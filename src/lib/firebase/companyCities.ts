import {
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from './config';

const COLLECTION_COMPANY_CITIES = 'companyCities';

/** Нормализация для отображения: trim + первый символ в верхний регистр, остальные в нижний (по словам). */
export function normalizeCityDisplay(name: string): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/** Проверка дубликата без учёта регистра и пробелов. */
function sameCity(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export interface CompanyCitiesDoc {
  cities: string[];
  updatedAt?: unknown;
}

/** Получить список городов компании (один раз). */
export async function getCompanyCities(companyId: string): Promise<string[]> {
  if (!companyId) return [];
  const ref = doc(db, COLLECTION_COMPANY_CITIES, companyId);
  const snap = await getDoc(ref);
  const data = snap.data() as CompanyCitiesDoc | undefined;
  const list = Array.isArray(data?.cities) ? data.cities : [];
  return list.filter((c) => typeof c === 'string' && c.trim());
}

/** Подписка на список городов компании (real-time). */
export function subscribeCompanyCities(
  companyId: string,
  callback: (cities: string[]) => void
): Unsubscribe {
  if (!companyId) {
    callback([]);
    return () => {};
  }
  const ref = doc(db, COLLECTION_COMPANY_CITIES, companyId);
  return onSnapshot(
    ref,
    (snap) => {
      const data = snap.data() as CompanyCitiesDoc | undefined;
      const list = Array.isArray(data?.cities) ? data.cities : [];
      callback(list.filter((c) => typeof c === 'string' && c.trim()));
    },
    () => callback([])
  );
}

/** Добавить город в справочник компании: нормализация, проверка дубля, сохранение. */
export async function addCompanyCity(companyId: string, cityName: string): Promise<string> {
  const normalized = normalizeCityDisplay(cityName);
  if (!normalized) throw new Error('Введите название города');
  const ref = doc(db, COLLECTION_COMPANY_CITIES, companyId);
  const snap = await getDoc(ref);
  const data = (snap.data() as CompanyCitiesDoc | undefined) ?? { cities: [] };
  const cities: string[] = Array.isArray(data.cities) ? [...data.cities] : [];
  if (cities.some((c) => sameCity(c, normalized))) return normalized;
  cities.push(normalized);
  cities.sort((a, b) => a.localeCompare(b, 'ru'));
  await setDoc(ref, { cities, updatedAt: serverTimestamp() }, { merge: true });
  return normalized;
}
