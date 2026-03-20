/**
 * Лёгкий мост extraction/summary → callbackRequested / время (без тяжёлого NLU).
 */
import type { CrmAiBotExtractionResult } from '../../../../src/types/crmAiBotExtraction';

const CALLBACK_HINTS =
  /перезвон|позвон(ите|и)\s+(мне\s+)?(позже|через|в\s+\d|завтра|на\s+следующей)|неудобно|сейчас\s+не\s+удобно|callback|перезвоните/i;

/** ISO-like or HH:MM in context */
const ISO_RX = /\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)\b/;
const TIME_RX = /\b([01]?\d|2[0-3]):[0-5]\d\b/;

export type VoiceCallbackSignals = {
  callbackRequested: boolean;
  callbackAtMs: number | null;
  callbackNote: string | null;
};

function combineText(extraction: CrmAiBotExtractionResult | null, summary: string | null): string {
  const parts = [
    summary,
    extraction?.nextStep,
    extraction?.summaryComment,
    extraction?.timeline,
    extraction?.preferredContactMode
  ]
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean);
  return parts.join('\n');
}

export function extractVoiceCallbackSignals(
  extraction: CrmAiBotExtractionResult | null,
  summary: string | null
): VoiceCallbackSignals {
  const text = combineText(extraction, summary);
  if (!text.trim()) {
    return { callbackRequested: false, callbackAtMs: null, callbackNote: null };
  }

  const callbackRequested = CALLBACK_HINTS.test(text);
  if (!callbackRequested) {
    return { callbackRequested: false, callbackAtMs: null, callbackNote: null };
  }

  let callbackAtMs: number | null = null;
  const iso = text.match(ISO_RX);
  if (iso) {
    const ms = Date.parse(iso[1]);
    if (Number.isFinite(ms)) callbackAtMs = ms;
  }
  if (callbackAtMs == null) {
    const hm = text.match(TIME_RX);
    if (hm) {
      const [h, m] = hm[0].split(':').map((x) => parseInt(x, 10));
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      callbackAtMs = d.getTime();
    }
  }

  return {
    callbackRequested: true,
    callbackAtMs,
    callbackNote: text.slice(0, 500)
  };
}
