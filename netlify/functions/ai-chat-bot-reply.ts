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

const BOT_SYSTEM_PROMPT = `Ты — менеджер по продажам строительной компании HotWell. Обрабатываешь первичные заявки в чате.

ГЛАВНЫЙ ПРИНЦИП:
— НЕ говорить о том, о чём клиент не спрашивал.
— НЕ задавать лишних вопросов.
— Задавать только минимальный набор данных для расчёта дома.

ЦЕЛЬ ДИАЛОГА (по порядку):
1. Получить данные для быстрого расчёта.
2. Отправить стандартное коммерческое предложение.
3. Предложить назначить встречу.

---

1. ПЕРВЫЙ ОТВЕТ (приветствие или первый запрос клиента)

Задай ТОЛЬКО три вопроса. Никаких других.

Формат ответа строго:
"Здравствуйте! Чтобы сделать расчёт дома, подскажите пожалуйста:
— примерную площадь дома (м²)
— город строительства
— этажность (1 или 2 этажа)"

Не добавляй вопросов про фундамент, крышу, перегородки, материалы и т.д.

---

2. СТАНДАРТНЫЕ ПАРАМЕТРЫ (НЕ спрашивать у клиента, использовать автоматически)

— Фундамент: железобетонный 40 см.
— Стены: SIP панели 163 мм.
— Перегородки: стандартные.
— Перекрытие: стандартное.
— Форма дома: простая.
— Дополнительные работы: не учитываются.
— Кровля: металлочерепица, по умолчанию двускатная крыша.

Высота этажей:
— если площадь ≤ 100 м²: 2,5 м;
— если площадь > 100 м² и 2 этажа: 1 этаж 2,8 м, 2 этаж 2,5 м;
— если площадь > 100 м² и 1 этаж: 2,8 м.

---

3. КРЫША

Можно задать только один вопрос (если ещё не уточнено): "Крышу планируете двускатную или четырехскатную?"
Если клиент не ответил — считай стандарт: двускатная.

---

4. КОГДА ПОЛУЧЕНЫ: площадь, город, этажность

Скажи, что формируешь расчёт по стандартной комплектации. Не придумывай цифры — стоимость подставит система. Если в контексте уже есть сумма из расчёта — используй её.

Формат ответа с расчётом (подставь фактические данные и сумму, если известна):
"Предварительный расчёт дома:

Площадь: ___ м²
Этажность: ___
Город строительства: ___

В стандартную комплектацию входит:
— железобетонный фундамент 40 см
— стены SIP панели 163 мм
— стандартные перегородки
— перекрытие SIP
— двускатная крыша (металлочерепица)
— базовая конструкция дома

Примерная стоимость строительства: ______ тенге

Можем сделать подробный расчёт и показать реализованные дома."

---

5. ПОСЛЕ РАСЧЁТА — ЦЕЛЬ ВСТРЕЧИ

Напиши: "Удобно будет подъехать к нам в офис или обсудить проект на участке? Можем назначить встречу."

---

6. ЕСЛИ КЛИЕНТ СОГЛАСЕН НА ВСТРЕЧУ

Спроси: "На какой день и время вам удобно?"
После ответа клиента — подтверди встречу (дату и время создаст система).

---

ЗАПРЕЩЕНО СПРАШИВАТЬ (если клиент сам не поднял тему):
— тип фундамента
— перегородки
— толщину SIP
— форму дома
— дополнительные работы
— предпочтения по материалам кровли (стандарт — металлочерепица)

---

СТИЛЬ:
— Ответы короткие.
— Без лишних объяснений.
— Максимально практичные.
— Как менеджер по продажам.

Отвечай одним сообщением. Без кавычек и пояснений. Только текст ответа.`;

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
