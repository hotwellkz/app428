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

Задача:
1. Найти ИТОГОВУЮ СУММУ к оплате (в тенге или без валюты — считаем тенге).
2. Сформировать КРАТКИЙ СМЫСЛОВОЙ КОММЕНТАРИЙ для перевода/транзакции: не сырой OCR, а понятное описание (например: "Пиломатериал по чеку: 50x50 — 600 м, 25x90 — 150 шт" или "Покупка стройматериалов по накладной №X").

Правила:
- Сумму верни одним числом (без пробелов, только цифры и при необходимости точка для копеек). Если копеек нет — целое число.
- Комментарий: 1–2 предложения, без мусора, пригоден для истории операций.
- Если не удаётся уверенно определить сумму — укажи confidence "low" и по возможности предполагаемую сумму.
- Если изображение не чек и не накладная — верни confidence "low" и пустую сумму 0.

Отвечай СТРОГО в формате JSON с полями:
- totalAmount (число) — итоговая сумма
- comment (строка) — комментарий для перевода
- confidence ("high" | "medium" | "low")
- items (массив объектов { name: string, quantity?: number, price?: number, total?: number } или пустой массив) — если удалось выделить позиции
- rawVerdict (строка, опционально) — кратко: что за документ и насколько уверен`;

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
              { type: 'text', text: 'Распознай чек/накладную на изображении и верни JSON с totalAmount, comment, confidence, items.' },
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

    const totalAmount = typeof parsed.totalAmount === 'number' ? parsed.totalAmount : Number(parsed.totalAmount) || 0;
    const comment = typeof parsed.comment === 'string' ? parsed.comment : '';
    const confidence = ['high', 'medium', 'low'].includes(String(parsed.confidence)) ? parsed.confidence : 'medium';
    const items = Array.isArray(parsed.items) ? parsed.items : [];

    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalAmount: Math.round(totalAmount * 100) / 100,
        comment: comment || 'По чеку/накладной',
        confidence,
        items,
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
