import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import type { WhatsAppAiBotRunRecord } from '../../lib/firebase/whatsappAiBotRuns';
import type { AiControlAggregatedStatus } from '../../types/aiControl';
import { AiRunStatusBadge } from './AiRunStatusBadge';
import { channelLabel } from './AiControlFilters';
import { computeRunResultFlags } from '../../lib/aiControl/aggregateAiRun';
import { runCreatedAtMs } from '../../lib/aiControl/aggregateAiRun';

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

export const AiRunList: React.FC<{
  runs: WhatsAppAiBotRunRecord[];
  botNames: Record<string, string>;
  aggregated: Record<string, AiControlAggregatedStatus>;
}> = ({ runs, botNames, aggregated }) => {
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
        const flags = computeRunResultFlags(run);
        const botName = botNames[run.botId] ?? run.botId.slice(0, 8);
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
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{previewReply(run.generatedReply, 120)}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 shrink-0 mt-1" />
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
              <span
                className={
                  flags.hasCrmApply ? 'text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded' : 'text-gray-400'
                }
              >
                CRM: {run.extractionApplyStatus ?? '—'}
              </span>
              <span
                className={
                  flags.hasDealCreate ? 'text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded' : 'text-gray-400'
                }
              >
                Сделка: {run.dealCreateStatus ?? run.dealRecommendationStatus ?? '—'}
              </span>
              <span
                className={
                  flags.hasTaskCreate ? 'text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded' : 'text-gray-400'
                }
              >
                Задача: {run.taskCreateStatus ?? '—'}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
};
