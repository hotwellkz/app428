/**
 * Единое правило: текст для AI из WhatsApp-сообщения.
 * Голосовые: приоритет у transcription; поле text не считается расшифровкой (часто пустое или плейсхолдер).
 * Вложения: сводка анализа (vision/PDF) подмешивается в контекст модели.
 */

import type { MessageAttachment, WhatsAppMessage } from '../types/whatsappDb';

export type WhatsAppMessageLike = {
  id: string;
  text?: string;
  transcription?: string | null;
  deleted?: boolean;
  attachments?: MessageAttachment[];
};

/** Текст-заглушка вместо реального содержимого медиа (не использовать как смысл для модели). */
export function isPlaceholderMediaText(s: string): boolean {
  const t = String(s ?? '').trim();
  if (!t) return true;
  const lower = t.toLowerCase();
  if (lower === '[медиа]' || lower === '[media]' || lower === '[no text]') return true;
  if (/^\[media:\s*https?:\/\//i.test(t)) return true;
  return false;
}

export function messageHasVoiceOrAudioAttachment(m: WhatsAppMessageLike): boolean {
  return !!m.attachments?.some((a) => {
    const t = String(a.type);
    return t === 'audio' || t === 'voice';
  });
}

/** Вложения, для которых CRM запускает автоанализ (и при необходимости ждёт результат). */
export function rowIsVisualAnalyzableForAiWait(att: MessageAttachment): boolean {
  if (att.type === 'video' || att.type === 'audio') return false;
  if (att.type === 'image') return true;
  if (att.type === 'file') {
    const mime = (att.mimeType ?? '').toLowerCase();
    const path = att.url.split('?')[0].toLowerCase();
    const name = (att.fileName ?? '').toLowerCase();
    return mime.includes('pdf') || path.endsWith('.pdf') || name.endsWith('.pdf') || mime.startsWith('image/');
  }
  return false;
}

export function messageHasVisualAnalyzableAttachment(m: WhatsAppMessageLike): boolean {
  return !!m.attachments?.some(rowIsVisualAnalyzableForAiWait);
}

function attachmentQueuedAtMillis(att: MessageAttachment): number | null {
  const v = att.analysisQueuedAt;
  if (v != null && typeof v === 'object' && 'toMillis' in v && typeof (v as { toMillis: () => number }).toMillis === 'function') {
    return (v as { toMillis: () => number }).toMillis();
  }
  if (v instanceof Date) return v.getTime();
  return null;
}

/** Клиентский текст рядом с вложением: ждать анализ, если пусто/плейсхолдер или явный запрос по смыслу. */
export function messageTextSuggestsAttachmentContext(text: string): boolean {
  const t = text.trim();
  if (!t || isPlaceholderMediaText(t)) return true;
  return /размер|план|дом|постро|стоим|аналог|можно|сколько|проект|этаж|площад|фото|pdf|пдф|планиров|черт|как на|такой|оцен|смет|скинул|прислал|вложен|файл/i.test(
    t
  );
}

/**
 * Пока в батче есть визуальное вложение в ожидании анализа — не дергать runtime (аналогично голосу).
 * Таймаут ~85 с от analysisQueuedAt: не блокируем ответ бесконечно.
 */
export function incomingBatchNeedsAttachmentAnalysisWait(
  batch: WhatsAppMessage[],
  mergedUpdates: Record<string, string>,
  nowMs: number
): boolean {
  for (const m of batch) {
    if (!messageHasVisualAnalyzableAttachment(m)) continue;
    const text = getMessageTextContentForAi(m, mergedUpdates);
    if (!messageTextSuggestsAttachmentContext(text)) continue;
    for (const a of m.attachments ?? []) {
      if (!rowIsVisualAnalyzableForAiWait(a)) continue;
      const st = a.analysisStatus;
      if (st === 'ready' || st === 'failed' || st === 'skipped') continue;
      if (st === 'pending' || st === 'processing') {
        const q = attachmentQueuedAtMillis(a);
        if (q != null && nowMs - q > 85_000) continue;
        return true;
      }
    }
  }
  return false;
}

/**
 * Блок для system/user истории: краткая сводка анализа вложений (уже в Firestore).
 */
export function formatAttachmentAnalysisForAiMessage(m: WhatsAppMessageLike): string {
  const atts = m.attachments ?? [];
  const lines: string[] = [];
  let idx = 0;
  for (const a of atts) {
    if (!rowIsVisualAnalyzableForAiWait(a)) continue;
    idx += 1;
    const st = a.analysisStatus;
    if (st === 'failed') {
      const err = (a.analysisError ?? '').trim().slice(0, 160);
      lines.push(`Вложение ${idx}: анализ не удался${err ? ` (${err})` : ''}.`);
      continue;
    }
    if (st === 'skipped') {
      const s = (a.analysisSummaryShort ?? '').trim();
      lines.push(`Вложение ${idx}: ${s || 'тип файла не анализируется автоматически.'}`);
      continue;
    }
    if (st !== 'ready') continue;
    const short = (a.analysisSummaryShort ?? '').trim();
    if (!short) continue;
    const struct = a.analysisStructured;
    const hints: string[] = [];
    if (struct) {
      if (struct.appearsToBeHouseProject) hints.push('похоже на проект/дом');
      if (struct.appearsToContainFloorplan) hints.push('есть планировка');
      if (struct.appearsToContainDimensions) hints.push('видны размеры');
      if (struct.detectedDimensionsText?.length) {
        hints.push(`размеры: ${struct.detectedDimensionsText.slice(0, 8).join('; ')}`);
      }
      if (struct.userIntentFromAttachment?.length) {
        hints.push(`намерение: ${struct.userIntentFromAttachment.join(', ')}`);
      }
      if (struct.warnings?.length) hints.push(`предупреждения: ${struct.warnings.join(', ')}`);
    }
    lines.push(`Вложение ${idx}: ${short}${hints.length ? ` [${hints.join(' | ')}]` : ''}`);
  }
  if (lines.length === 0) return '';
  return `Контекст вложений (CRM):\n${lines.join('\n')}`;
}

/**
 * Содержимое сообщения для AI (клиент / менеджер): transcript голосового = канонический текст клиента.
 * @param overrides — результат transcribeVoiceBatch messageId -> text (ещё не в Firestore)
 */
export function getMessageTextContentForAi(
  m: WhatsAppMessageLike,
  overrides?: Record<string, string> | null
): string {
  if (m.deleted) return '';
  const fromBatch = overrides?.[m.id]?.trim();
  const trans = (fromBatch || m.transcription || '').trim();
  if (trans) return trans.replace(/<[^>]*>/g, '').trim();
  const raw = (m.text || '').trim();
  if (!raw) return '';
  if (messageHasVoiceOrAudioAttachment(m) && isPlaceholderMediaText(raw)) return '';
  return raw.replace(/<[^>]*>/g, '').trim();
}
