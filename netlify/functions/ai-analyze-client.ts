import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';

const LOG_PREFIX = '[ai-analyze-client]';

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

interface AnalyzeClientBody {
  chatId?: string;
  messages?: AiMessage[];
}

function extractNameFromText(text: string): string | null {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  const patterns = [
    /(?:меня зовут|я\s+[-–—]?\s*)([А-ЯA-ZЁ][а-яa-zё]{1,20})/i,
    /(?:это|имя)\s*[:\-]?\s*([А-ЯA-ZЁ][а-яa-zё]{1,20})/i,
    /\b([А-ЯA-ZЁ][а-яa-zё]{1,20})\b/,
  ];

  for (const p of patterns) {
    const m = normalized.match(p);
    const candidate = m?.[1]?.trim();
    if (!candidate) continue;
    if (['Здравствуйте', 'Добрый', 'Доброе', 'Привет'].includes(candidate)) continue;
    return candidate;
  }
  return null;
}

function buildFallbackComment(messages: AiMessage[]): string {
  const clientTexts = messages
    .filter((m) => m.role === 'client')
    .map((m) => m.text.trim())
    .filter(Boolean)
    .slice(-5);

  if (clientTexts.length === 0) {
    return 'Клиент написал в WhatsApp. Требуется уточнение параметров объекта и запроса.';
  }

  const combined = clientTexts.join(' ').replace(/\s+/g, ' ').trim();
  const short = combined.length > 280 ? `${combined.slice(0, 277)}…` : combined;
  return `Запрос клиента: ${short}`;
}

function buildFallbackResult(messages: AiMessage[]) {
  const clientTexts = messages.filter((m) => m.role === 'client').map((m) => m.text);
  const firstName = clientTexts.map(extractNameFromText).find(Boolean) ?? null;
  const comment = buildFallbackComment(messages);
  return {
    name: firstName,
    leadTitle: firstName ? null : 'Лид из WhatsApp',
    comment,
  };
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

  const apiKey = process.env.OPENAI_API_KEY;

  let body: AnalyzeClientBody;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as AnalyzeClientBody) ?? {};
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
    .slice(-30);

  if (messages.length === 0) {
    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: null, leadTitle: null, comment: null }),
    });
  }

  if (!apiKey) {
    const fallback = buildFallbackResult(messages);
    log('Missing OPENAI_API_KEY, returning fallback result');
    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fallback, fallback: true }),
    });
  }

  const systemPrompt =
    'Ты AI помощник CRM строительной компании.\n' +
    'Твоя задача:\n' +
    '1) найти имя клиента, если он представился;\n' +
    '2) если имени нет — придумать короткое и понятное название лида (leadTitle) по контексту переписки;\n' +
    '3) составить краткий полезный комментарий для менеджеров.\n\n' +
    'Правила:\n' +
    '- имя клиента бери только если он сам его назвал;\n' +
    '- не используй имя менеджера;\n' +
    '- если имя клиента отсутствует, сгенерируй leadTitle на основе типа объекта, площади, размеров, материала и т.п.;\n' +
    '- leadTitle должен быть максимально коротким и понятным, например: "Дом SIP ~170м²", "Дом 12.5×35", "Каркас 30м²", "Баня ~40м²", "Дом 2 этажа ~140м²";\n' +
    '- комментарий должен быть коротким, но информативным;\n' +
    '- ответ верни строго в формате JSON с полями name, leadTitle и comment.\n';

  const chatContext = {
    chatId,
    messages: messages.map((m) => ({
      role: m.role,
      text: m.text,
    })),
  };

  const userPrompt =
    'Вот переписка:\n\n' +
    JSON.stringify(chatContext, null, 2) +
    '\n\nОпредели:\n' +
    '1) имя клиента (если он представился);\n' +
    '2) если имени нет — короткое название лида leadTitle (по объекту, площади, материалу и т.п.);\n' +
    '3) краткий комментарий о клиенте для CRM.\n\n' +
    'Ответ:\n{\n' +
    '"name": "Александр",\n' +
    '"leadTitle": "Дом SIP ~170м²",\n' +
    '"comment": "Интересуется строительством дома из SIP панелей около 170 м². Спрашивает стоимость панелей, монтаж и вентиляцию."\n' +
    '}\n';

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
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 160,
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      log('OpenAI API error:', response.status, responseText.slice(0, 500));
      const fallback = buildFallbackResult(messages);
      return withCors({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fallback,
          fallback: true,
          providerError: {
            status: response.status,
            detail: responseText.slice(0, 200),
          },
        }),
      });
    }

    let data: { choices?: Array<{ message?: { content?: string } }> };
    try {
      data = JSON.parse(responseText) as typeof data;
    } catch (e) {
      log('OpenAI response not JSON:', e);
      return withCors({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: null, leadTitle: null, comment: null }),
      });
    }

    const content = data.choices?.[0]?.message?.content ?? '';
    let parsed: { name?: string | null; leadTitle?: string | null; comment?: string | null } = {
      name: null,
      leadTitle: null,
      comment: null,
    };
    try {
      if (content.trim()) {
        parsed = JSON.parse(content) as typeof parsed;
      }
    } catch (e) {
      log('Failed to parse OpenAI JSON content, returning nulls:', e);
    }

    const name =
      typeof parsed.name === 'string'
        ? parsed.name.trim() || null
        : parsed.name === null
          ? null
          : null;

    const leadTitle =
      typeof parsed.leadTitle === 'string'
        ? parsed.leadTitle.trim() || null
        : parsed.leadTitle === null
          ? null
          : null;

    const comment =
      typeof parsed.comment === 'string'
        ? parsed.comment.trim() || null
        : parsed.comment === null
          ? null
          : null;

    log('Success:', { name, leadTitle, comment });
    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, leadTitle, comment }),
    });
  } catch (e) {
    log('OpenAI request failed:', e);
    const fallback = buildFallbackResult(messages);
    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...fallback,
        fallback: true,
        providerError: String(e),
      }),
    });
  }
};

