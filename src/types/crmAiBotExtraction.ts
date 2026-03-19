/**
 * Результат извлечения данных из тестового диалога AI-бота (этап 4+).
 * Готов к будущему автозаполнению CRM — пока только preview в UI.
 */

export interface CrmAiBotExtractionResult {
  clientName: string | null;
  city: string | null;
  areaM2: string | null;
  floors: string | null;
  projectType: string | null;
  houseFormat: string | null;
  wallType: string | null;
  roofType: string | null;
  ceilingHeight: string | null;
  budget: string | null;
  timeline: string | null;
  financing: string | null;
  landStatus: string | null;
  interestLevel: string | null;
  nextStep: string | null;
  summaryComment: string | null;
  missingFields: string[];
  detectedLanguage: 'ru' | 'kz' | 'unknown' | null;
  preferredContactMode: string | null;
  wantsCommercialOffer: boolean | null;
  wantsConsultation: boolean | null;
  hasOwnProject: boolean | null;
  leadTemperature: string | null;
}

export function emptyCrmAiBotExtraction(): CrmAiBotExtractionResult {
  return {
    clientName: null,
    city: null,
    areaM2: null,
    floors: null,
    projectType: null,
    houseFormat: null,
    wallType: null,
    roofType: null,
    ceilingHeight: null,
    budget: null,
    timeline: null,
    financing: null,
    landStatus: null,
    interestLevel: null,
    nextStep: null,
    summaryComment: null,
    missingFields: [],
    detectedLanguage: null,
    preferredContactMode: null,
    wantsCommercialOffer: null,
    wantsConsultation: null,
    hasOwnProject: null,
    leadTemperature: null
  };
}

function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : null;
  }
  if (typeof v === 'number' && !Number.isNaN(v)) return String(v);
  if (typeof v === 'boolean') return v ? 'да' : 'нет';
  return null;
}

function boolOrNull(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const x = v.trim().toLowerCase();
    if (x === 'true' || x === 'да' || x === 'yes') return true;
    if (x === 'false' || x === 'нет' || x === 'no') return false;
  }
  return null;
}

function langOrNull(v: unknown): 'ru' | 'kz' | 'unknown' | null {
  const s = strOrNull(v);
  if (!s) return null;
  const x = s.toLowerCase();
  if (x === 'ru' || x === 'rus' || x === 'русский') return 'ru';
  if (x === 'kz' || x === 'kk' || x === 'казахский' || x === 'қазақ') return 'kz';
  if (x === 'unknown' || x === 'неизвестно') return 'unknown';
  return 'unknown';
}

function stringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => strOrNull(x))
    .filter((x): x is string => typeof x === 'string' && x.length > 0);
}

/** Нормализация JSON от модели в строгий тип. */
export function parseCrmAiBotExtractionResult(raw: unknown): CrmAiBotExtractionResult {
  const base = emptyCrmAiBotExtraction();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;

  return {
    clientName: strOrNull(o.clientName),
    city: strOrNull(o.city),
    areaM2: strOrNull(o.areaM2),
    floors: strOrNull(o.floors),
    projectType: strOrNull(o.projectType),
    houseFormat: strOrNull(o.houseFormat),
    wallType: strOrNull(o.wallType),
    roofType: strOrNull(o.roofType),
    ceilingHeight: strOrNull(o.ceilingHeight),
    budget: strOrNull(o.budget),
    timeline: strOrNull(o.timeline),
    financing: strOrNull(o.financing),
    landStatus: strOrNull(o.landStatus),
    interestLevel: strOrNull(o.interestLevel),
    nextStep: strOrNull(o.nextStep),
    summaryComment: strOrNull(o.summaryComment),
    missingFields: stringArray(o.missingFields),
    detectedLanguage: langOrNull(o.detectedLanguage),
    preferredContactMode: strOrNull(o.preferredContactMode),
    wantsCommercialOffer: boolOrNull(o.wantsCommercialOffer),
    wantsConsultation: boolOrNull(o.wantsConsultation),
    hasOwnProject: boolOrNull(o.hasOwnProject),
    leadTemperature: strOrNull(o.leadTemperature)
  };
}
