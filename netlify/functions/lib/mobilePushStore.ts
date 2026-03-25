import { Timestamp } from 'firebase-admin/firestore';
import { getDb } from './firebaseAdmin';

export const MOBILE_COLLECTIONS = {
  DEVICES: 'mobileDevices',
  DEDUPE: 'mobilePushDedupe'
} as const;

export type MobilePlatform = 'android';

export interface MobileDeviceRow {
  managerId: string;
  token: string;
  platform: MobilePlatform;
  deviceModel: string | null;
  appVersion: string | null;
  deviceId: string | null;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastSeenAt: Timestamp;
}

export function normalizeToken(token: string): string {
  return String(token ?? '').trim();
}

export function normalizeManagerId(managerId: string): string {
  return String(managerId ?? '').trim();
}

export function devicesCollection() {
  return getDb().collection(MOBILE_COLLECTIONS.DEVICES);
}

export function dedupeCollection() {
  return getDb().collection(MOBILE_COLLECTIONS.DEDUPE);
}

