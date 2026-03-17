import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { useCompanyId } from '../../contexts/CompanyContext';
import { useAIConfigured } from '../../hooks/useAIConfigured';
import { useEstimateTotals } from '../../hooks/useEstimateTotals';
import { useEstimateLineItems } from '../../hooks/useEstimateLineItems';
import { useClientTransactions } from '../../hooks/useClientTransactions';
import { getAuthToken } from '../../lib/firebase/auth';
import {
  getClientEstimateAiReport,
  setClientEstimateAiReport,
  type EstimateVsActualReport,
  type EstimateLineItemRow,
  type EstimateSnapshot,
  type ClientEstimateAiReportSaved,
} from '../../lib/firebase/clientEstimateAiReport';
import type { Transaction } from '../transactions/types';

const API_URL = '/.netlify/functions/ai-estimate-vs-actual';

function formatMoney(n: number): string {
  return Math.round(n).toLocaleString('ru-RU') + ' ₸';
}

const STATUS_LABELS: Record<string, string> = {
  ok: 'В норме',
  overrun: 'Перерасход',
  savings: 'Экономия',
  no_fact: 'Нет факта',
  outside: 'Вне сметы',
  ambiguous: 'Нужна проверка',
};

function statusRowClass(status: string): string {
  switch (status) {
    case 'overrun':
      return 'bg-red-50 text-red-900 border-l-4 border-red-400';
    case 'savings':
      return 'bg-emerald-50 text-emerald-900 border-l-4 border-emerald-400';
    case 'ambiguous':
      return 'bg-amber-50 text-amber-900 border-l-4 border-amber-400';
    case 'no_fact':
      return 'bg-slate-100 text-slate-700 border-l-4 border-slate-300';
    default:
      return 'bg-slate-50 text-slate-800 border-l-4 border-slate-200';
  }
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
  const { lineItems: estimateLineItems, loading: lineItemsLoading } = useEstimateLineItems(clientId);
  const { transactions, loading: transactionsLoading } = useClientTransactions(clientId);

  const [saved, setSaved] = useState<ClientEstimateAiReportSaved | null>(null);
  const [report, setReport] = useState<EstimateVsActualReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [stale, setStale] = useState(false);
  const { configured: aiConfigured, loading: aiLoadingConfigured } = useAIConfigured();

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

  const isPermissionError = (e: unknown): boolean => {
    const msg = e instanceof Error ? e.message : String(e);
    return /permission|insufficient|forbidden/i.test(msg) || (e as { code?: string })?.code === 'permission-denied';
  };

  const loadSaved = useCallback(async () => {
    if (!companyId || !clientId) return;
    try {
      const data = await getClientEstimateAiReport(companyId, clientId);
      setSaved(data);
      setReport(data?.report ?? null);
    } catch (e) {
      if (isPermissionError(e)) {
        setSaved(null);
        setReport(null);
      } else if (import.meta.env.DEV) {
        console.error('[AIEstimateAnalysisBlock] loadSaved', e);
      }
    }
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
        estimateLineItems: estimateLineItems.length > 0 ? estimateLineItems : undefined,
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
      if (estimateLineItems.length > 0 && (!Array.isArray(reportData.lineItems) || reportData.lineItems.length === 0)) {
        setError('AI не вернул позиционное сравнение. Попробуйте обновить анализ.');
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
      if (isPermissionError(e)) {
        setError('Не удалось сохранить или загрузить отчёт. Проверьте права доступа к проекту.');
      } else {
        setError(e instanceof Error ? e.message : 'Ошибка при обращении к AI');
      }
      if (import.meta.env.DEV) console.error('[AIEstimateAnalysisBlock] runAnalysis', e);
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
                disabled={loading || transactionsLoading || lineItemsLoading || (aiLoadingConfigured === false && aiConfigured === false)}
                title={aiConfigured === false && !aiLoadingConfigured ? 'Подключите AI API key в разделе Интеграции' : undefined}
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
              {!aiLoadingConfigured && aiConfigured === false && (
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5 inline-block">
                  Подключите AI API key в разделе Интеграции
                </p>
              )}
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
                  disabled={loading || (aiLoadingConfigured === false && aiConfigured === false)}
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

              {displayReport.lineItems && displayReport.lineItems.length > 0 && (
                <>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Позиционное сравнение сметы и факта
                    </h4>
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-sm min-w-[720px]">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 text-left">
                            <th className="px-2 py-2 font-medium">Наименование</th>
                            <th className="px-2 py-2 font-medium">Раздел</th>
                            <th className="px-2 py-2 font-medium text-right">План кол-во</th>
                            <th className="px-2 py-2 font-medium text-right">План цена</th>
                            <th className="px-2 py-2 font-medium text-right">План сумма</th>
                            <th className="px-2 py-2 font-medium text-right">Факт кол-во</th>
                            <th className="px-2 py-2 font-medium text-right">Факт сумма</th>
                            <th className="px-2 py-2 font-medium text-right">Отклонение</th>
                            <th className="px-2 py-2 font-medium">Статус</th>
                            <th className="px-2 py-2 font-medium">Комментарий AI</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayReport.lineItems.map((row: EstimateLineItemRow, i: number) => (
                            <tr key={i} className={`border-t border-slate-100 ${statusRowClass(row.status)}`}>
                              <td className="px-2 py-2 font-medium">{row.name || '—'}</td>
                              <td className="px-2 py-2 text-slate-600">{row.section ?? '—'}</td>
                              <td className="px-2 py-2 text-right">{row.planQty != null ? String(row.planQty) : '—'}</td>
                              <td className="px-2 py-2 text-right">{row.planPrice != null ? formatMoney(row.planPrice) : '—'}</td>
                              <td className="px-2 py-2 text-right">{formatMoney(row.planSum)}</td>
                              <td className="px-2 py-2 text-right">{row.factQty != null ? String(row.factQty) : '—'}</td>
                              <td className="px-2 py-2 text-right">{row.factSum != null ? formatMoney(row.factSum) : '—'}</td>
                              <td className="px-2 py-2 text-right">
                                {row.deviation != null ? (row.deviation > 0 ? '+' : '') + formatMoney(row.deviation) : '—'}
                              </td>
                              <td className="px-2 py-2">
                                <span className="font-medium">{STATUS_LABELS[row.status] ?? row.status}</span>
                                {row.transactionIds && row.transactionIds.length > 0 && (
                                  <span className="block text-xs opacity-80 mt-0.5" title={row.transactionIds.join(', ')}>
                                    Транзакций: {row.transactionIds.length}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-2 text-xs max-w-[180px]">{row.comment ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {displayReport.lineItems.filter((r) => r.status === 'overrun').length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">Перерасход</h4>
                      <ul className="space-y-1.5 text-sm bg-red-50 rounded-lg p-3 border border-red-100">
                        {displayReport.lineItems
                          .filter((r) => r.status === 'overrun')
                          .map((row, i) => (
                            <li key={i} className="flex flex-wrap justify-between gap-2">
                              <span className="font-medium text-red-900">{row.name}</span>
                              <span>
                                план {formatMoney(row.planSum)} → факт {row.factSum != null ? formatMoney(row.factSum) : '—'}
                                {row.deviation != null && row.deviation > 0 && (
                                  <span className="ml-1 text-red-700">+{formatMoney(row.deviation)}</span>
                                )}
                              </span>
                              {row.comment && <span className="w-full text-xs text-red-800">{row.comment}</span>}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {displayReport.lineItems.filter((r) => r.status === 'savings').length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">Экономия</h4>
                      <ul className="space-y-1.5 text-sm bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                        {displayReport.lineItems
                          .filter((r) => r.status === 'savings')
                          .map((row, i) => (
                            <li key={i} className="flex flex-wrap justify-between gap-2">
                              <span className="font-medium text-emerald-900">{row.name}</span>
                              <span>
                                план {formatMoney(row.planSum)} → факт {row.factSum != null ? formatMoney(row.factSum) : '—'}
                                {row.deviation != null && row.deviation < 0 && (
                                  <span className="ml-1 text-emerald-700">{formatMoney(row.deviation)}</span>
                                )}
                              </span>
                              {row.comment && <span className="w-full text-xs text-emerald-800">{row.comment}</span>}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {displayReport.lineItems.filter((r) => r.status === 'no_fact').length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Не найдено в факте</h4>
                      <ul className="space-y-1 text-sm bg-slate-100 rounded-lg p-3 text-slate-700">
                        {displayReport.lineItems
                          .filter((r) => r.status === 'no_fact')
                          .map((row, i) => (
                            <li key={i}>
                              {row.name}
                              {row.comment && <span className="block text-xs text-slate-500">{row.comment}</span>}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {displayReport.outsideEstimate && displayReport.outsideEstimate.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Расходы вне сметы</h4>
                      <ul className="space-y-1 text-sm text-slate-600 bg-amber-50/70 rounded-lg p-3 border border-amber-100">
                        {displayReport.outsideEstimate.map((item, i) => (
                          <li key={i}>
                            {formatMoney(item.amount)} — {item.description || 'без комментария'}
                            {item.reason && <span className="block text-xs text-slate-500">{item.reason}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {displayReport.lineItems.filter((r) => r.status === 'ambiguous').length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Неоднозначные позиции (нужна проверка)</h4>
                      <ul className="space-y-1.5 text-sm bg-amber-50 rounded-lg p-3 border border-amber-200">
                        {displayReport.lineItems
                          .filter((r) => r.status === 'ambiguous')
                          .map((row, i) => (
                            <li key={i}>
                              <span className="font-medium text-amber-900">{row.name}</span>
                              {row.comment && <span className="block text-xs text-amber-800">{row.comment}</span>}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {displayReport.byCategory && displayReport.byCategory.length > 0 && !displayReport.lineItems?.length && (
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

              {displayReport.unclassifiedExpenses && displayReport.unclassifiedExpenses.length > 0 && !displayReport.lineItems?.length && (
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

              {displayReport.suspicious && displayReport.suspicious.length > 0 && !displayReport.lineItems?.length && (
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
