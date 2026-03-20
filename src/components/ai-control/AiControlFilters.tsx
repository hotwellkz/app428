import React from 'react';
import type { CrmAiBot } from '../../types/crmAiBot';
import type {
  AiControlFiltersState,
  AiControlPeriodPreset,
  AiControlResultFilter,
  AiControlVoiceIssuePreset
} from '../../types/aiControl';
import { DEFAULT_AI_CONTROL_FILTERS } from '../../types/aiControl';
import { labelCrmAiBotChannel } from '../../types/crmAiBot';

const PERIODS: { v: AiControlPeriodPreset; l: string }[] = [
  { v: 'today', l: 'Сегодня' },
  { v: 'yesterday', l: 'Вчера' },
  { v: '7d', l: '7 дней' },
  { v: '30d', l: '30 дней' },
  { v: 'custom', l: 'Период' }
];

const STATUS_BUCKETS = [
  { v: '', l: 'Все статусы' },
  { v: 'success', l: 'Успех' },
  { v: 'partial', l: 'Частично' },
  { v: 'warning', l: 'Внимание' },
  { v: 'error', l: 'Ошибка' },
  { v: 'skipped', l: 'Пропуск' },
  { v: 'duplicate', l: 'Дубль' },
  { v: 'paused', l: 'Пауза бота' },
  { v: 'off', l: 'Выкл.' }
];

const RESULTS: { v: AiControlResultFilter; l: string }[] = [
  { v: 'all', l: 'Все результаты' },
  { v: 'deal_created', l: 'Сделка создана' },
  { v: 'task_created', l: 'Задача записана' },
  { v: 'crm_updated', l: 'CRM обновлена' },
  { v: 'reply_only', l: 'Только ответ AI' },
  { v: 'no_changes', l: 'Без изменений в CRM' }
];

const RUNTIME_MODES = [
  { v: '', l: 'Любой режим' },
  { v: 'draft', l: 'Черновик' },
  { v: 'auto', l: 'Авто' },
  { v: 'off', l: 'Off' },
  { v: 'deal_create', l: 'Создание сделки' },
  { v: 'task_create', l: 'Создание задачи' }
];

const PRESET_VIEWS: { v: AiControlFiltersState['presetView']; l: string }[] = [
  { v: 'all', l: 'Все' },
  { v: 'errors', l: 'Ошибки' },
  { v: 'attention', l: 'Требуют внимания' },
  { v: 'deals', l: 'Сделки' },
  { v: 'tasks', l: 'Задачи' }
];
const SORT_OPTIONS: { v: AiControlFiltersState['sortBy']; l: string }[] = [
  { v: 'newest', l: 'Новые сверху' },
  { v: 'problem_first', l: 'Сначала проблемные' },
  { v: 'deal_task_first', l: 'Сначала сделки/задачи' },
  { v: 'overdue_first', l: 'Сначала просроченные' },
  { v: 'critical_first', l: 'Сначала критичные' },
  { v: 'unassigned_first', l: 'Сначала без ответственного' },
  { v: 'oldest_problem_first', l: 'Сначала самые старые проблемные' },
  { v: 'workflow_recently_updated', l: 'Сначала недавно обновлённые workflow' }
];

export const AiControlFilters: React.FC<{
  filters: AiControlFiltersState;
  onChange: (f: AiControlFiltersState) => void;
  bots: CrmAiBot[];
}> = ({ filters, onChange, bots }) => {
  const set = (patch: Partial<AiControlFiltersState>) => onChange({ ...filters, ...patch });

  return (
    <div className="space-y-3 p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap gap-2">
        <span className="text-[10px] text-gray-400 w-full uppercase tracking-wide">Канал</span>
        {[
          { label: 'Только WhatsApp', apply: { channel: 'whatsapp', voiceIssuePreset: '' as AiControlVoiceIssuePreset } },
          { label: 'Только Voice', apply: { channel: 'voice', voiceIssuePreset: '' as AiControlVoiceIssuePreset } }
        ].map((chip) => (
          <button
            key={chip.label}
            type="button"
            className="px-2.5 py-1 rounded-full text-xs border bg-violet-50 text-violet-900 border-violet-200 hover:bg-violet-100"
            onClick={() => set(chip.apply as Partial<AiControlFiltersState>)}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Все', apply: { presetView: 'all', runtimeMode: '', onlyCrmApply: false, onlyFallback: false, onlyWithDeal: false, onlyWithTask: false } },
          { label: 'Только ошибки', apply: { presetView: 'errors' } },
          { label: 'Только fallback', apply: { presetView: 'all', onlyFallback: true } },
          { label: 'Только со сделкой', apply: { presetView: 'deals' } },
          { label: 'Только с задачей', apply: { presetView: 'tasks' } },
          { label: 'Только auto', apply: { presetView: 'all', runtimeMode: 'auto' } },
          { label: 'Только draft', apply: { presetView: 'all', runtimeMode: 'draft' } },
          { label: 'Только применено в CRM', apply: { presetView: 'all', onlyCrmApply: true } },
          { label: 'Только требующие внимания', apply: { presetView: 'attention' } }
        ].map((chip) => (
          <button
            key={chip.label}
            type="button"
            className="px-2.5 py-1 rounded-full text-xs border bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            onClick={() => set(chip.apply as Partial<AiControlFiltersState>)}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <div className="pt-1 border-t border-gray-100">
        <p className="text-xs text-gray-500 mb-2">Workflow обработка</p>
        <div className="flex flex-wrap gap-2">
          {[
            { v: 'all', l: 'Все' },
            { v: 'new', l: 'Только новые' },
            { v: 'in_progress', l: 'Только в работе' },
            { v: 'escalated', l: 'Только эскалированные' },
            { v: 'resolved', l: 'Только решённые' },
            { v: 'ignored', l: 'Только игнор' }
          ].map((wf) => (
            <button
              key={wf.v}
              type="button"
              className={`px-2.5 py-1 rounded-full text-xs border ${
                filters.workflowFilter === wf.v ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300'
              }`}
              onClick={() => set({ workflowFilter: wf.v as AiControlFiltersState['workflowFilter'] })}
            >
              {wf.l}
            </button>
          ))}
          <button
            type="button"
            className={`px-2.5 py-1 rounded-full text-xs border ${
              filters.onlyMine ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300'
            }`}
            onClick={() => set({ onlyMine: !filters.onlyMine })}
          >
            Только мои
          </button>
          <button
            type="button"
            className={`px-2.5 py-1 rounded-full text-xs border ${
              filters.onlyNewProblem ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-300'
            }`}
            onClick={() => set({ onlyNewProblem: !filters.onlyNewProblem })}
          >
            Только новые проблемные
          </button>
          <button
            type="button"
            className={`px-2.5 py-1 rounded-full text-xs border ${
              filters.onlyOverdue ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-300'
            }`}
            onClick={() => set({ onlyOverdue: !filters.onlyOverdue })}
          >
            Только просроченные
          </button>
          <button
            type="button"
            className={`px-2.5 py-1 rounded-full text-xs border ${
              filters.onlyCritical ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-300'
            }`}
            onClick={() => set({ onlyCritical: !filters.onlyCritical })}
          >
            Только критичные
          </button>
          <button
            type="button"
            className={`px-2.5 py-1 rounded-full text-xs border ${
              filters.onlyUnassigned ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-300'
            }`}
            onClick={() => set({ onlyUnassigned: !filters.onlyUnassigned })}
          >
            Только без ответственного
          </button>
          <button
            type="button"
            className={`px-2.5 py-1 rounded-full text-xs border ${
              filters.onlyMyOverdue ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-300'
            }`}
            onClick={() => set({ onlyMyOverdue: !filters.onlyMyOverdue })}
          >
            Только мои просроченные
          </button>
          <button
            type="button"
            className={`px-2.5 py-1 rounded-full text-xs border ${
              filters.onlyReactionToday ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300'
            }`}
            onClick={() => set({ onlyReactionToday: !filters.onlyReactionToday })}
          >
            Только требующие реакции сегодня
          </button>
          <button
            type="button"
            className={`px-2.5 py-1 rounded-full text-xs border ${
              filters.onlyUnalertedCritical ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-300'
            }`}
            onClick={() => set({ onlyUnalertedCritical: !filters.onlyUnalertedCritical })}
          >
            Только неалерченные critical
          </button>
          <button
            type="button"
            className={`px-2.5 py-1 rounded-full text-xs border ${
              filters.onlyOverdueNoEscalation ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-300'
            }`}
            onClick={() => set({ onlyOverdueNoEscalation: !filters.onlyOverdueNoEscalation })}
          >
            Только overdue без эскалации
          </button>
          <button
            type="button"
            className={`px-2.5 py-1 rounded-full text-xs border ${
              filters.onlySnoozed ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300'
            }`}
            onClick={() => set({ onlySnoozed: !filters.onlySnoozed })}
          >
            Только snoozed
          </button>
          <button
            type="button"
            className={`px-2.5 py-1 rounded-full text-xs border ${
              filters.onlyMuted ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300'
            }`}
            onClick={() => set({ onlyMuted: !filters.onlyMuted })}
          >
            Только muted
          </button>
          <button
            type="button"
            className={`px-2.5 py-1 rounded-full text-xs border ${
              filters.onlyNeedReminderNow ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-700 border-gray-300'
            }`}
            onClick={() => set({ onlyNeedReminderNow: !filters.onlyNeedReminderNow })}
          >
            Только требуют напоминания сейчас
          </button>
          <button
            type="button"
            className={`px-2.5 py-1 rounded-full text-xs border ${
              filters.onlyEscalatedAlerts ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-700 border-gray-300'
            }`}
            onClick={() => set({ onlyEscalatedAlerts: !filters.onlyEscalatedAlerts })}
          >
            Только уже эскалированные
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Вид</label>
          <select
            className="text-sm border rounded-lg px-2 py-1.5 min-w-[150px]"
            value={filters.presetView}
            onChange={(e) => set({ presetView: e.target.value as AiControlFiltersState['presetView'] })}
          >
            {PRESET_VIEWS.map((p) => (
              <option key={p.v} value={p.v}>
                {p.l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Период</label>
          <select
            className="text-sm border rounded-lg px-2 py-1.5 min-w-[120px]"
            value={filters.period}
            onChange={(e) => set({ period: e.target.value as AiControlPeriodPreset })}
          >
            {PERIODS.map((p) => (
              <option key={p.v} value={p.v}>
                {p.l}
              </option>
            ))}
          </select>
        </div>
        {filters.period === 'custom' && (
          <>
            <div>
              <label className="block text-xs text-gray-500 mb-1">С</label>
              <input
                type="date"
                className="text-sm border rounded-lg px-2 py-1.5"
                value={filters.customFrom}
                onChange={(e) => set({ customFrom: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">По</label>
              <input
                type="date"
                className="text-sm border rounded-lg px-2 py-1.5"
                value={filters.customTo}
                onChange={(e) => set({ customTo: e.target.value })}
              />
            </div>
          </>
        )}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Бот</label>
          <select
            className="text-sm border rounded-lg px-2 py-1.5 min-w-[160px]"
            value={filters.botId}
            onChange={(e) => set({ botId: e.target.value })}
          >
            <option value="">Все боты</option>
            {bots.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Канал</label>
          <select
            className="text-sm border rounded-lg px-2 py-1.5 min-w-[130px]"
            value={filters.channel}
            onChange={(e) => set({ channel: e.target.value })}
          >
            <option value="">Все</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="voice">Voice (звонок)</option>
            <option value="instagram">Instagram</option>
            <option value="site">Сайт</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Voice: сценарий</label>
          <select
            className="text-sm border rounded-lg px-2 py-1.5 min-w-[200px]"
            value={filters.voiceIssuePreset}
            onChange={(e) => set({ voiceIssuePreset: e.target.value as AiControlVoiceIssuePreset })}
          >
            <option value="">Все voice-сценарии</option>
            <option value="post_call_failed">Post-call failed</option>
            <option value="no_answer_busy">Нет ответа / занято</option>
            <option value="voice_busy">Voice: busy</option>
            <option value="voice_no_answer">Voice: no_answer</option>
            <option value="voice_failed">Voice: failed</option>
            <option value="voice_telecom_route_uncertain">Voice: telecom_route_uncertain</option>
            <option value="outcome_unknown_empty">Completed + outcome unknown + нет сводки</option>
            <option value="follow_up_failed">Follow-up WhatsApp failed</option>
            <option value="crm_failed">CRM apply error</option>
            <option value="needs_attention_voice">Требуют внимания (voice)</option>
            <option value="retry_scheduled">Retry: запланирован</option>
            <option value="retry_exhausted">Retry: лимит исчерпан</option>
            <option value="callback_due">Callback в ближайшие 2ч</option>
            <option value="qa_low_quality">QA: низкое качество</option>
            <option value="qa_needs_review">QA: требует review</option>
            <option value="qa_missing_next_step">QA: нет next step</option>
            <option value="qa_unclear_outcome">QA: outcome неясен</option>
            <option value="qa_operational_issues">QA: CRM/follow-up/post-call issues</option>
            <option value="qa_repeated_retry_problem">QA: repeated retry problem</option>
            <option value="qa_failed">QA: pipeline failed</option>
            <option value="qa_review_pending">QA review: pending</option>
            <option value="qa_reviewed">QA review: reviewed</option>
            <option value="qa_false_positive">QA review: false positive</option>
            <option value="qa_accepted_issue">QA review: accepted issue</option>
            <option value="qa_needs_prompt_fix">QA: needs prompt fix</option>
            <option value="qa_needs_ops_fix">QA: needs ops fix</option>
            <option value="qa_needs_human_followup">QA: needs human follow-up</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Статус</label>
          <select
            className="text-sm border rounded-lg px-2 py-1.5 min-w-[140px]"
            value={filters.statusBucket}
            onChange={(e) => set({ statusBucket: e.target.value })}
          >
            {STATUS_BUCKETS.map((s) => (
              <option key={s.v || 'all'} value={s.v}>
                {s.l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Результат</label>
          <select
            className="text-sm border rounded-lg px-2 py-1.5 min-w-[160px]"
            value={filters.result}
            onChange={(e) => set({ result: e.target.value as AiControlResultFilter })}
          >
            {RESULTS.map((r) => (
              <option key={r.v} value={r.v}>
                {r.l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Режим run</label>
          <select
            className="text-sm border rounded-lg px-2 py-1.5 min-w-[140px]"
            value={filters.runtimeMode}
            onChange={(e) => set({ runtimeMode: e.target.value })}
          >
            {RUNTIME_MODES.map((r) => (
              <option key={r.v || 'any'} value={r.v}>
                {r.l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Сортировка</label>
          <select
            className="text-sm border rounded-lg px-2 py-1.5 min-w-[180px]"
            value={filters.sortBy}
            onChange={(e) => set({ sortBy: e.target.value as AiControlFiltersState['sortBy'] })}
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.v} value={s.v}>
                {s.l}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Поиск (телефон, id чата, сделки, имя бота)</label>
        <input
          type="search"
          placeholder="Поиск…"
          className="w-full max-w-md text-sm border rounded-lg px-3 py-2"
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'onlyErrors', label: 'Только ошибки' },
          { key: 'onlySkipped', label: 'Только skipped' },
          { key: 'onlySnapshot', label: 'Только snapshot' },
          { key: 'onlyFallback', label: 'Только fallback' },
          { key: 'onlyCrmApply', label: 'Только с CRM apply' },
          { key: 'onlyWithDeal', label: 'Только со сделкой' },
          { key: 'onlyWithTask', label: 'Только с задачей' }
        ].map((t) => {
          const k = t.key as keyof AiControlFiltersState;
          const active = Boolean(filters[k]);
          return (
            <button
              key={t.key}
              type="button"
              className={`px-2.5 py-1 rounded-full text-xs border ${
                active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'
              }`}
              onClick={() => set({ [k]: !active } as Partial<AiControlFiltersState>)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="text-xs text-indigo-600 hover:underline"
        onClick={() => onChange({ ...DEFAULT_AI_CONTROL_FILTERS })}
      >
        Сбросить фильтры
      </button>
    </div>
  );
};

export function channelLabel(ch: string | null | undefined): string {
  if (!ch) return '—';
  if (ch === 'whatsapp') return 'WhatsApp';
  if (ch === 'voice') return 'Voice';
  if (ch === 'instagram') return 'Instagram';
  return labelCrmAiBotChannel(ch);
}
