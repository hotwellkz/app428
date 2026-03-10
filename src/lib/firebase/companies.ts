import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config';
import type { CompanyUserRole } from '../../types/company';

const COMPANIES = 'companies';
const COMPANY_USERS = 'company_users';
const USERS = 'users';

export type CompanyStatus = 'active' | 'blocked' | 'deleted';

export interface CompanyRow {
  id: string;
  name: string;
  ownerId: string;
  createdAt: unknown;
  status?: CompanyStatus;
}

export interface CompanyUserRow {
  id: string;
  companyId: string;
  userId: string;
  role: CompanyUserRole;
}

/** Создать компанию. Возвращает id созданной компании. */
export async function createCompany(name: string, ownerId: string): Promise<string> {
  const ref = await addDoc(collection(db, COMPANIES), {
    name: name.trim(),
    ownerId,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

/** Добавить связь пользователь–компания. Документ id = userId. Для регистрации передать email, чтобы записать полный контракт. */
export async function addCompanyUser(
  companyId: string,
  userId: string,
  role: CompanyUserRole,
  email?: string
): Promise<string> {
  const ref = doc(db, COMPANY_USERS, userId);
  const data: Record<string, unknown> = {
    companyId,
    userId,
    role,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  if (email !== undefined) data.email = email;
  await setDoc(ref, data, { merge: true });
  return ref.id;
}

/** Получить companyId для текущего пользователя (сначала company_users/{userId}, иначе users). */
export async function getCompanyIdForUser(userId: string): Promise<string | null> {
  const cuRef = doc(db, COMPANY_USERS, userId);
  const cuSnap = await getDoc(cuRef);
  if (cuSnap.exists()) {
    return (cuSnap.data()?.companyId as string) ?? null;
  }
  const userRef = doc(db, USERS, userId);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() ? (userSnap.data()?.companyId as string | undefined) ?? null : null;
}

/** Получить документ компании по id. */
export async function getCompany(companyId: string): Promise<CompanyRow | null> {
  const ref = doc(db, COMPANIES, companyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    id: snap.id,
    name: (d.name as string) ?? '',
    ownerId: (d.ownerId as string) ?? '',
    createdAt: d.createdAt ?? null,
    status: (d.status as CompanyRow['status']) ?? 'active'
  };
}

/** Список всех компаний (только для global_admin). Деактивированные (deleted) не возвращаются. */
export async function getAllCompanies(): Promise<CompanyRow[]> {
  const snap = await getDocs(collection(db, COMPANIES));
  return snap.docs
    .map((d) => {
      const data = d.data();
      const status = (data.status as CompanyRow['status']) ?? 'active';
      return {
        id: d.id,
        name: (data.name as string) ?? '',
        ownerId: (data.ownerId as string) ?? '',
        createdAt: data.createdAt ?? null,
        status
      };
    })
    .filter((c) => c.status !== 'deleted');
}

/** Количество пользователей в компании. */
export async function getCompanyUsersCount(companyId: string): Promise<number> {
  const q = query(
    collection(db, COMPANY_USERS),
    where('companyId', '==', companyId)
  );
  const snap = await getDocs(q);
  return snap.size;
}

/** Обновить статус компании (active | blocked | deleted). Только global_admin или owner. */
export async function updateCompanyStatus(companyId: string, status: CompanyStatus): Promise<void> {
  await updateDoc(doc(db, COMPANIES, companyId), {
    status,
    updatedAt: serverTimestamp()
  });
}
