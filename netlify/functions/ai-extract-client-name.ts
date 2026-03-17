import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getAIApiKeyFromRequest } from './lib/aiAuth';

const LOG_PREFIX = '[ai-extract-client-name]';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function withCors(res: HandlerResponse): HandlerResponse {
  return { ...res, headers: { ...CORS_HEADERS, ...res.headers } };
}

function log(...args: unknown[]) {
  console.log(LOG_PREFIX, ...args);
}

interface AiMessage {
  role: 'client' | 'manager';
  text: string;
}

interface ExtractNameBody {
  chatId?: string;
  messages?: AiMessage[];
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return withCors({ statusCode: 204, headers: {}, body: '' });
  }

  if (event.httpMethod !== 'POST') {
    return withCors({
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    });
  }

  const auth = await getAIApiKeyFromRequest(event);
  if (!auth.ok) {
    log('AI key not available:', auth.error);
    return withCors({
      statusCode: auth.statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: auth.error }),
    });
  }
  const apiKey = auth.apiKey;

  let body: ExtractNameBody;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as ExtractNameBody) ?? {};
  } catch (e) {
    log('Invalid JSON body:', e);
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON' }),
    });
  }

  const chatId = (body.chatId ?? '').toString();
  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  if (!chatId || rawMessages.length === 0) {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'chatId and messages are required' }),
    });
  }

  const messages = rawMessages
    .filter((m) => m && typeof m.text === 'string' && m.text.trim().length > 0)
    .slice(-40);

  if (messages.length === 0) {
    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: null }),
    });
  }

  const systemPrompt =
    'Ты помощник CRM системы строительной компании. ' +
    'Твоя задача — определить имя клиента из переписки WhatsApp между клиентом и менеджером.\n\n' +
    'Правила:\n' +
    '1. Найди имя клиента, если он представился.\n' +
    '2. Не используй имя менеджера.\n' +
    '3. Если имя клиента не найдено — верни null.\n' +
    '4. Верни JSON строго в формате {"name": "Александр"} или {"name": null} без лишнего текста.\n';

  const chatContext = {
    chatId,
    messages: messages.map((m) => ({
      role: m.role,
      text: m.text,
    })),
  };

  const userContent =
    'Определи имя клиента на основе переписки ниже. ' +
    'Ответ верни строго как JSON с полем "name".\n\n' +
    JSON.stringify(chatContext, null, 2);

  try {
    log('Calling OpenAI for chatId', chatId, 'messages=', messages.length);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 64,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      log('OpenAI API error:', response.status, text);
      return withCors({
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'OpenAI API error', status: response.status }),
      });
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? '';
    let parsed: { name?: string | null } = { name: null };
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      log('Failed to parse OpenAI JSON content, returning null:', e);
    }

    const name =
      typeof parsed.name === 'string'
        ? parsed.name.trim() || null
        : parsed.name === null
        ? null
        : null;

    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  } catch (e) {
    log('OpenAI request failed:', e);
    return withCors({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to extract client name', detail: String(e) }),
    });
  }
};

