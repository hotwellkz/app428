/**
 * Единое правило: текст для AI из WhatsApp-сообщения.
 * Голосовые: приоритет у transcription; поле text не считается расшифровкой (часто пустое или плейсхолдер).
 */

export type WhatsAppMessageLike = {
  id: string;
  text?: string;
  transcription?: string | null;
  deleted?: boolean;
  attachments?: Array<{ type: string; url?: string }>;
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
  return !!m.attachments?.some((a) => a.type === 'audio' || a.type === 'voice');
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
