import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronRight, Copy, ExternalLink, MessageSquare, MoreVertical, User } from 'lucide-react';
import toast from 'react-hot-toast';
import type { WhatsAppAiBotRunRecord } from '../../lib/firebase/whatsappAiBotRuns';
import type { AiControlAggregatedStatus } from '../../types/aiControl';
import { AiRunStatusBadge } from './AiRunStatusBadge';
import { channelLabel } from './AiControlFilters';
import { runCreatedAtMs } from '../../lib/aiControl/aggregateAiRun';
import { deriveAiRunListPresentation } from '../../lib/ai-control/deriveAiRunListPresentation';

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
}> = ({ runs, botNames, aggregated }) => {
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
      {runs.map((run) => {
        const agg = aggregated[run.id] ?? 'skipped';
        const p = deriveAiRunListPresentation(run, agg);
        const botName = botNames[run.botId] ?? run.botId.slice(0, 8);
        const clientId = run.clientIdSnapshot || run.appliedClientId || null;
        const dealId = run.createdDealId || run.dealId || null;
        const answer = run.answerSnapshot || run.generatedReply || '';
        const summary = run.summarySnapshot || run.extractedSummary || '';
        const extractedJson = run.extractedSnapshotJson || '';
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
            className="block rounded-xl border border-gray-200 bg-white p-3 sm:p-4 hover:border-indigo-300 hover:shadow-sm transition-shadow"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <AiRunStatusBadge status={agg} />
                  <span className="text-xs text-gray-500">{fmtTime(run)}</span>
                  <span className="text-xs font-medium text-gray-800 truncate max-w-[200px]" title={botName}>
                    {botName}
                  </span>
                  <span className="text-[10px] text-gray-500 uppercase">
                    {channelLabel(run.channel)}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                    {run.mode || '—'}
                  </span>
                </div>
                <p className="text-sm text-gray-700 truncate" title={run.conversationId}>
                  Чат: {run.conversationId.slice(0, 12)}…
                </p>
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
