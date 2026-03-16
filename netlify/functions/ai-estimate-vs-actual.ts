import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';

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

interface TransactionInput {
  id: string;
  amount: number;
  description?: string;
  type?: string;
  date?: string;
  waybillNumber?: string;
  waybillData?: { documentNumber?: string; project?: string; note?: string; items?: Array<{ product?: { name?: string }; quantity?: number; price?: number }> };
  attachmentNames?: string[];
}

interface Body {
  companyId?: string;
  clientId: string;
  clientName?: string;
  estimateSummary: EstimateSummary;
  transactions: TransactionInput[];
}

const SYSTEM_PROMPT = `Ты — эксперт по контролю смет и фактических расходов в строительных проектах (CRM 2wix, Казахстан).
Тебе даны: 1) плановая смета по разделам (фундамент, стены СИП, крыша, перекрытие, перегородки, расходники, доп. работы, ЗП строителям, операционные); 2) список фактических транзакций по проекту (сумма, комментарий, тип, при необходимости — данные накладной).

Задача: сравнить план и факт, выявить перерасход и экономию по разделам, отнести расходы к категориям сметы где возможно, выделить неучтённые и подозрительные траты, дать краткие рекомендации собственнику.

Отвечай СТРОГО в формате JSON с полями:
- summary: объект с полями totalEstimate (число), totalActual (число), difference (число, факт минус смета), differencePercent (число), verdict (строка: "over" | "under" | "match"), summaryText (строка — общий вывод 2-3 предложения).
- byCategory: массив объектов { categoryName (строка, название раздела сметы), estimate (число), actual (число), difference (число), confidence (строка: "high"|"medium"|"low"), note (строка, кратко) }.
- unclassifiedExpenses: массив { transactionId (строка), amount (число), description (строка), reason (строка — почему не удалось отнести) } — транзакции, которые не удалось уверенно отнести ни к одному разделу сметы.
- suspicious: массив { transactionId, amount, description, reason } — подозрительные или неочевидные траты (дубли, слишком крупные, без понятного назначения).
- recommendations: массив строк — конкретные рекомендации собственнику (что перепроверить, где риск, где возможная ошибка учёта).

Категории сметы для сопоставления: фундамент, стены СИП / СИП-панели, крыша, перекрытие/пол, перегородки, расходные материалы, дополнительные работы, ЗП строителям, операционные расходы.
Используй комментарии транзакций, данные накладной (waybillData) и названия вложений для классификации. Если уверенность низкая — укажи confidence "low" и кратко note.`;

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
  const transactions = Array.isArray(body.transactions) ? body.transactions : [];

  if (!clientId) {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'clientId is required' }),
    });
  }

  if (!apiKey) {
    log('Missing OPENAI_API_KEY');
    return withCors({
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'AI не настроен (нет API ключа)' }),
    });
  }

  const userPrompt =
    `Проект/клиент: ${body.clientName ?? clientId}\n\n` +
    `Плановая смета (по разделам, в тенге):\n${JSON.stringify(estimateSummary, null, 2)}\n\n` +
    `Фактические транзакции (расходы по проекту):\n${JSON.stringify(
      transactions.map((t) => ({
        id: t.id,
        amount: t.amount,
        description: t.description || '',
        type: t.type,
        date: t.date,
        waybillNumber: t.waybillNumber,
        waybillData: t.waybillData,
        attachmentNames: t.attachmentNames,
      })),
      null,
      2
    )}\n\nВерни один JSON-объект с полями: summary, byCategory, unclassifiedExpenses, suspicious, recommendations.`;

  try {
    log('Calling OpenAI for clientId', clientId, 'transactions=', transactions.length);
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
        temperature: 0.2,
        max_tokens: 4000,
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
    let report: unknown;
    try {
      report = JSON.parse(jsonStr);
    } catch (e) {
      log('Failed to parse OpenAI JSON content:', e);
      return withCors({
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Не удалось разобрать ответ AI.' }),
      });
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
  };
};
