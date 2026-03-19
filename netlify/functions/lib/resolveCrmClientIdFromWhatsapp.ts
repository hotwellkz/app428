import type { Firestore } from 'firebase-admin/firestore';

const CRM_CLIENTS = 'clients';
const WHATSAPP_CLIENTS = 'whatsappClients';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits ? `+${digits}` : phone.trim();
}

/**
 * В чате clientId — это id документа whatsappClients, а не clients.
 * Для CRM (apply, сделка) нужен id из коллекции clients: либо прямой документ,
 * либо поиск по нормализованному телефону (как в UI чата).
 */
export async function resolveCrmClientIdForWhatsappConversation(
  db: Firestore,
  companyId: string,
  conv: Record<string, unknown>,
  /** Обычно conv.clientId (whatsapp); иногда может совпадать с CRM id */
  hintId: string | null | undefined
): Promise<string | null> {
  const hint = typeof hintId === 'string' ? hintId.trim() : '';
  if (hint) {
    const direct = await db.collection(CRM_CLIENTS).doc(hint).get();
    if (direct.exists && (direct.data()?.companyId as string) === companyId) {
      return hint;
    }
  }

  let phone = typeof conv.phone === 'string' ? conv.phone.trim() : '';
  const waClientId = typeof conv.clientId === 'string' ? String(conv.clientId).trim() : '';
  if (!phone && waClientId) {
    const waSnap = await db.collection(WHATSAPP_CLIENTS).doc(waClientId).get();
    if (waSnap.exists) {
      const w = waSnap.data() as Record<string, unknown>;
      if (typeof w.phone === 'string' && w.phone.trim()) phone = w.phone.trim();
    }
  }
  if (!phone) return null;

  const normalized = normalizePhone(phone);
  const q = await db
    .collection(CRM_CLIENTS)
    .where('companyId', '==', companyId)
    .where('phone', '==', normalized)
    .limit(1)
    .get();

  if (q.empty) return null;
  return q.docs[0].id;
}
