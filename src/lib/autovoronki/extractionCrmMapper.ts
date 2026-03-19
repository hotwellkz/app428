import type { CrmAiBotExtractionResult } from '../../types/crmAiBotExtraction';
import type {
  CrmApplyFieldAction,
  CrmApplyInfoRow,
  CrmApplyPreviewResult,
  CrmApplyPreviewRow,
  CrmExtractionMappedDraft
} from '../../types/crmExtractionApply';

const APPEND_SEPARATOR = '\n\n--- AI (автоворонка) ---\n';

export function displayFieldValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  const s = String(v).trim();
  return s.length ? s : '—';
}

/** Слабые «заглушки» имени — можно заменить из extraction без лишнего шума */
const WEAK_NAMES = new Set(['', 'клиент', 'client', 'whatsapp']);

function parseAreaM2(raw: string | null): number | null {
  if (!raw || !raw.trim()) return null;
  const n = parseFloat(raw.replace(',', '.').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function buildHouseTypeLine(e: CrmAiBotExtractionResult): string | null {
  const parts = [
    e.projectType,
    e.houseFormat,
    e.wallType,
    e.roofType,
    e.ceilingHeight
  ]
    .map((x) => (x && String(x).trim() ? String(x).trim() : null))
    .filter((x): x is string => !!x);
  if (!parts.length) return null;
  return parts.join(' · ');
}

function buildClientIntentLine(e: CrmAiBotExtractionResult): string | null {
  const parts: string[] = [];
  if (e.interestLevel?.trim()) parts.push(`Интерес: ${e.interestLevel.trim()}`);
  if (e.wantsCommercialOffer === true) parts.push('Запрос КП');
  if (e.wantsConsultation === true) parts.push('Нужна консультация');
  if (e.hasOwnProject === true) parts.push('Свой проект');
  if (!parts.length) return null;
  return parts.join(' · ');
}

function buildAppendBlock(e: CrmAiBotExtractionResult): string | null {
  const lines: string[] = [];
  if (e.summaryComment?.trim()) lines.push(e.summaryComment.trim());
  if (e.nextStep?.trim()) lines.push(`Следующий шаг: ${e.nextStep.trim()}`);
  if (e.budget?.trim()) lines.push(`Бюджет: ${e.budget.trim()}`);
  if (e.timeline?.trim()) lines.push(`Сроки: ${e.timeline.trim()}`);
  if (e.financing?.trim()) lines.push(`Финансирование: ${e.financing.trim()}`);
  if (e.landStatus?.trim()) lines.push(`Участок / земля: ${e.landStatus.trim()}`);
  if (e.preferredContactMode?.trim()) lines.push(`Контакт: ${e.preferredContactMode.trim()}`);
  if (!lines.length) return null;
  return lines.join('\n');
}

/**
 * Чистое преобразование extraction → предлагаемые значения для CRM (без чтения карточки).
 */
export function mapExtractionToCrmDraft(extraction: CrmAiBotExtractionResult): CrmExtractionMappedDraft {
  const city = extraction.city?.trim() || null;
  const floors = extraction.floors?.trim() || null;
  const leadTemperature = extraction.leadTemperature?.trim() || null;
  const clientDisplayName = extraction.clientName?.trim() || null;
  const areaSqm = parseAreaM2(extraction.areaM2);
  const houseType = buildHouseTypeLine(extraction);
  const clientIntent = buildClientIntentLine(extraction);
  const appendBlock = buildAppendBlock(extraction);

  return {
    city,
    areaSqm,
    floors,
    houseType,
    clientIntent,
    leadTemperature,
    clientDisplayName,
    appendBlock
  };
}

function currentDisplayName(data: Record<string, unknown>): string {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const fn = typeof data.firstName === 'string' ? data.firstName.trim() : '';
  const ln = typeof data.lastName === 'string' ? data.lastName.trim() : '';
  const composed = `${ln} ${fn}`.trim();
  return name || composed;
}

function isWeakName(name: string): boolean {
  return WEAK_NAMES.has(name.trim().toLowerCase());
}

function scalarAction(
  current: unknown,
  proposed: string | number | null
): CrmApplyFieldAction {
  if (proposed === null) return 'skipped';
  const curStr =
    typeof current === 'number'
      ? String(current)
      : typeof current === 'string'
        ? current.trim()
        : '';
  const propStr = typeof proposed === 'number' ? String(proposed) : proposed.trim();
  if (!propStr) return 'skipped';
  if (!curStr) return 'new';
  if (curStr === propStr) return 'unchanged';
  return 'replace';
}

function nameAction(currentName: string, proposed: string | null): CrmApplyFieldAction {
  if (!proposed?.trim()) return 'skipped';
  const p = proposed.trim();
  if (!currentName) return 'new';
  if (currentName === p) return 'unchanged';
  if (isWeakName(currentName)) return 'replace';
  return 'replace';
}

/** Куда дописывать AI-блок: как в WhatsApp-карточке — в aiSummary, иначе в comment */
export function resolveAppendTargetField(data: Record<string, unknown>): 'aiSummary' | 'comment' {
  const src = typeof data.source === 'string' ? data.source.toLowerCase() : '';
  if (src === 'whatsapp') return 'aiSummary';
  if (typeof data.aiSummary === 'string' && data.aiSummary.trim().length > 0) return 'aiSummary';
  return 'comment';
}

/**
 * Сборка preview и объекта для updateDoc.
 */
export function buildCrmApplyPreview(
  extraction: CrmAiBotExtractionResult,
  clientData: Record<string, unknown>
): CrmApplyPreviewResult {
  const draft = mapExtractionToCrmDraft(extraction);
  const rows: CrmApplyPreviewRow[] = [];
  const firestoreUpdate: Record<string, unknown> = {};

  const pushScalar = (
    fieldKey: string,
    label: string,
    currentRaw: unknown,
    proposed: string | number | null,
    firestoreKey: string = fieldKey
  ) => {
    const action = scalarAction(currentRaw, proposed);
    const before = displayFieldValue(currentRaw);
    const after =
      proposed === null
        ? '—'
        : typeof proposed === 'number'
          ? String(proposed)
          : proposed.trim() || '—';
    const willWrite = action === 'new' || action === 'replace';
    rows.push({
      fieldKey,
      label,
      beforeDisplay: before,
      afterDisplay: after,
      action,
      willWrite
    });
    if (willWrite && proposed !== null) {
      firestoreUpdate[firestoreKey] = proposed;
    }
  };

  // city
  pushScalar('city', 'Город', clientData.city, draft.city);

  // areaSqm
  {
    const cur = clientData.areaSqm;
    const action = scalarAction(cur, draft.areaSqm);
    const before = displayFieldValue(cur);
    const after = draft.areaSqm === null ? '—' : String(draft.areaSqm);
    rows.push({
      fieldKey: 'areaSqm',
      label: 'Площадь, м²',
      beforeDisplay: before,
      afterDisplay: after,
      action,
      willWrite: action === 'new' || action === 'replace'
    });
    if (action === 'new' || (action === 'replace' && draft.areaSqm !== null)) {
      firestoreUpdate.areaSqm = draft.areaSqm;
    }
  }

  // floors (в CRM часто строка, напр. "2 эт")
  pushScalar('floors', 'Этажность', clientData.floors, draft.floors);

  // houseType
  pushScalar('houseType', 'Тип дома / параметры', clientData.houseType, draft.houseType);

  // leadTemperature
  pushScalar('leadTemperature', 'Температура лида', clientData.leadTemperature, draft.leadTemperature);

  // clientIntent
  pushScalar('clientIntent', 'Интерес (сводка)', clientData.clientIntent, draft.clientIntent);

  // name (отображаемое имя карточки)
  {
    const currentName = currentDisplayName(clientData);
    const action = nameAction(currentName, draft.clientDisplayName);
    const before = displayFieldValue(currentName || null);
    const after = draft.clientDisplayName?.trim() || '—';
    const willWrite = action === 'new' || action === 'replace';
    rows.push({
      fieldKey: 'name',
      label: 'Имя / название',
      beforeDisplay: before,
      afterDisplay: after,
      action,
      willWrite
    });
    if (willWrite && draft.clientDisplayName) {
      firestoreUpdate.name = draft.clientDisplayName.trim();
    }
  }

  // append: comment или aiSummary
  const appendField = resolveAppendTargetField(clientData);
  const appendTargetCurrent =
    appendField === 'aiSummary' ? clientData.aiSummary : clientData.comment;
  const beforeAppend = displayFieldValue(appendTargetCurrent);
  let appendAction: CrmApplyFieldAction = 'skipped';
  let afterAppend = beforeAppend;
  if (draft.appendBlock) {
    const curStr =
      typeof appendTargetCurrent === 'string'
        ? appendTargetCurrent
        : appendTargetCurrent != null
          ? String(appendTargetCurrent)
          : '';
    const trimmed = curStr.trim();
    if (!trimmed) {
      appendAction = 'new';
      afterAppend = draft.appendBlock.trim();
    } else {
      appendAction = 'append';
      afterAppend = `${trimmed}${APPEND_SEPARATOR}${draft.appendBlock.trim()}`;
    }
    rows.push({
      fieldKey: appendField,
      label: appendField === 'aiSummary' ? 'AI-сводка (aiSummary)' : 'Комментарий',
      beforeDisplay: beforeAppend,
      afterDisplay: afterAppend,
      action: appendAction,
      willWrite: true
    });
    firestoreUpdate[appendField] = afterAppend;
  }

  const infoRows: CrmApplyInfoRow[] = [];
  if (extraction.missingFields?.length) {
    infoRows.push({
      kind: 'info',
      label: 'Не хватает данных (только подсказка)',
      value: extraction.missingFields.join('; ')
    });
  }
  if (extraction.detectedLanguage) {
    infoRows.push({
      kind: 'info',
      label: 'Язык диалога',
      value: extraction.detectedLanguage
    });
  }

  return { rows, infoRows, firestoreUpdate };
}

export function previewHasWritableChanges(result: CrmApplyPreviewResult): boolean {
  return result.rows.some((r) => r.willWrite);
}

export function extractionHasApplicableData(extraction: CrmAiBotExtractionResult): boolean {
  const d = mapExtractionToCrmDraft(extraction);
  return (
    d.city != null ||
    d.areaSqm != null ||
    d.floors != null ||
    d.houseType != null ||
    d.clientIntent != null ||
    d.leadTemperature != null ||
    d.clientDisplayName != null ||
    d.appendBlock != null
  );
}
