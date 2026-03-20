/**
 * Номера для исходящего voice (привязка к компании). Запись с клиента закрыта rules.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp
} from 'firebase/firestore';
import type { VoiceNumber, VoiceProviderId } from '../../types/voice';
import { db } from './config';

export const VOICE_NUMBERS_COLLECTION = 'voiceNumbers';

export function voiceNumberRef(numberId: string) {
  return doc(db, VOICE_NUMBERS_COLLECTION, numberId);
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function docToVoiceNumber(id: string, data: Record<string, unknown>): VoiceNumber {
  const cap = data.capabilities as Record<string, unknown> | undefined;
  return {
    id,
    companyId: str(data.companyId) ?? '',
    e164: str(data.e164) ?? '',
    provider: (str(data.provider) ?? 'unknown') as VoiceProviderId,
    providerSid: str(data.providerSid),
    label: str(data.label),
    isDefault: data.isDefault === true,
    isActive: data.isActive !== false,
    capabilities: cap ? { voice: cap.voice === true } : undefined,
    createdAt: (data.createdAt as Timestamp | Date | null) ?? null,
    updatedAt: (data.updatedAt as Timestamp | Date | null) ?? null
  };
}

export async function getVoiceNumber(companyId: string, numberId: string): Promise<VoiceNumber | null> {
  const snap = await getDoc(voiceNumberRef(numberId));
  if (!snap.exists()) return null;
  const row = docToVoiceNumber(snap.id, snap.data() as Record<string, unknown>);
  if (row.companyId !== companyId) return null;
  return row;
}

export async function listVoiceNumbersByCompany(companyId: string): Promise<VoiceNumber[]> {
  const q = query(collection(db, VOICE_NUMBERS_COLLECTION), where('companyId', '==', companyId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToVoiceNumber(d.id, d.data() as Record<string, unknown>));
}

/**
 * Первый номер с isDefault === true, иначе null.
 */
export async function getDefaultVoiceNumber(companyId: string): Promise<VoiceNumber | null> {
  const q = query(
    collection(db, VOICE_NUMBERS_COLLECTION),
    where('companyId', '==', companyId),
    where('isDefault', '==', true),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return docToVoiceNumber(d.id, d.data() as Record<string, unknown>);
}

export type VoiceNumberUpsertInput = Omit<VoiceNumber, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Создание/полная замена полей номера по id. С клиента сработает только при открытых rules (сейчас — нет).
 */
export async function upsertVoiceNumber(numberId: string, input: VoiceNumberUpsertInput): Promise<void> {
  const ref = voiceNumberRef(numberId);
  const snap = await getDoc(ref);
  await setDoc(
    ref,
    {
      ...input,
      updatedAt: serverTimestamp(),
      ...(snap.exists() ? {} : { createdAt: serverTimestamp() })
    },
    { merge: true }
  );
}
