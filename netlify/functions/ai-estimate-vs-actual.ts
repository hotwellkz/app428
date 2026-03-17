import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getAIApiKeyFromRequest } from './lib/aiAuth';

const LOG_PREFIX = '[ai-estimate-vs-actual]';

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

interface EstimateSummary {
  foundation?: number;
  sipWalls?: number;
  roof?: number;
  floor?: number;
  partitions?: number;
  consumables?: number;
  additionalWorks?: number;
  builderSalary?: number;
  operationalExpenses?: number;
  grandTotal?: number;
}

/** Одна строка сметы для позиционного сравнения */
interface EstimateLineItemInput {
  section: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  total: number;
}

interface TransactionInput {
  id: string;
  amount: number;
  description?: string;
  type?: string;
  date?: string;
  waybillNumber?: string;
  waybillData?: {
    documentNumber?: string;
    project?: string;
    note?: string;
    items?: Array<{ product?: { name?: string }; quantity?: number; price?: number }>;
  };
  attachmentNames?: string[];
}

interface Body {
  companyId?: string;
  clientId: string;
  clientName?: string;
  estimateSummary: EstimateSummary;
  /** Позиции сметы построчно — при наличии включается позиционный анализ */
  estimateLineItems?: EstimateLineItemInput[];
  transactions: TransactionInput[];
}

const LEGACY_SYSTEM_PROMPT = `Ты — эксперт по контролю смет и фактических расходов в строительных проектах (CRM 2wix, Казахстан).
Тебе даны: 1) плановая смета по разделам; 2) список фактических транзакций по проекту.

Задача: сравнить план и факт по разделам, выявить перерасход и экономию, выделить неучтённые траты, дать рекомендации.

Отвечай СТРОГО в формате JSON с полями:
- summary: { totalEstimate, totalActual, difference, differencePercent, verdict ("over"|"under"|"match"), summaryText }
- byCategory: массив { categoryName, estimate, actual, difference, confidence ("high"|"medium"|"low"), note }
- unclassifiedExpenses: массив { transactionId, amount, description, reason }
- suspicious: массив { transactionId, amount, description, reason }
- recommendations: массив строк`;

const POSITIONAL_SYSTEM_PROMPT = `Ты — эксперт по контролю смет и фактических расходов в строительных проектах (CRM 2wix, Казахстан).

Тебе даны:
1) Смета ПО ПОЗИЦИЯМ: каждая строка — наименование, раздел, единица, план (кол-во, цена, сумма).
2) Фактические транзакции: id, сумма, комментарий, тип, дата, waybillData (номера, товары в накладной), названия вложений.

ГЛАВНАЯ ЗАДАЧА: провести ПОЗИЦИОННОЕ сопоставление. Для КАЖДОЙ строки сметы попытаться определить:
- сколько по факту куплено/потрачено (кол-во и сумма), если можно вывести из транзакций/накладных/комментариев;
- отклонение от плана (по сумме, по возможности по кол-ву и цене);
- статус: "ok" (в норме), "overrun" (перерасход), "savings" (экономия), "no_fact" (нет подтверждённого факта), "ambiguous" (недостаточно данных, нужна проверка).

Транзакции, которые НЕ удалось привязать ни к одной строке сметы — верни в outsideEstimate (расходы вне сметы).

Отвечай СТРОГО в формате JSON с полями:
- summary: { totalEstimate (число), totalActual (число), difference (факт минус смета), differencePercent, verdict ("over"|"under"|"match"), summaryText (2-3 предложения) }
- lineItems: массив объектов по КАЖДОЙ строке сметы:
  { name (строка), section (строка), planQty (число), planPrice (число), planSum (число), factQty (число или null), factSum (число или null), deviation (число: факт минус план), deviationQty (если можно), deviationPrice (если можно), status ("ok"|"overrun"|"savings"|"no_fact"|"ambiguous"), comment (кратко), confidence ("high"|"medium"|"low"), transactionIds (массив id транзакций, отнесённых к этой позиции) }
  Порядок lineItems должен соответствовать порядку переданных строк сметы. Если по позиции нет данных в транзакциях — factQty/factSum = null, status = "no_fact" или "ambiguous", comment объясни.
- outsideEstimate: массив { transactionId, amount, description, reason } — транзакции, не привязанные ни к одной строке сметы.
- recommendations: массив строк — что перепроверить, где риск, где возможная ошибка учёта.

Важно: не выдумывать факт. Если по строке сметы нет однозначных данных в транзакциях — status "no_fact" или "ambiguous", confidence "low".`;

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

  let body: Body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as Body) ?? {};
  } catch (e) {
    log('Invalid JSON body:', e);
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON' }),
    });
  }

  const clientId = (body.clientId ?? '').toString();
  const estimateSummary = body.estimateSummary ?? {};
  const estimateLineItems = Array.isArray(body.estimateLineItems) ? body.estimateLineItems : [];
  const transactions = Array.isArray(body.transactions) ? body.transactions : [];

  if (!clientId) {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'clientId is required' }),
    });
  }

  const usePositional = estimateLineItems.length > 0;
  const systemPrompt = usePositional ? POSITIONAL_SYSTEM_PROMPT : LEGACY_SYSTEM_PROMPT;

  const transactionsPayload = transactions.map((t) => ({
    id: t.id,
    amount: t.amount,
    description: t.description || '',
    type: t.type,
    date: t.date,
    waybillNumber: t.waybillNumber,
    waybillData: t.waybillData,
    attachmentNames: t.attachmentNames,
  }));

  const userPrompt = usePositional
    ? `Проект/клиент: ${body.clientName ?? clientId}\n\n` +
      `Смета по позициям (раздел, наименование, ед., кол-во, цена, сумма):\n${JSON.stringify(
        estimateLineItems.map((it) => ({
          section: it.section,
          name: it.name,
          unit: it.unit,
          quantity: it.quantity,
          price: it.price,
          total: it.total,
        })),
        null,
        2
      )}\n\n` +
      `Фактические транзакции:\n${JSON.stringify(transactionsPayload, null, 2)}\n\n` +
      `Верни один JSON-объект с полями: summary, lineItems (для каждой позиции сметы в том же порядке), outsideEstimate, recommendations.`
    : `Проект/клиент: ${body.clientName ?? clientId}\n\n` +
      `Плановая смета (по разделам, в тенге):\n${JSON.stringify(estimateSummary, null, 2)}\n\n` +
      `Фактические транзакции:\n${JSON.stringify(transactionsPayload, null, 2)}\n\n` +
      `Верни один JSON-объект с полями: summary, byCategory, unclassifiedExpenses, suspicious, recommendations.`;

  try {
    log('Calling OpenAI for clientId', clientId, 'positional=', usePositional, 'transactions=', transactions.length);
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
        temperature: 0.2,
        max_tokens: 6000,
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
          details: response.status,
        }),
      });
    }

    let data: { choices?: Array<{ message?: { content?: string } }> };
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      log('OpenAI response not JSON:', e);
      return withCors({
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Некорректный ответ AI.' }),
      });
    }

    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return withCors({
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Пустой ответ AI.' }),
      });
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    let report: Record<string, unknown>;
    try {
      report = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch (e) {
      log('Failed to parse OpenAI JSON content:', e);
      return withCors({
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Не удалось разобрать ответ AI.' }),
      });
    }

    if (usePositional && Array.isArray(report.lineItems)) {
      const totalEstimate = estimateLineItems.reduce((s, i) => s + (Number(i.total) || 0), 0);
      const totalActual = transactions.reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const difference = totalActual - totalEstimate;
      const differencePercent = totalEstimate ? (difference / totalEstimate) * 100 : 0;
      const verdict = difference > 0 ? 'over' : difference < 0 ? 'under' : 'match';
      if (!report.summary || typeof report.summary !== 'object') {
        report.summary = {
          totalEstimate,
          totalActual,
          difference,
          differencePercent,
          verdict,
          summaryText: (report.summary as { summaryText?: string })?.summaryText ?? '',
        };
      } else {
        const s = report.summary as Record<string, unknown>;
        if (typeof s.totalEstimate !== 'number') s.totalEstimate = totalEstimate;
        if (typeof s.totalActual !== 'number') s.totalActual = totalActual;
        if (typeof s.difference !== 'number') s.difference = difference;
        if (typeof s.differencePercent !== 'number') s.differencePercent = differencePercent;
        if (!s.verdict) s.verdict = verdict;
      }
      report.lineItems = (report.lineItems as unknown[]).map((row: unknown, idx: number) => {
        const r = (row as Record<string, unknown>) ?? {};
        const plan = estimateLineItems[idx];
        const planSum = plan ? Number(plan.total) || 0 : Number(r.planSum) || 0;
        const planQty = plan ? Number(plan.quantity) ?? Number(r.planQty) : Number(r.planQty);
        const planPrice = plan ? Number(plan.price) ?? Number(r.planPrice) : Number(r.planPrice);
        let status = String(r.status ?? 'ambiguous').toLowerCase();
        if (!['ok', 'overrun', 'savings', 'no_fact', 'ambiguous'].includes(status)) status = 'ambiguous';
        return {
          name: String(r.name ?? plan?.name ?? ''),
          section: r.section ?? plan?.section ?? '',
          planQty: Number.isFinite(planQty) ? planQty : undefined,
          planPrice: Number.isFinite(planPrice) ? planPrice : undefined,
          planSum,
          factQty: r.factQty != null && Number.isFinite(Number(r.factQty)) ? Number(r.factQty) : null,
          factSum: r.factSum != null && Number.isFinite(Number(r.factSum)) ? Number(r.factSum) : null,
          deviation: r.deviation != null && Number.isFinite(Number(r.deviation)) ? Number(r.deviation) : null,
          deviationQty: r.deviationQty != null && Number.isFinite(Number(r.deviationQty)) ? Number(r.deviationQty) : null,
          deviationPrice: r.deviationPrice != null && Number.isFinite(Number(r.deviationPrice)) ? Number(r.deviationPrice) : null,
          status,
          comment: r.comment != null ? String(r.comment) : undefined,
          confidence: ['high', 'medium', 'low'].includes(String(r.confidence)) ? r.confidence : 'medium',
          transactionIds: Array.isArray(r.transactionIds) ? r.transactionIds.map(String) : undefined,
        };
      });
      if (!Array.isArray(report.outsideEstimate)) report.outsideEstimate = [];
    }

    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: null, report }),
    });
  } catch (e) {
    log('OpenAI request failed:', e);
    return withCors({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Ошибка при обращении к AI. Попробуйте позже.' }),
    });
  }
};
