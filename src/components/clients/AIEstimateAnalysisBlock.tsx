import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { useCompanyId } from '../../contexts/CompanyContext';
import { useEstimateTotals } from '../../hooks/useEstimateTotals';
import { useClientTransactions } from '../../hooks/useClientTransactions';
import { getAuthToken } from '../../lib/firebase/auth';
import {
  getClientEstimateAiReport,
  setClientEstimateAiReport,
  type EstimateVsActualReport,
  type EstimateSnapshot,
  type ClientEstimateAiReportSaved,
} from '../../lib/firebase/clientEstimateAiReport';
import type { Transaction } from '../transactions/types';

const API_URL = '/.netlify/functions/ai-estimate-vs-actual';

function formatMoney(n: number): string {
  return Math.round(n).toLocaleString('ru-RU') + ' ₸';
}

interface AIEstimateAnalysisBlockProps {
  clientId: string;
  clientName?: string;
}

export const AIEstimateAnalysisBlock: React.FC<AIEstimateAnalysisBlockProps> = ({
  clientId,
  clientName,
}) => {
  const companyId = useCompanyId();
  const { totals, grandTotal } = useEstimateTotals(clientId);
  const { transactions, loading: transactionsLoading } = useClientTransactions(clientId);

  const [saved, setSaved] = useState<ClientEstimateAiReportSaved | null>(null);
  const [report, setReport] = useState<EstimateVsActualReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [stale, setStale] = useState(false);

  const estimateSnapshot: EstimateSnapshot = {
    foundation: totals.foundation,
    sipWalls: totals.sipWalls,
    roof: totals.roof,
    floor: totals.floor,
    partitions: totals.partitions,
    consumables: totals.consumables,
    additionalWorks: totals.additionalWorks,
    builderSalary: totals.builderSalary,
    operationalExpenses: totals.operationalExpenses,
    grandTotal,
  };

  const loadSaved = useCallback(async () => {
    if (!companyId || !clientId) return;
    const data = await getClientEstimateAiReport(companyId, clientId);
    setSaved(data);
    setReport(data?.report ?? null);
  }, [companyId, clientId]);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  useEffect(() => {
    if (!saved) {
      setStale(false);
      return;
    }
    const estimateChanged =
      saved.estimateSnapshot.grandTotal !== grandTotal ||
      saved.estimateSnapshot.foundation !== totals.foundation ||
      saved.estimateSnapshot.sipWalls !== totals.sipWalls ||
      saved.estimateSnapshot.roof !== totals.roof ||
      saved.transactionsCount !== transactions.length;
    setStale(estimateChanged);
  }, [saved, grandTotal, totals.foundation, totals.sipWalls, totals.roof, transactions.length]);

  const runAnalysis = async () => {
    if (!companyId || !clientId) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const approvedOnly = transactions.filter(
        (t) => (t as { status?: string }).status === undefined || (t as { status?: string }).status === 'approved'
      );
      const payload = {
        companyId,
        clientId,
        clientName: clientName ?? '',
        estimateSummary: estimateSnapshot,
        transactions: approvedOnly.map((t: Transaction) => ({
          id: t.id,
          amount: Math.abs(t.amount),
          description: t.description ?? '',
          type: t.type,
          date: t.date != null ? (typeof t.date?.toDate === 'function' ? t.date.toDate().toISOString() : String(t.date)) : undefined,
          waybillNumber: t.waybillNumber,
          waybillData: t.waybillData,
          attachmentNames: t.attachments?.map((a) => a.name),
        })),
      };
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'Ошибка запроса');
        return;
      }
      if (data?.error) {
        setError(data.error);
        return;
      }
      const reportData = data?.report as EstimateVsActualReport;
      if (!reportData?.summary) {
        setError('Некорректный ответ AI');
        return;
      }
      await setClientEstimateAiReport(
        companyId,
        clientId,
        estimateSnapshot,
        approvedOnly.length,
        reportData
      );
      setReport(reportData);
      setSaved({
        report: reportData,
        estimateSnapshot,
        transactionsCount: approvedOnly.length,
        analyzedAt: new Date(),
      });
      setStale(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка при обращении к AI');
    } finally {
      setLoading(false);
    }
  };

  const displayReport = report ?? saved?.report;

  return (
    <div className="mt-6 bg-white rounded-lg shadow-lg overflow-hidden border border-slate-200">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-500" />
          <span className="font-medium text-slate-900 text-sm sm:text-base">
            AI-анализ сметы vs факт
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="divide-y divide-slate-100 px-3 sm:px-4 pb-4">
          {stale && saved && (
            <div className="flex items-center gap-2 py-2 text-amber-700 bg-amber-50 rounded-lg px-3 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                После последнего анализа изменились смета или операции. Имеет смысл обновить отчёт.
              </span>
            </div>
          )}

          {!displayReport && (
            <div className="py-4">
              <p className="text-sm text-slate-600 mb-3">
                Сравнение плановой сметы с фактическими расходами по проекту. Выявим перерасход, экономию и неучтённые траты.
              </p>
              <button
                type="button"
                onClick={runAnalysis}
                disabled={loading || transactionsLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Анализ…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Сравнить смету и факт
                  </>
                )}
              </button>
            </div>
          )}

          {displayReport && !loading && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-slate-500">
                  {saved?.analyzedAt
                    ? `Анализ: ${saved.analyzedAt.toLocaleString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                    : ''}
                </span>
                <button
                  type="button"
                  onClick={runAnalysis}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Обновить анализ
                </button>
              </div>

              {displayReport.summary && (
                <div className="rounded-lg bg-slate-50 p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Смета (план):</span>
                    <span className="font-medium">{formatMoney(displayReport.summary.totalEstimate)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Факт (расходы):</span>
                    <span className="font-medium">{formatMoney(displayReport.summary.totalActual)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Разница:</span>
                    <span
                      className={`font-medium ${
                        displayReport.summary.difference > 0
                          ? 'text-red-600'
                          : displayReport.summary.difference < 0
                            ? 'text-emerald-600'
                            : 'text-slate-700'
                      }`}
                    >
                      {displayReport.summary.difference > 0 ? '+' : ''}
                      {formatMoney(displayReport.summary.difference)}
                      {displayReport.summary.differencePercent != null
                        ? ` (${displayReport.summary.differencePercent > 0 ? '+' : ''}${displayReport.summary.differencePercent.toFixed(1)}%)`
                        : ''}
                    </span>
                  </div>
                  {displayReport.summary.summaryText && (
                    <p className="text-sm text-slate-700 pt-1 border-t border-slate-200">
                      {displayReport.summary.summaryText}
                    </p>
                  )}
                </div>
              )}

              {displayReport.byCategory && displayReport.byCategory.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    По категориям
                  </h4>
                  <div className="space-y-1.5">
                    {displayReport.byCategory.map((row, i) => (
                      <div
                        key={i}
                        className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                          row.difference > 0
                            ? 'bg-red-50 text-red-900'
                            : row.difference < 0
                              ? 'bg-emerald-50 text-emerald-900'
                              : 'bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="font-medium">{row.categoryName}</span>
                        <span>
                          смета {formatMoney(row.estimate)} → факт {formatMoney(row.actual)}
                          {row.difference !== 0 && (
                            <span className="ml-1">
                              ({row.difference > 0 ? '+' : ''}{formatMoney(row.difference)},{' '}
                              {row.confidence === 'low' ? 'низкая уверенность' : row.confidence === 'medium' ? 'средняя' : 'высокая'})
                            </span>
                          )}
                        </span>
                        {row.note && (
                          <span className="w-full text-xs opacity-90">{row.note}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {displayReport.unclassifiedExpenses && displayReport.unclassifiedExpenses.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Не отнесены к смете
                  </h4>
                  <ul className="space-y-1 text-sm text-slate-600 bg-amber-50/50 rounded-lg p-3">
                    {displayReport.unclassifiedExpenses.map((item, i) => (
                      <li key={i}>
                        {formatMoney(item.amount)} — {item.description || 'без комментария'}
                        {item.reason && (
                          <span className="block text-xs text-slate-500">{item.reason}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {displayReport.suspicious && displayReport.suspicious.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">
                    На что обратить внимание
                  </h4>
                  <ul className="space-y-1 text-sm text-slate-600 bg-amber-50 rounded-lg p-3">
                    {displayReport.suspicious.map((item, i) => (
                      <li key={i}>
                        {formatMoney(item.amount)} — {item.description || '—'}
                        {item.reason && (
                          <span className="block text-xs text-amber-700">{item.reason}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {displayReport.recommendations && displayReport.recommendations.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Рекомендации
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                    {displayReport.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {loading && (
            <div className="py-4 flex items-center gap-2 text-slate-500 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Идёт анализ сметы и транзакций…
            </div>
          )}

          {error && (
            <div className="py-2 text-sm text-red-600 bg-red-50 rounded-lg px-3">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
