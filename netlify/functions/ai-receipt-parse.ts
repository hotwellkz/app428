import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';

const LOG_PREFIX = '[ai-receipt-parse]';

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

/** data URL (data:image/jpeg;base64,...) или обычный URL изображения */
interface Body {
  imageDataUrl?: string;
  imageUrl?: string;
}

const SYSTEM_PROMPT = `Ты — эксперт по распознаванию чеков, накладных и фото документов (Казахстан, тенге).
Тебе передают изображение чека / накладной / документа о покупке.

ОСНОВНЫЕ ЗАДАЧИ (в порядке приоритета):

1) ИТОГОВАЯ СУММА ЧЕКА
Найти на документе итоговую сумму к оплате (в тенге). Вернуть числом в totalAmount и в receiptTotal.

2) ПОЗИЦИОННЫЙ РАЗБОР (если в чеке несколько строк)
По каждой строке товара/позиции попытаться определить:
- name (наименование, кратко)
- quantity (количество — число)
- unit (ед. изм.: шт, м, м2, кг, рулон, лист, пачка и т.д., или пустая строка)
- unitPrice (цена за единицу — число)
- lineTotal (сумма по строке — число). Если в чеке не указана явно, ВЫЧИСЛИ: lineTotal = quantity × unitPrice.

После разбора позиций:
- Посчитай totalByItems = сумма всех lineTotal.
- Сравни с итогом чека (receiptTotal). Если разница в пределах 1 тенге — totalsMatch: true, иначе totalsMatch: false.

3) КОММЕНТАРИЙ ДЛЯ ПЕРЕВОДА
Формируй comment на основе позиций, если они распознаны:
- Вариант: "Покупка: [позиция 1 — кол-во ед. × цена]; [позиция 2 — ...]. По чеку."
- Или короче: "Пиломатериал по чеку: 50x50 — 600 м, 25x90 — 150 шт."
Если позиций нет или разбор ненадёжный — сделай простой осмысленный комментарий (как раньше).

ПРАВИЛА И FALLBACK:
- Если позиционный разбор не получается уверенно (размыто, рукописное, одна позиция) — верни items: [] или частичный массив, но ВСЕГДА заполни totalAmount и comment. Не ухудшай текущий результат.
- totalAmount: приоритет — итог с чека (receiptTotal). Если его нет — используй totalByItems. Иначе — любая распознанная итоговая сумма.
- confidence: "high" — итог чётко виден и (если есть позиции) totalsMatch; "medium" — итог или позиции частично; "low" — сомнительно или не чек.
- Единицы измерения распознавай: шт, м, м2, м.п., кг, л, рулон, лист, пачка, упак и т.д.

Формат ответа — СТРОГО JSON:
- totalAmount (число)
- receiptTotal (число, итог с чека)
- totalByItems (число, сумма по позициям; 0 если позиций нет)
- totalsMatch (boolean, totalByItems совпадает с receiptTotal)
- comment (строка)
- confidence ("high" | "medium" | "low")
- items: массив { name, quantity?, unit?, unitPrice?, lineTotal? }
- rawVerdict (строка, опционально)`;

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
  if (!apiKey) {
    log('Missing OPENAI_API_KEY');
    return withCors({
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'AI не настроен (нет API ключа)' }),
    });
  }

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

  const imageDataUrl = (body.imageDataUrl ?? '').toString().trim();
  const imageUrl = (body.imageUrl ?? '').toString().trim();
  const imageInput = imageDataUrl || imageUrl;
  if (!imageInput) {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Требуется imageDataUrl или imageUrl' }),
    });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Распознай чек/накладную: итог, по возможности позиции (название, кол-во, ед., цена, сумма по строке), посчитай totalByItems и сверь с итогом чека. Верни JSON: totalAmount, receiptTotal, totalByItems, totalsMatch, comment, confidence, items.' },
              {
                type: 'image_url',
                image_url: { url: imageInput },
              },
            ],
          },
        ],
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      log('OpenAI API error:', response.status, responseText.slice(0, 400));
      return withCors({
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Ошибка распознавания. Попробуйте другое фото.' }),
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
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch (e) {
      log('Failed to parse OpenAI JSON:', e);
      return withCors({
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Не удалось разобрать ответ AI.' }),
      });
    }

    const receiptTotal = typeof parsed.receiptTotal === 'number' ? parsed.receiptTotal : Number(parsed.receiptTotal) || 0;
    const totalByItems = typeof parsed.totalByItems === 'number' ? parsed.totalByItems : Number(parsed.totalByItems) || 0;
    const totalsMatch = Boolean(parsed.totalsMatch);
    let totalAmount = typeof parsed.totalAmount === 'number' ? parsed.totalAmount : Number(parsed.totalAmount) || 0;
    if (receiptTotal > 0) totalAmount = receiptTotal;
    else if (totalByItems > 0) totalAmount = totalByItems;
    totalAmount = Math.round(totalAmount * 100) / 100;

    let comment = typeof parsed.comment === 'string' ? parsed.comment : '';
    if (!comment.trim()) comment = 'По чеку/накладной';

    const confidence = ['high', 'medium', 'low'].includes(String(parsed.confidence)) ? parsed.confidence : 'medium';
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    const items = rawItems.map((it: Record<string, unknown>) => {
      const q = Number(it.quantity) || 0;
      const up = (Number(it.unitPrice) ?? Number(it.price)) || 0;
      let lineTotal = typeof it.lineTotal === 'number' ? it.lineTotal : Number(it.lineTotal);
      if (!Number.isFinite(lineTotal) && q && up) lineTotal = q * up;
      return {
        name: String(it.name ?? ''),
        quantity: q,
        unit: it.unit != null ? String(it.unit) : undefined,
        unitPrice: up,
        lineTotal: Number.isFinite(lineTotal) ? Math.round(lineTotal * 100) / 100 : undefined,
      };
    });

    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalAmount,
        comment: comment.trim() || 'По чеку/накладной',
        confidence,
        items,
        totalByItems: items.length > 0 ? items.reduce((s, i) => s + (i.lineTotal ?? 0), 0) : 0,
        receiptTotal: receiptTotal || totalAmount,
        totalsMatch: items.length > 0 ? totalsMatch : undefined,
        rawVerdict: parsed.rawVerdict != null ? String(parsed.rawVerdict) : undefined,
      }),
    });
  } catch (e) {
    log('Request failed:', e);
    return withCors({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Ошибка при распознавании чека. Попробуйте позже.' }),
    });
  }
};
