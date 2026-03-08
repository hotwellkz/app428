import type { WhatsAppMessage } from '../../types/whatsappDb';

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
