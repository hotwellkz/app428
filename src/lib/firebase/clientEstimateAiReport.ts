import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';
import type { Timestamp } from 'firebase/firestore';

const COLLECTION_CLIENT_ESTIMATE_AI_REPORTS = 'clientEstimateAiReports';

export interface EstimateVsActualSummary {
  totalEstimate: number;
  totalActual: number;
  difference: number;
  differencePercent: number;
  verdict: 'over' | 'under' | 'match';
  summaryText?: string;
}

export interface EstimateVsActualCategory {
  categoryName: string;
  estimate: number;
  actual: number;
  difference: number;
  confidence: 'high' | 'medium' | 'low';
  note?: string;
}

export interface UnclassifiedOrSuspiciousItem {
  transactionId: string;
  amount: number;
  description?: string;
  reason?: string;
}

/** Статус позиции при позиционном сравнении сметы и факта */
export type EstimateLineStatus =
  | 'ok'       // в норме
  | 'overrun'  // перерасход
  | 'savings'  // экономия
  | 'no_fact'  // нет факта
  | 'outside'  // расход вне сметы (только для outsideEstimate)
  | 'ambiguous'; // недостаточно данных / нужна проверка

/** Одна строка позиционного сравнения сметы и факта */
export interface EstimateLineItemRow {
  name: string;
  section?: string;
  planQty?: number;
  planPrice?: number;
  planSum: number;
  factQty?: number | null;
  factSum?: number | null;
  deviation?: number | null;
  deviationQty?: number | null;
  deviationPrice?: number | null;
  status: EstimateLineStatus;
  comment?: string;
  confidence: 'high' | 'medium' | 'low';
  transactionIds?: string[];
}

export interface EstimateVsActualReport {
  summary: EstimateVsActualSummary;
  /** Позиционное сравнение (новая схема); при наличии используется в UI */
  lineItems?: EstimateLineItemRow[];
  /** Устаревшие поля — для обратной совместимости со старыми сохранёнными отчётами */
  byCategory?: EstimateVsActualCategory[];
  unclassifiedExpenses?: UnclassifiedOrSuspiciousItem[];
  suspicious?: UnclassifiedOrSuspiciousItem[];
  /** Расходы, не привязанные ни к одной строке сметы (вне сметы) */
  outsideEstimate?: UnclassifiedOrSuspiciousItem[];
  recommendations: string[];
}

export interface EstimateSnapshot {
  foundation?: number;
  sipWalls?: number;
  roof?: number;
  floor?: number;
  partitions?: number;
  consumables?: number;
  additionalWorks?: number;
  builderSalary?: number;
  operationalExpenses?: number;
  grandTotal?: number;
}

interface ClientEstimateAiReportDoc {
  companyId: string;
  clientId: string;
  estimateSnapshot: EstimateSnapshot;
  transactionsCount: number;
  report: EstimateVsActualReport;
  analyzedAt: Timestamp | ReturnType<typeof serverTimestamp>;
  createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
  createdBy?: string | null;
}

export interface ClientEstimateAiReportSaved {
  report: EstimateVsActualReport;
  estimateSnapshot: EstimateSnapshot;
  transactionsCount: number;
  analyzedAt: Date | null;
}

function docId(companyId: string, clientId: string): string {
  const a = (companyId ?? '').replace(/\//g, '_');
  const b = (clientId ?? '').replace(/\//g, '_');
  return `${a}__${b}`;
}

export async function getClientEstimateAiReport(
  companyId: string,
  clientId: string
): Promise<ClientEstimateAiReportSaved | null> {
  if (!companyId || !clientId) return null;
  const ref = doc(db, COLLECTION_CLIENT_ESTIMATE_AI_REPORTS, docId(companyId, clientId));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as ClientEstimateAiReportDoc;
  if (data.companyId !== companyId) return null;
  let analyzedAt: Date | null = null;
  if (data.analyzedAt != null) {
    const t = data.analyzedAt as { toDate?: () => Date; seconds?: number };
    if (typeof t.toDate === 'function') analyzedAt = t.toDate();
    else if (typeof t.seconds === 'number') analyzedAt = new Date(t.seconds * 1000);
  }
  return {
    report: data.report,
    estimateSnapshot: data.estimateSnapshot ?? {},
    transactionsCount: data.transactionsCount ?? 0,
    analyzedAt,
  };
}

export async function setClientEstimateAiReport(
  companyId: string,
  clientId: string,
  estimateSnapshot: EstimateSnapshot,
  transactionsCount: number,
  report: EstimateVsActualReport,
  createdBy?: string | null
): Promise<void> {
  if (!companyId || !clientId) return;
  const ref = doc(db, COLLECTION_CLIENT_ESTIMATE_AI_REPORTS, docId(companyId, clientId));
  const now = serverTimestamp();
  await setDoc(
    ref,
    {
      companyId,
      clientId,
      estimateSnapshot,
      transactionsCount,
      report,
      analyzedAt: now,
      createdAt: now,
      createdBy: createdBy ?? null,
    },
    { merge: true }
  );
}
