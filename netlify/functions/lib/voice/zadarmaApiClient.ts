/**
 * Клиент REST API Zadarma v1 — подпись как в официальном TS SDK:
 * @see https://github.com/zadarma/user-api-typescript/blob/main/src/Client.ts
 */
import { createHash, createHmac } from 'node:crypto';

const ZADARMA_API_BASE = 'https://api.zadarma.com';

/** Подпись строки для Authorization (hex HMAC → base64 от ASCII-hex). */
function encodeApiSignature(secret: string, signatureString: string): string {
  const sha1Hex = createHmac('sha1', secret).update(signatureString).digest('hex');
  return Buffer.from(sha1Hex, 'utf8').toString('base64');
}

function httpBuildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const u = new URLSearchParams();
  const keys = Object.keys(params).sort();
  for (const k of keys) {
    const v = params[k];
    if (v === undefined || v === null) continue;
    if (typeof v === 'object') continue;
    u.append(k, String(v));
  }
  return u.toString().replace(/%20/g, '+');
}

export type ZadarmaJson = Record<string, unknown>;

export async function zadarmaApiRequest<T extends ZadarmaJson = ZadarmaJson>(opts: {
  methodPath: string;
  /** Путь метода с версией, например "/v1/info/balance/" */
  fullMethodForSign: string;
  params?: Record<string, string | number | boolean | undefined>;
  requestType?: 'GET' | 'POST';
  key: string;
  secret: string;
}): Promise<{ ok: true; data: T; httpStatus: number } | { ok: false; httpStatus: number; message: string }> {
  const params = { ...(opts.params ?? {}), format: 'json' as const };
  const sortedKeys = Object.keys(params)
    .filter((k) => {
      const v = params[k as keyof typeof params];
      return typeof v !== 'object' || v === null;
    })
    .sort();
  const sorted: Record<string, string | number | boolean | undefined> = {};
  for (const k of sortedKeys) {
    sorted[k] = params[k as keyof typeof params] as string | number | boolean | undefined;
  }
  const paramsString = httpBuildQuery(sorted as Record<string, string | number | boolean | undefined>);
  const md5Params = createHash('md5').update(paramsString).digest('hex');
  const signatureString = opts.fullMethodForSign + paramsString + md5Params;
  const signature = encodeApiSignature(opts.secret, signatureString);
  const authHeader = `${opts.key}:${signature}`;

  const type = opts.requestType ?? 'GET';
  let url = `${ZADARMA_API_BASE}${opts.methodPath}`;
  const headers: Record<string, string> = { Authorization: authHeader };
  const init: RequestInit = { method: type, headers };

  if (type === 'GET') {
    url = `${url}?${paramsString}`;
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = paramsString;
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    return { ok: false, httpStatus: 0, message: e instanceof Error ? e.message : 'Сеть недоступна' };
  }

  let json: ZadarmaJson = {};
  try {
    json = (await res.json()) as ZadarmaJson;
  } catch {
    json = {};
  }

  if (!res.ok) {
    const msg = typeof json.message === 'string' ? json.message : `HTTP ${res.status}`;
    return { ok: false, httpStatus: res.status, message: msg };
  }
  if (json.status === 'error') {
    const msg = typeof json.message === 'string' ? json.message : 'Zadarma API error';
    return { ok: false, httpStatus: res.status, message: msg };
  }
  return { ok: true, data: json as T, httpStatus: res.status };
}

/** GET /v1/info/balance/ — проверка ключей. */
export async function zadarmaProbeBalance(key: string, secret: string) {
  return zadarmaApiRequest({
    methodPath: '/v1/info/balance/',
    fullMethodForSign: '/v1/info/balance/',
    params: {},
    requestType: 'GET',
    key,
    secret
  });
}

/** GET /v1/direct_numbers/ — подключённые виртуальные номера. */
export async function zadarmaFetchDirectNumbers(key: string, secret: string) {
  return zadarmaApiRequest<{ info?: unknown[] }>({
    methodPath: '/v1/direct_numbers/',
    fullMethodForSign: '/v1/direct_numbers/',
    params: {},
    requestType: 'GET',
    key,
    secret
  });
}

/** POST /v1/request/callback/ — обратный звонок (исходящая связь через PBX). */
export async function zadarmaRequestCallback(
  key: string,
  secret: string,
  params: { from: string; to: string; sip?: string; predicted?: boolean }
) {
  const body: Record<string, string | number | boolean | undefined> = {
    from: String(params.from).replace(/\D/g, '') || String(params.from).trim(),
    to: String(params.to).replace(/\D/g, '')
  };
  if (params.sip != null && String(params.sip).trim()) {
    body.sip = String(params.sip).replace(/\D/g, '') || String(params.sip).trim();
  }
  if (params.predicted === true) {
    body.predicted = true;
  }
  return zadarmaApiRequest({
    methodPath: '/v1/request/callback/',
    fullMethodForSign: '/v1/request/callback/',
    params: body,
    requestType: 'POST',
    key,
    secret
  });
}
