import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getAIApiKeyFromRequest } from './lib/aiAuth';

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
  /** Режим "Заправка": чек + приборная панель, извлечение суммы, пробега, литров, АЗС и т.д. */
  mode?: 'fuel';
}

const SYSTEM_PROMPT = `Ты — эксперт по распознаванию чеков и накладных (Казахстан, тенге). Изображение чека/накладной передаётся для извлечения позиций и итога.

——— 1) РАСПОЗНАВАНИЕ ЦИФР (критично) ———
- Внимательно читай ВСЕ цифры: рукописные и печатные. Частая ошибка: "1850" читают как "850" — проверяй количество разрядов.
- Цена за единицу: смотри контекст строки (название, количество, сумма по строке). Если видишь итог по чеку — используй его для проверки.
- Для каждой позиции явно выводи: quantity, unitPrice, lineTotal. Если lineTotal в чеке не указан — считай: lineTotal = quantity × unitPrice.

——— 2) АРИФМЕТИЧЕСКАЯ ПРОВЕРКА ———
- После разбора позиций: totalByItems = сумма всех lineTotal.
- Сравни totalByItems с итогом чека (receiptTotal). Разница допустима не более 1 тенге.
- Если НЕ сходится:
  • Перепроверь цифры в строках, особенно цены (часто ошибаются в одну цифру: 850 вместо 1850).
  • Попробуй скорректировать одну позицию: если итог чека известен, то (receiptTotal − сумма остальных позиций) / quantity этой позиции = правильная цена. Подставь её и пересчитай lineTotal.
  • Верни уже скорректированные значения в items и поставь totalsMatch: true только если арифметика сошлась.

——— 3) ПОЗИЦИИ (items) ———
По каждой строке товара:
- name — наименование (кратко)
- quantity — число
- unit — ед. изм.: шт, м, м2, м.п., кг, л, рулон, лист, пачка и т.д. (или пустая строка)
- unitPrice — цена за единицу (число)
- lineTotal — сумма по строке (число). Если нет в чеке — вычисли quantity × unitPrice.

——— 4) КОММЕНТАРИЙ И СТРУКТУРА ———
- comment — краткий человекочитаемый комментарий (как раньше), на случай если структура не используется.
- structuredComment — ОБЯЗАТЕЛЬНО заполни, если есть хотя бы одна позиция. Формат СТРОГО такой (пример):

Пиломатериал по чеку:
1) 50x50 — 600 м × 400 = 240000 ₸
2) 25x90 — 150 шт × 1850 = 277500 ₸
Итого по чеку: 517500 ₸

Правила structuredComment:
- Первая строка: короткий заголовок (например "Пиломатериал по чеку:" или "По чеку:").
- Далее по одной строке на позицию: "N) название — количество ед × цена = сумма ₸"
- Последняя строка: "Итого по чеку: X ₸" (X = receiptTotal).
- Числа без пробелов внутри, единицы (м, шт и т.д.) после количества. Этот текст будет использоваться для сравнения со сметой.

Если позиций нет — structuredComment можно не заполнять или пустая строка.

——— 5) ИТОГ И УВЕРЕННОСТЬ ———
- totalAmount и receiptTotal: приоритет — итог с чека. Если нет — сумма по позициям.
- confidence: "high" — итог чётко виден и арифметика сходится; "medium" — итог или позиции частично; "low" — сомнительно.

Формат ответа — СТРОГО JSON:
- totalAmount (число)
- receiptTotal (число)
- totalByItems (число)
- totalsMatch (boolean)
- comment (строка)
- structuredComment (строка, позиционный расчёт как выше — если есть позиции)
- confidence ("high" | "medium" | "low")
- items: массив { name, quantity?, unit?, unitPrice?, lineTotal? }
- rawVerdict (строка, опционально)`;

const FUEL_SYSTEM_PROMPT = `Ты — эксперт по распознаванию фото для учёта заправок (Казахстан, тенге). На фото может быть: чек АЗС и/или приборная панель автомобиля с одометром.

Извлекай данные по приоритету:
1) odometerKm — пробег в км с одометра/приборной панели (если виден). Формат: целое число (например 519066, 519 066, 519.066 — всё привести к 519066).
2) totalAmount — итоговая сумма с чека АЗС (тенге). Если дробная (например 31613.95) — верни как число, округление до целого сделает приложение.
3) liters — объём заправки в литрах, если есть в чеке.
4) pricePerLiter — цена за литр (тенге), если есть.
5) gasStation — название АЗС, если видно на чеке или вывеске.
6) fuelType — тип топлива (ДТ, АИ-92, АИ-95, Газ и т.д.), если можно определить.

Правила:
- Анализируй ВЕСЬ кадр: и чек, и приборную панель. Одометр часто виден на фото рядом с чеком.
- Пробег: только если уверенно виден на приборе (цифры одометра). Если сомнительно — не указывай или укажи с низкой уверенностью.
- Сумма: приоритет — итог с чека. Если не видна — null.
- Не придумывай данные. Если чего-то нет — верни null для поля.
- confidence: "high" | "medium" | "low" — общая уверенность. Для сомнительного пробега можно вернуть odometerConfidence: "low".

Ответ — СТРОГО JSON:
- totalAmount (число или null)
- odometerKm (целое число км или null)
- liters (число или null)
- pricePerLiter (число или null)
- gasStation (строка или null)
- fuelType (строка или null)
- confidence ("high" | "medium" | "low")
- odometerConfidence (опционально "high" | "medium" | "low")
- amountConfidence (опционально)`;

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

  try {
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

  const imageDataUrl = (body.imageDataUrl ?? '').toString().trim();
  const imageUrl = (body.imageUrl ?? '').toString().trim();
  const imageInput = imageDataUrl || imageUrl;
  const isFuelMode = body.mode === 'fuel';
  if (!imageInput) {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Требуется imageDataUrl или imageUrl' }),
    });
  }

  try {
    if (isFuelMode) {
      const fuelResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 512,
          messages: [
            { role: 'system', content: FUEL_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Распознай фото: сумма чека (totalAmount), пробег с одометра в км (odometerKm), литры, цена за литр, АЗС, тип топлива. Верни JSON: totalAmount, odometerKm, liters, pricePerLiter, gasStation, fuelType, confidence. Если чего-то нет — null.' },
                { type: 'image_url', image_url: { url: imageInput } },
              ],
            },
          ],
        }),
      });
      const fuelText = await fuelResponse.text();
      if (!fuelResponse.ok) {
        log('OpenAI fuel parse error:', fuelResponse.status, fuelText.slice(0, 300));
        return withCors({
          statusCode: 502,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Ошибка распознавания. Попробуйте другое фото.' }),
        });
      }
      let fuelData: { choices?: Array<{ message?: { content?: string } }> };
      try {
        fuelData = JSON.parse(fuelText);
      } catch {
        return withCors({
          statusCode: 502,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Некорректный ответ AI.' }),
        });
      }
      const fuelContent = fuelData?.choices?.[0]?.message?.content?.trim();
      if (!fuelContent) {
        return withCors({
          statusCode: 502,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Пустой ответ AI.' }),
        });
      }
      const fuelJsonMatch = fuelContent.match(/\{[\s\S]*\}/);
      const fuelJsonStr = fuelJsonMatch ? fuelJsonMatch[0] : fuelContent;
      let fuelParsed: Record<string, unknown>;
      try {
        fuelParsed = JSON.parse(fuelJsonStr) as Record<string, unknown>;
      } catch (e) {
        log('Failed to parse fuel JSON:', e);
        return withCors({
          statusCode: 502,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Не удалось разобрать ответ AI.' }),
        });
      }
      const toNum = (v: unknown): number | null => {
        if (v == null) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      const toStr = (v: unknown): string | null => {
        if (v == null) return null;
        const s = String(v).trim();
        return s || null;
      };
      let totalAmount = toNum(fuelParsed.totalAmount);
      const odometerRaw = fuelParsed.odometerKm;
      let odometerKm: number | null = null;
      if (odometerRaw != null) {
        const n = typeof odometerRaw === 'number' ? odometerRaw : Number(String(odometerRaw).replace(/\s/g, '').replace(',', '.'));
        if (Number.isFinite(n) && n >= 0) odometerKm = Math.round(n);
      }
      const liters = toNum(fuelParsed.liters);
      const pricePerLiter = toNum(fuelParsed.pricePerLiter);
      const gasStation = toStr(fuelParsed.gasStation);
      const fuelType = toStr(fuelParsed.fuelType);
      const confidence = ['high', 'medium', 'low'].includes(String(fuelParsed.confidence)) ? fuelParsed.confidence : 'medium';
      const odometerConfidence = ['high', 'medium', 'low'].includes(String(fuelParsed.odometerConfidence)) ? fuelParsed.odometerConfidence : undefined;
      const amountConfidence = ['high', 'medium', 'low'].includes(String(fuelParsed.amountConfidence)) ? fuelParsed.amountConfidence : undefined;
      if (totalAmount != null) totalAmount = Math.round(totalAmount * 100) / 100;
      return withCors({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalAmount: totalAmount ?? undefined,
          odometerKm: odometerKm ?? undefined,
          liters: liters ?? undefined,
          pricePerLiter: pricePerLiter ?? undefined,
          gasStation: gasStation ?? undefined,
          fuelType: fuelType ?? undefined,
          confidence,
          odometerConfidence,
          amountConfidence,
        }),
      });
    }

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
              { type: 'text', text: 'Распознай чек: итог (receiptTotal), позиции (name, quantity, unit, unitPrice, lineTotal). Внимательно читай цифры (1850 не 850). Проверь арифметику: сумма позиций = итог чека; если не сходится — перепроверь цены и при необходимости скорректируй. Заполни structuredComment в формате "По чеку:\\n1) название — кол-во ед × цена = сумма ₸\\n...\\nИтого по чеку: X ₸". Верни JSON: totalAmount, receiptTotal, totalByItems, totalsMatch, comment, structuredComment, confidence, items.' },
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
    interface ItemRow {
      name: string;
      quantity: number;
      unit?: string;
      unitPrice: number;
      lineTotal?: number;
    }
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    let items: ItemRow[] = rawItems.map((it: Record<string, unknown>) => {
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

    let totalByItemsComputed = items.length > 0 ? items.reduce((s, i) => s + (i.lineTotal ?? 0), 0) : 0;
    const receiptTotalFinal = receiptTotal || totalAmount;
    const tolerance = 1;

    // Арифметическая коррекция: если итог по позициям не сходится с итогом чека — попробовать скорректировать одну позицию
    if (items.length >= 1 && receiptTotalFinal > 0 && Math.abs(totalByItemsComputed - receiptTotalFinal) > tolerance) {
      const sumOthers = (idx: number) =>
        items.reduce((s, i, iidx) => s + (iidx === idx ? 0 : (i.lineTotal ?? i.quantity * i.unitPrice)), 0);
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const q = item.quantity;
        if (!q || q <= 0) continue;
        const rest = sumOthers(idx);
        const neededLineTotal = Math.round((receiptTotalFinal - rest) * 100) / 100;
        if (neededLineTotal <= 0) continue;
        const inferredUnitPrice = Math.round((neededLineTotal / q) * 100) / 100;
        const inferredLineTotal = Math.round(inferredUnitPrice * q * 100) / 100;
        const newSum = rest + inferredLineTotal;
        if (Math.abs(newSum - receiptTotalFinal) <= tolerance) {
          items = items.map((it, i) =>
            i === idx
              ? { ...it, unitPrice: inferredUnitPrice, lineTotal: inferredLineTotal }
              : it
          );
          totalByItemsComputed = items.reduce((s, i) => s + (i.lineTotal ?? 0), 0);
          break;
        }
      }
    }

    const totalByItemsOut = items.length > 0 ? items.reduce((s, i) => s + (i.lineTotal ?? 0), 0) : 0;
    const totalsMatchOut = items.length > 0 && Math.abs(totalByItemsOut - receiptTotalFinal) <= tolerance;

    // Формируем структурированный комментарий для сравнения со сметой (если есть позиции)
    let structuredComment = typeof parsed.structuredComment === 'string' ? parsed.structuredComment.trim() : '';
    if (items.length > 0) {
      if (!structuredComment) {
        const lines = items.map(
          (it, i) =>
            `${i + 1}) ${it.name} — ${it.quantity}${it.unit ? ` ${it.unit}` : ''} × ${it.unitPrice} = ${Math.round((it.lineTotal ?? it.quantity * it.unitPrice) * 100) / 100} ₸`
        );
        structuredComment = `По чеку:\n${lines.join('\n')}\nИтого по чеку: ${Math.round(receiptTotalFinal * 100) / 100} ₸`;
      }
    }

    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalAmount,
        comment: comment.trim() || 'По чеку/накладной',
        structuredComment: structuredComment || undefined,
        confidence,
        items,
        totalByItems: totalByItemsOut,
        receiptTotal: receiptTotalFinal,
        totalsMatch: items.length > 0 ? totalsMatchOut : undefined,
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
  } catch (outer) {
    log('Handler error:', outer);
    return withCors({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Сервис временно недоступен. Попробуйте позже.' }),
    });
  }
};
