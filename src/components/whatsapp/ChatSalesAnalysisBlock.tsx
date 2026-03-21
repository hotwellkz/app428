import React, { useState, useRef, useCallback, useId, useEffect } from 'react';
import { Sparkles, Copy, RefreshCw, ChevronDown, ChevronUp, Type } from 'lucide-react';
import { getAuthToken } from '../../lib/firebase/auth';
import { useAIConfigured } from '../../hooks/useAIConfigured';
import type { WhatsAppMessage } from '../../types/whatsappDb';
import { getMessageTextContentForAi } from '../../utils/whatsappAiMessageContent';

const SALES_ANALYZE_ENDPOINTS = ['/.netlify/functions/ai-analyze-sales', '/api/ai/analyze-sales'] as const;
const CLIENT_ANALYZE_ENDPOINTS = ['/.netlify/functions/ai-analyze-client', '/api/ai/analyze-client'] as const;

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits ? `+${digits}` : phone.trim();
}

export interface SalesAnalysisResult {
  overallAssessment: string;
  strengths: string[];
  errors: string[];
  missedOpportunities: string[];
  clientSignals: string[];
  recommendations: string[];
  nextMessage: string;
  badges?: string[];
  /** Классификация лида: hot | warm | cold */
  leadTemperature?: string;
  /** Этап интереса: primary_interest | need_quote | send_proposal | thinking | meeting | in_progress | lost */
  leadStage?: string;
  /** Намерение: build_house | get_price | compare_tech | need_project | mortgage_installment | consultation */
  leadIntent?: string;
}

const BADGE_LABELS: Record<string, string> = {
  riskLosingClient: 'Риск потери клиента',
  clientInterested: 'Клиент заинтересован',
  noNextStep: 'Нет следующего шага',
  objectionNotHandled: 'Возражение не отработано',
  weakNeedDiscovery: 'Слабое выявление потребности',
};

function formatAnalyzedAt(d: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'только что';
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'минуту' : diffMins < 5 ? 'минуты' : 'минут'} назад`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'час' : diffHours < 5 ? 'часа' : 'часов'} назад`;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface ChatSalesAnalysisBlockProps {
  messages: WhatsAppMessage[];
  phone: string | null;
  conversationId: string | null;
  /** Результат анализа для текущего чата (из кэша/БД) */
  cachedResult: SalesAnalysisResult | null;
  /** Дата последнего сохранённого анализа */
  analyzedAt?: Date | null;
  /** Сохранить результат по conversationId (и в БД в родителе) */
  onCacheResult: (conversationId: string, result: SalesAnalysisResult) => void;
  /** Компактный/мобильный вид: блок можно свернуть */
  compact?: boolean;
  /** Вставить готовый ответ в поле ввода (replace или append). Не отправляет сообщение. */
  onInsertNextMessage?: (text: string, mode: 'replace' | 'append') => void;
  /** Текущий текст поля ввода: если не пустой, при «Вставить в поле» показывается выбор замены/добавления */
  getCurrentInputValue?: () => string;
  /** Подготовка к анализу: расшифровать голосовые, вернуть результат и updates для подстановки в анализ */
  onPrepareForAnalysis?: (
    onProgress?: (current: number, total: number) => void
  ) => Promise<{ status: 'none' | 'done' | 'partial' | 'failed'; updates: Record<string, string>; done: number; errors: number; total: number }>;
  /** Идёт ли массовая расшифровка из кнопки «Расшифровать всё» — дизейблить «Проанализировать чат» */
  isTranscribeBatchRunning?: boolean;
  /** После успешного анализа продаж: вызвать извлечение города (ai-analyze-client) и передать сюда для автоподстановки */
  onExtractedCity?: (city: string) => void;
}

export function ChatSalesAnalysisBlock({
  messages,
  phone,
  conversationId,
  cachedResult,
  analyzedAt = null,
  onCacheResult,
  compact = false,
  onInsertNextMessage,
  getCurrentInputValue,
  onPrepareForAnalysis,
  isTranscribeBatchRunning = false,
  onExtractedCity,
}: ChatSalesAnalysisBlockProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [insertChoiceOpen, setInsertChoiceOpen] = useState(false);
  const insertAnchorRef = useRef<HTMLButtonElement>(null);
  const insertChoiceId = useId();
  const runGuardRef = useRef(false);
  const { configured: aiConfigured, loading: aiLoadingConfigured } = useAIConfigured();

  /** Фаза цепочки: подготовка (расшифровка) → анализ */
  const [analysisPhase, setAnalysisPhase] = useState<'idle' | 'preparing' | 'transcribing' | 'analyzing'>('idle');
  const [transcribeProgress, setTranscribeProgress] = useState<{ current: number; total: number } | null>(null);
  const [prepareWarning, setPrepareWarning] = useState<string | null>(null);

  const recent = messages
    .map((m) => ({
      ...m,
      _content: getMessageTextContentForAi(m)
    }))
    .filter((m) => m._content.length > 0 && !m.deleted)
    .slice(-50);

  /** Построить recent с подстановкой переданных расшифровок (после prepare) */
  const getRecentWithOverrides = useCallback(
    (overrides?: Record<string, string>) => {
      return messages
        .map((m) => ({
          ...m,
          _content: getMessageTextContentForAi(m, overrides)
        }))
        .filter((m) => m._content.length > 0 && !m.deleted)
        .slice(-50);
    },
    [messages]
  );

  const runAnalysis = useCallback(
    async (transcriptionOverrides?: Record<string, string>) => {
      if (!phone || !conversationId || runGuardRef.current) return;
      const recentForPayload = getRecentWithOverrides(transcriptionOverrides);
      if (recentForPayload.length === 0) {
        setError('Недостаточно сообщений для анализа.');
        return;
      }

      runGuardRef.current = true;
      setError(null);
      setLoading(true);
      const payload = {
        chatId: normalizePhone(phone),
        messages: recentForPayload.map((m) => ({
          role: m.direction === 'incoming' ? ('client' as const) : ('manager' as const),
          text: m._content.replace(/<[^>]*>/g, '').trim(),
        })),
      };

    try {
      const token = await getAuthToken();
      let res: Response | null = null;
      let data: SalesAnalysisResult & { error?: string } = {} as SalesAnalysisResult;

      for (const url of SALES_ANALYZE_ENDPOINTS) {
        try {
          const r = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(payload),
          });
          const raw = await r.text();
          if (raw.trimStart().startsWith('<') || raw.includes('<!DOCTYPE')) continue;
          const parsed = raw ? (JSON.parse(raw) as typeof data) : {};
          if (parsed.error && r.status >= 400) {
            setError(parsed.error || 'Ошибка анализа.');
            return;
          }
          res = r;
          data = parsed;
          if (r.ok && !parsed.error) break;
        } catch {
          continue;
        }
      }

      if (!res || !res.ok) {
        setError('Ошибка AI. Попробуйте позже.');
        return;
      }

      const result: SalesAnalysisResult = {
        overallAssessment: data.overallAssessment ?? '—',
        strengths: Array.isArray(data.strengths) ? data.strengths : [],
        errors: Array.isArray(data.errors) ? data.errors : [],
        missedOpportunities: Array.isArray(data.missedOpportunities) ? data.missedOpportunities : [],
        clientSignals: Array.isArray(data.clientSignals) ? data.clientSignals : [],
        recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
        nextMessage: typeof data.nextMessage === 'string' ? data.nextMessage : '',
        badges: Array.isArray(data.badges) ? data.badges : [],
        leadTemperature: typeof data.leadTemperature === 'string' ? data.leadTemperature : undefined,
        leadStage: typeof data.leadStage === 'string' ? data.leadStage : undefined,
        leadIntent: typeof data.leadIntent === 'string' ? data.leadIntent : undefined,
      };
      onCacheResult(conversationId, result);
      if (onExtractedCity && payload.messages.length > 0) {
        getAuthToken().then((token) => {
          const req = () =>
            fetch(CLIENT_ANALYZE_ENDPOINTS[0], {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify(payload),
            });
          req()
            .then((r) => r.json().catch(() => ({})))
            .then((body: { city?: string | null; error?: string }) => {
              const city =
                typeof body.city === 'string' && body.city.trim().length > 0 ? body.city.trim() : null;
              if (city) onExtractedCity(city);
            })
            .catch(() => {});
        });
      }
    } catch (e) {
      setError('Не удалось выполнить анализ. Попробуйте позже.');
      if (import.meta.env.DEV) console.warn('[ChatSalesAnalysis]', e);
    } finally {
      setLoading(false);
      runGuardRef.current = false;
    }
  }, [phone, conversationId, getRecentWithOverrides, onCacheResult, onExtractedCity]);

  const copyFull = useCallback(() => {
    if (!cachedResult) return;
    const parts = [
      'Общая оценка: ' + cachedResult.overallAssessment,
      '',
      'Сильные стороны:\n' + cachedResult.strengths.map((s) => '• ' + s).join('\n'),
      '',
      'Ошибки:\n' + cachedResult.errors.map((e) => '• ' + e).join('\n'),
      '',
      'Упущенные возможности:\n' + cachedResult.missedOpportunities.map((o) => '• ' + o).join('\n'),
      '',
      'Сигналы клиента:\n' + cachedResult.clientSignals.map((s) => '• ' + s).join('\n'),
      '',
      'Рекомендации:\n' + cachedResult.recommendations.map((r) => '• ' + r).join('\n'),
      '',
      'Готовый ответ клиенту:\n' + (cachedResult.nextMessage || '—'),
    ];
    void navigator.clipboard.writeText(parts.join('\n'));
  }, [cachedResult]);

  const copyNextMessage = useCallback(() => {
    if (!cachedResult?.nextMessage) return;
    void navigator.clipboard.writeText(cachedResult.nextMessage);
  }, [cachedResult]);

  const handleInsertClick = useCallback(() => {
    const text = cachedResult?.nextMessage?.trim();
    if (!text || !onInsertNextMessage) return;
    const current = getCurrentInputValue?.()?.trim() ?? '';
    if (!current) {
      onInsertNextMessage(text, 'replace');
      return;
    }
    setInsertChoiceOpen(true);
  }, [cachedResult?.nextMessage, onInsertNextMessage, getCurrentInputValue]);

  const handleInsertChoice = useCallback(
    (mode: 'replace' | 'append') => {
      const text = cachedResult?.nextMessage?.trim();
      if (text && onInsertNextMessage) {
        onInsertNextMessage(text, mode);
      }
      setInsertChoiceOpen(false);
    },
    [cachedResult?.nextMessage, onInsertNextMessage]
  );

  const hasResult = !!cachedResult;
  const canRun =
    !!phone &&
    !!conversationId &&
    recent.length > 0 &&
    !loading &&
    analysisPhase === 'idle' &&
    !isTranscribeBatchRunning &&
    (aiLoadingConfigured || aiConfigured !== false);

  /** Цепочка: подготовка (расшифровка при необходимости) → анализ */
  const runAnalysisWithPrepare = useCallback(async () => {
    if (!phone || !conversationId || runGuardRef.current || analysisPhase !== 'idle') return;
    if (recent.length === 0) {
      setError('Недостаточно сообщений для анализа.');
      return;
    }
    setPrepareWarning(null);
    if (onPrepareForAnalysis) {
      setAnalysisPhase('preparing');
      try {
        const result = await onPrepareForAnalysis((current, total) => {
          setAnalysisPhase('transcribing');
          setTranscribeProgress({ current, total });
        });
        setTranscribeProgress(null);
        if (result.status === 'failed' && result.total > 0 && result.done === 0) {
          setError('Не удалось расшифровать голосовые. Проверьте подключение AI и попробуйте снова.');
          return;
        }
        if (result.status === 'partial' && result.errors > 0) {
          setPrepareWarning('Часть голосовых не удалось расшифровать, анализ выполнен по доступным сообщениям.');
        }
        setAnalysisPhase('analyzing');
        await runAnalysis(result.updates);
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[ChatSalesAnalysis] prepare failed', e);
        setError('Ошибка подготовки чата к анализу.');
      } finally {
        setAnalysisPhase('idle');
        setTranscribeProgress(null);
      }
    } else {
      await runAnalysis();
    }
  }, [phone, conversationId, recent.length, onPrepareForAnalysis, runAnalysis]);

  useEffect(() => {
    if (!insertChoiceOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInsertChoiceOpen(false);
    };
    const onDocClick = (e: MouseEvent) => {
      if (insertAnchorRef.current && !insertAnchorRef.current.contains(e.target as Node)) {
        const menu = document.getElementById(insertChoiceId);
        if (menu && !menu.contains(e.target as Node)) setInsertChoiceOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('click', onDocClick, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onDocClick, true);
    };
  }, [insertChoiceOpen, insertChoiceId]);

  const section = (title: string, items: string[], emptyText: string) => (
    <div className="mt-3">
      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">{title}</h4>
      {items.length > 0 ? (
        <ul className="space-y-1 text-sm text-gray-800 list-disc list-inside">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">{emptyText}</p>
      )}
    </div>
  );

  const content = (
    <>
      <p className="text-xs text-gray-500 mt-1">
        Разбор переписки с точки зрения продаж: оценка, ошибки, упущенные возможности и готовый следующий ответ.
      </p>
      <button
        type="button"
        onClick={runAnalysisWithPrepare}
        disabled={!canRun}
        title={aiConfigured === false && !aiLoadingConfigured ? 'Подключите AI API key в разделе Интеграции' : undefined}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Sparkles className="w-4 h-4 shrink-0" />
        {analysisPhase === 'preparing' && 'Подготовка чата…'}
        {analysisPhase === 'transcribing' &&
          transcribeProgress &&
          `Расшифровка: ${transcribeProgress.current} из ${transcribeProgress.total}`}
        {analysisPhase === 'analyzing' && (loading ? 'Анализируем чат…' : 'Анализируем чат…')}
        {analysisPhase === 'idle' && (loading ? 'Анализируем чат…' : 'Проанализировать чат')}
      </button>
      {(analysisPhase === 'transcribing' && transcribeProgress) && (
        <p className="mt-1.5 text-xs text-gray-500">
          Расшифровка голосовых перед анализом…
        </p>
      )}
      {prepareWarning && (
        <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5" role="alert">
          {prepareWarning}
        </p>
      )}
      {!aiLoadingConfigured && aiConfigured === false && (
        <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5" role="alert">
          Подключите AI API key в разделе Интеграции
        </p>
      )}
      {recent.length === 0 && phone && (
        <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5" role="alert">
          В чате нет сообщений для анализа.
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs text-red-700 bg-red-50 rounded-lg px-2 py-1.5" role="alert">
          {error}
        </p>
      )}

      {hasResult && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
          {analyzedAt && (
            <p className="text-xs text-gray-500">
              Последний анализ: {formatAnalyzedAt(analyzedAt)}
            </p>
          )}
          {cachedResult!.badges && cachedResult!.badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {cachedResult!.badges!.map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700"
                >
                  {BADGE_LABELS[b] ?? b}
                </span>
              ))}
            </div>
          )}
          <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
            <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Общая оценка</h4>
            <p className="mt-1 text-sm text-gray-800">{cachedResult!.overallAssessment}</p>
          </div>
          {section('Сильные стороны', cachedResult!.strengths, '—')}
          {section('Ошибки', cachedResult!.errors, '—')}
          {section('Упущенные возможности', cachedResult!.missedOpportunities, '—')}
          {section('Сигналы клиента', cachedResult!.clientSignals, '—')}
          {section('Рекомендации', cachedResult!.recommendations, '—')}
          {cachedResult!.nextMessage && (
            <div className="mt-3 p-2.5 rounded-lg bg-green-50 border border-green-100 relative">
              <h4 className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-1.5">
                Готовый ответ клиенту
              </h4>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{cachedResult!.nextMessage}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {onInsertNextMessage && (
                  <>
                    <button
                      ref={insertAnchorRef}
                      type="button"
                      onClick={handleInsertClick}
                      className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800"
                      aria-expanded={insertChoiceOpen}
                      aria-haspopup="true"
                      aria-controls={insertChoiceId}
                    >
                      <Type className="w-3.5 h-3.5" />
                      Вставить в поле
                    </button>
                    {insertChoiceOpen && (
                      <div
                        id={insertChoiceId}
                        role="menu"
                        className="absolute left-2.5 right-2.5 top-full mt-1 z-10 rounded-lg border border-green-200 bg-white py-1 shadow-lg"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleInsertChoice('replace')}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-gray-800 hover:bg-green-50"
                        >
                          Заменить текст
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleInsertChoice('append')}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-gray-800 hover:bg-green-50"
                        >
                          Добавить в конец
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => setInsertChoiceOpen(false)}
                          className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-50"
                        >
                          Отмена
                        </button>
                      </div>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={copyNextMessage}
                  className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Копировать
                </button>
                <button
                  type="button"
                  onClick={runAnalysis}
                  disabled={!canRun}
                  className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Обновить ответ
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={runAnalysis}
              disabled={!canRun}
              className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Обновляем анализ…' : 'Обновить'}
            </button>
            <button
              type="button"
              onClick={copyFull}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-700"
            >
              <Copy className="w-3.5 h-3.5" />
              Скопировать вывод
            </button>
          </div>
        </div>
      )}
    </>
  );

  const header = (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-gray-700">AI-разбор переписки</h3>
      {compact && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="p-1 rounded text-gray-500 hover:bg-gray-100"
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      )}
    </div>
  );

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      {header}
      {(!compact || !collapsed) && <div className="mt-2">{content}</div>}
    </div>
  );
}
