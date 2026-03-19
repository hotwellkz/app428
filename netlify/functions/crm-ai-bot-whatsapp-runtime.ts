import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getAIApiKeyFromRequest } from './lib/aiAuth';
import { getDb } from './lib/firebaseAdmin';
import {
  buildCrmAiBotSystemPrompt,
  CRM_AI_BOT_WHATSAPP_RUNTIME_APPEND,
  type CrmAiBotPromptMeta
} from '../../src/lib/ai/crmAiBotPrompt';
import { parseCrmAiBotConfig, type CrmAiBotConfig } from '../../src/types/crmAiBotConfig';
import { buildCrmAiBotKnowledgeContext, type CrmAiBotKnowledgeMeta } from './lib/crmAiBotKnowledgeLoad';
import { runCrmAiBotExtraction } from './lib/crmAiBotExtractionOpenAi';
import type { CrmAiBotExtractionResult } from '../../src/types/crmAiBotExtraction';

const LOG_PREFIX = '[crm-ai-bot-whatsapp-runtime]';
const CRM_AI_BOTS = 'crmAiBots';
const WHATSAPP_CONVERSATIONS = 'whatsappConversations';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

function withCors(res: HandlerResponse): HandlerResponse {
  return { ...res, headers: { ...CORS_HEADERS, ...res.headers } };
}

function log(...args: unknown[]) {
  console.log(LOG_PREFIX, ...args);
}

interface ChatMessage {
  role?: string;
  content?: string;
}

interface RequestBody {
  botId?: string;
  conversationId?: string;
  messages?: ChatMessage[];
}

const MAX_MESSAGES = 40;
const MAX_CONTENT_LEN = 12000;

function lastUserContent(msgs: { role: 'user' | 'assistant'; content: string }[]): string {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'user') return msgs[i].content;
  }
  return '';
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return withCors({ statusCode: 204, headers: {}, body: '' });
  }

  if (event.httpMethod !== 'POST') {
    return withCors({
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    });
  }

  const auth = await getAIApiKeyFromRequest(event);
  if (!auth.ok) {
    return withCors({
      statusCode: auth.statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: auth.error })
    });
  }

  let body: RequestBody;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as RequestBody) ?? {};
  } catch {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON' })
    });
  }

  const botId = typeof body.botId === 'string' ? body.botId.trim() : '';
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
  if (!botId) {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Не указан botId' })
    });
  }
  if (!conversationId) {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Не указан conversationId' })
    });
  }

  const db = getDb();

  let convSnap;
  try {
    convSnap = await db.collection(WHATSAPP_CONVERSATIONS).doc(conversationId).get();
  } catch (e) {
    log('conversation read failed', e);
    return withCors({
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Не удалось проверить чат' })
    });
  }
  if (!convSnap.exists) {
    return withCors({
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Чат не найден' })
    });
  }
  const convCompany = (convSnap.data()?.companyId as string) || '';
  if (convCompany !== auth.companyId) {
    return withCors({
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Доступ к чату запрещён' })
    });
  }

  let botSnap;
  try {
    botSnap = await db.collection(CRM_AI_BOTS).doc(botId).get();
  } catch (e) {
    log('Firestore read failed', e);
    return withCors({
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Не удалось проверить бота' })
    });
  }

  if (!botSnap.exists) {
    return withCors({
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Бот не найден' })
    });
  }

  const botData = botSnap.data()!;
  const botCompany = (botData.companyId as string) || '';
  if (botCompany !== auth.companyId) {
    return withCors({
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Доступ к этому боту запрещён' })
    });
  }

  const status = (botData.status as string) || 'draft';
  if (status === 'archived') {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Бот в архиве, runtime отключён' })
    });
  }

  const botMeta: CrmAiBotPromptMeta = {
    name: String(botData.name ?? 'Бот').trim().slice(0, 200),
    description:
      typeof botData.description === 'string' ? botData.description.trim().slice(0, 2000) : null,
    botType: String(botData.botType ?? 'other'),
    channel: String(botData.channel ?? 'whatsapp')
  };

  const config: CrmAiBotConfig = parseCrmAiBotConfig(botData.config);

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  if (rawMessages.length === 0) {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Передайте историю сообщений (messages)' })
    });
  }

  const trimmed = rawMessages.slice(-MAX_MESSAGES);
  const openaiMessages: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of trimmed) {
    const role = m.role === 'user' || m.role === 'assistant' ? m.role : null;
    const content = typeof m.content === 'string' ? m.content.slice(0, MAX_CONTENT_LEN) : '';
    if (!role || !content.trim()) continue;
    openaiMessages.push({ role, content: content.trim() });
  }

  if (openaiMessages.length === 0) {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Нет валидных сообщений в истории' })
    });
  }

  const systemBase = buildCrmAiBotSystemPrompt(botMeta, config);

  let knowledgeMeta: CrmAiBotKnowledgeMeta = {
    companyKnowledgeBaseLoaded: false,
    quickRepliesLoaded: false,
    knowledgeArticlesUsed: 0,
    quickRepliesUsed: 0,
    truncated: false
  };

  let knowledgeAppend = '';
  const useKb = config.knowledge.useCompanyKnowledgeBase === true;
  const useQr = config.knowledge.useQuickReplies === true;

  if (useKb || useQr) {
    const lastUser = lastUserContent(openaiMessages);
    const { text, meta: km } = await buildCrmAiBotKnowledgeContext(db, auth.companyId, {
      useKb,
      useQr,
      lastUserMessage: lastUser || 'общий контекст'
    });
    knowledgeMeta = km;
    if (text.trim()) {
      knowledgeAppend = `

---
ФАКТЫ И ШАБЛОНЫ КОМПАНИИ (источник правды для стандартов; не задавай вопросы, ответ на которые уже явно дан здесь для типового случая; если клиент хочет нестандарт — уточняй отдельно)

${text}
`;
    }
  }

  const systemContent = `${systemBase}${knowledgeAppend}\n\n${CRM_AI_BOT_WHATSAPP_RUNTIME_APPEND}`;

  try {
    log('OpenAI whatsapp runtime botId=', botId, 'conv=', conversationId, 'msgs=', openaiMessages.length);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemContent }, ...openaiMessages],
        temperature: 0.5,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const textErr = await response.text();
      log('OpenAI error', response.status, textErr.slice(0, 400));
      return withCors({
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Не удалось получить ответ от модели', status: response.status })
      });
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
      usage?: unknown;
    };
    const answer = String(data.choices?.[0]?.message?.content ?? '').trim();

    let extracted: CrmAiBotExtractionResult | null = null;
    let extractionError: string | undefined;
    let extractUsage: unknown;

    const transcriptForExtract = [...openaiMessages, { role: 'assistant' as const, content: answer }];
    const ex = await runCrmAiBotExtraction(auth.apiKey, transcriptForExtract);
    if (ex.ok) {
      extracted = ex.extracted;
      extractUsage = ex.usage;
    } else {
      extractionError = ex.error;
      log('Extraction failed', ex.error);
    }

    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answer,
        extracted,
        extractionError,
        knowledgeMeta,
        usage: {
          answer: data.usage ?? null,
          extract: extractUsage ?? null
        }
      })
    });
  } catch (e) {
    log('Request failed', e);
    return withCors({
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Ошибка при обращении к OpenAI' })
    });
  }
};
