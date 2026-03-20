import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';

/**
 * Минимальный TwiML для исходящего звонка P0: без медиа/LLM — сразу завершение линии после ответа.
 * Следующий этап: подключение stream / Say / Gather.
 */
const TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`;

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
  }
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: { 'Content-Type': 'text/plain' }, body: 'Method Not Allowed' };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: TWIML
  };
};
