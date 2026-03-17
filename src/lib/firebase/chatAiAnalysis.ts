import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';
import type { Timestamp } from 'firebase/firestore';

const COLLECTION_CHAT_AI_ANALYSES = 'chatAiAnalyses';

/** Результат AI-разбора переписки (совпадает с SalesAnalysisResult в UI) */
export interface ChatAiAnalysisResult {
  overallAssessment: string;
  strengths: string[];
  errors: string[];
  missedOpportunities: string[];
  clientSignals: string[];
  recommendations: string[];
  nextMessage: string;
  badges?: string[];
  leadTemperature?: string;
  leadStage?: string;
  leadIntent?: string;
}

/** Документ в Firestore: результат + метаданные */
export interface ChatAiAnalysisDoc {
  companyId: string;
  conversationId: string;
  result: ChatAiAnalysisResult;
  analyzedAt: Timestamp | ReturnType<typeof serverTimestamp>;
  createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
  updatedAt: Timestamp | ReturnType<typeof serverTimestamp>;
}

/** Значение для UI: результат + дата последнего анализа */
export interface ChatAiAnalysisSaved {
  result: ChatAiAnalysisResult;
  analyzedAt: Date | null;
}

function docId(companyId: string, conversationId: string): string {
  const a = (companyId ?? '').replace(/\//g, '_');
  const b = (conversationId ?? '').replace(/\//g, '_');
  return `${a}__${b}`;
}

/**
 * Загрузить сохранённый AI-разбор для чата.
 * Изоляция по companyId: в документе хранится companyId, при несовпадении вернём null.
 */
export async function getChatAiAnalysis(
  companyId: string,
  conversationId: string
): Promise<ChatAiAnalysisSaved | null> {
  if (!companyId || !conversationId) return null;
  const ref = doc(db, COLLECTION_CHAT_AI_ANALYSES, docId(companyId, conversationId));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as ChatAiAnalysisDoc;
  if (data.companyId !== companyId) return null;
  let analyzedAt: Date | null = null;
  if (data.analyzedAt != null) {
    const t = data.analyzedAt as { toDate?: () => Date; seconds?: number };
    if (typeof t.toDate === 'function') analyzedAt = t.toDate();
    else if (typeof t.seconds === 'number') analyzedAt = new Date(t.seconds * 1000);
  }
  return {
    result: data.result,
    analyzedAt: analyzedAt ?? null,
  };
}

/**
 * Сохранить AI-разбор для чата (одна актуальная версия на чат).
 * Перезаписывает предыдущий разбор.
 */
export async function setChatAiAnalysis(
  companyId: string,
  conversationId: string,
  result: ChatAiAnalysisResult
): Promise<void> {
  if (!companyId || !conversationId) return;
  const ref = doc(db, COLLECTION_CHAT_AI_ANALYSES, docId(companyId, conversationId));
  const now = serverTimestamp();
  await setDoc(ref, {
    companyId,
    conversationId,
    result,
    analyzedAt: now,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
}
