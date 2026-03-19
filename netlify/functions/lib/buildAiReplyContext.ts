/**
 * Сборка контекста переписки для AI «сгенерировать ответ».
 * Не ограничиваемся последними N сообщениями: при длинном чате сохраняем
 * начало диалога + недавнюю часть, укладываемся в бюджет символов.
 *
 * Дублирует логику с src/utils/buildAiReplyContext.ts — при правках синхронизировать.
 */
export type AiReplyMessage = { role: 'client' | 'manager'; text: string };

/** Макс. символов на одно сообщение до компрессии */
const MAX_SINGLE_MSG_CHARS = 3500;
/** Целевой бюджет суммарного текста переписки в промпте (остальное — system/kb/quick) */
const MAX_TOTAL_TEXT_CHARS = 20000;
/** Сколько первых сообщений всегда сохранять при длинном чате */
const HEAD_MESSAGE_COUNT = 12;
/** Сколько последних сообщений сохранять при длинном чате */
const TAIL_MESSAGE_COUNT = 48;
/** Сколько сообщений максимум принять с клиента (защита от огромного JSON) */
export const MAX_INCOMING_MESSAGES = 900;

/** Ограничение размера тела запроса: начало + конец переписки */
export function capIncomingMessagesForReply(msgs: AiReplyMessage[], max = MAX_INCOMING_MESSAGES): AiReplyMessage[] {
  if (msgs.length <= max) return msgs;
  const head = 100;
  const tail = max - head;
  return [...msgs.slice(0, head), ...msgs.slice(-tail)];
}

export interface CompactAiReplyResult {
  messages: AiReplyMessage[];
  /** Сколько сообщений выкинуто из середины (0 если не применялось) */
  omittedMiddleCount: number;
  /** Была ли дополнительная ужимка по символам */
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

/**
 * Уменьшает тексты, пока сумма не <= maxChars (сохраняем начало/конец переписки сильнее).
 */
function shrinkToBudget(msgs: AiReplyMessage[], maxChars: number): AiReplyMessage[] {
  if (msgs.length === 0 || totalChars(msgs) <= maxChars) return msgs;

  const out = msgs.map((m) => ({ ...m, text: m.text }));
  const n = out.length;
  /** Приоритет обрезки: середина хуже, первые 4 и последние 10 — мягче */
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

/**
 * Нормализует вход, применяет head+tail при длинном чате, ужимает по бюджету символов.
 */
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
