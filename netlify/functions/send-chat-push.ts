import type { Handler } from '@netlify/functions';
import { sendChatPushToManager } from './lib/mobilePushSender';

type Body = {
  managerId?: string;
  userId?: string;
  chatId?: string;
  phone?: string;
  clientName?: string;
  preview?: string;
  unreadCount?: number | string;
  targetUrl?: string;
  messageId?: string;
  type?: string;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
  }

  let body: Body;
  try {
    body = JSON.parse(event.body || '{}') as Body;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) };
  }

  const managerId = String(body.managerId ?? body.userId ?? '').trim();
  if (!managerId) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'managerId is required' }) };

  const unreadCount =
    typeof body.unreadCount === 'number'
      ? body.unreadCount
      : typeof body.unreadCount === 'string'
        ? Number.parseInt(body.unreadCount, 10)
        : undefined;

  try {
    const result = await sendChatPushToManager({
      managerId,
      chatId: body.chatId?.trim() || undefined,
      phone: body.phone?.trim() || undefined,
      clientName: body.clientName?.trim() || undefined,
      preview: body.preview?.trim() || undefined,
      unreadCount: typeof unreadCount === 'number' && Number.isFinite(unreadCount) ? unreadCount : undefined,
      targetUrl: body.targetUrl?.trim() || undefined,
      messageId: body.messageId?.trim() || undefined,
      type: body.type?.trim() || undefined
    });
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message || 'send failed';
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: msg }) };
  }
};

