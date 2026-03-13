/**
 * Доп. данные для аналитики: клиенты (стройка), транзакции, склад.
 * Только чтение существующих коллекций.
 */
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from './config';
import { assertAnalyticsView } from './analyticsDashboard';
import type { MenuAccess } from '../../types/menuAccess';

export interface ClientAnalyticsRow {
  id: string;
  name: string;
  objectName: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  startDate?: string;
  buildDays?: number;
  constructionDays?: number;
  deposit: number;
}

export interface TxAnalyticsRow {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  dateMs: number;
  description: string;
  fromUser: string;
  toUser: string;
  status?: string;
  editType?: string;
}

export interface ProductAnalyticsRow {
  id: string;
  name: string;
  quantity: number;
  minQuantity?: number;
  averagePurchasePrice?: number;
  unit?: string;
}

export interface WarehouseDocRow {
  id: string;
  type: 'income' | 'expense';
  date: string;
  dateMs: number;
  items: Array<{ product: { name: string; unit?: string }; quantity: number; price: number }>;
}

function toMs(v: unknown): number {
  if (!v) return 0;
  if (typeof (v as Timestamp).toMillis === 'function') return (v as Timestamp).toMillis();
  if (typeof v === 'object' && v !== null && 'seconds' in (v as object))
    return ((v as { seconds: number }).seconds || 0) * 1000;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(v).getTime();
  return 0;
}

function parseDocDate(d: string): number {
  const t = Date.parse(d);
  return Number.isFinite(t) ? t : 0;
}

export async function fetchClientsForAnalytics(
  companyId: string,
  menuAccess?: MenuAccess | null
): Promise<ClientAnalyticsRow[]> {
  assertAnalyticsView(menuAccess);
  const q = query(collection(db, 'clients'), where('companyId', '==', companyId));
  const snap = await getDocs(q);
  return snap.docs.map((doc) => {
    const x = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      name: String(x.name || x.firstName || ''),
      objectName: String(x.objectName || ''),
      status: String(x.status || ''),
      createdAt: toMs(x.createdAt),
      updatedAt: toMs(x.updatedAt) || toMs(x.createdAt),
      startDate: x.startDate ? String(x.startDate) : undefined,
      buildDays: typeof x.buildDays === 'number' ? x.buildDays : typeof x.constructionDays === 'number' ? x.constructionDays : 45,
      constructionDays: typeof x.constructionDays === 'number' ? x.constructionDays : undefined,
      deposit: Number(x.deposit) || 0
    };
  });
}

export async function fetchTransactionsForAnalytics(
  companyId: string,
  maxDocs: number,
  menuAccess?: MenuAccess | null
): Promise<TxAnalyticsRow[]> {
  assertAnalyticsView(menuAccess);
  const q = query(
    collection(db, 'transactions'),
    where('companyId', '==', companyId),
    orderBy('date', 'desc'),
    limit(maxDocs)
  );
  const snap = await getDocs(q);
  const corrected = new Set(
    snap.docs.map((d) => d.data().correctedFrom).filter(Boolean) as string[]
  );
  const rows: TxAnalyticsRow[] = [];
  snap.docs.forEach((d) => {
    const x = d.data() as Record<string, unknown>;
    if (x.status === 'cancelled' || x.editType === 'reversal' || corrected.has(d.id)) return;
    const type = x.type === 'expense' ? 'expense' : 'income';
    rows.push({
      id: d.id,
      type,
      amount: Math.abs(Number(x.amount) || 0),
      dateMs: toMs(x.date),
      description: String(x.description || ''),
      fromUser: String(x.fromUser || ''),
      toUser: String(x.toUser || ''),
      status: x.status as string | undefined,
      editType: x.editType as string | undefined
    });
  });
  return rows;
}

export async function fetchProductsForAnalytics(
  companyId: string,
  menuAccess?: MenuAccess | null
): Promise<ProductAnalyticsRow[]> {
  assertAnalyticsView(menuAccess);
  const q = query(collection(db, 'products'), where('companyId', '==', companyId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const x = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      name: String(x.name || ''),
      quantity: Number(x.quantity) || 0,
      minQuantity: typeof x.minQuantity === 'number' ? x.minQuantity : 5,
      averagePurchasePrice: Number(x.averagePurchasePrice) || 0,
      unit: String(x.unit || '')
    };
  });
}

export async function fetchWarehouseDocumentsForAnalytics(
  companyId: string,
  maxDocs: number,
  menuAccess?: MenuAccess | null
): Promise<WarehouseDocRow[]> {
  assertAnalyticsView(menuAccess);
  const q = query(
    collection(db, 'warehouseDocuments'),
    where('companyId', '==', companyId),
    orderBy('date', 'desc'),
    limit(maxDocs)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const x = d.data() as Record<string, unknown>;
    const dateStr = String(x.date || '').slice(0, 10);
    const items = Array.isArray(x.items) ? x.items : [];
    return {
      id: d.id,
      type: x.type === 'expense' ? 'expense' : 'income',
      date: dateStr,
      dateMs: parseDocDate(dateStr) || toMs(x.createdAt),
      items: items as WarehouseDocRow['items']
    };
  });
}
