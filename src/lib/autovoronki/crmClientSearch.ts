import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { CrmClientPickRow } from '../../types/crmExtractionApply';

export function normalizeCrmPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits ? `+${digits}` : phone.trim();
}

export function clientDocToPickRow(id: string, data: Record<string, unknown>): CrmClientPickRow | null {
  const companyId = data.companyId as string | undefined;
  if (!companyId) return null;
  const phoneRaw = typeof data.phone === 'string' ? data.phone : '';
  const fn = typeof data.firstName === 'string' ? data.firstName.trim() : '';
  const ln = typeof data.lastName === 'string' ? data.lastName.trim() : '';
  const singleName = typeof data.name === 'string' ? data.name.trim() : '';
  const displayName =
    [ln, fn].filter(Boolean).join(' ').trim() ||
    singleName ||
    (phoneRaw ? normalizeCrmPhone(phoneRaw) : 'Без имени');
  const subtitle =
    (typeof data.objectName === 'string' && data.objectName.trim()) ||
    (typeof data.source === 'string' && data.source) ||
    phoneRaw ||
    '';
  return {
    id,
    companyId,
    displayName,
    phone: phoneRaw ? normalizeCrmPhone(phoneRaw) : '',
    subtitle,
    source: typeof data.source === 'string' ? data.source : undefined
  };
}

/** Все клиенты компании (коллекция clients). Фильтрация по строке поиска — на клиенте. */
export async function fetchCompanyClientsForPicker(companyId: string): Promise<CrmClientPickRow[]> {
  const q = query(collection(db, 'clients'), where('companyId', '==', companyId));
  const snap = await getDocs(q);
  const rows: CrmClientPickRow[] = [];
  snap.docs.forEach((d) => {
    const row = clientDocToPickRow(d.id, d.data() as Record<string, unknown>);
    if (row) rows.push(row);
  });
  rows.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru'));
  return rows;
}

export function filterClientPickRows(rows: CrmClientPickRow[], search: string): CrmClientPickRow[] {
  const t = search.trim().toLowerCase();
  if (!t) return rows.slice(0, 100);
  const digits = t.replace(/\D/g, '');
  return rows
    .filter((r) => {
      const name = r.displayName.toLowerCase();
      const sub = r.subtitle.toLowerCase();
      const phoneDigits = r.phone.replace(/\D/g, '');
      if (name.includes(t) || sub.includes(t)) return true;
      if (digits.length >= 3 && phoneDigits.includes(digits)) return true;
      return false;
    })
    .slice(0, 60);
}
