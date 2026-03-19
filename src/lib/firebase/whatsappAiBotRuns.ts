import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

export const WHATSAPP_AI_BOT_RUNS_COLLECTION = 'whatsappAiBotRuns';

export type WhatsAppAiBotRunStatus = 'success' | 'error' | 'skipped';

export interface WhatsAppAiBotRunLogInput {
  companyId: string;
  conversationId: string;
  botId: string;
  mode: string;
  triggerMessageId: string;
  startedAt: unknown;
  finishedAt: unknown;
  status: WhatsAppAiBotRunStatus;
  reason?: string | null;
  generatedReply?: string | null;
  extractedSummary?: string | null;
  /** Auto-apply extraction → CRM */
  extractionApplied?: boolean;
  extractionApplyStatus?: 'applied' | 'skipped' | 'error';
  extractionApplyReason?: string | null;
  extractionAppliedFields?: string[] | null;
  extractionAppliedLabels?: string[] | null;
  extractionAppliedFieldCount?: number | null;
  appliedClientId?: string | null;
  extractionAppliedAt?: string | null;
  dealRecommendationForLog?: string | null;
  dealRecommendationStatus?: string | null;
  dealRecommendationReason?: string | null;
  dealDraftTitle?: string | null;
}

/** Аудит запусков AI в WhatsApp (отладка и поддержка). */
export async function addWhatsAppAiBotRunLog(input: WhatsAppAiBotRunLogInput): Promise<string> {
  const ref = await addDoc(collection(db, WHATSAPP_AI_BOT_RUNS_COLLECTION), {
    ...input,
    createdAt: serverTimestamp()
  });
  return ref.id;
}
