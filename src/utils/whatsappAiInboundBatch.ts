/**
 * Debounce + батчинг входящих сообщений клиента для AI-ответа в одном чате WhatsApp.
 */

import type { WhatsAppMessage } from '../types/whatsappDb';
import type { CrmAiBotReplyStyle } from '../types/crmAiBotConfig';
import { pickCrmClientAggregationDebounceMs } from '../lib/ai/crmAiBotReplyGeneration';
import { getMessageTextContentForAi, messageHasVoiceOrAudioAttachment } from './whatsappAiMessageContent';

export function getWhatsAppMessageTime(m: WhatsAppMessage): number {
  const t = m.createdAt;
  if (!t) return 0;
  if (typeof (t as { toMillis?: () => number }).toMillis === 'function') {
    return (t as { toMillis: () => number }).toMillis();
  }
  if (typeof t === 'object' && t !== null && 'seconds' in (t as object)) {
    return ((t as { seconds: number }).seconds ?? 0) * 1000;
  }
  return new Date(t as string).getTime();
}

/**
 * Входящие сообщения клиента после watermark lastProcessedIncomingMessageId (по порядку в чате).
 */
/**
 * Два источника watermark (ref + снапшот списка): берём тот, что дальше по таймлайну входящих,
 * чтобы не обрабатывать повторно уже закрытые хвосты.
 */
export function mergeLastProcessedInboundWatermarks(
  messages: WhatsAppMessage[],
  refId: string | null,
  listId: string | null,
  getMessageTime: (m: WhatsAppMessage) => number
): string | null {
  if (!refId) return listId;
  if (!listId) return refId;
  if (refId === listId) return refId;
  const incoming = messages
    .filter((m) => !m.deleted && m.direction === 'incoming')
    .sort((a, b) => getMessageTime(a) - getMessageTime(b));
  const ia = incoming.findIndex((m) => m.id === refId);
  const ib = incoming.findIndex((m) => m.id === listId);
  if (ia < 0) return listId;
  if (ib < 0) return refId;
  return ia >= ib ? refId : listId;
}

export function getUnprocessedIncomingMessages(
  messages: WhatsAppMessage[],
  lastProcessedIncomingId: string | null,
  getMessageTime: (m: WhatsAppMessage) => number = getWhatsAppMessageTime
): WhatsAppMessage[] {
  const incoming = messages
    .filter((m) => !m.deleted && m.direction === 'incoming')
    .sort((a, b) => getMessageTime(a) - getMessageTime(b));
  if (!lastProcessedIncomingId) return incoming;
  const idx = incoming.findIndex((m) => m.id === lastProcessedIncomingId);
  if (idx < 0) return incoming;
  return incoming.slice(idx + 1);
}

/** Есть ли в батче голос без готового текста для AI (нужна расшифровка). */
export function incomingBatchNeedsTranscriptWait(
  batch: WhatsAppMessage[],
  mergedUpdates: Record<string, string>
): boolean {
  return batch.some((m) => {
    if (!messageHasVoiceOrAudioAttachment(m)) return false;
    return !getMessageTextContentForAi(m, mergedUpdates).trim();
  });
}

/**
 * Debounce: 6 с для текста, 10 с если в необработанном хвосте есть voice/audio (legacy AI).
 */
export function chooseWhatsAppAiDebounceMs(unprocessedIncoming: WhatsAppMessage[]): number {
  const hasVoice = unprocessedIncoming.some((m) => messageHasVoiceOrAudioAttachment(m));
  return hasVoice ? 10_000 : 6_000;
}

/**
 * Автоворонка CRM: агрегация серии сообщений клиента (настройка min/max мс) + 10 с при voice.
 */
export function chooseCrmWhatsAppAiDebounceMs(
  unprocessedIncoming: WhatsAppMessage[],
  replyStyle: CrmAiBotReplyStyle
): number {
  if (unprocessedIncoming.some((m) => messageHasVoiceOrAudioAttachment(m))) return 10_000;
  return pickCrmClientAggregationDebounceMs(replyStyle);
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim();
}

function buildBatchedTimeline<T extends { role: string; text?: string; content?: string }>(
  messages: WhatsAppMessage[],
  lastProcessedIncomingId: string | null,
  mergedUpdates: Record<string, string>,
  getMessageTime: (m: WhatsAppMessage) => number,
  mapLine: (
    direction: 'incoming' | 'outgoing',
    text: string
  ) => T,
  mapBatchedClient: (combinedText: string) => T
): T[] {
  const pendingIncoming = getUnprocessedIncomingMessages(messages, lastProcessedIncomingId, getMessageTime);
  const pendingIds = new Set(pendingIncoming.map((m) => m.id));
  const sorted = [...messages]
    .filter((m) => !m.deleted)
    .sort((a, b) => getMessageTime(a) - getMessageTime(b));

  const out: T[] = [];
  let i = 0;
  while (i < sorted.length) {
    const m = sorted[i];
    if (m.direction === 'incoming' && pendingIds.has(m.id)) {
      const block: WhatsAppMessage[] = [];
      while (
        i < sorted.length &&
        sorted[i].direction === 'incoming' &&
        pendingIds.has(sorted[i].id)
      ) {
        block.push(sorted[i]);
        i++;
      }
      const parts = block.map((msg, idx) => {
        const raw = stripHtml(getMessageTextContentForAi(msg, mergedUpdates));
        const label = messageHasVoiceOrAudioAttachment(msg)
          ? 'Голосовое (расшифровка)'
          : `Сообщение ${idx + 1}`;
        return `${label}: ${raw}`;
      });
      const combined = parts.join('\n\n').trim();
      if (combined) out.push(mapBatchedClient(combined));
      continue;
    }
    const content = stripHtml(getMessageTextContentForAi(m, mergedUpdates));
    if (!content) {
      i++;
      continue;
    }
    out.push(mapLine(m.direction === 'incoming' ? 'incoming' : 'outgoing', content));
    i++;
  }
  return out;
}

export type LegacyAiChatLine = { role: 'client' | 'manager'; text: string };

export function buildLegacyAiPayloadMessages(
  messages: WhatsAppMessage[],
  lastProcessedIncomingId: string | null,
  mergedUpdates: Record<string, string>,
  getMessageTime: (m: WhatsAppMessage) => number,
  maxTail: number
): LegacyAiChatLine[] {
  const lines = buildBatchedTimeline(
    messages,
    lastProcessedIncomingId,
    mergedUpdates,
    getMessageTime,
    (dir, text) => ({
      role: dir === 'incoming' ? ('client' as const) : ('manager' as const),
      text
    }),
    (combinedText) => ({ role: 'client' as const, text: combinedText })
  );
  return lines.slice(-maxTail);
}

export type CrmOpenAiLine = { role: 'user' | 'assistant'; content: string };

export function buildCrmOpenAiMessagesFromBatch(
  messages: WhatsAppMessage[],
  lastProcessedIncomingId: string | null,
  mergedUpdates: Record<string, string>,
  getMessageTime: (m: WhatsAppMessage) => number,
  maxTail: number
): CrmOpenAiLine[] {
  const lines = buildBatchedTimeline(
    messages,
    lastProcessedIncomingId,
    mergedUpdates,
    getMessageTime,
    (dir, text) => ({
      role: dir === 'incoming' ? ('user' as const) : ('assistant' as const),
      content: text
    }),
    (combinedText) => ({ role: 'user' as const, content: combinedText })
  );
  return lines.slice(-maxTail).filter((m) => m.content.length > 0);
}

/** Проверка: пока шла генерация, пришли новые входящие (другой хвост). */
export function isInboundBatchStale(
  messages: WhatsAppMessage[],
  lastProcessedIncomingId: string | null,
  anchorLastIncomingId: string,
  anchorPendingCount: number,
  getMessageTime: (m: WhatsAppMessage) => number
): boolean {
  const pending = getUnprocessedIncomingMessages(messages, lastProcessedIncomingId, getMessageTime);
  if (pending.length !== anchorPendingCount) return true;
  const last = pending[pending.length - 1];
  return last?.id !== anchorLastIncomingId;
}
