import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getDb, findClientByPhone, createClient, DEFAULT_COMPANY_ID } from './lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

const LOG_PREFIX = '[kaspi-sync-orders]';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

function withCors(res: HandlerResponse): HandlerResponse {
  return { ...res, headers: { ...CORS_HEADERS, ...res.headers } };
}

function log(...args: unknown[]) {
  console.log(LOG_PREFIX, ...args);
}

interface KaspiOrderLike {
  id?: string;
  code?: string;
  number?: string;
  status?: string;
  approvedAt?: string;
  createdAt?: string;
  totalPrice?: number;
  totalAmount?: number;
  customer?: {
    name?: string;
    fullName?: string;
    phone?: string;
    cellPhone?: string;
    address?: string;
  };
  deliveryAddress?: {
    formatted?: string;
    address?: string;
  };
  buyerName?: string;
  phone?: string;
  address?: string;
  items?: Array<{
    name?: string;
    productName?: string;
    quantity?: number;
    amount?: number;
  }>;
  [key: string]: unknown;
}

interface KaspiApiResponse {
  data?: KaspiOrderLike[];
  orders?: KaspiOrderLike[];
  [key: string]: unknown;
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return withCors({ statusCode: 204, headers: {}, body: '' });
  }
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return withCors({
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    });
  }

  const token = process.env.KASPI_API_TOKEN;
  const baseUrl = process.env.KASPI_BASE_URL || 'https://kaspi.kz';
  const companyId = (process.env.KASPI_COMPANY_ID || DEFAULT_COMPANY_ID).trim();

  if (!token) {
    log('KASPI_API_TOKEN is not set');
    return withCors({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Kaspi API token is not configured' })
    });
  }

  const db = getDb();

  // lastSyncTimestamp по companyId
  const syncRef = db.collection('kaspiSync').doc(companyId);
  const syncSnap = await syncRef.get();
  const lastSync: string | null = syncSnap.exists ? (syncSnap.data()?.lastSync as string | undefined) ?? null : null;

  try {
    const url = new URL(baseUrl.replace(/\/$/, '') + '/shop/api/v2/orders');
    // Базовые параметры: последние заказы в статусе NEW (детальная фильтрация настраивается под реальный Kaspi API)
    const params: Record<string, string> = {
      page: '0',
      size: '50',
      status: 'NEW'
    };
    if (lastSync) {
      params['from'] = lastSync;
    }
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    log('Requesting Kaspi orders', url.toString());
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Auth-Token': token
      }
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      log('Kaspi API error', res.status, text.slice(0, 500));
      return withCors({
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Kaspi API error', status: res.status })
      });
    }

    const raw = (await res.json().catch(() => ({}))) as KaspiApiResponse | KaspiOrderLike[];
    const ordersArray =
      Array.isArray((raw as KaspiApiResponse).data)
        ? (raw as KaspiApiResponse).data
        : Array.isArray((raw as KaspiApiResponse).orders)
          ? (raw as KaspiApiResponse).orders
          : Array.isArray(raw)
            ? (raw as KaspiOrderLike[])
            : [];

    if (!ordersArray.length) {
      log('No new Kaspi orders');
      return withCors({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, processed: 0 })
      });
    }

    const conversationsCol = db.collection('whatsappConversations');
    const nowIso = new Date().toISOString();
    const nowTs = Timestamp.now();

    let processed = 0;

    for (const order of ordersArray) {
      const orderNumber = String(order.code ?? order.number ?? order.id ?? '').trim();
      if (!orderNumber) continue;

      // Защита от дублей: ищем разговор с таким номером заказа
      const dupSnap = await conversationsCol
        .where('companyId', '==', companyId)
        .where('kaspiOrderNumber', '==', orderNumber)
        .limit(1)
        .get();
      if (!dupSnap.empty) {
        continue;
      }

      const customerName =
        order.customer?.name ??
        order.customer?.fullName ??
        order.buyerName ??
        'Клиент Kaspi';
      const rawPhone =
        order.customer?.phone ?? order.customer?.cellPhone ?? order.phone ?? '';
      if (!rawPhone) {
        log('Skip order without phone', orderNumber);
        continue;
      }

      const amount = Number(order.totalPrice ?? order.totalAmount ?? 0) || null;
      const address =
        order.deliveryAddress?.formatted ??
        order.deliveryAddress?.address ??
        order.customer?.address ??
        order.address ??
        '';

      const items =
        Array.isArray(order.items) && order.items.length
          ? order.items.map((it) => ({
              name: (it.productName || it.name || 'Товар') as string,
              quantity: Number(it.quantity ?? 0) || 0
            }))
          : [];

      // Клиент WhatsApp (таблица whatsappClients)
      let client = await findClientByPhone(rawPhone, companyId);
      if (!client) {
        const clientId = await createClient(rawPhone, customerName, null, companyId);
        client = await findClientByPhone(rawPhone, companyId);
        if (!client) {
          log('Failed to create client for order', orderNumber);
          continue;
        }
        log('Created WhatsApp client for Kaspi order', orderNumber, clientId);
      }

      // Разговор под Kaspi-заказ
      const convRef = await conversationsCol.add({
        clientId: client.id,
        phone: client.phone,
        status: 'active',
        createdAt: nowTs,
        lastMessageAt: nowTs,
        lastIncomingAt: nowTs,
        lastOutgoingAt: null,
        lastClientMessageTime: nowTs,
        lastManagerMessageTime: null,
        lastMessageSender: 'client',
        unreadCount: 1,
        companyId,
        channel: 'whatsapp',
        chatType: 'whatsapp',
        // Kaspi-метаданные
        source: 'Kaspi',
        kaspiOrderNumber: orderNumber,
        kaspiOrderAmount: amount,
        kaspiOrderStatus: order.status ?? 'Новый заказ Kaspi',
        kaspiOrderCustomerName: customerName,
        kaspiOrderAddress: address || null,
        kaspiOrderItems: items,
        lastMessagePreview:
          `Kaspi заказ №${orderNumber}` +
          (amount && amount > 0 ? ` на ${amount.toLocaleString('ru-RU')} ₸` : '')
      });

      processed += 1;
      log('Created Kaspi conversation', orderNumber, convRef.id);
    }

    await syncRef.set(
      {
        companyId,
        lastSync: nowIso,
        updatedAt: nowTs
      },
      { merge: true }
    );

    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, processed })
    });
  } catch (e) {
    log('Sync failed', e);
    return withCors({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Kaspi sync failed', detail: String(e) })
    });
  }
}

