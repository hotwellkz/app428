import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import { useCompanyId } from '../../contexts/CompanyContext';
import { Sparkles, MoreVertical } from 'lucide-react';

const COLLECTION_CLIENTS = 'clients';
const COLLECTION_DEALS = 'deals';

export interface DealCard {
  id: string;
  clientPhone: string;
  /** Идентификатор статуса сделки (из коллекции dealStatuses) */
  statusId?: string | null;
  /** Старое поле статуса (для обратной совместимости) */
  status?: string | null;
  /** Идентификатор ответственного менеджера (из коллекции chatManagers) */
  managerId?: string | null;
  source: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface DealStatusRecord {
  id: string;
  name: string;
  color: string;
}

export interface ChatManagerRecord {
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
    managerId: (data.managerId as string | undefined) ?? null,
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
    managerId: null,
    source: 'whatsapp',
    createdAt: null,
    updatedAt: null,
  };
}

import type { WhatsAppMessage } from '../../types/whatsappDb';

const COLLECTION_MANAGERS = 'chatManagers';

interface ClientInfoPanelProps {
  /** Номер телефона (chatId) выбранного диалога */
  phone: string | null;
  /** Сообщения текущего диалога (для AI-анализа имени) */
  messages?: WhatsAppMessage[];
  /** Настроенные статусы сделок компании */
  dealStatuses?: DealStatusRecord[];
  /** Справочник менеджеров для назначения на клиента */
  managers?: ChatManagerRecord[];
  /** Количество клиентов по статусам (для бейджей в карточке) */
  dealStatusCounts?: { none: number; byId: Record<string, number> };
  /** Количество клиентов по менеджерам (для бейджей в карточке) */
  managerCounts?: { none: number; byId: Record<string, number> };
}

const COUNT_BADGE_CLASS = 'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 py-0 rounded-[10px] text-[11px] font-medium bg-[#f1f3f5] text-[#555] flex-shrink-0';

const ClientInfoPanel: React.FC<ClientInfoPanelProps> = ({
  phone,
  messages = [],
  dealStatuses,
  managers = [],
  dealStatusCounts,
  managerCounts
}) => {
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
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [newManagerName, setNewManagerName] = useState('');
  const [newManagerColor, setNewManagerColor] = useState('#3B82F6');
  const [statusContextMenu, setStatusContextMenu] = useState<{ x: number; y: number; status: DealStatusRecord } | null>(null);
  const [editingStatus, setEditingStatus] = useState<DealStatusRecord | null>(null);
  const [editStatusName, setEditStatusName] = useState('');
  const [editStatusColor, setEditStatusColor] = useState('#6B7280');
  const [deletingStatus, setDeletingStatus] = useState<{ status: DealStatusRecord; dealCount: number } | null>(null);
  const [deleteStatusLoading, setDeleteStatusLoading] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const [managerContextMenu, setManagerContextMenu] = useState<{ x: number; y: number; manager: ChatManagerRecord } | null>(null);
  const [editingManager, setEditingManager] = useState<ChatManagerRecord | null>(null);
  const [editManagerName, setEditManagerName] = useState('');
  const [editManagerColor, setEditManagerColor] = useState('#3B82F6');
  const [deletingManager, setDeletingManager] = useState<{ manager: ChatManagerRecord; dealCount: number } | null>(null);
  const [deleteManagerLoading, setDeleteManagerLoading] = useState(false);
  const managerMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!statusContextMenu) return;
    const close = () => setStatusContextMenu(null);
    const onDocClick = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [statusContextMenu]);

  useEffect(() => {
    if (!managerContextMenu) return;
    const close = () => setManagerContextMenu(null);
    const onDocClick = (e: MouseEvent) => {
      if (managerMenuRef.current && !managerMenuRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [managerContextMenu]);

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
                      {/* Без статуса */}
                      <div className="group flex items-center gap-1 w-full">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!phone || !deal) return;
                            setCreatingDeal(true);
                            try {
                              await updateDoc(doc(db, COLLECTION_DEALS, deal.id), {
                                statusId: null,
                                status: null,
                                updatedAt: serverTimestamp()
                              });
                              setDeal({ ...deal, statusId: null, status: null });
                            } finally {
                              setCreatingDeal(false);
                            }
                          }}
                          className="flex-1 min-w-0 text-left px-2 py-1 rounded-md text-xs hover:bg-gray-100 flex items-center gap-2"
                        >
                          <span className="inline-flex h-2 w-2 rounded-full flex-shrink-0 bg-gray-300" />
                          <span className="truncate">Без статуса</span>
                        </button>
                        {dealStatusCounts != null && (
                          <span className={COUNT_BADGE_CLASS}>{dealStatusCounts.none}</span>
                        )}
                      </div>
                      {dealStatuses.map((s) => (
                        <div
                          key={s.id}
                          className="group flex items-center gap-1 w-full"
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setStatusContextMenu({ x: e.clientX, y: e.clientY, status: s });
                          }}
                        >
                          <button
                            type="button"
                            onClick={async () => {
                              if (!phone) return;
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
                            className="flex-1 min-w-0 text-left px-2 py-1 rounded-md text-xs hover:bg-gray-100 flex items-center gap-2"
                          >
                            <span
                              className="inline-flex h-2 w-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: s.color }}
                            />
                            <span className="truncate">{s.name}</span>
                          </button>
                          {dealStatusCounts != null && (
                            <span className={COUNT_BADGE_CLASS}>{dealStatusCounts.byId[s.id] ?? 0}</span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatusContextMenu({ x: e.clientX, y: e.clientY, status: s });
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 text-gray-500 flex-shrink-0"
                            aria-label="Меню статуса"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>
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

              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Ответственный менеджер</h3>
                {managers.length > 0 ? (
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer w-full min-w-0">
                      <input
                        type="radio"
                        name="manager"
                        checked={!deal?.managerId}
                        onChange={async () => {
                          if (!phone || !deal) return;
                          setCreatingDeal(true);
                          try {
                            await updateDoc(doc(db, COLLECTION_DEALS, deal.id), {
                              managerId: null,
                              updatedAt: serverTimestamp()
                            });
                            setDeal({ ...deal, managerId: null });
                          } finally {
                            setCreatingDeal(false);
                          }
                        }}
                        className="text-green-600"
                      />
                      <span className="text-sm text-gray-600 truncate">Без менеджера</span>
                      {managerCounts != null && (
                        <span className={COUNT_BADGE_CLASS + ' ml-auto'}>{managerCounts.none}</span>
                      )}
                    </label>
                    {managers.map((mg) => (
                      <div
                        key={mg.id}
                        className="group flex items-center gap-1 w-full"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setManagerContextMenu({ x: e.clientX, y: e.clientY, manager: mg });
                        }}
                      >
                        <label className="flex-1 flex items-center gap-2 cursor-pointer min-w-0">
                          <input
                            type="radio"
                            name="manager"
                            checked={deal?.managerId === mg.id}
                            onChange={async () => {
                              if (!phone) return;
                              setCreatingDeal(true);
                              try {
                                if (!deal) {
                                  const newDeal = await createDealForClient(phone, companyId);
                                  await updateDoc(doc(db, COLLECTION_DEALS, newDeal.id), {
                                    managerId: mg.id,
                                    updatedAt: serverTimestamp()
                                  });
                                  setDeal({ ...newDeal, managerId: mg.id });
                                } else {
                                  await updateDoc(doc(db, COLLECTION_DEALS, deal.id), {
                                    managerId: mg.id,
                                    updatedAt: serverTimestamp()
                                  });
                                  setDeal({ ...deal, managerId: mg.id });
                                }
                              } finally {
                                setCreatingDeal(false);
                              }
                            }}
                            className="text-green-600"
                          />
                          <span
                            className="inline-flex h-2 w-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: mg.color }}
                          />
                          <span className="text-sm text-gray-800 truncate">{mg.name}</span>
                        </label>
                        {managerCounts != null && (
                          <span className={COUNT_BADGE_CLASS}>{managerCounts.byId[mg.id] ?? 0}</span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setManagerContextMenu({ x: e.clientX, y: e.clientY, manager: mg });
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 text-gray-500 flex-shrink-0"
                          aria-label="Меню менеджера"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowManagerModal(true)}
                      className="mt-1 text-[11px] text-green-600 hover:text-green-700"
                    >
                      + Добавить менеджера
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-500 mb-1">Менеджеры не добавлены.</p>
                    <button
                      type="button"
                      onClick={() => setShowManagerModal(true)}
                      className="text-[11px] text-green-600 hover:text-green-700"
                    >
                      + Добавить первого менеджера
                    </button>
                  </>
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
      {statusContextMenu && (
        <div
          ref={statusMenuRef}
          className="fixed z-[1300] min-w-[140px] py-1 bg-white rounded-lg shadow-lg border border-gray-200"
          style={{ left: statusContextMenu.x, top: statusContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => {
              setEditStatusName(statusContextMenu.status.name);
              setEditStatusColor(statusContextMenu.status.color);
              setEditingStatus(statusContextMenu.status);
              setStatusContextMenu(null);
            }}
          >
            Редактировать
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            onClick={async () => {
              const status = statusContextMenu.status;
              setStatusContextMenu(null);
              const dealsSnap = await getDocs(
                query(
                  collection(db, COLLECTION_DEALS),
                  where('companyId', '==', companyId),
                  where('statusId', '==', status.id)
                )
              );
              setDeletingStatus({ status, dealCount: dealsSnap.size });
            }}
          >
            Удалить
          </button>
        </div>
      )}

      {editingStatus && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-xs">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Редактировать статус</h3>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Название статуса</label>
                <input
                  type="text"
                  value={editStatusName}
                  onChange={(e) => setEditStatusName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Например: КП выслано"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Цвет статуса</label>
                <input
                  type="color"
                  value={editStatusColor}
                  onChange={(e) => setEditStatusColor(e.target.value)}
                  className="h-8 w-16 border border-gray-300 rounded"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingStatus(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!editStatusName.trim()}
                onClick={async () => {
                  if (!editStatusName.trim()) return;
                  await updateDoc(doc(db, 'dealStatuses', editingStatus.id), {
                    name: editStatusName.trim(),
                    color: editStatusColor
                  });
                  setEditingStatus(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingStatus && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">
              Удалить статус «{deletingStatus.status.name}»?
            </h3>
            {deletingStatus.dealCount > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mb-3">
                Этот статус используется в {deletingStatus.dealCount} сделках. При удалении сделки
                получат статус «Без статуса».
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingStatus(null)}
                disabled={deleteStatusLoading}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={deleteStatusLoading}
                onClick={async () => {
                  setDeleteStatusLoading(true);
                  try {
                    const { status } = deletingStatus;
                    const dealsSnap = await getDocs(
                      query(
                        collection(db, COLLECTION_DEALS),
                        where('companyId', '==', companyId),
                        where('statusId', '==', status.id)
                      )
                    );
                    const batch = writeBatch(db);
                    dealsSnap.docs.forEach((d) => {
                      batch.update(d.ref, { statusId: null, status: null, updatedAt: serverTimestamp() });
                    });
                    await batch.commit();
                    await deleteDoc(doc(db, 'dealStatuses', status.id));
                    if (deal && (deal.statusId === status.id || deal.status === status.id)) {
                      setDeal({ ...deal, statusId: null, status: null });
                    }
                    setDeletingStatus(null);
                  } finally {
                    setDeleteStatusLoading(false);
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteStatusLoading ? 'Удаление…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {managerContextMenu && (
        <div
          ref={managerMenuRef}
          className="fixed z-[1300] min-w-[140px] py-1 bg-white rounded-lg shadow-lg border border-gray-200"
          style={{ left: managerContextMenu.x, top: managerContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => {
              setEditManagerName(managerContextMenu.manager.name);
              setEditManagerColor(managerContextMenu.manager.color);
              setEditingManager(managerContextMenu.manager);
              setManagerContextMenu(null);
            }}
          >
            Редактировать
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            onClick={async () => {
              const manager = managerContextMenu.manager;
              setManagerContextMenu(null);
              const dealsSnap = await getDocs(
                query(
                  collection(db, COLLECTION_DEALS),
                  where('companyId', '==', companyId),
                  where('managerId', '==', manager.id)
                )
              );
              setDeletingManager({ manager, dealCount: dealsSnap.size });
            }}
          >
            Удалить
          </button>
        </div>
      )}

      {editingManager && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-xs">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Редактировать менеджера</h3>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Имя менеджера</label>
                <input
                  type="text"
                  value={editManagerName}
                  onChange={(e) => setEditManagerName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Например: Маргарита"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Цвет иконки</label>
                <input
                  type="color"
                  value={editManagerColor}
                  onChange={(e) => setEditManagerColor(e.target.value)}
                  className="h-8 w-16 border border-gray-300 rounded"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingManager(null)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!editManagerName.trim()}
                onClick={async () => {
                  if (!editManagerName.trim()) return;
                  await updateDoc(doc(db, COLLECTION_MANAGERS, editingManager.id), {
                    name: editManagerName.trim(),
                    color: editManagerColor
                  });
                  setEditingManager(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingManager && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">
              Удалить менеджера «{deletingManager.manager.name}»?
            </h3>
            {deletingManager.dealCount > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mb-3">
                Этот менеджер назначен в {deletingManager.dealCount} сделках. При удалении у сделок
                будет установлен вариант «Без менеджера».
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingManager(null)}
                disabled={deleteManagerLoading}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={deleteManagerLoading}
                onClick={async () => {
                  setDeleteManagerLoading(true);
                  try {
                    const { manager } = deletingManager;
                    const dealsSnap = await getDocs(
                      query(
                        collection(db, COLLECTION_DEALS),
                        where('companyId', '==', companyId),
                        where('managerId', '==', manager.id)
                      )
                    );
                    const batch = writeBatch(db);
                    dealsSnap.docs.forEach((d) => {
                      batch.update(d.ref, { managerId: null, updatedAt: serverTimestamp() });
                    });
                    await batch.commit();
                    await deleteDoc(doc(db, COLLECTION_MANAGERS, manager.id));
                    if (deal && deal.managerId === manager.id) {
                      setDeal({ ...deal, managerId: null });
                    }
                    setDeletingManager(null);
                  } finally {
                    setDeleteManagerLoading(false);
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteManagerLoading ? 'Удаление…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
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
      {showManagerModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-xs">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Новый менеджер</h3>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Имя</label>
                <input
                  type="text"
                  value={newManagerName}
                  onChange={(e) => setNewManagerName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Например: Маргарита"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Цвет</label>
                <input
                  type="color"
                  value={newManagerColor}
                  onChange={(e) => setNewManagerColor(e.target.value)}
                  className="h-8 w-16 border border-gray-300 rounded"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowManagerModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!newManagerName.trim()}
                onClick={async () => {
                  if (!companyId || !newManagerName.trim()) return;
                  const col = collection(db, COLLECTION_MANAGERS);
                  await addDoc(col, {
                    name: newManagerName.trim(),
                    color: newManagerColor,
                    order: managers?.length ?? 0,
                    companyId
                  });
                  setShowManagerModal(false);
                  setNewManagerName('');
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
