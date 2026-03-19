import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getAIApiKeyFromRequest } from './lib/aiAuth';
import {
  capIncomingMessagesForReply,
  compactMessagesForAiReply,
  MAX_INCOMING_MESSAGES,
  type AiReplyMessage
} from './lib/buildAiReplyContext';

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

interface QuickReplyInput {
  id?: string;
  title?: string;
  text?: string;
  keywords?: string;
  category?: string;
}

/** Необязательный контекст из CRM для генерации ответа */
interface CrmContextInput {
  clientName?: string;
  city?: string;
  dealTitle?: string;
  dealStageName?: string;
  dealResponsibleName?: string;
  kaspiOrderNumber?: string;
  kaspiOrderStatus?: string;
  kaspiOrderAmount?: number;
}

interface GenerateReplyBody {
  messages?: AiMessage[];
  mode?: Mode;
  knowledgeBase?: Array<{
    title?: string;
    content?: string;
    category?: string | null;
  }>;
  quickReplies?: QuickReplyInput[];
  crmContext?: CrmContextInput;
}

/** Нормализация для сравнения: нижний регистр, лишние пробелы убраны. */
function normalize(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Слова из строки (кириллица + латиница + цифры). */
function getWords(s: string): string[] {
  return normalize(s)
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Оценка релевантности быстрого ответа последнему сообщению клиента.
 * Возвращает 0..1: >0.8 — сильное совпадение, 0.5–0.8 — вспомогательный, <0.5 — не использовать.
 */
function scoreQuickReply(clientMessage: string, q: QuickReplyInput): number {
  const msg = normalize(clientMessage);
  const msgWords = getWords(msg);
  if (msgWords.length === 0) return 0;

  const title = normalize((q.title ?? '').trim());
  const keywordsStr = (q.keywords ?? '').trim();
  const keywords = keywordsStr
    .split(/[,;]/)
    .map((k) => normalize(k.trim()))
    .filter((k) => k.length > 0);
  const text = normalize((q.text ?? '').trim());

  let score = 0;

  // Совпадение по названию
  if (title.length > 0) {
    if (msg.includes(title) || title.includes(msg)) score += 0.45;
    else {
      const titleWords = getWords(title);
      const matchTitle = titleWords.filter((w) => w.length > 1 && msg.includes(w)).length;
      if (matchTitle > 0) score += 0.25 * Math.min(matchTitle / Math.max(titleWords.length, 1), 1);
    }
  }

  // Совпадение по ключевым словам
  for (const kw of keywords) {
    if (kw.length < 2) continue;
    if (msg.includes(kw) || msgWords.some((w) => w.includes(kw) || kw.includes(w))) {
      score += 0.35;
      break;
    }
  }

  // Совпадение по тексту шаблона (общие слова)
  if (text.length > 0) {
    const textWords = getWords(text);
    const matchText = msgWords.filter((w) => w.length > 1 && textWords.some((tw) => tw.includes(w) || w.includes(tw))).length;
    if (matchText > 0) score += 0.2 * Math.min(matchText / Math.min(msgWords.length, 5), 1);
  }

  return Math.min(score, 1);
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
    log('AI key not available:', auth.error);
    return withCors({
      statusCode: auth.statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: auth.error })
    });
  }
  const apiKey = auth.apiKey;

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
  const quickRepliesRaw = Array.isArray(body.quickReplies) ? body.quickReplies : [];
  const quickReplies = quickRepliesRaw.filter(
    (q) => q && typeof (q.title ?? q.text ?? '') === 'string' && ((q.text ?? '').trim().length > 0 || (q.title ?? '').trim().length > 0)
  );

  const cleaned: AiReplyMessage[] = rawMessages
    .filter(
      (m) =>
        m &&
        typeof m.text === 'string' &&
        m.text.trim().length > 0 &&
        (m.role === 'client' || m.role === 'manager')
    )
    .map((m) => ({
      role: m.role === 'manager' ? ('manager' as const) : ('client' as const),
      text: m.text.trim()
    }));

  const capped = capIncomingMessagesForReply(cleaned, MAX_INCOMING_MESSAGES);
  const compacted = compactMessagesForAiReply(capped);
  const messages = compacted.messages;

  if (messages.length === 0) {
    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: '' })
    });
  }

  const lastClientMessage = messages
    .filter((m) => m.role === 'client')
    .map((m) => m.text)
    .pop();
  const clientMessageForContext = lastClientMessage ?? messages[messages.length - 1]?.text ?? '';

  type ScoredQuickReply = QuickReplyInput & { _score: number };
  const scoredQuickReplies: ScoredQuickReply[] = quickReplies.map((q) => ({
    ...q,
    _score: scoreQuickReply(clientMessageForContext, q)
  }));
  const matchedQuickReplies = scoredQuickReplies
    .filter((q) => q._score >= 0.5)
    .sort((a, b) => b._score - a._score)
    .slice(0, 5);

  const hasStrongQuickMatch = matchedQuickReplies.length > 0 && matchedQuickReplies[0]._score > 0.8;

  const systemPrompt =
    'Ты AI-агент компании HotWell — отвечаешь клиентам в чате по строительству домов из SIP-панелей.\n\n' +
    'ИСТОЧНИКИ ОТВЕТА (в порядке приоритета):\n' +
    '1) Быстрые ответы (шаблоны) — если подходящий шаблон найден, используй его формулировку как основу. Не переписывай своими словами, если шаблон уже хорошо подходит.\n' +
    '2) AI-база знаний — факты и уточнения. Используй только то, что есть в базе. Не придумывай.\n' +
    '3) Общая логика — только если шаблонов и фактов мало: коротко, предложи уточнить у менеджера или задать один вопрос.\n\n' +
    'ПРАВИЛА:\n' +
    '- Если в контексте есть подходящий БЫСТРЫЙ ОТВЕТ с высоким совпадением — возьми его текст за основу. Можно слегка адаптировать под вопрос (обращение, одно слово), но не меняй суть.\n' +
    '- Если подходящих быстрых ответов несколько — выбери один самый релевантный или аккуратно объедини не более двух. Не вставляй длинные простыни.\n' +
    '- База знаний — только для уточнения фактов (адрес, часы работы, рассрочка, что входит). Не фантазируй.\n' +
    '- Стиль: коротко, уверенно, доброжелательно, по делу. Как опытный менеджер HotWell. Без лишней воды и без «умных» фраз.\n\n' +
    'ПРИВЕТСТВИЯ И ВСТУПЛЕНИЯ:\n' +
    '- Если диалог уже идёт (в переписке уже было приветствие от менеджера или общение продолжается) — НЕ начинай ответ с приветствия. Не пиши «Здравствуйте», «Добрый день», «Спасибо за обращение» и подобное повторно. Отвечай сразу по сути.\n' +
    '- Приветствие уместно только при первом контакте, длинном перерыве или явном новом заходе клиента. Во всех остальных случаях — сразу к делу.\n' +
    '- Не повторяй благодарности без причины, не пиши шаблонные вступления в каждом сообщении. Если клиент задал конкретный вопрос — сразу отвечай на него.\n\n' +
    'ВОПРОСЫ К КЛИЕНТУ:\n' +
    '- НЕ задавай много вопросов подряд. Одно сообщение — один основной вопрос (максимум два коротких).\n' +
    '- Цепочка: город/участок → площадь → этажность → тип крыши → сроки. Потом: "Отлично, спасибо 🙌 Можем сделать бесплатный расчёт."\n\n' +
    'ПЕРВЫЙ ОТВЕТ (действительно первое сообщение в диалоге): поздороваться, одно предложение о SIP-домах и бесплатном расчёте, один вопрос (город/участок).\n\n' +
    'ЗАПРЕЩЕНО: придумывать информацию, писать длинные тексты, задавать 5–6 вопросов сразу, давить на клиента, повторять приветствия в уже идущем диалоге.\n\n' +
    'КОНТЕКСТ ПЕРЕПИСКИ: в промпте может быть начало диалога и последние сообщения; если указано что часть середины пропущена — всё равно опирайся на то, что есть, и на блок CRM. Не повторяй вопросы, если в переписке уже есть ответы клиента. Если обсуждали расчёт/КП/встречу — не игнорируй это.\n\n' +
    'Ответь одним сообщением. Без кавычек и пояснений.';

  const modeInstructions =
    mode === 'short'
      ? 'Режим: очень короткий ответ. 1–2 предложения, без лишнего.\n'
      : mode === 'close'
      ? 'Режим: мягко подтолкни к следующему шагу (расчёт, уточнение параметров, созвон). Один вопрос или одно предложение. Коротко.\n'
      : 'Режим: обычный ответ. Ответь по делу, задай не более одного (максимум двух коротких) уточняющих вопроса. Коротко.\n';

  const quickRepliesSection =
    matchedQuickReplies.length > 0
      ? '\n\nБЫСТРЫЕ ОТВЕТЫ (шаблоны менеджеров — приоритет над базой знаний). Число после title — релевантность запросу клиента (0.8+ = брать за основу):\n' +
        JSON.stringify(
          matchedQuickReplies.map((q) => ({
            title: (q.title ?? '').trim(),
            score: Math.round(q._score * 100) / 100,
            text: (q.text ?? '').trim().slice(0, 800)
          })),
          null,
          2
        ) +
        (hasStrongQuickMatch
          ? '\n\nВыбран шаблон с высокой релевантностью. Используй его текст как основу ответа; можно слегка адаптировать под вопрос клиента.'
          : '\n\nИспользуй подходящие шаблоны как вспомогательную формулировку, комбинируй с базой знаний.')
      : '';

  const kbSection =
    knowledgeBase.length > 0
      ? '\n\nБАЗА ЗНАНИЙ (факты для уточнения; не придумывай того, чего нет):\n' +
        JSON.stringify(
          knowledgeBase.map((k) => ({
            title: k.title ?? '',
            category: k.category ?? '',
            content: (k.content ?? '').trim().slice(0, 600)
          })),
          null,
          2
        )
      : '';

  let contextNotes = '';
  if (compacted.omittedMiddleCount > 0) {
    contextNotes +=
      `В длинной переписке не показана середина: пропущено ${compacted.omittedMiddleCount} сообщений; в контексте — начало диалога и последние реплики.\n`;
  }
  if (compacted.trimmedForBudget) {
    contextNotes +=
      'Отдельные сообщения могли быть укорочены по объёму в рамках лимита контекста.\n';
  }

  const crmRaw = body.crmContext;
  let crmSection = '';
  if (crmRaw && typeof crmRaw === 'object') {
    const crmObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(crmRaw)) {
      if (v == null) continue;
      const s = typeof v === 'string' ? v.trim() : v;
      if (s === '' || s === undefined) continue;
      crmObj[k] = v;
    }
    if (Object.keys(crmObj).length > 0) {
      crmSection =
        '\n\nДАННЫЕ ИЗ CRM (факты; не придумывай того, чего здесь нет):\n' +
        JSON.stringify(crmObj, null, 2);
    }
  }

  const userPrompt =
    (contextNotes ? contextNotes + '\n' : '') +
    'Последнее сообщение клиента (на него нужно ответить): "' +
    clientMessageForContext +
    '"\n\nПереписка (client = клиент, manager = менеджер):\n' +
    JSON.stringify(
      messages.map((m) => ({ role: m.role, text: m.text })),
      null,
      2
    ) +
    quickRepliesSection +
    kbSection +
    crmSection +
    '\n\nРежим: ' +
    mode +
    '. ' +
    modeInstructions +
    'Напиши только текст ответа менеджера: коротко, по делу, с опорой на быстрые ответы и базу знаний. Без кавычек и пояснений.';

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

    const debug =
      matchedQuickReplies.length > 0 || knowledgeBase.length > 0
        ? {
            matchedQuickReplies: matchedQuickReplies.map((q) => ({
              title: (q.title ?? '').trim(),
              score: Math.round(q._score * 100) / 100,
              textPreview: ((q.text ?? '').trim().slice(0, 120) + (((q.text ?? '').trim().length > 120 ? '…' : '')))
            })),
            matchedKnowledgeBase: knowledgeBase.map((k) => ({ title: (k.title ?? '').trim(), category: (k.category ?? '').trim() })),
            chosenTemplate: hasStrongQuickMatch && matchedQuickReplies[0] ? (matchedQuickReplies[0].title ?? '').trim() : null
          }
        : undefined;

    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(debug ? { reply, debug } : { reply })
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

