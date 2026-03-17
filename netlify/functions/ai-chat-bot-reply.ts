import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getAIApiKeyFromRequest } from './lib/aiAuth';

const LOG_PREFIX = '[ai-chat-bot-reply]';

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

interface AiMessage {
  role: 'client' | 'manager';
  text: string;
}

interface ChatBotReplyBody {
  messages?: AiMessage[];
  knowledgeBase?: Array<{ title?: string; content?: string; category?: string | null }>;
  quickReplies?: Array<{ title?: string; text?: string; keywords?: string; category?: string }>;
  /** Контекст клиента/чата для бота */
  clientContext?: {
    city?: string | null;
    comment?: string | null;
    dealStageName?: string | null;
    responsibleName?: string | null;
  };
}

const BOT_SYSTEM_PROMPT =
  'Ты — сильный менеджер по продажам строительной компании HotWell. Ты отвечаешь в чате кратко, уверенно и по делу.\n\n' +
  'Задача: помочь клиенту, ответить на вопрос, понять потребность, аккуратно собрать минимум нужных данных и при необходимости подвести к расчёту/КП через калькулятор CRM.\n\n' +
  'Правила:\n' +
  '- Не лей воду. Не пиши длинные шаблонные приветствия.\n' +
  '- Сначала отвечай на вопрос клиента.\n' +
  '- Задавай не более 1–2 уточняющих вопросов за раз.\n' +
  '- Не повторяй уже известные данные. Не придумывай факты, цены, сроки и параметры.\n' +
  '- Для расчёта используй только реальный калькулятор CRM (не выдумывай цифры).\n' +
  '- Если данных не хватает — уточняй только критично важное (площадь, город, этажность).\n' +
  '- Говори простым языком. Цель — продвинуть диалог к полезному результату: ответ, расчёт, КП, следующий шаг.\n' +
  '- Не спорить с клиентом, не давить, не быть навязчивым. Подводить к действию мягко.\n\n' +
  'Если диалог уже идёт — не начинай с приветствия. Отвечай сразу по сути. Ответь одним сообщением, без кавычек и пояснений.';

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
    log('AI key not available:', auth.error);
    return withCors({
      statusCode: auth.statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: auth.error })
    });
  }

  let body: ChatBotReplyBody;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as ChatBotReplyBody) ?? {};
  } catch (e) {
    log('Invalid JSON body:', e);
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON' })
    });
  }

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const messages = rawMessages
    .filter((m) => m && typeof m.text === 'string' && m.text.trim().length > 0)
    .slice(-20);
  const knowledgeBase = Array.isArray(body.knowledgeBase)
    ? body.knowledgeBase.filter((k) => k && typeof k.content === 'string' && (k.content ?? '').trim().length > 0)
    : [];
  const quickReplies = Array.isArray(body.quickReplies)
    ? body.quickReplies.filter((q) => q && ((q.text ?? '').trim().length > 0 || (q.title ?? '').trim().length > 0))
    : [];
  const ctx = body.clientContext ?? {};

  if (messages.length === 0) {
    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: '' })
    });
  }

  const lastClientMessage = messages.filter((m) => m.role === 'client').pop()?.text ?? messages[messages.length - 1]?.text ?? '';
  const contextParts: string[] = [
    'Переписка (client = клиент, manager = менеджер):\n' +
      JSON.stringify(messages.map((m) => ({ role: m.role, text: m.text })), null, 2)
  ];
  if (ctx.city || ctx.comment || ctx.dealStageName) {
    contextParts.push(
      'Контекст по клиенту/чату: ' +
        JSON.stringify({
          city: ctx.city ?? undefined,
          comment: ctx.comment ?? undefined,
          этап_сделки: ctx.dealStageName ?? undefined,
          ответственный: ctx.responsibleName ?? undefined
        })
    );
  }
  if (knowledgeBase.length > 0) {
    contextParts.push(
      'База знаний:\n' + JSON.stringify(knowledgeBase.map((k) => ({ title: k.title, content: (k.content ?? '').slice(0, 500) })), null, 2)
    );
  }
  if (quickReplies.length > 0) {
    contextParts.push(
      'Быстрые ответы (шаблоны):\n' + JSON.stringify(quickReplies.map((q) => ({ title: q.title, text: (q.text ?? '').slice(0, 400) })), null, 2)
    );
  }

  const userPrompt =
    'Последнее сообщение клиента (на него нужно ответить): "' +
    lastClientMessage.replace(/"/g, '\\"') +
    '"\n\n' +
    contextParts.join('\n\n') +
    '\n\nНапиши только текст ответа менеджера: коротко, по делу. Без кавычек и пояснений.';

  try {
    log('Calling OpenAI chat-bot-reply, messages=', messages.length);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: BOT_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.35,
        max_tokens: 320
      })
    });

    if (!response.ok) {
      const text = await response.text();
      log('OpenAI API error:', response.status, text);
      return withCors({
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'OpenAI API error', status: response.status })
      });
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
    const raw = (data.choices?.[0]?.message?.content ?? '') || '';
    const reply = String(raw).trim();

    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply })
    });
  } catch (e) {
    log('OpenAI request failed:', e);
    return withCors({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to generate reply', detail: String(e) })
    });
  }
};
