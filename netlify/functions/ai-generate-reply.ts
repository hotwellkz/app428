import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';

const LOG_PREFIX = '[ai-generate-reply]';

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

type Role = 'client' | 'manager';
type Mode = 'normal' | 'short' | 'close';

interface AiMessage {
  role: Role;
  text: string;
}

interface GenerateReplyBody {
  messages?: AiMessage[];
  mode?: Mode;
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    log('Missing OPENAI_API_KEY');
    return withCors({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'OpenAI API key is not configured' })
    });
  }

  let body: GenerateReplyBody;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as GenerateReplyBody) ?? {};
  } catch (e) {
    log('Invalid JSON body:', e);
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON' })
    });
  }

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const mode: Mode = body.mode === 'short' || body.mode === 'close' ? body.mode : 'normal';

  const messages = rawMessages
    .filter((m) => m && typeof m.text === 'string' && m.text.trim().length > 0)
    .slice(-15);

  if (messages.length === 0) {
    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: '' })
    });
  }

  const systemPrompt =
    'Ты профессиональный менеджер по продажам строительной компании HotWell.\n' +
    'Компания:\n' +
    '- Строительство домов из SIP-панелей\n' +
    '- Работаем по всему Казахстану\n' +
    '- С 2012 года\n' +
    '- Построено более 700 домов\n\n' +
    'Ты отвечаешь клиентам в WhatsApp.\n\n' +
    'Общие правила ответов:\n' +
    '1. Пиши коротко.\n' +
    '2. Пиши простым разговорным стилем.\n' +
    '3. Максимум 2–4 короткие строки.\n' +
    '4. Не пиши длинные полотна текста.\n' +
    '5. Отвечай как живой менеджер, а не как робот.\n' +
    '6. Помогай продать, но без агрессии.\n' +
    '7. Можно задавать уточняющие вопросы.\n' +
    '8. Не используй сложные формулировки.\n' +
    '9. Пиши удобно для чтения в мессенджере (короткие фразы, переносы).\n\n' +
    'Ты всегда отвечаешь одним сообщением без лишних пояснений.';

  const modeInstructions =
    mode === 'short'
      ? 'Режим: очень короткий ответ (mode = "short").\n' +
        '- Дай максимально короткий ответ: 1–2 предложения.\n' +
        '- Без лишних вводных и длинных объяснений.\n'
      : mode === 'close'
      ? 'Режим: продвинуть клиента дальше по воронке (mode = "close").\n' +
        '- Ответ должен мягко подталкивать клиента к следующему шагу:\n' +
        '  • предложи расчёт стоимости, или\n' +
        '  • предложи обсудить проект, или\n' +
        '  • предложи созвониться / оставить номер, или\n' +
        '  • уточни ключевые параметры дома (площадь, этажность, бюджет и т.п.).\n' +
        '- Всё равно оставайся коротким (до 3–4 строк).\n'
      : 'Режим: обычный ответ (mode = "normal").\n' +
        '- Дай понятный ответ на вопрос клиента.\n' +
        '- Можно задать 1–2 уточняющих вопроса.\n' +
        '- Коротко, по делу.\n';

  const userPrompt =
    'Вот переписка между клиентом и менеджером (client = клиент, manager = менеджер):\n\n' +
    JSON.stringify(
      messages.map((m) => ({ role: m.role, text: m.text })),
      null,
      2
    ) +
    '\n\n' +
    'Текущий режим: ' +
    mode +
    '.\n' +
    modeInstructions +
    '\nНапиши только текст ответа менеджера без дополнительных комментариев и без кавычек вокруг всего сообщения.';

  try {
    log('Calling OpenAI generate-reply, messages=', messages.length, 'mode=', mode);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
        max_tokens: 256
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

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
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

