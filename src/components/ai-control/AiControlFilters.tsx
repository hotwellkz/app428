import React from 'react';
import type { CrmAiBot } from '../../types/crmAiBot';
import type { AiControlFiltersState, AiControlPeriodPreset, AiControlResultFilter } from '../../types/aiControl';
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

export const AiControlFilters: React.FC<{
  filters: AiControlFiltersState;
  onChange: (f: AiControlFiltersState) => void;
  bots: CrmAiBot[];
}> = ({ filters, onChange, bots }) => {
  const set = (patch: Partial<AiControlFiltersState>) => onChange({ ...filters, ...patch });

  return (
    <div className="space-y-3 p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
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
            <option value="instagram">Instagram</option>
            <option value="site">Сайт</option>
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
  if (ch === 'instagram') return 'Instagram';
  return labelCrmAiBotChannel(ch);
}
