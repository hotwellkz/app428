/**
 * Сборка контекста переписки для AI «сгенерировать ответ» (клиент).
 * Синхронизировать с netlify/functions/lib/buildAiReplyContext.ts при изменениях.
 */
export type AiReplyMessage = { role: 'client' | 'manager'; text: string };

const MAX_SINGLE_MSG_CHARS = 3500;
const MAX_TOTAL_TEXT_CHARS = 20000;
const HEAD_MESSAGE_COUNT = 12;
const TAIL_MESSAGE_COUNT = 48;

/** Макс. сообщений в одном запросе (защита размера тела) */
export const MAX_MESSAGES_PER_AI_REPLY_REQUEST = 900;

export interface CompactAiReplyResult {
  messages: AiReplyMessage[];
  omittedMiddleCount: number;
  trimmedForBudget: boolean;
}

function stripHtml(s: string): string {
  return (s ?? '').replace(/<[^>]*>/g, '').trim();
}

function normalizeOne(m: AiReplyMessage): AiReplyMessage | null {
  const text = stripHtml(m.text).slice(0, MAX_SINGLE_MSG_CHARS);
  if (!text) return null;
  return { role: m.role === 'manager' ? 'manager' : 'client', text };
}

function totalChars(msgs: AiReplyMessage[]): number {
  return msgs.reduce((s, m) => s + m.text.length, 0);
}

function shrinkToBudget(msgs: AiReplyMessage[], maxChars: number): AiReplyMessage[] {
  if (msgs.length === 0 || totalChars(msgs) <= maxChars) return msgs;

  const out = msgs.map((m) => ({ ...m, text: m.text }));
  const n = out.length;
  const weight = (i: number) => {
    if (i < 4) return 0.35;
    if (i >= n - 10) return 0.4;
    return 1;
  };

  let guard = 0;
  while (totalChars(out) > maxChars && guard < 50000) {
    guard++;
    let bestI = 0;
    let bestScore = -1;
    for (let i = 0; i < out.length; i++) {
      if (out[i].text.length < 80) continue;
      const score = out[i].text.length * weight(i);
      if (score > bestScore) {
        bestScore = score;
        bestI = i;
      }
    }
    if (bestScore <= 0) break;
    const cut = Math.min(400, Math.floor(out[bestI].text.length * 0.2));
    out[bestI] = {
      ...out[bestI],
      text: out[bestI].text.slice(0, Math.max(60, out[bestI].text.length - cut)) + '…'
    };
  }
  return out;
}

export function compactMessagesForAiReply(raw: AiReplyMessage[]): CompactAiReplyResult {
  const normalized = raw.map(normalizeOne).filter((m): m is AiReplyMessage => m !== null);

  if (normalized.length === 0) {
    return { messages: [], omittedMiddleCount: 0, trimmedForBudget: false };
  }

  let omittedMiddleCount = 0;
  let working: AiReplyMessage[];

  if (normalized.length <= HEAD_MESSAGE_COUNT + TAIL_MESSAGE_COUNT) {
    working = normalized;
  } else {
    const head = normalized.slice(0, HEAD_MESSAGE_COUNT);
    const tail = normalized.slice(-TAIL_MESSAGE_COUNT);
    working = [...head, ...tail];
    omittedMiddleCount = normalized.length - head.length - tail.length;
  }

  const charsBeforeShrink = totalChars(working);
  working = shrinkToBudget(working, MAX_TOTAL_TEXT_CHARS);
  const trimmedForBudget = totalChars(working) < charsBeforeShrink;

  return {
    messages: working,
    omittedMiddleCount,
    trimmedForBudget
  };
}

/**
 * Если сообщений слишком много для HTTP-тела — оставляем начало и конец до лимита.
 */
export function capMessagesForTransport(msgs: AiReplyMessage[], max = MAX_MESSAGES_PER_AI_REPLY_REQUEST): AiReplyMessage[] {
  if (msgs.length <= max) return msgs;
  const head = 100;
  const tail = max - head;
  return [...msgs.slice(0, head), ...msgs.slice(-tail)];
}
