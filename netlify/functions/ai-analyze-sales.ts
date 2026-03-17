import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getAIApiKeyFromRequest } from './lib/aiAuth';

const LOG_PREFIX = '[ai-analyze-sales]';

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

interface AnalyzeSalesBody {
  chatId?: string;
  messages?: AiMessage[];
}

const LEAD_TEMPERATURE_VALUES = ['hot', 'warm', 'cold'] as const;
const LEAD_STAGE_VALUES = [
  'primary_interest',
  'need_quote',
  'send_proposal',
  'thinking',
  'meeting',
  'in_progress',
  'lost',
] as const;
const LEAD_INTENT_VALUES = [
  'build_house',
  'get_price',
  'compare_tech',
  'need_project',
  'mortgage_installment',
  'consultation',
] as const;

const SYSTEM_PROMPT = `Ты — сильный руководитель отдела продаж и эксперт по продажам в переписке.
Твоя задача: проанализировать диалог менеджера с клиентом и дать конкретный продажный разбор.
Оцени: качество ведения клиента, выявление потребности, работу с возражениями, структуру диалога, фиксацию следующего шага и вероятность продвижения сделки.

Отвечай СТРОГО в формате JSON с полями (все строки, списки — массивы строк):
- overallAssessment: краткая общая оценка (сильная / средняя / слабая переписка, шанс сделки: высокий / средний / низкий).
- strengths: массив — что менеджер сделал хорошо (конкретно, без воды).
- errors: массив — конкретные ошибки менеджера.
- missedOpportunities: массив — упущенные возможности (что можно было сделать лучше).
- clientSignals: массив — что клиент реально хочет, чего боится, на каком он этапе.
- recommendations: массив — что делать дальше (конкретные шаги).
- nextMessage: одна строка — готовый текст следующего сообщения клиенту, которое можно отправить от имени менеджера (практичный, продажный, ведущий к следующему шагу).
- badges: массив строк — необязательно, только если уместно: "riskLosingClient", "clientInterested", "noNextStep", "objectionNotHandled", "weakNeedDiscovery" (на английском, как в списке).

Классификация лида (по переписке, одно значение на поле; если неясно — выбери наиболее вероятное):
- leadTemperature: "hot" | "warm" | "cold" — температура лида (горячий / тёплый / холодный).
- leadStage: один из — "primary_interest" (первичный интерес), "need_quote" (нужен расчёт), "send_proposal" (отправить КП), "thinking" (думает), "meeting" (встреча), "in_progress" (в работе), "lost" (потерян).
- leadIntent: один из — "build_house" (строить дом), "get_price" (узнать цену), "compare_tech" (сравнить технологии), "need_project" (нужен проект), "mortgage_installment" (ипотека/рассрочка), "consultation" (консультация).

Стиль: уверенно и чётко, как сильный РОП. Без абстракций и "возможно стоит". Только конкретика для обучения и контроля продаж.`;

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

  let body: AnalyzeSalesBody;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as AnalyzeSalesBody) ?? {};
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
    .slice(-50);

  if (messages.length === 0) {
    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: null,
        overallAssessment: 'Недостаточно сообщений для анализа.',
        strengths: [],
        errors: [],
        missedOpportunities: [],
        clientSignals: [],
        recommendations: [],
        nextMessage: '',
        badges: [],
        leadTemperature: '',
        leadStage: '',
        leadIntent: '',
      }),
    });
  }

  const userPrompt =
    'Переписка (роль: client — клиент, manager — менеджер):\n' +
    JSON.stringify(
      messages.map((m) => ({ role: m.role, text: m.text })),
      null,
      2
    ) +
    '\n\nВерни один JSON-объект с полями: overallAssessment, strengths, errors, missedOpportunities, clientSignals, recommendations, nextMessage, badges, leadTemperature, leadStage, leadIntent.';

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
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      log('OpenAI API error:', response.status, responseText.slice(0, 500));
      return withCors({
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Ошибка AI. Попробуйте позже.',
          providerStatus: response.status,
        }),
      });
    }

    let data: { choices?: Array<{ message?: { content?: string } }> };
    try {
      data = JSON.parse(responseText) as typeof data;
    } catch (e) {
      log('OpenAI response not JSON:', e);
      return withCors({
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Некорректный ответ AI.' }),
      });
    }

    const content = data.choices?.[0]?.message?.content ?? '';
    let parsed: {
      overallAssessment?: string;
      strengths?: string[];
      errors?: string[];
      missedOpportunities?: string[];
      clientSignals?: string[];
      recommendations?: string[];
      nextMessage?: string;
      badges?: string[];
      leadTemperature?: string;
      leadStage?: string;
      leadIntent?: string;
    } = {};

    try {
      if (content.trim()) {
        parsed = JSON.parse(content) as typeof parsed;
      }
    } catch (e) {
      log('Failed to parse OpenAI JSON content:', e);
      return withCors({
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Не удалось разобрать ответ AI.' }),
      });
    }

    const arr = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x) => typeof x === 'string').map((x) => String(x).trim()).filter(Boolean) : [];
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const oneOf = (v: unknown, allowed: readonly string[]) =>
      typeof v === 'string' && allowed.includes(v) ? v : '';

    const result = {
      error: null as string | null,
      overallAssessment: str(parsed.overallAssessment) || 'Оценка не получена.',
      strengths: arr(parsed.strengths),
      errors: arr(parsed.errors),
      missedOpportunities: arr(parsed.missedOpportunities),
      clientSignals: arr(parsed.clientSignals),
      recommendations: arr(parsed.recommendations),
      nextMessage: str(parsed.nextMessage),
      badges: arr(parsed.badges),
      leadTemperature: oneOf(parsed.leadTemperature, LEAD_TEMPERATURE_VALUES),
      leadStage: oneOf(parsed.leadStage, LEAD_STAGE_VALUES),
      leadIntent: oneOf(parsed.leadIntent, LEAD_INTENT_VALUES),
    };

    log('Success, sections:', {
      overall: !!result.overallAssessment,
      strengths: result.strengths.length,
      errors: result.errors.length,
      nextMessage: !!result.nextMessage,
    });

    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
  } catch (e) {
    log('OpenAI request failed:', e);
    return withCors({
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Ошибка при обращении к AI. Попробуйте позже.' }),
    });
  }
};
