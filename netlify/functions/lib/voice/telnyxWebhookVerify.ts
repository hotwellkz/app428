/**
 * Проверка подписи Telnyx webhook (Ed25519).
 * Формат signed payload: `${timestamp}|${rawBody}` (UTF-8), как в официальном SDK Telnyx.
 * @see https://github.com/team-telnyx/telnyx-node/blob/main/src/webhooks.ts
 */
import { createPublicKey, verify } from 'node:crypto';

const ED25519_RAW_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function publicKeyFromTelnyxBase64(keyInput: string): ReturnType<typeof createPublicKey> {
  const s = keyInput.trim();
  if (s.includes('BEGIN')) {
    return createPublicKey(s);
  }
  const raw = Buffer.from(s, 'base64');
  if (raw.length === 32) {
    const spki = Buffer.concat([ED25519_RAW_SPKI_PREFIX, raw]);
    return createPublicKey({ key: spki, format: 'der', type: 'spki' });
  }
  return createPublicKey({ key: raw, format: 'der', type: 'spki' });
}

export function verifyTelnyxWebhookSignature(opts: {
  publicKeyMaterial: string;
  rawBody: string;
  timestampHeader: string | undefined;
  signatureHeaderB64: string | undefined;
  /** секунды допуска по времени (по умолчанию 300 как в SDK Telnyx) */
  toleranceSec?: number;
}): { ok: true } | { ok: false; reason: string } {
  const ts = opts.timestampHeader?.trim();
  const sigB64 = opts.signatureHeaderB64?.trim();
  if (!ts) return { ok: false, reason: 'missing_telnyx_timestamp' };
  if (!sigB64) return { ok: false, reason: 'missing_telnyx_signature_ed25519' };

  const webhookTime = parseInt(ts, 10);
  if (!Number.isFinite(webhookTime)) return { ok: false, reason: 'invalid_timestamp' };
  const now = Math.floor(Date.now() / 1000);
  const tol = opts.toleranceSec ?? 300;
  if (Math.abs(now - webhookTime) > tol) return { ok: false, reason: 'timestamp_out_of_tolerance' };

  let pub: ReturnType<typeof createPublicKey>;
  try {
    pub = publicKeyFromTelnyxBase64(opts.publicKeyMaterial);
  } catch {
    return { ok: false, reason: 'invalid_public_key' };
  }

  const sig = Buffer.from(sigB64, 'base64');
  if (sig.length !== 64) return { ok: false, reason: 'invalid_signature_length' };

  const msg = Buffer.from(`${ts}|${opts.rawBody}`, 'utf8');
  try {
    const ok = verify(null, msg, pub, sig);
    return ok ? { ok: true } : { ok: false, reason: 'signature_mismatch' };
  } catch {
    return { ok: false, reason: 'verify_error' };
  }
}
