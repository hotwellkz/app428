import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { verifyIdToken } from './lib/firebaseAdmin';
import { getTransactionsTelegramEnv, sendTelegramMessage } from './lib/telegramTransport';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const MAX_LEN = 3900;

/**
 * Отправка уведомлений о складе/транзакциях в Telegram (секреты только на сервере).
 */
export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = String(authHeader).replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    await verifyIdToken(token);

    const body = event.body ? (JSON.parse(event.body) as { message?: string; parseMode?: 'HTML' }) : {};
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'message required' }) };
    }
    if (message.length > MAX_LEN) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'message too long' }) };
    }

    const cfg = getTransactionsTelegramEnv();
    if (!cfg) {
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, skipped: true, reason: 'transactions telegram not configured' })
      };
    }

    const parseMode = body.parseMode === 'HTML' ? 'HTML' : undefined;
    const out = await sendTelegramMessage({
      token: cfg.token,
      chatId: cfg.chatId,
      text: message,
      parseMode,
      disableWebPagePreview: false
    });

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: out.ok, error: out.error ?? null })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: String(e) })
    };
  }
};
