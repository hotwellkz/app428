import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import { useCompanyId } from '../../contexts/CompanyContext';
import { Sparkles } from 'lucide-react';

const COLLECTION_CLIENTS = 'clients';
const COLLECTION_DEALS = 'deals';

export interface DealCard {
  id: string;
  clientPhone: string;
  /** Идентификатор статуса сделки (из коллекции dealStatuses) */
  statusId?: string | null;
  /** Старое поле статуса (для обратной совместимости) */
  status?: string | null;
  source: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface DealStatusRecord {
  id: string;
  name: string;
  color: string;
}

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
    statusId: (data.statusId as string | undefined) ?? (data.status as string | undefined) ?? null,
    status: (data.status as string | undefined) ?? null,
    source: (data.source as string) ?? 'whatsapp',
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

async function createDealForClient(phone: string, companyId: string): Promise<DealCard> {
  const normalized = normalizePhone(phone);
  const ref = await addDoc(collection(db, COLLECTION_DEALS), {
    clientPhone: normalized,
    statusId: 'new',
    status: 'new',
    source: 'whatsapp',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    companyId,
  });
  return {
    id: ref.id,
    clientPhone: normalized,
    statusId: 'new',
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
  /** Настроенные статусы сделок компании */
  dealStatuses?: DealStatusRecord[];
}

const ClientInfoPanel: React.FC<ClientInfoPanelProps> = ({ phone, messages = [], dealStatuses }) => {
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
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#6B7280');

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
  const handleAIAnalyze = async () => {
    if (!phone || aiLoading) return;
    const recent = messages
      .map((m) => ({
        ...m,
        _content: (m.transcription ?? m.text ?? '').trim()
      }))
      .filter((m) => m._content.length > 0 && !m.deleted)
      .slice(-30);
    if (recent.length === 0) return;

    setAiLoading(true);
    try {
      const payload = {
        chatId: normalizePhone(phone),
        messages: recent.map((m) => ({
          role: m.direction === 'incoming' ? ('client' as const) : ('manager' as const),
          text: m._content.replace(/<[^>]*>/g, '').trim(),
        })),
      };
      const res = await fetch('/.netlify/functions/ai-analyze-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        name?: string | null;
        leadTitle?: string | null;
        comment?: string | null;
        error?: string;
      };
      if (!res.ok || data.error) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('[ClientInfoPanel] AI analyze client failed', { status: res.status, data });
        }
        return;
      }
      const rawName =
        typeof data.name === 'string' ? data.name.trim() : data.name === null ? null : null;
      const rawLeadTitle =
        typeof data.leadTitle === 'string'
          ? data.leadTitle.trim()
          : data.leadTitle === null
          ? null
          : null;
      const nextName = rawName && rawName.length > 0 ? rawName : rawLeadTitle && rawLeadTitle.length > 0 ? rawLeadTitle : null;
      const nextComment =
        typeof data.comment === 'string'
          ? data.comment.trim()
          : data.comment === null
          ? null
          : null;

      if (nextName && nextName.length > 0) {
        setEditName(nextName);
      }
      if (nextComment && nextComment.length > 0) {
        setEditComment(nextComment);
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[ClientInfoPanel] AI analyze client error', e);
      }
    } finally {
      setAiLoading(false);
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
                  <dd className="text-gray-900">{client?.name || '—'}</dd>
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
              <button
                type="button"
                onClick={startEdit}
                className="mt-4 w-full py-2 text-sm font-medium text-green-600 border border-green-500 rounded-lg hover:bg-green-50"
              >
                Редактировать
              </button>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Сделка</h3>
                {dealStatuses && dealStatuses.length > 0 ? (
                  <div className="space-y-2">
                    {(() => {
                      const currentStatusId = deal?.statusId ?? deal?.status ?? null;
                      const current =
                        (currentStatusId &&
                          dealStatuses.find((s) => s.id === currentStatusId)) ??
                        null;
                      return (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border border-gray-200 bg-gray-50"
                        >
                          <span
                            className="inline-flex h-2 w-2 rounded-full"
                            style={{ backgroundColor: current?.color ?? '#6B7280' }}
                          />
                          <span>{current?.name ?? 'Без статуса'}</span>
                        </button>
                      );
                    })()}
                    <div className="mt-1 space-y-1">
                      {dealStatuses.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={async () => {
                            if (!phone) return;
                            const normalized = normalizePhone(phone);
                            setCreatingDeal(true);
                            try {
                              if (!deal) {
                                const newDeal = await createDealForClient(phone, companyId);
                                await updateDoc(doc(db, COLLECTION_DEALS, newDeal.id), {
                                  statusId: s.id,
                                  status: s.id,
                                  updatedAt: serverTimestamp()
                                });
                                setDeal({
                                  ...newDeal,
                                  statusId: s.id,
                                  status: s.id
                                });
                              } else {
                                await updateDoc(doc(db, COLLECTION_DEALS, deal.id), {
                                  statusId: s.id,
                                  status: s.id,
                                  updatedAt: serverTimestamp()
                                });
                                setDeal({ ...deal, statusId: s.id, status: s.id });
                              }
                            } finally {
                              setCreatingDeal(false);
                            }
                          }}
                          className="w-full text-left px-2 py-1 rounded-md text-xs hover:bg-gray-100 flex items-center gap-2"
                        >
                          <span
                            className="inline-flex h-2 w-2 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          <span>{s.name}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowStatusModal(true)}
                      className="mt-1 text-[11px] text-green-600 hover:text-green-700"
                    >
                      + Добавить статус
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">
                      Статусы сделок ещё не настроены.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowStatusModal(true)}
                      className="mt-1 text-[11px] text-green-600 hover:text-green-700"
                    >
                      + Добавить первый статус
                    </button>
                    {!deal && (
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
                )}
              </div>
            </>
          ) : (
            <div className="mt-4 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-gray-500">Имя</label>
                  <button
                    type="button"
                    onClick={handleAIAnalyze}
                    disabled={aiLoading || messages.length === 0}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-amber-300 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                    title="AI анализ переписки: определить имя и комментарий"
                  >
                    <Sparkles
                      size={14}
                      className={aiLoading ? 'animate-spin' : ''}
                    />
                    <span className="hidden md:inline">AI анализ</span>
                  </button>
                </div>
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
      {showStatusModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-xs">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Новый статус сделки</h3>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Название</label>
                <input
                  type="text"
                  value={newStatusName}
                  onChange={(e) => setNewStatusName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Например: Назначена встреча"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Цвет</label>
                <input
                  type="color"
                  value={newStatusColor}
                  onChange={(e) => setNewStatusColor(e.target.value)}
                  className="h-8 w-16 border border-gray-300 rounded"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!newStatusName.trim()}
                onClick={async () => {
                  if (!companyId || !newStatusName.trim()) return;
                  const col = collection(db, 'dealStatuses');
                  await addDoc(col, {
                    name: newStatusName.trim(),
                    color: newStatusColor,
                    order: dealStatuses?.length ?? 0,
                    companyId
                  });
                  setShowStatusModal(false);
                  setNewStatusName('');
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default ClientInfoPanel;
