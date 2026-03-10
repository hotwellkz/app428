import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import { useCompanyId } from '../../contexts/CompanyContext';

const COLLECTION_CLIENTS = 'clients';
const COLLECTION_DEALS = 'deals';

type DealStatus = 'new' | 'in_progress' | 'closed' | 'lost';

export interface DealCard {
  id: string;
  clientPhone: string;
  status: DealStatus;
  source: string;
  createdAt: unknown;
  updatedAt: unknown;
}

const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  closed: 'Закрыта',
  lost: 'Потеряна',
};

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits ? `+${digits}` : phone.trim();
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  let ms: number;
  if (typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    ms = (value as { toMillis: () => number }).toMillis();
  } else if (typeof value === 'object' && value !== null && 'seconds' in (value as object)) {
    ms = ((value as { seconds: number }).seconds ?? 0) * 1000;
  } else {
    ms = new Date(value as string).getTime();
  }
  return new Date(ms).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export interface WhatsAppClientCard {
  id: string;
  phone: string;
  name: string;
  source: string;
  comment: string;
  createdAt: unknown;
}

async function getClientByPhone(phone: string, companyId: string): Promise<WhatsAppClientCard | null> {
  const normalized = normalizePhone(phone);
  const q = query(
    collection(db, COLLECTION_CLIENTS),
    where('companyId', '==', companyId),
    where('phone', '==', normalized)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  const data = d.data();
  return {
    id: d.id,
    phone: (data.phone as string) ?? normalized,
    name: (data.name as string) ?? '',
    source: (data.source as string) ?? '',
    comment: (data.comment as string) ?? '',
    createdAt: data.createdAt,
  };
}

async function getDealByClientPhone(phone: string, companyId: string): Promise<DealCard | null> {
  const normalized = normalizePhone(phone);
  const q = query(
    collection(db, COLLECTION_DEALS),
    where('companyId', '==', companyId),
    where('clientPhone', '==', normalized)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  const data = d.data();
  return {
    id: d.id,
    clientPhone: (data.clientPhone as string) ?? normalized,
    status: (data.status as DealStatus) ?? 'new',
    source: (data.source as string) ?? 'whatsapp',
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

async function createDealForClient(phone: string, companyId: string): Promise<DealCard> {
  const normalized = normalizePhone(phone);
  const ref = await addDoc(collection(db, COLLECTION_DEALS), {
    clientPhone: normalized,
    status: 'new',
    source: 'whatsapp',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    companyId,
  });
  return {
    id: ref.id,
    clientPhone: normalized,
    status: 'new',
    source: 'whatsapp',
    createdAt: null,
    updatedAt: null,
  };
}

import type { WhatsAppMessage } from '../../types/whatsappDb';

interface ClientInfoPanelProps {
  /** Номер телефона (chatId) выбранного диалога */
  phone: string | null;
  /** Сообщения текущего диалога (для AI-анализа имени) */
  messages?: WhatsAppMessage[];
}

const ClientInfoPanel: React.FC<ClientInfoPanelProps> = ({ phone, messages = [] }) => {
  const companyId = useCompanyId();
  const [client, setClient] = useState<WhatsAppClientCard | null>(null);
  const [deal, setDeal] = useState<DealCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingDeal, setCreatingDeal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editComment, setEditComment] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNameSuggestion, setAiNameSuggestion] = useState<string | null>(null);

  const loadClientAndDeal = React.useCallback(() => {
    if (!phone) return;
    setLoading(true);
    Promise.all([getClientByPhone(phone, companyId), getDealByClientPhone(phone, companyId)])
      .then(([c, d]) => {
        setClient(c);
        setDeal(d);
        setEditName(c?.name ?? '');
        setEditSource(c?.source ?? '');
        setEditComment(c?.comment ?? '');
      })
      .catch(() => {
        setClient(null);
        setDeal(null);
      })
      .finally(() => setLoading(false));
  }, [phone, companyId]);

  useEffect(() => {
    if (!phone) {
      setClient(null);
      setDeal(null);
      setEditing(false);
      return;
    }
    loadClientAndDeal();
  }, [phone, loadClientAndDeal]);

  const handleAiSuggestName = async () => {
    if (!phone || aiLoading) return;
    // Берём последние до 40 сообщений с текстом
    const recent = messages
      .filter((m) => (m.text ?? '').trim().length > 0 && !m.deleted)
      .slice(-40);
    if (recent.length === 0) {
      return;
    }
    setAiLoading(true);
    setAiNameSuggestion(null);
    try {
      const payload = {
        chatId: normalizePhone(phone),
        messages: recent.map((m) => ({
          role: m.direction === 'incoming' ? 'client' as const : 'manager' as const,
          text: (m.text ?? '').replace(/<[^>]*>/g, '').trim()
        }))
      };
      const res = await fetch('/.netlify/functions/ai-extract-client-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await res.json().catch(() => ({}))) as { name?: string | null; error?: string };
      if (!res.ok || data.error) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('[ClientInfoPanel] AI extract name failed', { status: res.status, data });
        }
        return;
      }
      const name = typeof data.name === 'string' ? data.name.trim() : null;
      setAiNameSuggestion(name || null);
    } catch (e) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[ClientInfoPanel] AI extract name error', e);
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyAiName = async () => {
    if (!phone || !aiNameSuggestion) return;
    const trimmed = aiNameSuggestion.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const normalized = normalizePhone(phone);
      if (client) {
        await updateDoc(doc(db, COLLECTION_CLIENTS, client.id), {
          name: trimmed
        });
        setClient({
          ...client,
          name: trimmed
        });
        setEditName(trimmed);
      } else {
        // Клиента ещё нет — создаём карточку только с именем и телефоном
        const ref = await addDoc(collection(db, COLLECTION_CLIENTS), {
          phone: normalized,
          name: trimmed,
          source: '',
          comment: '',
          createdAt: serverTimestamp(),
          companyId
        });
        setClient({
          id: ref.id,
          phone: normalized,
          name: trimmed,
          source: '',
          comment: '',
          createdAt: null
        });
        setEditName(trimmed);
      }
      setAiNameSuggestion(null);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = () => {
    setEditName(client?.name ?? '');
    setEditSource(client?.source ?? '');
    setEditComment(client?.comment ?? '');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!phone) return;
    setSaving(true);
    try {
      const normalized = normalizePhone(phone);
      if (client) {
        await updateDoc(doc(db, COLLECTION_CLIENTS, client.id), {
          name: editName.trim(),
          source: editSource.trim(),
          comment: editComment.trim(),
        });
        setClient({
          ...client,
          name: editName.trim(),
          source: editSource.trim(),
          comment: editComment.trim(),
        });
      } else {
        const ref = await addDoc(collection(db, COLLECTION_CLIENTS), {
          phone: normalized,
          name: editName.trim(),
          source: editSource.trim(),
          comment: editComment.trim(),
          createdAt: serverTimestamp(),
          companyId,
        });
        setClient({
          id: ref.id,
          phone: normalized,
          name: editName.trim(),
          source: editSource.trim(),
          comment: editComment.trim(),
          createdAt: null,
        });
      }
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditName(client?.name ?? '');
    setEditSource(client?.source ?? '');
    setEditComment(client?.comment ?? '');
    setEditing(false);
  };

  if (!phone) {
    return (
      <aside className="w-[320px] flex-shrink-0 bg-white border-l border-[#eee] p-4 overflow-y-auto">
        <h2 className="text-sm font-semibold text-gray-500">Клиент</h2>
        <p className="mt-2 text-sm text-gray-400">Выберите диалог</p>
      </aside>
    );
  }

  return (
    <aside className="w-[320px] flex-shrink-0 bg-white border-l border-[#eee] p-4 overflow-y-auto">
      <h2 className="text-sm font-semibold text-gray-700">Клиент</h2>

      {loading ? (
        <p className="mt-2 text-sm text-gray-500">Загрузка…</p>
      ) : (
        <>
          <p className="mt-1 text-base font-medium text-gray-900">
            {client ? (client.name || client.phone) : 'Новый клиент'}
          </p>

          {!editing ? (
            <>
              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  <dt className="text-gray-500">Имя</dt>
                  <dd className="flex items-center gap-2">
                    <span className="text-gray-900">{client?.name || '—'}</span>
                    <button
                      type="button"
                      onClick={handleAiSuggestName}
                      disabled={aiLoading || messages.length === 0}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-dashed border-amber-300 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                      title="Определить имя клиента с помощью AI"
                    >
                      ✨
                    </button>
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Телефон</dt>
                  <dd className="text-gray-900">{client?.phone ?? phone}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Источник</dt>
                  <dd className="text-gray-900">{client?.source || '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Комментарий</dt>
                  <dd className="text-gray-900 whitespace-pre-wrap">{client?.comment || '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Дата первого обращения</dt>
                  <dd className="text-gray-900">{client?.createdAt ? formatDate(client.createdAt) : '—'}</dd>
                </div>
              </dl>
              {aiNameSuggestion && (
                <div className="mt-3 p-2 rounded-lg border border-dashed border-amber-300 bg-amber-50">
                  <p className="text-xs text-gray-700 mb-1">
                    AI предлагает имя клиента: <span className="font-semibold">«{aiNameSuggestion}»</span>
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleApplyAiName}
                      disabled={saving}
                      className="px-3 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Применить
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiNameSuggestion(null)}
                      className="px-3 py-1 text-xs font-medium rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={startEdit}
                className="mt-4 w-full py-2 text-sm font-medium text-green-600 border border-green-500 rounded-lg hover:bg-green-50"
              >
                Редактировать
              </button>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">Сделка</h3>
                {deal ? (
                  <p className="mt-1 text-sm text-gray-900">{DEAL_STATUS_LABELS[deal.status]}</p>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!phone) return;
                      setCreatingDeal(true);
                      try {
                        const newDeal = await createDealForClient(phone, companyId);
                        setDeal(newDeal);
                      } finally {
                        setCreatingDeal(false);
                      }
                    }}
                    disabled={creatingDeal}
                    className="mt-2 w-full py-2 text-sm font-medium text-green-600 border border-green-500 rounded-lg hover:bg-green-50 disabled:opacity-50"
                  >
                    {creatingDeal ? 'Создание…' : 'Создать сделку'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Имя</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Имя"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Источник</label>
                <input
                  type="text"
                  value={editSource}
                  onChange={(e) => setEditSource(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="WhatsApp"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Комментарий</label>
                <textarea
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm min-h-[80px]"
                  placeholder="Комментарий"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
};

export default ClientInfoPanel;
