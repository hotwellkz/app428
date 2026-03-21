import React, { useMemo, useState } from 'react';
import { Sparkles, Zap, Target, Loader2, Settings2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAIConfigured } from '../../hooks/useAIConfigured';
import type { CrmAiBot } from '../../types/crmAiBot';
import { labelCrmAiBotStatus } from '../../types/crmAiBot';
import type { WhatsAppAiRuntime, WhatsAppAiRuntimeMode } from '../../types/whatsappAiRuntime';
import type { WhatsAppAiRuntimePatch } from '../../lib/firebase/whatsappDb';

function formatAiRuntimeDate(value: unknown): string {
  if (value == null) return '—';
  try {
    const v = value as { toDate?: () => Date };
    if (typeof v.toDate === 'function') {
      return v.toDate().toLocaleString('ru-RU');
    }
    const d = new Date(value as string | number);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('ru-RU');
  } catch {
    return '—';
  }
}

export interface MobileWhatsappAiCrmConfig {
  aiRuntime: WhatsAppAiRuntime;
  crmAiBots: CrmAiBot[];
  onAiRuntimePatch: (patch: WhatsAppAiRuntimePatch) => void;
  aiRuntimeSaving: boolean;
}

export interface MobileWhatsappAiComposerProps {
  onAiReply: (mode: 'normal' | 'short' | 'close') => void;
  aiModeLoading: 'normal' | 'short' | 'close' | null;
  disabled?: boolean;
  /** Если есть — показываем вторую кнопку «настройки» с теми же патчами, что в карточке клиента */
  crmAi: MobileWhatsappAiCrmConfig | null;
}

/**
 * Мобильный UX: одна кнопка «AI действия» (меню из 3 бывших цветных кнопок) + опционально «AI настройки» (CRM runtime).
 */
const MobileWhatsappAiComposer: React.FC<MobileWhatsappAiComposerProps> = ({
  onAiReply,
  aiModeLoading,
  disabled = false,
  crmAi
}) => {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { configured: aiConfigured, loading: aiLoadingConfigured } = useAIConfigured();

  const runtimeBots = useMemo(
    () => (crmAi?.crmAiBots ?? []).filter((b) => b.status !== 'archived'),
    [crmAi?.crmAiBots]
  );

  const aiRuntime = crmAi?.aiRuntime;
  const busy = !!aiModeLoading;

  const runAction = (mode: 'normal' | 'short' | 'close') => {
    setActionsOpen(false);
    onAiReply(mode);
  };

  const openActions = () => {
    setSettingsOpen(false);
    setActionsOpen(true);
  };

  const openSettings = () => {
    setActionsOpen(false);
    setSettingsOpen(true);
  };

  /** Единый mobile touch target (≥44px) и стиль в духе остальных иконок composer: rounded-xl, спокойные заливки */
  const hitBtn =
    'flex h-11 w-11 min-h-[44px] min-w-[44px] flex-shrink-0 touch-manipulation items-center justify-center rounded-xl transition-colors active:scale-[0.97] disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1';

  return (
    <>
      <div
        className="flex flex-shrink-0 items-center gap-3 max-md:px-0.5"
        role="group"
        aria-label="AI в чате"
      >
        <button
          type="button"
          onClick={openActions}
          disabled={disabled || busy}
          title="AI: сгенерировать ответ"
          aria-label="AI: действия — открыть меню"
          aria-haspopup="dialog"
          aria-expanded={actionsOpen}
          className={`${hitBtn} border border-emerald-200/90 bg-emerald-50 text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] hover:bg-emerald-100/90 focus-visible:ring-emerald-400/45`}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" strokeWidth={2} />
          ) : (
            <Sparkles className="h-5 w-5 shrink-0" strokeWidth={2} />
          )}
        </button>

        {crmAi && (
          <button
            type="button"
            onClick={openSettings}
            disabled={disabled}
            title="AI: режим, бот и автоворонка"
            aria-label="Настройки AI в чате"
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            className={`${hitBtn} relative border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-800 focus-visible:ring-gray-400/40`}
          >
            <Settings2 className="h-5 w-5 shrink-0" strokeWidth={2} />
            <span
              className={`pointer-events-none absolute right-1 top-1 h-2 w-2 rounded-full ring-2 ring-gray-50 ${
                aiRuntime?.enabled ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
              aria-hidden
            />
            {aiRuntime?.enabled && aiRuntime.mode !== 'off' && (
              <span
                className="pointer-events-none absolute bottom-1 right-1 min-w-[16px] rounded-md bg-gray-700/90 px-0.5 text-center text-[9px] font-semibold leading-4 text-white shadow-sm"
                aria-hidden
              >
                {aiRuntime.mode === 'draft' ? 'Ч' : 'А'}
              </span>
            )}
          </button>
        )}
      </div>

      {actionsOpen && (
        <div
          className="fixed inset-0 z-[1102] flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="AI действия"
        >
          <button type="button" className="absolute inset-0 bg-black/50" onClick={() => setActionsOpen(false)} aria-label="Закрыть" />
          <div
            className="relative rounded-t-2xl bg-white shadow-xl"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="mx-auto mb-2 mt-2 h-1 w-10 rounded-full bg-gray-300" aria-hidden />
            <p className="px-4 pb-2 text-center text-sm font-medium text-gray-800">AI действия</p>
            <div className="max-h-[min(56vh,420px)] space-y-1 overflow-y-auto px-3 pb-3">
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => runAction('normal')}
                className="flex w-full items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-3 text-left active:bg-emerald-100 disabled:opacity-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                  {aiModeLoading === 'normal' ? (
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                  ) : (
                    <Sparkles className="h-5 w-5 text-emerald-600" />
                  )}
                </span>
                <span>
                  <span className="block text-sm font-medium text-gray-900">Сгенерировать ответ</span>
                  <span className="text-xs text-gray-600">Обычный ответ по контексту чата</span>
                </span>
              </button>
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => runAction('short')}
                className="flex w-full items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/80 px-3 py-3 text-left active:bg-indigo-100 disabled:opacity-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                  {aiModeLoading === 'short' ? (
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                  ) : (
                    <Zap className="h-5 w-5 text-indigo-600" />
                  )}
                </span>
                <span>
                  <span className="block text-sm font-medium text-gray-900">Очень коротко</span>
                  <span className="text-xs text-gray-600">Краткий ответ</span>
                </span>
              </button>
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => runAction('close')}
                className="flex w-full items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-3 text-left active:bg-amber-100 disabled:opacity-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                  {aiModeLoading === 'close' ? (
                    <Loader2 className="h-5 w-5 animate-spin text-amber-700" />
                  ) : (
                    <Target className="h-5 w-5 text-amber-700" />
                  )}
                </span>
                <span>
                  <span className="block text-sm font-medium text-gray-900">Продвинуть сделку</span>
                  <span className="text-xs text-gray-600">Фокус на следующем шаге</span>
                </span>
              </button>
            </div>
            <button
              type="button"
              className="w-full border-t border-gray-100 py-3 text-sm text-gray-600"
              onClick={() => setActionsOpen(false)}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {settingsOpen && crmAi && (() => {
        const rt = crmAi.aiRuntime;
        return (
        <div
          className="fixed inset-0 z-[1102] flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Настройки AI"
        >
          <button type="button" className="absolute inset-0 bg-black/50" onClick={() => setSettingsOpen(false)} aria-label="Закрыть" />
          <div
            className="relative max-h-[min(72vh,520px)] overflow-y-auto rounded-t-2xl bg-white shadow-xl"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="sticky top-0 z-[1] bg-white pb-2 pt-2">
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-300" aria-hidden />
              <p className="px-4 text-center text-sm font-semibold text-gray-900">AI в чате</p>
              <p className="mt-0.5 px-4 text-center text-[11px] text-gray-500">Автоворонки · тот же режим, что в карточке клиента</p>
            </div>
            <div className="space-y-3 px-4 pb-4">
              {!aiConfigured && !aiLoadingConfigured && (
                <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                  Укажите API-ключ AI в разделе Интеграции.
                </p>
              )}
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={rt.enabled}
                  disabled={crmAi.aiRuntimeSaving}
                  onChange={(e) => {
                    const on = e.target.checked;
                    if (on && !aiLoadingConfigured && !aiConfigured) {
                      toast.error('Сначала настройте AI API ключ в Интеграциях');
                      return;
                    }
                    crmAi.onAiRuntimePatch({
                      enabled: on,
                      ...(on ? {} : { mode: 'off' as WhatsAppAiRuntimeMode })
                    });
                  }}
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-500 disabled:opacity-50"
                />
                <span className="text-sm font-medium text-gray-800">AI-режим</span>
                {crmAi.aiRuntimeSaving && <span className="text-[10px] text-violet-600">сохранение…</span>}
              </label>
              <div>
                <label className="mb-0.5 block text-[11px] font-medium text-gray-600">Бот</label>
                <select
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
                  disabled={crmAi.aiRuntimeSaving || !rt.enabled}
                  value={rt.botId ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    crmAi.onAiRuntimePatch({ botId: v.length ? v : null });
                  }}
                >
                  <option value="">— не выбран —</option>
                  {runtimeBots.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.status !== 'active' ? ` (${labelCrmAiBotStatus(b.status)})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-0.5 block text-[11px] font-medium text-gray-600">Режим</label>
                <select
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
                  disabled={crmAi.aiRuntimeSaving || !rt.enabled}
                  value={rt.mode}
                  onChange={(e) => {
                    const v = e.target.value as WhatsAppAiRuntimeMode;
                    crmAi.onAiRuntimePatch({ mode: v });
                  }}
                >
                  <option value="off">Выключен</option>
                  <option value="draft">Черновик ответа</option>
                  <option value="auto">Автоответ</option>
                </select>
              </div>
              <dl className="space-y-1.5 border-t border-gray-100 pt-3 text-[11px] text-gray-600">
                <div className="flex justify-between gap-2">
                  <dt className="shrink-0 text-gray-500">Последний запуск</dt>
                  <dd className="text-right">{formatAiRuntimeDate(rt.lastRunAt)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="shrink-0 text-gray-500">Статус</dt>
                  <dd className="max-w-[65%] truncate text-right" title={rt.lastReason ?? undefined}>
                    {rt.lastStatus === 'success' && 'успех'}
                    {rt.lastStatus === 'error' && 'ошибка'}
                    {rt.lastStatus === 'skipped' && 'пропуск'}
                    {rt.lastStatus === 'idle' && 'ожидание'}
                    {!rt.lastStatus && '—'}
                    {rt.lastReason ? ` · ${rt.lastReason}` : ''}
                  </dd>
                </div>
              </dl>
              <p className="text-[10px] text-gray-500">
                Полная карточка клиента — для сделок, задач и CRM extraction.
              </p>
            </div>
            <button
              type="button"
              className="sticky bottom-0 w-full border-t border-gray-100 bg-white py-3 text-sm text-gray-700"
              onClick={() => setSettingsOpen(false)}
            >
              Готово
            </button>
          </div>
        </div>
        );
      })()}
    </>
  );
};

export default MobileWhatsappAiComposer;
