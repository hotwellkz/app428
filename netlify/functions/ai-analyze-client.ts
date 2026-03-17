import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getAIApiKeyFromRequest } from './lib/aiAuth';

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

/** Грубое извлечение города без AI (падежи → именительный по словарю) */
function extractCityFallback(text: string): string | null {
  const t = text.replace(/\s+/g, ' ');
  const cityForms: Record<string, string> = {
    семее: 'Семей',
    семей: 'Семей',
    астане: 'Астана',
    астана: 'Астана',
    алматы: 'Алматы',
    алмаате: 'Алматы',
    шымкенте: 'Шымкент',
    шымкент: 'Шымкент',
    караганде: 'Караганда',
    караганда: 'Караганда',
    актобе: 'Актобе',
    павлодаре: 'Павлодар',
    павлодар: 'Павлодар',
    устькаменогорске: 'Усть-Каменогорск',
    костанае: 'Костанай',
    костанай: 'Костанай',
    таразе: 'Тараз',
    тараз: 'Тараз',
    атырау: 'Атырау',
    кызылорде: 'Кызылорда',
    кызылорда: 'Кызылорда',
    уральске: 'Уральск',
    петропавловске: 'Петропавловск',
  };
  const m = t.match(
    /(?:в|во|на|по|из)\s+([А-Яа-яЁёA-Za-z\-]+(?:\s+[А-Яа-яЁё]+)?)/i
  );
  if (!m?.[1]) return null;
  const raw = m[1].trim().toLowerCase().replace(/^г\.?\s*/i, '');
  return cityForms[raw] ?? (raw.length >= 3 ? m[1].trim().replace(/^./, (c) => c.toUpperCase()) : null);
}

function buildFallbackResult(messages: AiMessage[]) {
  const clientTexts = messages.filter((m) => m.role === 'client').map((m) => m.text);
  const combined = clientTexts.join(' ');
  const firstName = clientTexts.map(extractNameFromText).find(Boolean) ?? null;
  const city = extractCityFallback(combined);
  const comment = buildFallbackComment(messages);
  const areaM = combined.match(/(\d+)\s*(?:кв\.?\s*м|м²|м2|кв\s*м)/i);
  const areaSqm = areaM ? parseInt(areaM[1], 10) : null;
  const houseSummary =
    firstName || !areaM ? null : `Дом ~${areaM[1]}м²`;
  return {
    name: firstName,
    city,
    areaSqm: Number.isFinite(areaSqm) ? areaSqm : null,
    houseSummary: houseSummary || (firstName ? null : 'Лид из WhatsApp'),
    leadTitle: houseSummary || (firstName ? null : 'Лид из WhatsApp'),
    comment,
    houseType: null,
    floors: null,
    clientIntent: null,
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
      body: JSON.stringify({
        name: null,
        city: null,
        areaSqm: null,
        houseType: null,
        floors: null,
        houseSummary: null,
        leadTitle: null,
        clientIntent: null,
        comment: null,
      }),
    });
  }

  const systemPrompt =
    'Ты AI помощник CRM строительной компании (Казахстан/СНГ). Извлекай из переписки структурированные поля.\n\n' +
    'Поля JSON (все могут быть null):\n' +
    '- name: имя клиента только если сам представился (одно слово или имя+отчество кратко).\n' +
    '- city: город строительства/региона в ИМЕНИТЕЛЬНОМ падеже. Примеры: "в Семее"→"Семей", "в Астане"→"Астана". Если города нет — null.\n' +
    '- areaSqm: число кв.м дома если явно указано (80, 100.5), иначе null.\n' +
    '- houseType: тип дома одной фразой (SIP, каркас, каменный, модульный и т.п.) или null.\n' +
    '- floors: этажность (например "1", "2", "двухэтажный") или null.\n' +
    '- houseSummary: короткая строка типа дома + площадь: "Дом SIP ~80м²", "Дом ~100м²". Если только площадь — "Дом ~Nм²".\n' +
    '- leadTitle: дублируй houseSummary или краткий лид (для совместимости).\n' +
    '- clientIntent: кратко интерес/запрос клиента (узнать цену, построить дом, проект и т.п.) или null.\n' +
    '- comment: краткое описание запроса клиента для менеджера.\n\n' +
    'Не используй имя менеджера. Ответ только JSON: name, city, areaSqm, houseType, floors, houseSummary, leadTitle, clientIntent, comment.';

  const chatContext = {
    chatId,
    messages: messages.map((m) => ({
      role: m.role,
      text: m.text,
    })),
  };

  const userPrompt =
    'Переписка:\n' +
    JSON.stringify(chatContext, null, 2) +
    '\n\nВерни JSON:\n' +
    '{"name":null,"city":null,"areaSqm":null,"houseType":null,"floors":null,"houseSummary":null,"leadTitle":null,"clientIntent":null,"comment":null}\n' +
    'Заполни то, что можно извлечь. city в именительном падеже.';

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
        max_tokens: 280,
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
        body: JSON.stringify({
          name: null,
          city: null,
          areaSqm: null,
          houseType: null,
          floors: null,
          houseSummary: null,
          leadTitle: null,
          clientIntent: null,
          comment: null,
        }),
      });
    }

    const content = data.choices?.[0]?.message?.content ?? '';
    let parsed: {
      name?: string | null;
      city?: string | null;
      areaSqm?: number | null;
      houseType?: string | null;
      floors?: string | null;
      houseSummary?: string | null;
      leadTitle?: string | null;
      clientIntent?: string | null;
      comment?: string | null;
    } = {
      name: null,
      city: null,
      houseSummary: null,
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

    const str = (v: unknown) =>
      typeof v === 'string' ? v.trim() || null : v === null ? null : null;
    const numOrNull = (v: unknown) =>
      typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
    const name = str(parsed.name);
    const city = str(parsed.city);
    const areaSqm = numOrNull(parsed.areaSqm);
    const houseType = str(parsed.houseType);
    const floors = str(parsed.floors);
    const clientIntent = str(parsed.clientIntent);
    let houseSummary = str(parsed.houseSummary);
    const leadTitle =
      str(parsed.leadTitle) ||
      houseSummary ||
      (areaSqm != null ? `Дом ~${areaSqm}м²` : null);
    if (!houseSummary && leadTitle) houseSummary = leadTitle;

    const comment =
      typeof parsed.comment === 'string'
        ? parsed.comment.trim() || null
        : parsed.comment === null
          ? null
          : null;

    const out = {
      name,
      city,
      areaSqm,
      houseType,
      floors,
      houseSummary,
      leadTitle,
      clientIntent,
      comment,
    };
    log('Success:', out);
    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(out),
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

