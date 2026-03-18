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

export type DialogStage = 'city' | 'area' | 'floors' | 'roof' | 'calculation' | 'finish';

/** Извлечённые факты из сообщений (город, площадь, этажность, тип крыши) */
export interface ExtractedFacts {
  city?: string | null;
  area_m2?: number | null;
  floors?: number | null;
  roofType?: string | null;
  stage?: DialogStage | null;
}

interface ChatBotReplyBody {
  messages?: AiMessage[];
  knowledgeBase?: Array<{ title?: string; content?: string; category?: string | null }>;
  quickReplies?: Array<{ title?: string; text?: string; keywords?: string; category?: string }>;
  /** Контекст клиента/чата для бота (state machine: город, площадь, этажность, крыша, этап) */
  clientContext?: {
    city?: string | null;
    area_m2?: number | null;
    floors?: number | null;
    roofType?: string | null;
    stage?: DialogStage | null;
    comment?: string | null;
    dealStageName?: string | null;
    responsibleName?: string | null;
  };
}

/** Фразы сброса диалога — начать расчёт заново */
const RESET_PHRASES = /новый расчет|другой дом|посчитать другой вариант|заново|сначала/i;

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

/** Нормализация типа крыши из текста */
function parseRoofType(text: string): string | null {
  const t = (text ?? '').trim().toLowerCase();
  if (/\b(двускатн|два\s*ската|2\s*ската|двухскатн)\w*/i.test(t)) return 'двускатная';
  if (/\b(четырехскатн|четырёхскатн|четыре\s*ската|4\s*ската)\w*/i.test(t)) return 'четырехскатная';
  return null;
}

/**
 * Извлечь город, площадь, этажность, тип крыши из одного текста сообщения (текст или ASR-транскрипт).
 * Учитывает короткие ответы: "Алматы", "100", "1", "2", "двускатная".
 */
function extractClientFacts(text: string): Partial<ExtractedFacts> {
  const out: Partial<ExtractedFacts> = {};
  if (!text || typeof text !== 'string') return out;
  const lower = text.toLowerCase();
  const trimmed = text.trim();

  // Город: по алиасам и по отдельным словам
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
  // Короткий ответ — только название города (одно слово)
  if (!out.city && /^[а-яё\s\-]+$/i.test(trimmed) && trimmed.length >= 3 && trimmed.length <= 30) {
    const asCity = normalizeCityFromText(trimmed);
    if (asCity) out.city = asCity;
  }

  // Площадь: с единицами и короткое число 20–2000
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
  // Короткий ответ — только число (площадь)
  if (!out.area_m2 && /^\s*\d{2,4}\s*$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    if (Number.isFinite(n) && n >= 20 && n <= 2000) out.area_m2 = n;
  }

  // Этажность
  if (/\b(одноэтаж|1\s*этаж|один\s*этаж|одним\s*этаж|одно\s*этаж)\b/i.test(text)) out.floors = 1;
  else if (/\b(двухэтаж|2\s*этаж|два\s*этаж|двумя\s*этаж|два\s*этажа)\b/i.test(text)) out.floors = 2;
  else if (/\b(1|один)\s*этаж\w*\b/i.test(text)) out.floors = 1;
  else if (/\b(2|два)\s*этаж\w*\b/i.test(text)) out.floors = 2;
  // Короткий ответ — только 1 или 2
  if (out.floors == null && /^\s*[12]\s*$/.test(trimmed)) out.floors = parseInt(trimmed, 10) as 1 | 2;

  // Тип крыши
  const roof = parseRoofType(text);
  if (roof) out.roofType = roof;

  return out;
}

/** Форматирование суммы для ответа клиенту (пробелы между разрядами). */
function formatTotalPrice(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Финальное сообщение с расчётом (один раз). Формат как у менеджера. */
function formatEstimateReply(facts: ExtractedFacts, totalPrice: number): string {
  const area = facts.area_m2 ?? 0;
  const floors = facts.floors ?? 1;
  const city = facts.city ?? '—';
  const roofType = facts.roofType ?? 'двускатная';
  const sum = formatTotalPrice(totalPrice);
  return (
    'Сделала предварительный расчет дома:\n\n' +
    `Площадь: ${area} м²\nЭтажность: ${floors}\nГород: ${city}\nКрыша: ${roofType}\n\n` +
    `Ориентировочная стоимость: ${sum} ₸\n\n` +
    'Можем обсудить проект подробнее и сделать точный расчет.\n\n' +
    'Удобно будет подъехать к нам в офис или встретиться на участке?'
  );
}

/** Сообщение при недоступности калькулятора (не показывать выдуманную цену). */
const FALLBACK_ESTIMATE_REPLY =
  'Я собрала основные параметры, но сейчас не удалось автоматически получить расчёт. Могу передать данные менеджеру для точного коммерческого предложения.';

/** Определить текущий этап по заполненным полям (следующий незаполненный). */
function getNextStage(facts: ExtractedFacts): DialogStage {
  if (!facts.city || String(facts.city).trim() === '') return 'city';
  if (facts.area_m2 == null || facts.area_m2 < 20 || facts.area_m2 > 2000) return 'area';
  if (facts.floors != 1 && facts.floors != 2) return 'floors';
  if (!facts.roofType || String(facts.roofType).trim() === '') return 'roof';
  return 'calculation';
}

/** Есть ли все четыре параметра для финального расчёта. */
function hasAllParams(facts: ExtractedFacts): boolean {
  return (
    !!(facts.city && String(facts.city).trim()) &&
    typeof facts.area_m2 === 'number' &&
    facts.area_m2 >= 20 &&
    facts.area_m2 <= 2000 &&
    (facts.floors === 1 || facts.floors === 2) &&
    !!(facts.roofType && String(facts.roofType).trim())
  );
}

const GREETING_AND_CITY =
  'Здравствуйте! Меня зовут Юля, я менеджер строительной компании HotWell.kz.\n\nМы строим энергоэффективные дома из SIP-панелей по всему Казахстану.\n\nПодскажите, пожалуйста, в каком городе планируется строительство?';

const QUESTIONS: Record<Exclude<DialogStage, 'calculation' | 'finish'>, string> = {
  city: 'Подскажите, пожалуйста, в каком городе планируется строительство?',
  area: 'Примерная площадь дома какая планируется? (м²)',
  floors: 'Дом планируется одноэтажный или двухэтажный?',
  roof: 'Крышу планируете двускатную или четырехскатную?'
};

/** Один вопрос по текущему этапу. Финальное сообщение не задаём — только этапы city…roof. */
function getNextQuestion(facts: ExtractedFacts, isFirstMessage: boolean): string {
  const stage = getNextStage(facts);
  if (stage === 'city' && isFirstMessage) return GREETING_AND_CITY;
  return QUESTIONS[stage] ?? QUESTIONS.city;
}

/** Короткий ответ после финального расчёта (финал отправляется только один раз). */
const AFTER_FINISH_REPLY = 'Чем ещё могу помочь? Если нужен новый расчёт — напишите «новый расчёт».';

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
  const clientCount = clientMessages.length;

  // Сброс диалога по фразам «новый расчёт», «другой дом» и т.п.
  const isReset = RESET_PHRASES.test(lastClientMessage);
  if (isReset) {
    const reply = 'Хорошо, начнём заново. ' + QUESTIONS.city;
    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reply,
        extractedFacts: { stage: 'city' as DialogStage }
      })
    });
  }

  const extractedFromDialogue: ExtractedFacts = {};
  for (const m of clientMessages) {
    const one = extractClientFacts(m.text);
    if (one.city) extractedFromDialogue.city = one.city;
    if (one.area_m2 != null) extractedFromDialogue.area_m2 = one.area_m2;
    if (one.floors != null) extractedFromDialogue.floors = one.floors;
    if (one.roofType) extractedFromDialogue.roofType = one.roofType;
  }
  const mergedFacts: ExtractedFacts = {
    city: ctx.city ?? extractedFromDialogue.city ?? null,
    area_m2: ctx.area_m2 ?? extractedFromDialogue.area_m2 ?? null,
    floors: ctx.floors ?? extractedFromDialogue.floors ?? null,
    roofType: ctx.roofType ?? extractedFromDialogue.roofType ?? null,
    stage: ctx.stage ?? getNextStage({
      city: ctx.city ?? extractedFromDialogue.city ?? null,
      area_m2: ctx.area_m2 ?? extractedFromDialogue.area_m2 ?? null,
      floors: ctx.floors ?? extractedFromDialogue.floors ?? null,
      roofType: ctx.roofType ?? extractedFromDialogue.roofType ?? null
    })
  };

  if (process.env.NODE_ENV !== 'production' || process.env.DEBUG) {
    log('rawMessages=', rawMessages.length, 'mergedFacts=', JSON.stringify(mergedFacts));
  }

  // Финальное сообщение только один раз: если уже finish — короткий ответ
  if (mergedFacts.stage === 'finish') {
    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: AFTER_FINISH_REPLY, extractedFacts: { ...mergedFacts, stage: 'finish' } })
    });
  }

  const hasAllForEstimate = hasAllParams(mergedFacts);

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
          body: JSON.stringify({ reply, extractedFacts: { ...mergedFacts, stage: 'finish' } })
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
      body: JSON.stringify({ reply, extractedFacts: { ...mergedFacts, stage: 'finish' } })
    });
  }

  // Детерминированный вопрос по state machine: не спрашивать то, что уже известно
  const nextStage = getNextStage(mergedFacts);
  const isFirstMessage = clientCount === 1 && !ctx.city && !ctx.area_m2 && !ctx.floors && !ctx.roofType;
  const reply = getNextQuestion(mergedFacts, isFirstMessage);
  return withCors({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reply,
      extractedFacts: { ...mergedFacts, stage: nextStage }
    })
  });
};
