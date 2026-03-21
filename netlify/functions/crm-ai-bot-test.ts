import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getAIApiKeyFromRequest } from './lib/aiAuth';
import { getDb } from './lib/firebaseAdmin';
import {
  buildCrmAiBotSystemPrompt,
  CRM_AI_BOT_SANDBOX_SYSTEM_APPEND,
  type CrmAiBotPromptMeta
} from '../../src/lib/ai/crmAiBotPrompt';
import { parseCrmAiBotConfig, type CrmAiBotConfig } from '../../src/types/crmAiBotConfig';
import {
  buildCrmAiBotJsonReplyInstruction,
  crmAiReplyStyleMaxTokens,
  crmAiReplyStyleTemperature,
  parseCrmAiBotModelReplyJson
} from '../../src/lib/ai/crmAiBotReplyGeneration';
import { buildCrmAiBotKnowledgeContext, type CrmAiBotKnowledgeMeta } from './lib/crmAiBotKnowledgeLoad';
import { runCrmAiBotExtraction } from './lib/crmAiBotExtractionOpenAi';
import type { CrmAiBotExtractionResult } from '../../src/types/crmAiBotExtraction';

const LOG_PREFIX = '[crm-ai-bot-test]';
const CRM_AI_BOTS = 'crmAiBots';

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
  botMeta?: CrmAiBotPromptMeta;
  config?: unknown;
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
  if (!botId) {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Не указан botId' })
    });
  }

  const db = getDb();
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

  const botCompany = (botSnap.data()?.companyId as string) || '';
  if (botCompany !== auth.companyId) {
    return withCors({
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Доступ к этому боту запрещён' })
    });
  }

  const meta = body.botMeta;
  if (
    !meta ||
    typeof meta.name !== 'string' ||
    typeof meta.botType !== 'string' ||
    typeof meta.channel !== 'string'
  ) {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Некорректные метаданные бота (botMeta)' })
    });
  }

  const botMeta: CrmAiBotPromptMeta = {
    name: meta.name.trim().slice(0, 200),
    description: typeof meta.description === 'string' ? meta.description.trim().slice(0, 2000) : null,
    botType: meta.botType,
    channel: meta.channel
  };

  const config: CrmAiBotConfig = parseCrmAiBotConfig(body.config);

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

  const replyStyle = config.replyStyle;
  const jsonInstr = buildCrmAiBotJsonReplyInstruction(config);
  const systemContent = `${systemBase}${knowledgeAppend}\n\n${CRM_AI_BOT_SANDBOX_SYSTEM_APPEND}\n\n---\n${jsonInstr}`;

  try {
    log('OpenAI answer botId=', botId, 'messages=', openaiMessages.length, 'kb=', useKb, 'qr=', useQr);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemContent }, ...openaiMessages],
        response_format: { type: 'json_object' },
        temperature: crmAiReplyStyleTemperature(replyStyle),
        max_tokens: crmAiReplyStyleMaxTokens(replyStyle)
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
    const rawOut = String(data.choices?.[0]?.message?.content ?? '').trim();
    const parsed = parseCrmAiBotModelReplyJson(rawOut, replyStyle);
    const answer = parsed.combinedText.trim() || rawOut.trim();
    const answerParts = parsed.parts.length ? parsed.parts : answer ? [answer] : [];

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
        answerParts,
        replyMode: parsed.replyMode,
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
