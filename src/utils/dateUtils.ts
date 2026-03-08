import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export const formatDateKey = (timestamp: any): string => {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return format(date, 'yyyy-MM-dd');
};

export const formatDateHeader = (dateKey: string): string => {
  const date = new Date(dateKey);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateKey === format(today, 'yyyy-MM-dd')) {
    return 'Сегодня';
  } else if (dateKey === format(yesterday, 'yyyy-MM-dd')) {
    return 'Вчера';
  }

  return format(date, 'EEE, d MMMM', { locale: ru }).toUpperCase();
};

export const formatTime = (timestamp: any): string => {
  if (!timestamp) return '';
  const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : (timestamp.seconds != null ? new Date(timestamp.seconds * 1000) : new Date());
  return format(date, 'HH:mm');
};