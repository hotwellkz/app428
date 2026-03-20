import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronRight, Copy, ExternalLink, MessageSquare, MoreVertical, User } from 'lucide-react';
import toast from 'react-hot-toast';
import type { WhatsAppAiBotRunRecord } from '../../lib/firebase/whatsappAiBotRuns';
import type { AiControlAggregatedStatus } from '../../types/aiControl';
import { AiRunStatusBadge } from './AiRunStatusBadge';
import { channelLabel } from './AiControlFilters';
import { channelBadgeLabel } from '../../lib/ai-control/deriveAiRunChannel';
import { runCreatedAtMs } from '../../lib/aiControl/aggregateAiRun';
import { deriveAiRunListPresentation } from '../../lib/ai-control/deriveAiRunListPresentation';
import { deriveAiRunWorkflow } from '../../lib/ai-control/deriveAiRunWorkflow';
import type { WhatsAppAiRunWorkflowRecord } from '../../lib/firebase/whatsappAiRunWorkflow';

function fmtTime(run: WhatsAppAiBotRunRecord): string {
  const ms = runCreatedAtMs(run);
  if (!ms) return '—';
  try {
    return format(new Date(ms), 'dd.MM.yyyy HH:mm');
  } catch {
    return '—';
  }
}

function previewReply(text: string | null | undefined, n = 80): string {
  if (!text?.trim()) return '—';
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length <= n ? t : t.slice(0, n) + '…';
}

function badgeTone(badge: string): string {
  const b = badge.toLowerCase();
  if (b.includes('ошибка') || b.includes('error')) return 'bg-red-50 text-red-700';
  if (b.includes('fallback') || b.includes('skipped') || b.includes('paused') || b.includes('duplicate'))
    return 'bg-amber-50 text-amber-800';
  if (
    b.includes('extraction') ||
    b.includes('crm apply') ||
    b.includes('сделка') ||
    b.includes('задача') ||
    b.includes('auto') ||
    b.includes('draft')
  )
    return 'bg-emerald-50 text-emerald-700';
  return 'bg-gray-100 text-gray-700';
}

export const AiRunList: React.FC<{
  runs: WhatsAppAiBotRunRecord[];
  botNames: Record<string, string>;
  aggregated: Record<string, AiControlAggregatedStatus>;
  workflowByRunId: Record<string, WhatsAppAiRunWorkflowRecord>;
  workflowBusyByRunId: Record<string, boolean>;
  onTakeInWork: (run: WhatsAppAiBotRunRecord) => Promise<void> | void;
  onResolve: (run: WhatsAppAiBotRunRecord) => Promise<void> | void;
  onIgnore: (run: WhatsAppAiBotRunRecord) => Promise<void> | void;
  onEscalate: (run: WhatsAppAiBotRunRecord) => Promise<void> | void;
  selectedRunIds: string[];
  onToggleSelected: (runId: string) => void;
  onSelectAllFiltered: () => void;
  areAllFilteredSelected: boolean;
}> = ({ runs, botNames, aggregated, workflowByRunId, workflowBusyByRunId, onTakeInWork, onResolve, onIgnore, onEscalate, selectedRunIds, onToggleSelected, onSelectAllFiltered, areAllFilteredSelected }) => {
  const navigate = useNavigate();
  const [mobileActionsFor, setMobileActionsFor] = useState<string | null>(null);
  if (runs.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 text-sm border rounded-xl bg-gray-50/80">
        Нет записей за выбранные условия. Запустите AI в чате или расширьте период.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <label className="inline-flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={areAllFilteredSelected} onChange={onSelectAllFiltered} />
          Выбрать все в текущей выдаче
        </label>
      </div>
      {runs.map((run) => {
        const agg = aggregated[run.id] ?? 'skipped';
        const p = deriveAiRunListPresentation(run, agg);
        const wf = deriveAiRunWorkflow(run, p, workflowByRunId[run.id] ?? null);
        const busy = !!workflowBusyByRunId[run.id];
        const botName = botNames[run.botId] ?? run.botId.slice(0, 8);
        const clientId = run.clientIdSnapshot || run.appliedClientId || null;
        const dealId = run.createdDealId || run.dealId || null;
        const answer = run.answerSnapshot || run.generatedReply || '';
        const summary = run.summarySnapshot || run.extractedSummary || '';
        const extractedJson = run.extractedSnapshotJson || '';
        const isVoice = p.derivedChannel === 'voice';
        const copy = async (label: string, text: string) => {
          if (!text.trim()) {
            toast.error('Пустое значение');
            return;
          }
          try {
            await navigator.clipboard.writeText(text);
            toast.success(`${label} скопировано`);
          } catch {
            toast.error('Не удалось скопировать');
          }
        };
        const actions = (
          <>
            {!isVoice ? (
            <button
              type="button"
              disabled={!answer.trim()}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate(`/whatsapp?chatId=${encodeURIComponent(run.conversationId)}`);
              }}
              title="Открыть чат"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            ) : null}
            <button
              type="button"
              disabled={!clientId}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-40"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (clientId) navigate(`/clients?clientId=${encodeURIComponent(clientId)}`);
              }}
              title="Открыть клиента"
            >
              <User className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={!dealId}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-40"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dealId) navigate(`/deals?deal=${encodeURIComponent(dealId)}`);
              }}
              title="Открыть сделку"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void copy('Ответ', answer);
              }}
              title={answer.trim() ? 'Копировать ответ' : 'Ответ отсутствует'}
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={!summary.trim()}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void copy('Summary', summary);
              }}
              title={summary.trim() ? 'Копировать summary' : 'Summary отсутствует'}
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={busy}
              className="px-2 py-1 text-[10px] rounded border text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void onTakeInWork(run);
              }}
              title="Взять в работу"
            >
              В работу
            </button>
            <button
              type="button"
              disabled={busy}
              className="px-2 py-1 text-[10px] rounded border text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void onResolve(run);
              }}
              title="Пометить решённым"
            >
              Решено
            </button>
            <button
              type="button"
              disabled={busy}
              className="px-2 py-1 text-[10px] rounded border text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void onIgnore(run);
              }}
              title="Игнорировать"
            >
              Игнор
            </button>
            <button
              type="button"
              disabled={busy}
              className="px-2 py-1 text-[10px] rounded border text-amber-700 hover:bg-amber-50 disabled:opacity-40"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void onEscalate(run);
              }}
              title="Эскалировать"
            >
              Эскалация
            </button>
            <button
              type="button"
              disabled={!extractedJson.trim()}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-40"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void copy('Extracted JSON', extractedJson);
              }}
              title={extractedJson.trim() ? 'Копировать extracted JSON' : 'Extracted JSON отсутствует'}
            >
              <Copy className="w-4 h-4" />
            </button>
          </>
        );
        return (
          <Link
            key={run.id}
            to={`/ai-control/${run.id}`}
            className={`block rounded-xl border bg-white p-3 sm:p-4 hover:border-indigo-300 hover:shadow-sm transition-shadow ${
              wf.isOverdue && wf.priority === 'critical'
                ? 'border-red-300 bg-red-50/40'
                : wf.isOverdue
                  ? 'border-amber-300 bg-amber-50/30'
                  : wf.isNewProblem
                    ? 'border-red-200 bg-red-50/20'
                    : 'border-gray-200'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    checked={selectedRunIds.includes(run.id)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onChange={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleSelected(run.id);
                    }}
                  />
                  <AiRunStatusBadge status={agg} />
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      isVoice ? 'bg-violet-100 text-violet-900' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {channelBadgeLabel(p.derivedChannel)}
                  </span>
                  <span className="text-xs text-gray-500">{fmtTime(run)}</span>
                  <span className="text-xs font-medium text-gray-800 truncate max-w-[200px]" title={botName}>
                    {botName}
                  </span>
                  <span className="text-[10px] text-gray-500 uppercase">
                    {channelLabel(run.channel || (isVoice ? 'voice' : ''))}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                    {run.mode || '—'}
                  </span>
                </div>
                <p className="text-sm text-gray-700 truncate" title={isVoice ? run.phoneSnapshot ?? '' : run.conversationId}>
                  {isVoice ? (
                    <>
                      <span className="text-violet-800 font-medium">Голос</span> · {run.phoneSnapshot || '—'} ·{' '}
                      {p.voiceOperationalLine || 'voice'}
                    </>
                  ) : (
                    <>Чат: {run.conversationId.slice(0, 12)}…</>
                  )}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                    {wf.statusLabel}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded ${wf.priority === 'critical' ? 'bg-red-100 text-red-800' : wf.priority === 'high' ? 'bg-amber-100 text-amber-800' : wf.priority === 'normal' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>
                    {wf.priorityLabel}
                  </span>
                  {wf.isOverdue ? <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800">Просрочено</span> : null}
                  {wf.firstAlertAtMs ? <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">Alerted</span> : <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">Not alerted</span>}
                  {wf.escalationSent ? <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Escalated alert</span> : null}
                  {wf.isSnoozed ? <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">Snoozed</span> : null}
                  {wf.isMuted ? <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">Muted</span> : null}
                  <span className="text-gray-500">Назначен: {wf.assigneeName || 'Не назначен'}</span>
                  {wf.updatedAtMs ? (
                    <span className="text-gray-400">{format(new Date(wf.updatedAtMs), 'dd.MM HH:mm')}</span>
                  ) : null}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {wf.dueAtMs ? `SLA до ${format(new Date(wf.dueAtMs), 'dd.MM HH:mm')}` : 'SLA не задан'} · Возраст: {wf.ageMinutes != null ? `${wf.ageMinutes} мин` : '—'} · last alert: {wf.lastAlertAtMs ? format(new Date(wf.lastAlertAtMs), 'dd.MM HH:mm') : '—'}
                </p>
                {wf.lastComment ? (
                  <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">Комментарий: {wf.lastComment}</p>
                ) : null}
                <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                  {previewReply(p.summaryPreview || p.answerPreview || '', 160) || 'Нет краткого описания'}
                </p>
                <p className="text-[11px] text-gray-600 mt-1 line-clamp-1">{p.summaryLine}</p>
              </div>
              <div className="hidden sm:flex items-center gap-0.5">{actions}</div>
              <div className="sm:hidden relative">
                <button
                  type="button"
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMobileActionsFor((prev) => (prev === run.id ? null : run.id));
                  }}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {mobileActionsFor === run.id ? (
                  <div className="absolute right-0 mt-1 z-10 rounded-lg border bg-white p-1 shadow">
                    <div className="flex items-center gap-0.5">{actions}</div>
                  </div>
                ) : null}
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 shrink-0 mt-1" />
            </div>
            <div className="mt-2 text-[10px]">
              <div className="flex flex-wrap gap-1.5 sm:hidden">
                {p.badges.slice(0, 4).map((b) => (
                  <span
                    key={`m-${b}`}
                    className={`px-1.5 py-0.5 rounded ${badgeTone(b)}`}
                    title={b}
                  >
                    {b}
                  </span>
                ))}
              </div>
              <div className="hidden sm:flex sm:flex-wrap gap-1.5">
                {p.badges.map((b) => (
                <span
                  key={`d-${b}`}
                  className={`px-1.5 py-0.5 rounded ${badgeTone(b)}`}
                  title={b}
                >
                  {b}
                </span>
              ))}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
};
