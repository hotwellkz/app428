/**
 * Server-only Telegram transport. Tokens and chat IDs come from env — never from the client.
 * Shared by AI-control alerting and optional transaction/warehouse notifications.
 */

export type TelegramSendResult = { ok: boolean; error?: string };

const TELEGRAM_MAX = 3900;

export async function sendTelegramMessage(options: {
  token: string;
  chatId: string;
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disableWebPagePreview?: boolean;
}): Promise<TelegramSendResult> {
  const { token, chatId, text, parseMode, disableWebPagePreview = true } = options;
  const trimmed = text.length > TELEGRAM_MAX ? `${text.slice(0, TELEGRAM_MAX)}…` : text;
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: trimmed,
    disable_web_page_preview: disableWebPagePreview
  };
  if (parseMode) body.parse_mode = parseMode;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: errText.slice(0, 500) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** AI-control alerts (SLA / escalation) */
export function getAiControlTelegramEnv(): { token: string; chatId: string } | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.AI_CONTROL_TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return null;
  return { token, chatId };
}

/** Склад / переводы — отдельный чат, тот же бот (один TELEGRAM_BOT_TOKEN) */
export function getTransactionsTelegramEnv(): { token: string; chatId: string } | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TRANSACTIONS_TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return null;
  return { token, chatId };
}

export async function sendAiControlTelegram(text: string): Promise<TelegramSendResult> {
  const cfg = getAiControlTelegramEnv();
  if (!cfg) return { ok: false, error: 'telegram transport not configured' };
  return sendTelegramMessage({
    token: cfg.token,
    chatId: cfg.chatId,
    text,
    disableWebPagePreview: true
  });
}
