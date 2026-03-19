/**
 * Ручное применение structured extraction (автоворонки) в карточку clients/{id}.
 * Этап 5: preview → подтверждение → запись.
 */

export type CrmApplyFieldAction = 'new' | 'replace' | 'append' | 'unchanged' | 'skipped';

/** Одна строка предпросмотра для UI и логики записи */
export interface CrmApplyPreviewRow {
  /** Ключ поля в Firestore (или виртуальный ключ для инфо-строк) */
  fieldKey: string;
  label: string;
  beforeDisplay: string;
  afterDisplay: string;
  action: CrmApplyFieldAction;
  /** Участвует ли в updateDoc */
  willWrite: boolean;
}

/** Информация только для preview (не пишется в CRM) */
export interface CrmApplyInfoRow {
  kind: 'info';
  label: string;
  value: string;
}

export interface CrmExtractionMappedDraft {
  city: string | null;
  areaSqm: number | null;
  floors: string | null;
  houseType: string | null;
  clientIntent: string | null;
  leadTemperature: string | null;
  /** Имя для поля name (WhatsApp / общее отображаемое имя) */
  clientDisplayName: string | null;
  /** Текст для стратегии append (комментарий / aiSummary) */
  appendBlock: string | null;
}

/** Результат сборки preview + payload для Firestore */
export interface CrmApplyPreviewResult {
  rows: CrmApplyPreviewRow[];
  infoRows: CrmApplyInfoRow[];
  /** Только поля для updateDoc (без undefined) */
  firestoreUpdate: Record<string, unknown>;
}

/** Строка поиска клиента в модалке */
export interface CrmClientPickRow {
  id: string;
  companyId: string;
  displayName: string;
  phone: string;
  subtitle: string;
  source?: string;
}
