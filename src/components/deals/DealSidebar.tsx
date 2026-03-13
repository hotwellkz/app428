import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Timestamp, addDoc, collection } from 'firebase/firestore';
import {
  X,
  Pencil,
  Trash2,
  GitBranch,
  MessageCircle,
  FileText,
  History,
  Phone,
  ListTodo,
  Zap,
  ChevronRight
} from 'lucide-react';
import type { Deal, DealsPipelineStage, DealHistoryEntry, DealActivityLogEntry } from '../../types/deals';
import {
  subscribeDealHistory,
  subscribeDealActivity,
  updateDeal,
  softDeleteDeal,
  addDealActivity
} from '../../lib/firebase/deals';
import { db } from '../../lib/firebase/config';

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

function timeMs(v: DealHistoryEntry['createdAt']): number {
  if (!v) return 0;
  if (typeof (v as { toMillis?: () => number }).toMillis === 'function') {
    return (v as { toMillis: () => number }).toMillis();
  }
  if (typeof v === 'object' && v !== null && 'seconds' in (v as object)) {
    return ((v as { seconds: number }).seconds ?? 0) * 1000;
  }
  return new Date(v as string).getTime();
}

function formatLineDate(ms: number): string {
  return new Date(ms).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function activityLabel(type: DealActivityLogEntry['type'], payload: Record<string, unknown>): string {
  switch (type) {
    case 'created':
      return 'Сделка создана';
    case 'stage_changed':
      return `Этап изменён${payload.stageId ? '' : ''}`;
    case 'manager_assigned':
      return `Менеджер: ${(payload.name as string) ?? 'назначен'}`;
    case 'priority_changed':
      return `Приоритет: ${(payload.priority as string) ?? '—'}`;
    case 'amount_changed':
      return `Сумма: ${(payload.amount as number)?.toLocaleString?.('ru-RU') ?? '—'} ₸`;
    case 'next_step_set':
      return `След. шаг: ${(payload.nextAction as string) ?? '—'}`;
    case 'comment_added':
      return 'Комментарий';
    case 'deleted':
      return 'В корзину';
    case 'restored':
      return 'Восстановлена';
    case 'whatsapp_in':
      return 'Входящее WhatsApp';
    case 'whatsapp_out':
      return 'Исходящее WhatsApp';
    default:
      return 'Обновление';
  }
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

const PRIORITIES: { id: string; label: string }[] = [
  { id: 'high', label: 'Высокий' },
  { id: 'medium', label: 'Средний' },
  { id: 'low', label: 'Низкий' }
];

const TAG_PRESETS = [
  'горячий',
  'сравнивает',
  'рассрочка',
  'замер',
  'повторный',
  'КП отправлено',
  'ждёт расчёт'
];

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
  const [activity, setActivity] = useState<DealActivityLogEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<
    'main' | 'client' | 'next' | 'timeline' | 'comments'
  >('main');
  const [form, setForm] = useState({
    title: deal.title,
    clientName: deal.clientNameSnapshot ?? '',
    phone: deal.clientPhoneSnapshot ?? '',
    amount: deal.amount != null ? String(deal.amount) : '',
    note: deal.note ?? '',
    source: deal.source ?? 'Ручной',
    responsibleUserId: deal.responsibleUserId ?? '',
    nextAction: deal.nextAction ?? '',
    nextActionAt: deal.nextActionAt
      ? new Date(timeMs(deal.nextActionAt)).toISOString().slice(0, 16)
      : '',
    priority: (deal.priority as string) || 'medium',
    tags: (deal.tags ?? []).join(', ')
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
      responsibleUserId: deal.responsibleUserId ?? '',
      nextAction: deal.nextAction ?? '',
      nextActionAt: deal.nextActionAt
        ? new Date(timeMs(deal.nextActionAt)).toISOString().slice(0, 16)
        : '',
      priority: (deal.priority as string) || 'medium',
      tags: (deal.tags ?? []).join(', ')
    });
  }, [deal.id]);

  useEffect(() => {
    const u1 = subscribeDealHistory(companyId, deal.id, setHistory, () => setHistory([]));
    const u2 = subscribeDealActivity(companyId, deal.id, setActivity, () => setActivity([]));
    return () => {
      u1();
      u2();
    };
  }, [companyId, deal.id]);

  const timeline = useMemo(() => {
    const rows: { ms: number; text: string; kind: 'hist' | 'act' }[] = [];
    history.forEach((h) => rows.push({ ms: timeMs(h.createdAt), text: h.message, kind: 'hist' }));
    activity.forEach((a) =>
      rows.push({
        ms: timeMs(a.createdAt),
        text: activityLabel(a.type, a.payload),
        kind: 'act'
      })
    );
    rows.sort((a, b) => a.ms - b.ms);
    return rows;
  }, [history, activity]);

  const stageName = stages.find((s) => s.id === deal.stageId)?.name ?? '—';

  const saveEdit = async () => {
    setSaving(true);
    try {
      const mgr = managers.find((m) => m.id === form.responsibleUserId);
      const tags = form.tags
        .split(/[,;]/)
        .map((t) => t.trim())
        .filter(Boolean);
      const nextAt = form.nextActionAt.trim()
        ? Timestamp.fromDate(new Date(form.nextActionAt))
        : null;
      const prevMgr = deal.responsibleUserId;
      const prevAmount = deal.amount;
      const prevPriority = deal.priority;
      const prevNext = deal.nextAction;
      const prevNextAt = deal.nextActionAt ? timeMs(deal.nextActionAt) : 0;

      await updateDeal(deal.id, {
        title: form.title.trim(),
        clientNameSnapshot: form.clientName.trim() || undefined,
        clientPhoneSnapshot: form.phone.trim() || undefined,
        amount: form.amount.trim() ? Number(form.amount.replace(/\s/g, '')) : undefined,
        note: form.note,
        source: form.source || null,
        responsibleUserId: form.responsibleUserId || null,
        responsibleNameSnapshot: mgr?.name ?? null,
        nextAction: form.nextAction.trim() || null,
        nextActionAt: nextAt,
        priority: form.priority || null,
        tags
      });

      if (prevMgr !== (form.responsibleUserId || null)) {
        await addDealActivity(companyId, deal.id, 'manager_assigned', { name: mgr?.name });
        await addDoc(collection(db, 'deal_history'), {
          companyId,
          dealId: deal.id,
          message: `Ответственный: ${mgr?.name ?? 'не назначен'}`,
          createdAt: Timestamp.now()
        });
      }
      if (prevPriority !== form.priority) {
        await addDealActivity(companyId, deal.id, 'priority_changed', { priority: form.priority });
      }
      const newAmount = form.amount.trim() ? Number(form.amount.replace(/\s/g, '')) : undefined;
      if (prevAmount !== newAmount) {
        await addDealActivity(companyId, deal.id, 'amount_changed', { amount: newAmount });
      }
      const newNextAtMs = form.nextActionAt.trim() ? new Date(form.nextActionAt).getTime() : 0;
      if (prevNext !== form.nextAction.trim() || prevNextAt !== newNextAtMs) {
        await addDealActivity(companyId, deal.id, 'next_step_set', {
          nextAction: form.nextAction.trim(),
          nextActionAt: form.nextActionAt
        });
        await addDoc(collection(db, 'deal_history'), {
          companyId,
          dealId: deal.id,
          message: `Следующий шаг: ${form.nextAction.trim() || '—'}${form.nextActionAt ? ` к ${new Date(form.nextActionAt).toLocaleString('ru-RU')}` : ''}`,
          createdAt: Timestamp.now()
        });
      }
      if (form.note !== (deal.note ?? '') && form.note.trim()) {
        await addDealActivity(companyId, deal.id, 'comment_added', { preview: form.note.slice(0, 80) });
      }
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

  const phoneHref = deal.clientPhoneSnapshot?.replace(/\D/g, '')
    ? `tel:${deal.clientPhoneSnapshot.replace(/\D/g, '')}`
    : null;

  return (
    <>
      <div className="fixed inset-0 z-[1050] bg-black/35 lg:bg-black/25" aria-hidden onClick={onClose} />
      <aside
        className="deal-sidebar fixed top-0 right-0 z-[1060] h-full w-full max-w-lg bg-white shadow-2xl border-l border-slate-200 flex flex-col"
        role="dialog"
        aria-label="Карточка сделки"
      >
        <div className="flex-none flex items-start justify-between gap-2 p-4 border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Сделка</span>
              {deal.priority === 'high' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 font-semibold">
                  Высокий
                </span>
              )}
              {deal.priority === 'medium' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold">
                  Средний
                </span>
              )}
              {deal.priority === 'low' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                  Низкий
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">{deal.title}</h2>
            <p className="text-xs text-slate-500 mt-1">
              Этап: <span className="font-medium text-slate-700">{stageName}</span> · {formatDealDate(deal.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-600"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-none flex flex-wrap gap-1.5 px-3 py-2 border-b border-slate-100 bg-slate-50/90">
          {[
            { id: 'main' as const, label: 'Основное' },
            { id: 'client' as const, label: 'Клиент' },
            { id: 'next' as const, label: 'След. шаг' },
            { id: 'timeline' as const, label: 'История' },
            { id: 'comments' as const, label: 'Комментарий' }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSection(t.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                section === t.id
                  ? 'bg-white text-emerald-800 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:bg-white/80'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-none grid grid-cols-2 sm:grid-cols-4 gap-1.5 px-3 py-2 border-b border-slate-100">
          {deal.whatsappConversationId && (
            <Link
              to={`/whatsapp?chatId=${deal.whatsappConversationId}`}
              className="flex items-center justify-center gap-1 py-2 rounded-lg bg-[#25D366] text-white text-xs font-semibold"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp
            </Link>
          )}
          {phoneHref && (
            <a
              href={phoneHref}
              className="flex items-center justify-center gap-1 py-2 rounded-lg bg-slate-800 text-white text-xs font-semibold"
            >
              <Phone className="w-3.5 h-3.5" />
              Звонок
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              setSection('next');
              setEditing(true);
            }}
            className="flex items-center justify-center gap-1 py-2 rounded-lg bg-amber-500 text-white text-xs font-semibold"
          >
            <ListTodo className="w-3.5 h-3.5" />
            Задача
          </button>
          <button
            type="button"
            onClick={() => setMoveOpen((v) => !v)}
            className="flex items-center justify-center gap-1 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800"
          >
            <GitBranch className="w-3.5 h-3.5" />
            Этап
          </button>
        </div>
        {moveOpen && (
          <div className="flex-none max-h-36 overflow-y-auto border-b border-slate-100 px-3 py-2 bg-white">
            {stages.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={s.id === deal.stageId}
                onClick={() => {
                  onMoveStage(s.id);
                  setMoveOpen(false);
                }}
                className="w-full text-left px-2 py-1.5 text-sm rounded-lg hover:bg-slate-50 disabled:opacity-40 flex items-center gap-2"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: s.color && /^#[0-9A-Fa-f]{3,8}$/i.test(s.color) ? s.color : '#94a3b8'
                  }}
                />
                {s.name}
                <ChevronRight className="w-3 h-3 ml-auto opacity-40" />
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {section === 'main' && !editing && (
            <>
              <section>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Сумма</h3>
                <p className="text-xl font-bold text-emerald-700 tabular-nums">
                  {deal.amount != null ? `${deal.amount.toLocaleString('ru-RU')} ₸` : '—'}
                </p>
              </section>
              <section>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Ответственный</h3>
                <p className="text-sm font-medium text-slate-800">
                  {deal.responsibleNameSnapshot || (
                    <span className="text-amber-700">Не назначен</span>
                  )}
                </p>
              </section>
              <section>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Источник</h3>
                <p className="text-sm text-slate-700">{deal.source || '—'}</p>
              </section>
              {(deal.tags?.length ?? 0) > 0 && (
                <section>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Теги</h3>
                  <div className="flex flex-wrap gap-1">
                    {deal.tags!.map((t) => (
                      <span
                        key={t}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {section === 'client' && !editing && (
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Клиент</h3>
              <p className="text-sm font-semibold text-slate-900">{deal.clientNameSnapshot || '—'}</p>
              <p className="text-sm text-slate-600 font-mono mt-1">{deal.clientPhoneSnapshot || '—'}</p>
            </section>
          )}

          {section === 'next' && !editing && (
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Следующий шаг
              </h3>
              {deal.nextAction?.trim() ? (
                <p className="text-sm font-medium text-slate-900">{deal.nextAction}</p>
              ) : (
                <p className="text-sm text-slate-400 italic">Нет следующего шага</p>
              )}
              {deal.nextActionAt && (
                <p className="text-xs text-slate-500 mt-1">
                  Касание: {new Date(timeMs(deal.nextActionAt)).toLocaleString('ru-RU')}
                </p>
              )}
            </section>
          )}

          {section === 'timeline' && (
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <History className="w-3 h-3" /> Лента активности
              </h3>
              <ul className="space-y-2 border border-slate-100 rounded-xl p-2 bg-slate-50/80 max-h-80 overflow-y-auto">
                {timeline.length === 0 && (
                  <li className="text-xs text-slate-400 py-4 text-center">Пока нет событий</li>
                )}
                {timeline.map((row, i) => (
                  <li
                    key={`${row.ms}-${i}`}
                    className="text-sm border-l-2 border-emerald-400 pl-2 py-1 bg-white/80 rounded-r"
                  >
                    <p className="text-slate-800">{row.text}</p>
                    <p className="text-[10px] text-slate-400">{formatLineDate(row.ms)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {section === 'comments' && !editing && (
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Комментарий
              </h3>
              <p className="text-sm text-slate-700 whitespace-pre-wrap rounded-xl border border-slate-100 p-3 bg-slate-50/80">
                {deal.note?.trim() || '—'}
              </p>
            </section>
          )}

          {editing && (
            <div className="space-y-3 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <p className="text-xs font-bold text-slate-600">Редактирование</p>
              <label className="block text-[10px] font-semibold text-slate-500">Название</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
              <label className="block text-[10px] font-semibold text-slate-500">Клиент</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.clientName}
                onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
              />
              <label className="block text-[10px] font-semibold text-slate-500">Телефон</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <label className="block text-[10px] font-semibold text-slate-500">Сумма (₸)</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
              <label className="block text-[10px] font-semibold text-slate-500">Источник</label>
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
              <label className="block text-[10px] font-semibold text-slate-500">Ответственный</label>
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
              <label className="block text-[10px] font-semibold text-slate-500">Приоритет</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <label className="block text-[10px] font-semibold text-slate-500">Следующий шаг</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Перезвонить, отправить КП…"
                value={form.nextAction}
                onChange={(e) => setForm((f) => ({ ...f, nextAction: e.target.value }))}
              />
              <label className="block text-[10px] font-semibold text-slate-500">Дата следующего касания</label>
              <input
                type="datetime-local"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.nextActionAt}
                onChange={(e) => setForm((f) => ({ ...f, nextActionAt: e.target.value }))}
              />
              <label className="block text-[10px] font-semibold text-slate-500">Теги (через запятую)</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder={TAG_PRESETS.slice(0, 4).join(', ')}
              />
              <label className="block text-[10px] font-semibold text-slate-500">Комментарий</label>
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
                  className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-4 py-2.5 rounded-lg border text-sm font-medium"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-none p-4 border-t border-slate-100 bg-white space-y-2 safe-area-pb">
          {!editing && (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setSection('main');
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold"
              >
                <Pencil className="w-4 h-4" />
                Редактировать карточку
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                В корзину
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
};

export default DealSidebar;
