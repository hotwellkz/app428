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

/** Извлечённые факты из сообщений (город, площадь, этажность) */
export interface ExtractedFacts {
  city?: string | null;
  area_m2?: number | null;
  floors?: number | null;
}

interface ChatBotReplyBody {
  messages?: AiMessage[];
  knowledgeBase?: Array<{ title?: string; content?: string; category?: string | null }>;
  quickReplies?: Array<{ title?: string; text?: string; keywords?: string; category?: string }>;
  /** Контекст клиента/чата для бота (известные город, площадь, этажность + CRM) */
  clientContext?: {
    city?: string | null;
    area_m2?: number | null;
    floors?: number | null;
    comment?: string | null;
    dealStageName?: string | null;
    responsibleName?: string | null;
  };
}

/** Алиасы городов: нормализация к каноническому названию */
const CITY_ALIASES: Record<string, string> = {
  алматы: 'Алматы',
  алмата: 'Алматы',
  'г алматы': 'Алматы',
  'г. алматы': 'Алматы',
  'в алматы': 'Алматы',
  астана: 'Астана',
  'в астане': 'Астана',
  'г астана': 'Астана',
  'г. астана': 'Астана',
  актобе: 'Актобе',
  'в актобе': 'Актобе',
  шымкент: 'Шымкент',
  караганда: 'Караганда',
  'в караганде': 'Караганда',
  павлодар: 'Павлодар',
  усть: 'Усть-Каменогорск',
  'усть-каменогорск': 'Усть-Каменогорск',
  семей: 'Семей',
  семипалатинск: 'Семей',
  уральск: 'Уральск',
  костанай: 'Костанай',
  петропавловск: 'Петропавловск',
  тараз: 'Тараз',
  атырау: 'Атырау',
  актау: 'Актау',
  туркестан: 'Туркестан'
};

function normalizeCityFromText(raw: string): string | null {
  const t = (raw ?? '').trim().toLowerCase().replace(/^\s*г\.?\s*/i, '').trim();
  if (!t) return null;
  const canonical = CITY_ALIASES[t] ?? CITY_ALIASES[t.replace(/\s+/g, ' ')];
  if (canonical) return canonical;
  const firstUpper = t.charAt(0).toUpperCase() + t.slice(1);
  return firstUpper;
}

/**
 * Извлечь город, площадь, этажность из одного текста сообщения (текст или ASR-транскрипт).
 */
function extractClientFacts(text: string): Partial<ExtractedFacts> {
  const out: Partial<ExtractedFacts> = {};
  if (!text || typeof text !== 'string') return out;
  const lower = text.toLowerCase();

  for (const [alias, city] of Object.entries(CITY_ALIASES)) {
    const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text) || lower.includes(alias)) {
      out.city = city;
      break;
    }
  }
  if (!out.city) {
    const cityMatch = text.match(/\b(алматы|астана|актобе|шымкент|караганда|павлодар|семей|уральск|костанай|тараз|атырау|актау|туркестан)\b/i);
    if (cityMatch) out.city = normalizeCityFromText(cityMatch[1]) ?? cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1).toLowerCase();
  }

  const areaMatch = text.match(/(\d{1,4})\s*(м²|м2|кв\.?\s*м|квадрат|кв\.?м|м\s*²)/i) ?? text.match(/(\d{1,4})\s*(?:квадрат\w*|кв\.?\s*м)/i) ?? text.match(/(?:площад\w*|дом\s+)(?:в\s+)?(\d{1,4})/i) ?? text.match(/(\d{1,4})\s*(?:кв|м²|м2)/i);
  if (areaMatch) {
    const n = parseInt(areaMatch[1], 10);
    if (Number.isFinite(n) && n >= 20 && n <= 2000) out.area_m2 = n;
  }
  const numOnlyArea = text.match(/\b(\d{2,4})\s*(?=м|кв|квадрат|этаж|этажа|этажей)/i);
  if (!out.area_m2 && numOnlyArea) {
    const n = parseInt(numOnlyArea[1], 10);
    if (Number.isFinite(n) && n >= 20 && n <= 2000) out.area_m2 = n;
  }

  if (/\b(одноэтаж|1\s*этаж|один\s*этаж|одним\s*этаж|одно\s*этаж)\b/i.test(text)) out.floors = 1;
  else if (/\b(двухэтаж|2\s*этаж|два\s*этаж|двумя\s*этаж|два\s*этажа)\b/i.test(text)) out.floors = 2;
  else if (/\b(1|один)\s*этаж\w*\b/i.test(text)) out.floors = 1;
  else if (/\b(2|два)\s*этаж\w*\b/i.test(text)) out.floors = 2;

  return out;
}

/** Форматирование суммы для ответа клиенту (пробелы между разрядами). */
function formatTotalPrice(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Ответ клиенту на основе результата реального калькулятора (не выдумывать цену). */
function formatEstimateReply(facts: ExtractedFacts, totalPrice: number): string {
  const area = facts.area_m2 ?? 0;
  const floors = facts.floors ?? 1;
  const city = facts.city ?? '—';
  const sum = formatTotalPrice(totalPrice);
  return (
    'Сделала предварительный расчёт по вашему дому.\n\n' +
    `Площадь: ${area} м²\nЭтажность: ${floors}\nГород строительства: ${city}\n\n` +
    `По текущим параметрам ориентировочная стоимость составляет:\n${sum} ₸\n\n` +
    'В расчёт заложено:\n' +
    '— фундамент: Ж/Б стандартный\n— стены: SIP-163 мм\n— перегородки: стандартные\n— крыша: двускатная\n— форма дома: простая\n\n' +
    'Если хотите, могу подготовить точное коммерческое предложение и назначить встречу.'
  );
}

/** Сообщение при недоступности калькулятора (не показывать выдуманную цену). */
const FALLBACK_ESTIMATE_REPLY =
  'Я собрала основные параметры, но сейчас не удалось автоматически получить расчёт. Могу передать данные менеджеру для точного коммерческого предложения.';

const BOT_SYSTEM_PROMPT = `Ты — Юля, менеджер строительной компании HotWell.kz. Обрабатываешь первичные заявки в чате.

ГЛАВНЫЙ ПРИНЦИП:
— Задавай вопросы ПО ОДНОМУ, никогда списком.
— Перед каждым вопросом проверь переписку: нет ли этой информации уже в сообщениях клиента. Если есть — вопрос не задавай.

ЦЕЛЬ: получить 3 параметра для расчёта дома (по порядку):
1. город строительства
2. площадь дома (м²)
3. этажность (1 или 2)

---

ПЕРВОЕ СООБЩЕНИЕ БОТА (когда клиент только написал приветствие или первый запрос)

Ответь строго в таком формате (сначала представиться, кратко о компании, затем один вопрос):

"Здравствуйте! Меня зовут Юля, я менеджер строительной компании HotWell.kz.

Мы строим энергоэффективные дома из SIP-панелей по всему Казахстану.

Подскажите, пожалуйста, в каком городе планируется строительство?"

Не добавляй других вопросов в первое сообщение. Только представление + вопрос про город.

---

ИЗВЛЕЧЕНИЕ ИЗ СООБЩЕНИЯ

Умей вытаскивать данные из текста клиента. Примеры:
— "100м2 Алматы" → площадь 100, город Алматы
— "Дом 120 квадратов один этаж" → площадь 120, этажность 1
— "Алматы 2 этажа 150" → город Алматы, этажность 2, площадь 150
— числа с м², кв.м, квадратов → площадь
— названия городов (Алматы, Астана, и т.д.) → город
— один/одноэтажный/1 этаж → этажность 1; два/двухэтажный/2 этажа → этажность 2

Если данные найдены в сообщении — не спрашивай про них, переходи к следующему недостающему параметру или к расчёту.

---

ДАЛЬНЕЙШИЕ ВОПРОСЫ (только один за раз)

ШАГ 1. Если город неизвестен — спроси: "Подскажите, пожалуйста, в каком городе планируется строительство?"

ШАГ 2. Если площадь неизвестна — спроси: "Примерная площадь дома какая планируется? (м²)"

ШАГ 3. Если этажность неизвестна — спроси: "Дом планируется одноэтажный или двухэтажный?"

В одном сообщении — только один вопрос.

---

СТАНДАРТНЫЕ ПАРАМЕТРЫ (НЕ спрашивать, использовать автоматически)

— Фундамент: железобетонный 40 см
— Стены: SIP панели 163 мм
— Перегородки: стандартные
— Перекрытие: стандартное
— Форма дома: простая
— Кровля: металлочерепица, по умолчанию двускатная

Высота этажей:
— площадь ≤ 100 м² → 2,5 м
— площадь > 100 м², 2 этажа → 1 этаж 2,8 м, 2 этаж 2,5 м
— площадь > 100 м², 1 этаж → 2,8 м

---

КРЫША

Можно один раз спросить (если ещё не уточнено): "Крышу планируете двускатную или четырехскатную?"
Если клиент не ответил — стандарт: двускатная.

---

КОГДА ПОЛУЧЕНЫ ВСЕ ТРИ: город, площадь, этажность

Расчёт стоимости делается на бэкенде по реальному калькулятору. Ты НЕ придумывай сумму и не пиши расчёт сам.
Если в контексте уже есть все три параметра — бэкенд вернёт готовый ответ с суммой. Иначе задай следующий недостающий вопрос.

---

ПОСЛЕ РАСЧЁТА — ВСТРЕЧА

Напиши: "Можем обсудить проект подробнее и сделать точный расчет. Удобно будет подъехать к нам в офис или встретиться на участке?"

---

СТИЛЬ: коротко, по делу, один вопрос за раз. Отвечай одним сообщением. Без кавычек. Только текст ответа.`;

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
      body: JSON.stringify({ reply: '', extractedFacts: null })
    });
  }

  const lastClientMessage = messages.filter((m) => m.role === 'client').pop()?.text ?? messages[messages.length - 1]?.text ?? '';
  const clientMessages = messages.filter((m) => m.role === 'client');
  const extractedFromDialogue: ExtractedFacts = {};
  for (const m of clientMessages) {
    const one = extractClientFacts(m.text);
    if (one.city) extractedFromDialogue.city = one.city;
    if (one.area_m2 != null) extractedFromDialogue.area_m2 = one.area_m2;
    if (one.floors != null) extractedFromDialogue.floors = one.floors;
  }
  const mergedFacts: ExtractedFacts = {
    city: ctx.city ?? extractedFromDialogue.city ?? null,
    area_m2: ctx.area_m2 ?? extractedFromDialogue.area_m2 ?? null,
    floors: ctx.floors ?? extractedFromDialogue.floors ?? null
  };

  if (process.env.NODE_ENV !== 'production' || process.env.DEBUG) {
    log('rawMessages=', rawMessages.length, 'normalizedCount=', messages.length, 'lastClientText=', lastClientMessage.slice(0, 80));
    log('extractedFromDialogue=', JSON.stringify(extractedFromDialogue), 'mergedFacts=', JSON.stringify(mergedFacts));
  }

  const hasAllForEstimate =
    mergedFacts.city &&
    String(mergedFacts.city).trim() &&
    typeof mergedFacts.area_m2 === 'number' &&
    mergedFacts.area_m2 >= 10 &&
    mergedFacts.area_m2 <= 1500 &&
    (mergedFacts.floors === 1 || mergedFacts.floors === 2 || mergedFacts.floors === 3);

  if (hasAllForEstimate) {
    const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'http://localhost:8888';
    const calculatorUrl = `${baseUrl.replace(/\/$/, '')}/.netlify/functions/calculator-estimate`;
    try {
      const calcRes = await fetch(calculatorUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          areaM2: mergedFacts.area_m2,
          floorsCount: (mergedFacts.floors ?? 1) as 1 | 2 | 3,
          deliveryCity: mergedFacts.city ?? ''
        })
      });
      const calcData = (await calcRes.json().catch(() => ({}))) as { totalPrice?: number; error?: string };
      if (calcRes.ok && typeof calcData.totalPrice === 'number' && calcData.totalPrice > 0) {
        const reply = formatEstimateReply(mergedFacts, calcData.totalPrice);
        if (process.env.NODE_ENV !== 'production' || process.env.DEBUG) {
          log('replyMode=calculator_result', 'totalPrice=', calcData.totalPrice);
        }
        return withCors({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reply, extractedFacts: mergedFacts })
        });
      }
      log('Calculator unavailable or invalid response', calcRes.status, calcData.error);
    } catch (e) {
      log('Calculator request failed', e);
    }
    const reply = FALLBACK_ESTIMATE_REPLY;
    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply, extractedFacts: mergedFacts })
    });
  }

  const contextParts: string[] = [
    'Переписка (client = клиент, manager = менеджер):\n' +
      JSON.stringify(messages.map((m) => ({ role: m.role, text: m.text })), null, 2)
  ];
  contextParts.push(
    'ИЗВЕСТНЫЕ ДАННЫЕ (уже есть, НЕ СПРАШИВАЙ повторно): ' +
      JSON.stringify({
        город: mergedFacts.city ?? 'не указан',
        площадь_м2: mergedFacts.area_m2 ?? 'не указана',
        этажность: mergedFacts.floors ?? 'не указана'
      }) +
      '\nЗапрещено задавать вопрос про параметр, который уже указан выше.'
  );
  if (ctx.comment || ctx.dealStageName) {
    contextParts.push(
      'Контекст по клиенту/чату: ' +
        JSON.stringify({
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
        temperature: 0.3,
        max_tokens: 520
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

    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG) {
      log('nextReplyLength=', reply.length, 'extractedFacts=', JSON.stringify(mergedFacts));
    }

    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply, extractedFacts: mergedFacts })
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
