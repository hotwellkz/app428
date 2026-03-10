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
  knowledgeBase?: Array<{
    title?: string;
    content?: string;
    category?: string | null;
  }>;
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
  const knowledgeBase = Array.isArray(body.knowledgeBase)
    ? body.knowledgeBase.filter(
        (k) => k && typeof k.content === 'string' && (k.content ?? '').trim().length > 0
      )
    : [];

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
    'Ты AI-агент компании HotWell — отвечаешь клиентам в чате по строительству домов из SIP-панелей.\n\n' +
    'ГЛАВНОЕ ПРАВИЛО: ВСЕГДА в первую очередь опирайся на базу знаний. Перед ответом сначала ищи подходящую информацию в базе знаний и только потом формируй ответ. Не придумывай факты, которых нет в базе знаний.\n\n' +
    'Цель: дать понятный и вежливый ответ, не перегружать клиента, аккуратно довести до бесплатного расчёта дома.\n\n' +
    'ВОПРОСЫ:\n' +
    '- НЕ задавай сразу много вопросов подряд. Запрещено отправлять список из 5–6 вопросов.\n' +
    '- Задавай вопросы ПОЭТАПНО: одно сообщение = один основной вопрос, иногда максимум два коротких вопроса.\n' +
    '- Поэтапная цепочка: 1) город или наличие участка → 2) площадь дома → 3) этажность → 4) тип крыши → 5) сроки → 6) при необходимости форма дома или высота этажа. Когда данные собраны: "Отлично, спасибо 🙌 На основе этой информации мы можем сделать для вас бесплатный расчёт стоимости дома."\n\n' +
    'ПЕРВЫЙ ОТВЕТ (если клиент написал "Здравствуйте", "Хотел узнать о строительстве", "Интересует дом" и т.п.):\n' +
    '- Поздороваться, коротко ответить по теме (мы строим дома из SIP-панелей — быстро, тёпло, надёжно; можем сделать бесплатный расчёт).\n' +
    '- Задать только 1 вопрос: например "Подскажите, вы из какого города?" или "Скажите, у вас уже есть участок?"\n' +
    '- Пример: "Здравствуйте! Спасибо за обращение в HotWell 🙌 Мы строим дома из SIP-панелей и можем сделать бесплатный расчёт. Скажите, у вас уже есть участок?"\n\n' +
    'ЕСЛИ КЛИЕНТ ЗАДАЁТ КОНКРЕТНЫЙ ВОПРОС (цена, что входит, рассрочка и т.д.):\n' +
    '- Сначала ответь по сути, используя базу знаний.\n' +
    '- Потом задай один уточняющий вопрос и подведи к расчёту.\n\n' +
    'СТИЛЬ: вежливо, просто, не длинно, без перегруза, как живой менеджер. Эмодзи умеренно: 🙌 👍 🏡\n\n' +
    'ЗАПРЕЩЕНО: задавать много вопросов одним сообщением, отвечать без опоры на базу знаний, придумывать информацию, писать длинные полотна, давить на клиента.\n\n' +
    'Отвечай одним сообщением без кавычек и пояснений.';

  const modeInstructions =
    mode === 'short'
      ? 'Режим: очень короткий ответ. 1–2 предложения, без лишнего.\n'
      : mode === 'close'
      ? 'Режим: мягко подтолкни к следующему шагу (расчёт, уточнение параметров, созвон). Один вопрос или одно предложение. Коротко.\n'
      : 'Режим: обычный ответ. Ответь по делу, задай не более одного (максимум двух коротких) уточняющих вопроса. Коротко.\n';

  const kbSection =
    knowledgeBase.length > 0
      ? '\n\nБАЗА ЗНАНИЙ (обязательно используй в первую очередь для ответа):\n' +
        JSON.stringify(
          knowledgeBase.map((k) => ({
            title: k.title ?? '',
            category: k.category ?? '',
            content: k.content ?? ''
          })),
          null,
          2
        ) +
        '\n\nСначала найди в базе знаний ответ на вопрос клиента. Отвечай только на основе этих данных. Если информации нет — честно скажи, что уточнят менеджеры, или предложи связаться.'
      : '\n\nБаза знаний пуста. Отвечай в рамках общих сведений о строительстве из SIP-панелей и HotWell. Не придумывай конкретные цифры и условия — предлагай уточнить у менеджера.';

  const userPrompt =
    'Переписка (client = клиент, manager = менеджер):\n\n' +
    JSON.stringify(
      messages.map((m) => ({ role: m.role, text: m.text })),
      null,
      2
    ) +
    kbSection +
    '\n\nРежим: ' +
    mode +
    '. ' +
    modeInstructions +
    'Напиши только текст ответа менеджера: вежливо, коротко, с опорой на базу знаний; не более одного основного вопроса в сообщении. Без кавычек и пояснений.';

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

