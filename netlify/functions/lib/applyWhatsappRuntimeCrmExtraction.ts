import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from './firebaseAdmin';
import type { CrmAiBotExtractionResult } from '../../../src/types/crmAiBotExtraction';
import type { CrmAiBotConfig } from '../../../src/types/crmAiBotConfig';
import {
  buildDealRecommendationForLog,
  buildGatedCrmApplyPreview,
  previewHasWritableChanges
} from '../../../src/lib/autovoronki/extractionCrmMapper';

const CRM_CLIENTS = 'clients';

export type ExtractionApplyStatus = 'applied' | 'skipped' | 'error';

/** Ответ API для клиента + лог whatsappAiBotRuns */
export interface WhatsappRuntimeExtractionApplyPayload {
  extractionApplied: boolean;
  extractionApplyStatus: ExtractionApplyStatus;
  extractionApplyReason: string | null;
  appliedClientId: string | null;
  extractionAppliedFields: string[];
  extractionAppliedLabels: string[];
  extractionAppliedFieldCount: number;
  appliedAt: string | null;
  dealRecommendationForLog: string | null;
}

function dealLogOnly(
  extraction: CrmAiBotExtractionResult,
  crmActions: CrmAiBotConfig['crmActions']
): string | null {
  return crmActions.suggestCreateDeal === true ? buildDealRecommendationForLog(extraction) : null;
}

/**
 * Безопасное применение extraction в clients/{id} (Admin SDK), с гейтами crmActions.
 * Не вызывать с пустым extraction.
 */
export async function tryApplyWhatsappRuntimeExtraction(params: {
  companyId: string;
  clientId: string | null | undefined;
  channel: string | undefined;
  extraction: CrmAiBotExtractionResult;
  crmActions: CrmAiBotConfig['crmActions'];
}): Promise<WhatsappRuntimeExtractionApplyPayload> {
  const { companyId, clientId, channel, extraction, crmActions } = params;

  const skipped = (
    reason: string,
    extra: Partial<WhatsappRuntimeExtractionApplyPayload> = {}
  ): WhatsappRuntimeExtractionApplyPayload => ({
    extractionApplied: false,
    extractionApplyStatus: 'skipped',
    extractionApplyReason: reason,
    appliedClientId: null,
    extractionAppliedFields: [],
    extractionAppliedLabels: [],
    extractionAppliedFieldCount: 0,
    appliedAt: null,
    dealRecommendationForLog: dealLogOnly(extraction, crmActions),
    ...extra
  });

  if (channel === 'instagram') {
    return skipped('Канал Instagram — запись в CRM отключена');
  }

  if (!clientId || typeof clientId !== 'string' || !clientId.trim()) {
    return skipped(
      'Нет карточки клиента в CRM с этим номером — создайте клиента в разделе «Клиенты» (тот же телефон, что в WhatsApp)'
    );
  }

  const db = getDb();
  let snapshot;
  try {
    snapshot = await db.collection(CRM_CLIENTS).doc(clientId).get();
  } catch (e) {
    return {
      extractionApplied: false,
      extractionApplyStatus: 'error',
      extractionApplyReason: e instanceof Error ? e.message : 'Ошибка чтения карточки клиента',
      appliedClientId: null,
      extractionAppliedFields: [],
      extractionAppliedLabels: [],
      extractionAppliedFieldCount: 0,
      appliedAt: null,
      dealRecommendationForLog: dealLogOnly(extraction, crmActions)
    };
  }

  if (!snapshot.exists) {
    return skipped('Карточка клиента не найдена');
  }

  const data = snapshot.data() as Record<string, unknown>;
  if (data.companyId !== companyId) {
    return skipped('Карточка клиента не принадлежит компании');
  }

  const { preview, skipReason, dealRecommendationForLog } = buildGatedCrmApplyPreview(
    extraction,
    data,
    crmActions
  );

  if (!previewHasWritableChanges(preview)) {
    return {
      extractionApplied: false,
      extractionApplyStatus: 'skipped',
      extractionApplyReason: skipReason ?? 'Нечего записывать',
      appliedClientId: clientId,
      extractionAppliedFields: [],
      extractionAppliedLabels: [],
      extractionAppliedFieldCount: 0,
      appliedAt: null,
      dealRecommendationForLog
    };
  }

  try {
    await db
      .collection(CRM_CLIENTS)
      .doc(clientId)
      .update({
        ...preview.firestoreUpdate,
        updatedAt: FieldValue.serverTimestamp()
      });
  } catch (e) {
    return {
      extractionApplied: false,
      extractionApplyStatus: 'error',
      extractionApplyReason: e instanceof Error ? e.message : 'Ошибка записи в CRM',
      appliedClientId: clientId,
      extractionAppliedFields: [],
      extractionAppliedLabels: [],
      extractionAppliedFieldCount: 0,
      appliedAt: null,
      dealRecommendationForLog
    };
  }

  const keys = Object.keys(preview.firestoreUpdate);
  const labelByKey = new Map(
    preview.rows.filter((r) => r.willWrite).map((r) => [r.fieldKey, r.label])
  );
  const labels = keys.map((k) => labelByKey.get(k) ?? k);

  return {
    extractionApplied: true,
    extractionApplyStatus: 'applied',
    extractionApplyReason: null,
    appliedClientId: clientId,
    extractionAppliedFields: keys,
    extractionAppliedLabels: labels,
    extractionAppliedFieldCount: keys.length,
    appliedAt: new Date().toISOString(),
    dealRecommendationForLog
  };
}
