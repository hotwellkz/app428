import { getAuthToken } from '../lib/firebase/auth';

const TELEGRAM_NOTIFY_URL = '/.netlify/functions/telegram-notify';

/**
 * Уведомление о транзакции/складе в Telegram. Секреты только на сервере (Netlify Function).
 * Если TRANSACTIONS_TELEGRAM_CHAT_ID / TELEGRAM_BOT_TOKEN не заданы в env — тихий skip (ok: false, skipped).
 */
export const sendTelegramNotification = async (
  message: string,
  options?: { parseMode?: 'HTML' }
): Promise<boolean> => {
  try {
    const token = await getAuthToken();
    if (!token) {
      console.warn('Telegram notify: no auth token');
      return false;
    }

    const response = await fetch(TELEGRAM_NOTIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        message,
        parseMode: options?.parseMode
      })
    });

    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      skipped?: boolean;
      reason?: string;
      error?: string | null;
    };

    if (!response.ok) {
      console.warn('Telegram notify failed:', data);
      return false;
    }
    if (data.skipped) {
      return false;
    }
    if (data.ok === false && data.error) {
      console.warn('Telegram notify:', data.error);
      return false;
    }
    return data.ok === true;
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    return false;
  }
};

export const formatTransactionMessage = (
  fromUser: string,
  toUser: string,
  amount: number,
  description: string,
  type: 'income' | 'expense',
  waybillNumber?: string
): string => {
  const formattedAmount = Math.round(amount).toLocaleString('ru-RU');

  if (waybillNumber) {
    const emoji = type === 'income' ? '📥' : '📤';
    const waybillLink = `https://t.me/HotWellBot/waybill/${waybillNumber}`;
    return `
${emoji} <b>Складская операция</b>

<b>От:</b> ${fromUser}
<b>Кому:</b> ${toUser}
<b>Сумма:</b> ${formattedAmount} ₸
<b>Примечание:</b> ${description}
<b>Накладная:</b> <a href="${waybillLink}">№${waybillNumber}</a>
    `.trim();
  }

  return `🔴 Расчет по Чекам HotWell.KZ

От: ${fromUser}
Кому: ${toUser}
Сумма: ${formattedAmount} ₸
Примечание: ${description}`.trim();
};
