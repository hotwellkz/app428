import type { CompanyUserRole } from './company';

export type CompanyInviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface CompanyInvite {
  id: string;
  companyId: string;
  email: string;
  role: CompanyUserRole;
  token: string;
  status: CompanyInviteStatus;
  invitedBy: string;
  expiresAt: unknown;
  createdAt: unknown;
  updatedAt: unknown;
}
