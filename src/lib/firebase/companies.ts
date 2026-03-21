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
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config';
import type { CompanyUserRole } from '../../types/company';
import type { MenuAccess } from '../../types/menuAccess';
import { defaultMenuAccessForRole } from '../../types/menuAccess';

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

/** Дополнительные права пользователя в компании (назначаются владельцем). */
export interface CompanyUserPermissions {
  /** Право одобрять/отклонять транзакции (в рамках своей компании). */
  approveTransactions?: boolean;
  /** Если false — на странице «Транзакции» пользователь видит только сумму своей карточки сотрудника; чужие скрыты. */
  viewAllEmployeeBalances?: boolean;
  /** ID категории (карточки сотрудника row=2), которая считается «своей» при viewAllEmployeeBalances === false. */
  employeeCategoryId?: string;
}

export interface CompanyUserRow {
  id: string;
  companyId: string;
  userId: string;
  role: CompanyUserRole;
  menuAccess?: MenuAccess;
  /** Права, назначаемые владельцем (например, одобрение транзакций). */
  permissions?: CompanyUserPermissions;
  email?: string;
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
  const snap = await getDoc(ref);
  const data: Record<string, unknown> = {
    companyId,
    userId,
    role,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  if (email !== undefined) data.email = email;
  if (!snap.exists() || snap.data()?.menuAccess == null) {
    data.menuAccess = defaultMenuAccessForRole(role);
  }
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

/** Список пользователей компании (company_users по companyId). */
export async function getCompanyUsers(companyId: string): Promise<CompanyUserRow[]> {
  const q = query(
    collection(db, COMPANY_USERS),
    where('companyId', '==', companyId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      companyId: (data.companyId as string) ?? '',
      userId: (data.userId as string) ?? d.id,
      role: (data.role as CompanyUserRole) ?? 'member',
      menuAccess: data.menuAccess as MenuAccess | undefined,
      email: data.email as string | undefined
    };
  });
}

/** Обновить права доступа к разделам меню для пользователя компании. */
export async function updateCompanyUserMenuAccess(
  userId: string,
  menuAccess: MenuAccess
): Promise<void> {
  const ref = doc(db, COMPANY_USERS, userId);
  await updateDoc(ref, {
    menuAccess,
    updatedAt: serverTimestamp()
  });
}

/**
 * Обновить дополнительные права пользователя в компании (merge с существующими).
 * Значения `undefined` в переданном объекте означают «сбросить поле» (ключ не попадёт в Firestore).
 * Firestore не принимает `undefined` в полях — раньше это ломало сохранение при пустой категории.
 */
export async function updateCompanyUserPermissions(
  userId: string,
  permissions: CompanyUserPermissions
): Promise<void> {
  const ref = doc(db, COMPANY_USERS, userId);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? (snap.data()?.permissions as CompanyUserPermissions | undefined) : undefined;
  const merged: Record<string, unknown> = { ...(existing ?? {}) };
  for (const key of Object.keys(permissions) as (keyof CompanyUserPermissions)[]) {
    const value = permissions[key];
    if (value === undefined) {
      delete merged[key as string];
    } else {
      merged[key as string] = value;
    }
  }
  const cleaned = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined));
  await updateDoc(ref, {
    permissions: cleaned,
    updatedAt: serverTimestamp()
  });
}

/** Получить документ company_users для пользователя (role + menuAccess). */
export async function getCompanyUser(userId: string): Promise<CompanyUserRow | null> {
  const ref = doc(db, COMPANY_USERS, userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    companyId: (data.companyId as string) ?? '',
    userId: (data.userId as string) ?? snap.id,
    role: (data.role as CompanyUserRole) ?? 'member',
    menuAccess: data.menuAccess as MenuAccess | undefined,
    permissions: data.permissions as CompanyUserRow['permissions'],
    email: data.email as string | undefined
  };
}

/**
 * Обновить роль пользователя в компании.
 * Вызывать только при проверке прав (owner или global_admin на клиенте).
 * Firestore rules: update разрешён для owner/admin компании.
 */
export async function updateCompanyUserRole(
  userId: string,
  newRole: CompanyUserRole,
  companyId: string
): Promise<void> {
  const ref = doc(db, COMPANY_USERS, userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('Пользователь не найден в компании');
  }
  const data = snap.data();
  if ((data.companyId as string) !== companyId) {
    throw new Error('Пользователь принадлежит другой компании');
  }
  const menuAccess = defaultMenuAccessForRole(newRole);
  await updateDoc(ref, {
    role: newRole,
    menuAccess,
    updatedAt: serverTimestamp()
  });
}

/** Удалить привязку пользователя к компании (company_users/{userId}). Доступно owner/admin компании или global_admin. */
export async function deleteCompanyUser(userId: string): Promise<void> {
  const ref = doc(db, COMPANY_USERS, userId);
  await deleteDoc(ref);
}
