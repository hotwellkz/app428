import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getAIApiKeyFromRequest } from './lib/aiAuth';
import { getDb } from './lib/firebaseAdmin';
import {
  buildCrmAiBotSystemPrompt,
  CRM_AI_BOT_SANDBOX_SYSTEM_APPEND,
  type CrmAiBotPromptMeta
} from '../../src/lib/ai/crmAiBotPrompt';
import { parseCrmAiBotConfig, type CrmAiBotConfig } from '../../src/types/crmAiBotConfig';

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
  const systemContent = `${systemBase}\n\n${CRM_AI_BOT_SANDBOX_SYSTEM_APPEND}`;

  try {
    log('OpenAI call botId=', botId, 'messages=', openaiMessages.length);
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
      const text = await response.text();
      log('OpenAI error', response.status, text.slice(0, 400));
      return withCors({
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Не удалось получить ответ от модели', status: response.status })
      });
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
      usage?: { total_tokens?: number };
    };
    const answer = String(data.choices?.[0]?.message?.content ?? '').trim();

    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answer,
        usage: data.usage ?? null
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
