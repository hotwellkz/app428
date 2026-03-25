import { createHash } from 'crypto';
import type { Handler } from '@netlify/functions';
import { getDb, getWazzupApiKeyForCompany, saveMessage } from './lib/firebaseAdmin';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const WAZZUP_MESSAGE_URL = 'https://api.wazzup24.com/v3/message';

function normalizeText(input: string): string {
  return input.replace(/\r\n/g, '\n').replace(/\n\n+/g, '\n\n').trim();
}

function payloadHash(chatId: string, text: string): string {
  return createHash('sha256').update(`${chatId}\n${text}`).digest('hex');
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, code: 'method_not_allowed' }) };
  }

  let body: {
    managerId?: string;
    chatId?: string;
    text?: string;
    clientMessageId?: string;
  };
  try {
    body = JSON.parse(event.body || '{}') as typeof body;
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, code: 'invalid_json' }) };
  }

  const managerId = String(body.managerId ?? '').trim();
  const chatId = String(body.chatId ?? '').trim();
  const text = normalizeText(String(body.text ?? ''));
  const clientMessageId = String(body.clientMessageId ?? '').trim();

  if (!managerId || !chatId || !text || !clientMessageId) {
    return {
      statusCode: 400,
      headers: CORS,
      body: JSON.stringify({ ok: false, code: 'invalid_request', message: 'managerId, chatId, text, clientMessageId are required' })
    };
  }

  try {
    const db = getDb();
    const idemId = `${managerId}:${chatId}:${clientMessageId}`;
    const idemRef = db.collection('mobileSendIdempotency').doc(idemId);
    const reqHash = payloadHash(chatId, text);
    const idemSnap = await idemRef.get();

    if (idemSnap.exists) {
      const d = idemSnap.data() as
        | {
            payloadHash?: string;
            serverMessageId?: string;
            status?: string;
            createdAt?: number;
          }
        | undefined;
      if (d?.payloadHash && d.payloadHash !== reqHash) {
        return {
          statusCode: 409,
          headers: { ...CORS, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ok: false,
            code: 'conflict',
            message: 'clientMessageId already used with different payload'
          })
        };
      }
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: true,
          chatId,
          clientMessageId,
          serverMessageId: d?.serverMessageId ?? null,
          status: d?.status ?? 'sent',
          createdAt: d?.createdAt ?? Date.now()
        })
      };
    }

    const convSnap = await db.collection('whatsappConversations').doc(chatId).get();
    if (!convSnap.exists) {
      return {
        statusCode: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, code: 'chat_not_found', message: 'Chat not found' })
      };
    }
    const conv = convSnap.data() as
      | {
          clientId?: string;
          phone?: string;
          wazzupChannelId?: string;
          wazzupTransport?: string;
          wazzupChatId?: string;
          companyId?: string;
        }
      | undefined;
    const clientId = String(conv?.clientId ?? '').trim();
    if (!clientId) {
      return {
        statusCode: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, code: 'chat_not_found', message: 'Chat client is missing' })
      };
    }

    const ownerSnap = await db
      .collection('whatsappClients')
      .where('companyId', '==', 'hotwell')
      .where('managerId', '==', managerId)
      .where('__name__', '==', clientId)
      .limit(1)
      .get();
    if (ownerSnap.empty) {
      return {
        statusCode: 403,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, code: 'forbidden', message: 'Chat does not belong to manager' })
      };
    }

    const companyId = String(conv?.companyId ?? 'hotwell').trim() || 'hotwell';
    const apiKey = await getWazzupApiKeyForCompany(companyId);
    if (!apiKey?.trim()) {
      return {
        statusCode: 403,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: false,
          code: 'integration_not_configured',
          message: 'Wazzup API key is not configured'
        })
      };
    }

    const channelId = String(conv?.wazzupChannelId ?? '').trim();
    if (!channelId) {
      return {
        statusCode: 409,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: false,
          code: 'missing_channel',
          message: 'Conversation has no wazzupChannelId yet'
        })
      };
    }
    const transport = String(conv?.wazzupTransport ?? '').toLowerCase();
    const chatType = transport === 'instagram' ? 'instagram' : 'whatsapp';
    const chatIdWazzup =
      String(conv?.wazzupChatId ?? '').trim() ||
      (chatType === 'instagram' ? String(conv?.phone ?? '').trim() : String(conv?.phone ?? '').replace(/^\+/, ''));
    if (!chatIdWazzup) {
      return {
        statusCode: 409,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: false,
          code: 'missing_chat_route',
          message: 'Conversation has no routable chat id'
        })
      };
    }

    const wazzupResp = await fetch(WAZZUP_MESSAGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channelId,
        chatType,
        chatId: chatIdWazzup,
        text
      })
    });
    const raw = await wazzupResp.text();
    const parsed = raw ? (JSON.parse(raw) as { messageId?: string; id?: string }) : {};
    if (!wazzupResp.ok) {
      return {
        statusCode: wazzupResp.status >= 500 ? 502 : 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: false,
          code: 'transport_error',
          message: 'Wazzup API error',
          retryable: wazzupResp.status >= 500
        })
      };
    }

    const serverMessageId = String(parsed.messageId ?? parsed.id ?? '').trim() || clientMessageId;
    await saveMessage(chatId, text, 'outgoing', {
      status: 'sent',
      providerMessageId: serverMessageId,
      channel: chatType === 'instagram' ? 'instagram' : 'whatsapp',
      companyId
    });
    const now = Date.now();
    await idemRef.set({
      managerId,
      chatId,
      clientMessageId,
      payloadHash: reqHash,
      serverMessageId,
      status: 'sent',
      createdAt: now,
      updatedAt: now
    });

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        chatId,
        clientMessageId,
        serverMessageId,
        status: 'sent',
        createdAt: now,
        message: {
          messageId: serverMessageId,
          serverMessageId,
          chatId,
          direction: 'outgoing',
          text,
          status: 'sent',
          createdAt: now,
          attachments: []
        }
      })
    };
  } catch (e: unknown) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        code: 'internal_error',
        message: (e as { message?: string })?.message ?? 'Send failed'
      })
    };
  }
};
