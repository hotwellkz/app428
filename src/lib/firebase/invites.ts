import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from './config';
import type { CompanyUserRole } from '../../types/company';
import type { CompanyInviteStatus } from '../../types/invite';

const COMPANY_INVITES = 'company_invites';

const INVITE_EXPIRES_DAYS = 7;

function generateToken(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 15)}`;
}

export interface CreateInviteInput {
  companyId: string;
  email: string;
  role: CompanyUserRole;
  invitedBy: string;
}

export interface CreateInviteResult {
  inviteId: string;
  token: string;
  link: string;
}

/** Создать приглашение в компанию. Возвращает ссылку для принятия. */
export async function createInvite(input: CreateInviteInput): Promise<CreateInviteResult> {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRES_DAYS);

  const ref = await addDoc(collection(db, COMPANY_INVITES), {
    companyId: input.companyId,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    token,
    status: 'pending',
    invitedBy: input.invitedBy,
    expiresAt,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  const base = typeof window !== 'undefined' ? `${window.location.origin}/accept-invite` : '';
  const link = `${base}?token=${encodeURIComponent(token)}`;

  return { inviteId: ref.id, token, link };
}

/** Список приглашений компании (для раздела пользователей). */
export async function listInvitesByCompany(companyId: string): Promise<Array<{ id: string; email: string; role: string; status: CompanyInviteStatus; createdAt: unknown }>> {
  const q = query(
    collection(db, COMPANY_INVITES),
    where('companyId', '==', companyId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      email: (data.email as string) ?? '',
      role: (data.role as string) ?? 'member',
      status: (data.status as CompanyInviteStatus) ?? 'pending',
      createdAt: data.createdAt
    };
  });
}
