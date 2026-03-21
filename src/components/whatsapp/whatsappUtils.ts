import type { WhatsAppMessage, MessageStatus, MessageAttachment } from '../../types/whatsappDb';

/** Длительность для превью в списке чатов (mm:ss, часы при необходимости). */
export function formatVoiceListDuration(totalSec: number | null | undefined): string | null {
  if (totalSec == null || !Number.isFinite(totalSec) || totalSec < 0) return null;
  const s = Math.floor(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
  }
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/** Голосовое (PTT) vs обычный аудиофайл: по типу и эвристике имени/mime. */
export function isVoiceNoteAttachment(att: MessageAttachment | undefined): boolean {
  if (!att) return false;
  if (att.type === 'voice') return true;
  if (att.type !== 'audio') return false;
  const name = (att.fileName ?? '').toLowerCase();
  if (name.startsWith('voice.')) return true;
  const mime = (att.mimeType ?? '').toLowerCase();
  if (mime.includes('opus') && mime.includes('ogg')) return true;
  if (mime.includes('opus')) return true;
  const url = (att.url ?? '').toLowerCase();
  if (url.includes('.ogg') || url.includes('opus')) return true;
  /** Синтетическое превью списка / Wazzup: только длительность, без имени файла. */
  if (
    typeof att.durationSeconds === 'number' &&
    att.durationSeconds >= 0 &&
    att.durationSeconds <= 3600 &&
    !name.trim()
  ) {
    return true;
  }
  return false;
}

/**
 * Парсит строку вида «0:09» или «1:02:03» в секунды.
 */
function parseCompactDurationLabelToSeconds(label: string): number | undefined {
  const parts = label.split(':').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return undefined;
  const nums = parts.map((p) => parseInt(p, 10));
  if (nums.some((n) => Number.isNaN(n))) return undefined;
  if (nums.length === 2) return nums[0] * 60 + nums[1];
  return nums[0] * 3600 + nums[1] * 60 + nums[2];
}

/**
 * Денормализованный текст превью диалога: «Голосовое сообщение» / «Голосовое сообщение · 0:09».
 * Используется, когда в summary нет lastMessageMediaKind, но текст превью уже голосовой.
 */
export function parseVoiceListPreviewFromText(text: string | null | undefined): { durationSeconds?: number } | null {
  const t = (text ?? '').trim();
  if (!t.startsWith('Голосовое сообщение')) return null;
  const dot = t.indexOf('·');
  if (dot === -1) return {};
  const label = t.slice(dot + 1).trim();
  if (!label) return {};
  const sec = parseCompactDurationLabelToSeconds(label);
  if (sec === undefined || !Number.isFinite(sec) || sec < 0) return {};
  return { durationSeconds: sec };
}

/** Маппинг статуса от Wazzup (sent|delivered|read|error) в UI. */
export function mapProviderStatusToUiStatus(
  rawStatus: string | undefined,
  _payload?: unknown
): MessageStatus {
  if (!rawStatus) return 'pending';
  const s = String(rawStatus).toLowerCase();
  if (s === 'sent') return 'sent';
  if (s === 'delivered') return 'delivered';
  if (s === 'read') return 'read';
  if (s === 'error' || s === 'failed') return 'failed';
  return 'pending';
}

export function formatMessageTime(createdAt: WhatsAppMessage['createdAt']): string {
  if (!createdAt) return '';
  let ms: number;
  if (typeof (createdAt as { toMillis?: () => number }).toMillis === 'function') {
    ms = (createdAt as { toMillis: () => number }).toMillis();
  } else if (typeof createdAt === 'object' && createdAt !== null && 'seconds' in (createdAt as object)) {
    ms = ((createdAt as { seconds: number }).seconds ?? 0) * 1000;
  } else {
    ms = new Date(createdAt as string).getTime();
  }
  const d = new Date(ms);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function formatLastMessageTime(createdAt: WhatsAppMessage['createdAt']): string {
  if (!createdAt) return '';
  let ms: number;
  if (typeof (createdAt as { toMillis?: () => number }).toMillis === 'function') {
    ms = (createdAt as { toMillis: () => number }).toMillis();
  } else if (typeof createdAt === 'object' && createdAt !== null && 'seconds' in (createdAt as object)) {
    ms = ((createdAt as { seconds: number }).seconds ?? 0) * 1000;
  } else {
    ms = new Date(createdAt as string).getTime();
  }
  const d = new Date(ms);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Вчера';
  if (diffDays < 7) return d.toLocaleDateString('ru-RU', { weekday: 'short' });
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}
