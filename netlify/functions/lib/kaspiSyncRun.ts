/**
 * Общая логика синхронизации заказов Kaspi для одной компании.
 * Используется ручным вызовом (kaspi-sync-orders) и по расписанию (kaspi-sync-scheduled).
 */
import { getDb, findClientByPhone, createClient, getKaspiIntegration, setKaspiIntegration } from './firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

const KASPI_ORDERS_BASE = 'https://kaspi.kz/shop/api/v2';

interface KaspiOrderLike {
  id?: string;
  code?: string;
  number?: string;
  status?: string;
  totalPrice?: number;
  totalAmount?: number;
  customer?: { name?: string; fullName?: string; phone?: string; cellPhone?: string; address?: string };
  deliveryAddress?: { formatted?: string; address?: string };
  buyerName?: string;
  phone?: string;
  address?: string;
  items?: Array<{ name?: string; productName?: string; quantity?: number; amount?: number }>;
  [key: string]: unknown;
}

interface KaspiApiResponse {
  data?: KaspiOrderLike[];
  orders?: KaspiOrderLike[];
  [key: string]: unknown;
}

export interface RunSyncResult {
  ok: boolean;
  processed: number;
  found: number;
  error?: string;
}

export async function runKaspiSyncForCompany(companyId: string): Promise<RunSyncResult> {
  const integration = await getKaspiIntegration(companyId);
  if (!integration?.apiKey?.trim()) {
    return { ok: false, processed: 0, found: 0, error: 'Kaspi не настроен' };
  }
  if (!integration.enabled) {
    return { ok: false, processed: 0, found: 0, error: 'Интеграция отключена' };
  }

  const apiKey = integration.apiKey.trim();
  const db = getDb();
  const syncRef = db.collection('kaspiSync').doc(companyId);
  const syncSnap = await syncRef.get();
  const lastSync: string | null = syncSnap.exists ? (syncSnap.data()?.lastSync as string | undefined) ?? null : null;

  try {
    const url = new URL(KASPI_ORDERS_BASE + '/orders');
    url.searchParams.set('page[number]', '0');
    url.searchParams.set('page[size]', '50');
    url.searchParams.set('filter[orders][state]', 'NEW');
    // Обязательный фильтр: дата создания заказа >= (в миллисекундах с эпохи)
    const nowMs = Date.now();
    const geMs = lastSync ? Math.min(new Date(lastSync).getTime(), nowMs - 1000) : nowMs - 14 * 24 * 60 * 60 * 1000; // при первом запросе — последние 14 дней (лимит API)
    url.searchParams.set('filter[orders][creationDate][$ge]', String(geMs));
    url.searchParams.set('filter[orders][creationDate][$le]', String(nowMs));

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/vnd.api+json;charset=UTF-8', 'X-Auth-Token': apiKey }
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      await setKaspiIntegration(companyId, {
        lastSyncAt: Timestamp.now(),
        lastSyncStatus: 'error',
        lastSyncMessage: `API ${res.status}: ${text.slice(0, 200)}`,
        lastSyncOrdersCount: null
      }).catch(() => {});
      return { ok: false, processed: 0, found: 0, error: `Kaspi API ${res.status}` };
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
      await setKaspiIntegration(companyId, {
        lastSyncAt: Timestamp.now(),
        lastSyncStatus: 'success',
        lastSyncMessage: 'Заказов не найдено',
        lastSyncOrdersCount: 0
      });
      return { ok: true, processed: 0, found: 0 };
    }

    const conversationsCol = db.collection('whatsappConversations');
    const nowIso = new Date().toISOString();
    const nowTs = Timestamp.now();
    let processed = 0;

    for (const order of ordersArray) {
      const orderNumber = String(order.code ?? order.number ?? order.id ?? '').trim();
      if (!orderNumber) continue;

      const dupSnap = await conversationsCol
        .where('companyId', '==', companyId)
        .where('kaspiOrderNumber', '==', orderNumber)
        .limit(1)
        .get();
      if (!dupSnap.empty) continue;

      const customerName =
        order.customer?.name ?? order.customer?.fullName ?? order.buyerName ?? 'Клиент Kaspi';
      const rawPhone = order.customer?.phone ?? order.customer?.cellPhone ?? order.phone ?? '';
      if (!rawPhone) continue;

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

      let client = await findClientByPhone(rawPhone, companyId);
      if (!client) {
        await createClient(rawPhone, customerName, null, companyId);
        client = await findClientByPhone(rawPhone, companyId);
        if (!client) continue;
      }

      await conversationsCol.add({
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
        source: 'Kaspi',
        kaspiOrderNumber: orderNumber,
        kaspiOrderAmount: amount,
        kaspiOrderStatus: order.status ?? 'Новый заказ Kaspi',
        kaspiOrderCustomerName: customerName,
        kaspiOrderAddress: address || null,
        kaspiOrderItems: items,
        kaspiOrderUrl: 'https://kaspi.kz/shop/orders',
        lastMessagePreview:
          `Kaspi заказ №${orderNumber}` + (amount && amount > 0 ? ` на ${amount.toLocaleString('ru-RU')} ₸` : '')
      });
      processed += 1;
    }

    await syncRef.set({ companyId, lastSync: nowIso, updatedAt: nowTs }, { merge: true });
    await setKaspiIntegration(companyId, {
      lastSyncAt: Timestamp.now(),
      lastSyncStatus: 'success',
      lastSyncMessage: `Импортировано новых заказов: ${processed}`,
      lastSyncOrdersCount: processed
    });

    return { ok: true, processed, found: ordersArray.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Ошибка синхронизации';
    await setKaspiIntegration(companyId, {
      lastSyncAt: Timestamp.now(),
      lastSyncStatus: 'error',
      lastSyncMessage: message,
      lastSyncOrdersCount: null
    }).catch(() => {});
    return { ok: false, processed: 0, found: 0, error: message };
  }
}
