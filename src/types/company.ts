import type { Timestamp } from 'firebase/firestore';

export interface Company {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Timestamp | null;
}

export type CompanyUserRole = 'owner' | 'admin' | 'manager' | 'member';

export interface CompanyUser {
  id: string;
  companyId: string;
  userId: string;
  role: CompanyUserRole;
}
