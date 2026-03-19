import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { CrmAiBotExtractionResult } from '../../types/crmAiBotExtraction';
import { buildCrmApplyPreview, previewHasWritableChanges } from './extractionCrmMapper';

export async function loadClientDocForCompany(
  clientId: string,
  companyId: string
): Promise<Record<string, unknown> | null> {
  const ref = doc(db, 'clients', clientId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  if (data.companyId !== companyId) return null;
  return data;
}

/**
 * Подтверждённая запись: пересобирает patch из актуального документа и extraction.
 */
export async function applyExtractionToClientDoc(
  clientId: string,
  companyId: string,
  extraction: CrmAiBotExtractionResult
): Promise<{ updatedKeys: string[] }> {
  const data = await loadClientDocForCompany(clientId, companyId);
  if (!data) throw new Error('Клиент не найден или нет доступа');
  const preview = buildCrmApplyPreview(extraction, data);
  if (!previewHasWritableChanges(preview)) {
    throw new Error('Нечего записывать: нет новых данных или все поля совпадают');
  }
  const patch: Record<string, unknown> = {
    ...preview.firestoreUpdate,
    updatedAt: serverTimestamp()
  };
  await updateDoc(doc(db, 'clients', clientId), patch);
  return { updatedKeys: Object.keys(preview.firestoreUpdate) };
}
