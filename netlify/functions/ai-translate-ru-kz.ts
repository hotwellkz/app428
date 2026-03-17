import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getAIApiKeyFromRequest } from './lib/aiAuth';

const LOG_PREFIX = '[ai-translate-ru-kz]';

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

/** targetLang: на какой язык переводить — 'ru' (русский) или 'kz' (казахский). */
interface TranslateBody {
  text?: string;
  targetLang?: 'ru' | 'kz';
}

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

  let body: TranslateBody;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as TranslateBody) ?? {};
  } catch {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON' }),
    });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const targetLang = body.targetLang === 'kz' || body.targetLang === 'ru' ? body.targetLang : 'ru';

  if (!text) {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Текст для перевода не указан' }),
    });
  }

  const targetLabel = targetLang === 'ru' ? 'русский' : 'казахский';
  const systemPrompt =
    'Ты переводчик для деловой переписки CRM (строительство, дома, участки). ' +
    `Переведи сообщение на ${targetLabel} язык. ` +
    'Правила: переводи только текст; не добавляй пояснений и кавычек; сохраняй числа, даты, размеры (м², м), суммы и условия оплаты без изменений; сохраняй названия материалов и формулировки по проекту; стиль — короткий, деловой, без литературных излишеств. Ответь одним сообщением — только перевод.';

  const userPrompt = text;

  try {
    log('Translate to', targetLang, 'length=', text.length);
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
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      log('OpenAI error', response.status, errText.slice(0, 300));
      return withCors({
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Ошибка сервиса перевода', status: response.status }),
      });
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const raw = (data.choices?.[0]?.message?.content ?? '') || '';
    const translated = String(raw).trim();

    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ translated, targetLang }),
    });
  } catch (e) {
    log('Request failed', e);
    return withCors({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Не удалось выполнить перевод', detail: String(e) }),
    });
  }
};
