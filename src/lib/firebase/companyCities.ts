import {
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  getDocs,
  writeBatch,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from './config';

const COLLECTION_COMPANY_CITIES = 'companyCities';
const COLLECTION_CLIENTS = 'clients';

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

/**
 * Нормализация сырого названия города из AI: trim, убрать префикс "г.", привести к виду для сравнения.
 */
export function normalizeDetectedCity(raw: string): string {
  const t = (raw ?? '').trim().replace(/^\s*г\.?\s*/i, '').trim();
  return normalizeCityDisplay(t);
}

/**
 * Определить, можно ли автоматически подставить город в карточку после AI-анализа.
 * Возвращает каноническое название города из справочника или null.
 * Правила: не перезаписывать ручной выбор; только если город есть в справочнике; двусмысленность не подставляем.
 */
export function resolveCityForAutoAssign(
  detectedCity: string,
  companyCities: string[],
  currentClientCity: string | null | undefined
): string | null {
  const normalized = normalizeDetectedCity(detectedCity);
  if (!normalized) return null;
  if (typeof currentClientCity === 'string' && currentClientCity.trim().length > 0) return null;
  const match = companyCities.find((c) => c.trim().toLowerCase() === normalized.trim().toLowerCase());
  return match ?? null;
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
  if (cities.some((c) => sameCity(c, normalized))) throw new Error('Такой город уже существует');
  cities.push(normalized);
  cities.sort((a, b) => a.localeCompare(b, 'ru'));
  await setDoc(ref, { cities, updatedAt: serverTimestamp() }, { merge: true });
  return normalized;
}

/** Переименовать город в справочнике и у всех клиентов компании. */
export async function renameCompanyCity(
  companyId: string,
  oldName: string,
  newName: string
): Promise<string> {
  const oldNorm = (oldName ?? '').trim();
  const newNorm = normalizeCityDisplay(newName);
  if (!oldNorm || !newNorm) throw new Error('Укажите название');
  if (sameCity(oldNorm, newNorm)) return newNorm;
  const ref = doc(db, COLLECTION_COMPANY_CITIES, companyId);
  const snap = await getDoc(ref);
  const data = (snap.data() as CompanyCitiesDoc | undefined) ?? { cities: [] };
  let cities: string[] = Array.isArray(data.cities) ? [...data.cities] : [];
  const idx = cities.findIndex((c) => sameCity(c, oldNorm));
  if (idx === -1) throw new Error('Город не найден');
  if (cities.some((c) => sameCity(c, newNorm))) throw new Error('Такой город уже есть');
  cities[idx] = newNorm;
  cities.sort((a, b) => a.localeCompare(b, 'ru'));
  const clientsRef = collection(db, COLLECTION_CLIENTS);
  const clientsSnap = await getDocs(
    query(
      clientsRef,
      where('companyId', '==', companyId),
      where('city', '==', oldNorm)
    )
  );
  const batch = writeBatch(db);
  clientsSnap.docs.forEach((d) => {
    batch.update(d.ref, { city: newNorm });
  });
  await batch.commit();
  await setDoc(ref, { cities, updatedAt: serverTimestamp() }, { merge: true });
  return newNorm;
}

/** Удалить город из справочника и сбросить city у клиентов компании. */
export async function removeCompanyCity(companyId: string, cityName: string): Promise<void> {
  const normalized = (cityName ?? '').trim();
  if (!normalized) return;
  const ref = doc(db, COLLECTION_COMPANY_CITIES, companyId);
  const snap = await getDoc(ref);
  const data = (snap.data() as CompanyCitiesDoc | undefined) ?? { cities: [] };
  let cities: string[] = Array.isArray(data.cities) ? [...data.cities] : [];
  const idx = cities.findIndex((c) => sameCity(c, normalized));
  if (idx === -1) return;
  cities.splice(idx, 1);
  const clientsRef = collection(db, COLLECTION_CLIENTS);
  const clientsSnap = await getDocs(
    query(
      clientsRef,
      where('companyId', '==', companyId),
      where('city', '==', normalized)
    )
  );
  const batch = writeBatch(db);
  clientsSnap.docs.forEach((d) => {
    batch.update(d.ref, { city: null });
  });
  await batch.commit();
  await setDoc(ref, { cities, updatedAt: serverTimestamp() }, { merge: true });
}
