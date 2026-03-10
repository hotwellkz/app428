import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { acceptInvite as acceptInviteBackend } from './lib/firebaseAdmin';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function withCors(res: HandlerResponse): HandlerResponse {
  return { ...res, headers: { ...CORS_HEADERS, ...res.headers } };
}

interface AcceptInviteBody {
  token: string;
  displayName?: string;
  password: string;
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return withCors({ statusCode: 204, headers: {}, body: '' });
  }

  if (event.httpMethod !== 'POST') {
    return withCors({ statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) });
  }

  let body: AcceptInviteBody;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as AcceptInviteBody) ?? {};
  } catch {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON' })
    });
  }

  const { token, displayName, password } = body;
  if (!token || typeof token !== 'string' || !token.trim()) {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'token is required' })
    });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Пароль должен быть не менее 6 символов' })
    });
  }

  try {
    const { customToken } = await acceptInviteBackend(
      token.trim(),
      typeof displayName === 'string' ? displayName : '',
      password
    );
    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customToken })
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Не удалось принять приглашение';
    console.error('[accept-invite]', err);
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: message })
    });
  }
};
