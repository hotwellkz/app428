import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  Pencil,
  Trash2,
  GitBranch,
  MessageCircle,
  FileText,
  History,
  ListTodo,
  FolderOpen
} from 'lucide-react';
import type { Deal, DealsPipelineStage, DealHistoryEntry } from '../../types/deals';
import { subscribeDealHistory, updateDeal, softDeleteDeal } from '../../lib/firebase/deals';

function formatDealDate(v: Deal['createdAt']): string {
  if (!v) return '—';
  let ms: number;
  if (typeof (v as { toMillis?: () => number }).toMillis === 'function') {
    ms = (v as { toMillis: () => number }).toMillis();
  } else if (typeof v === 'object' && v !== null && 'seconds' in (v as object)) {
    ms = ((v as { seconds: number }).seconds ?? 0) * 1000;
  } else ms = new Date(v as string).getTime();
  return new Date(ms).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatHistoryDate(v: DealHistoryEntry['createdAt']): string {
  if (!v) return '';
  let ms: number;
  if (typeof (v as { toMillis?: () => number }).toMillis === 'function') {
    ms = (v as { toMillis: () => number }).toMillis();
  } else if (typeof v === 'object' && v !== null && 'seconds' in (v as object)) {
    ms = ((v as { seconds: number }).seconds ?? 0) * 1000;
  } else ms = new Date(v as string).getTime();
  return new Date(ms).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export interface ManagerOption {
  id: string;
  name: string;
  color?: string;
}

interface DealSidebarProps {
  deal: Deal;
  companyId: string;
  stages: DealsPipelineStage[];
  managers: ManagerOption[];
  onClose: () => void;
  onDeleted: () => void;
  onMoveStage: (stageId: string) => void;
}

export const DealSidebar: React.FC<DealSidebarProps> = ({
  deal,
  companyId,
  stages,
  managers,
  onClose,
  onDeleted,
  onMoveStage
}) => {
  const [history, setHistory] = useState<DealHistoryEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: deal.title,
    clientName: deal.clientNameSnapshot ?? '',
    phone: deal.clientPhoneSnapshot ?? '',
    amount: deal.amount != null ? String(deal.amount) : '',
    note: deal.note ?? '',
    source: deal.source ?? 'Ручной',
    responsibleUserId: deal.responsibleUserId ?? ''
  });
  const [moveOpen, setMoveOpen] = useState(false);

  useEffect(() => {
    setForm({
      title: deal.title,
      clientName: deal.clientNameSnapshot ?? '',
      phone: deal.clientPhoneSnapshot ?? '',
      amount: deal.amount != null ? String(deal.amount) : '',
      note: deal.note ?? '',
      source: deal.source ?? 'Ручной',
      responsibleUserId: deal.responsibleUserId ?? ''
    });
  }, [deal.id, deal.title, deal.clientNameSnapshot, deal.clientPhoneSnapshot, deal.amount, deal.note, deal.source, deal.responsibleUserId]);

  useEffect(() => {
    const unsub = subscribeDealHistory(companyId, deal.id, setHistory, () => setHistory([]));
    return () => unsub();
  }, [companyId, deal.id]);

  const saveEdit = async () => {
    setSaving(true);
    try {
      const mgr = managers.find((m) => m.id === form.responsibleUserId);
      await updateDeal(deal.id, {
        title: form.title.trim(),
        clientNameSnapshot: form.clientName.trim() || undefined,
        clientPhoneSnapshot: form.phone.trim() || undefined,
        amount: form.amount.trim() ? Number(form.amount.replace(/\s/g, '')) : undefined,
        note: form.note,
        source: form.source || null,
        responsibleUserId: form.responsibleUserId || null,
        responsibleNameSnapshot: mgr?.name ?? null
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Переместить сделку в корзину?')) return;
    await softDeleteDeal(deal.id, companyId);
    onDeleted();
  };

  return (
    <>
      <div className="fixed inset-0 z-[1050] bg-black/30 lg:bg-black/20" aria-hidden onClick={onClose} />
      <aside
        className="deal-sidebar fixed top-0 right-0 z-[1060] h-full w-full max-w-md bg-white shadow-2xl border-l border-gray-200 flex flex-col animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-label="Карточка сделки"
      >
        <div className="flex-none flex items-start justify-between gap-2 p-4 border-b border-gray-100 bg-gradient-to-br from-slate-50 to-white">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Сделка</p>
            <h2 className="text-lg font-semibold text-slate-900 mt-0.5 truncate">{deal.title}</h2>
            <p className="text-xs text-slate-500 mt-1">{formatDealDate(deal.createdAt)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {!editing ? (
            <>
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2">Клиент</h3>
                <p className="text-sm font-medium text-slate-900">{deal.clientNameSnapshot || '—'}</p>
                <p className="text-sm text-slate-600 font-mono mt-1">{deal.clientPhoneSnapshot || '—'}</p>
                <p className="text-sm text-slate-600 mt-2">
                  <span className="text-slate-400">Источник: </span>
                  {deal.source || '—'}
                </p>
              </section>
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2">Сумма</h3>
                <p className="text-lg font-semibold text-emerald-700">
                  {deal.amount != null ? `${deal.amount.toLocaleString('ru-RU')} ₸` : '—'}
                </p>
              </section>
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2 flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" /> Ответственный
                </h3>
                <p className="text-sm text-slate-800">{deal.responsibleNameSnapshot || 'Не назначен'}</p>
              </section>
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> Комментарий
                </h3>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{deal.note?.trim() || '—'}</p>
              </section>
            </>
          ) : (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-500">Название</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
              <label className="block text-xs font-medium text-slate-500">Клиент</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.clientName}
                onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
              />
              <label className="block text-xs font-medium text-slate-500">Телефон</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <label className="block text-xs font-medium text-slate-500">Сумма (₸)</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
              <label className="block text-xs font-medium text-slate-500">Источник</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              >
                {['WhatsApp', 'Звонок', 'Сайт', 'Ручной', 'Другое'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <label className="block text-xs font-medium text-slate-500">Ответственный</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.responsibleUserId}
                onChange={(e) => setForm((f) => ({ ...f, responsibleUserId: e.target.value }))}
              >
                <option value="">Не назначен</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <label className="block text-xs font-medium text-slate-500">Комментарий</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm min-h-[80px]"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveEdit}
                  className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 rounded-lg border text-sm"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2 flex items-center gap-1">
              <FolderOpen className="w-3.5 h-3.5" /> Файлы
            </h3>
            <p className="text-sm text-slate-400">Скоро: вложения к сделке</p>
          </section>
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2 flex items-center gap-1">
              <History className="w-3.5 h-3.5" /> История
            </h3>
            <ul className="space-y-2 max-h-48 overflow-y-auto text-sm border border-slate-100 rounded-lg p-2 bg-slate-50/80">
              {history.length === 0 && <li className="text-slate-400 text-xs">Нет записей</li>}
              {history.map((h) => (
                <li key={h.id} className="border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                  <p className="text-slate-800">{h.message}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{formatHistoryDate(h.createdAt)}</p>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2 flex items-center gap-1">
              <ListTodo className="w-3.5 h-3.5" /> Задачи
            </h3>
            <p className="text-sm text-slate-400">Скоро: задачи по сделке</p>
          </section>

          {deal.whatsappConversationId && (
            <Link
              to={`/whatsapp?chatId=${deal.whatsappConversationId}`}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#25D366] text-white text-sm font-medium"
            >
              <MessageCircle className="w-4 h-4" />
              Открыть чат WhatsApp
            </Link>
          )}
        </div>

        <div className="flex-none p-4 border-t border-gray-100 bg-slate-50/90 space-y-2 safe-area-pb">
          {!editing && (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  <Pencil className="w-4 h-4" />
                  Редактировать
                </button>
                <button
                  type="button"
                  onClick={() => setMoveOpen((v) => !v)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  <GitBranch className="w-4 h-4" />
                  Переместить
                </button>
              </div>
              {moveOpen && (
                <div className="rounded-lg border border-slate-200 bg-white p-2 max-h-40 overflow-y-auto">
                  {stages.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={s.id === deal.stageId}
                      onClick={() => {
                        onMoveStage(s.id);
                        setMoveOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-slate-50 disabled:opacity-40 flex items-center gap-2"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor: s.color && /^#[0-9A-Fa-f]{3,8}$/i.test(s.color) ? s.color : '#94a3b8'
                        }}
                      />
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={handleDelete}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                Удалить
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
};

export default DealSidebar;
