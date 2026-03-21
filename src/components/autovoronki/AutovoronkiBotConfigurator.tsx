import React from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { CrmAiBotConfig } from '../../types/crmAiBotConfig';
import {
  CRM_AI_BOT_COLLECT_FIELD_OPTIONS,
  CRM_AI_BOT_LANGUAGE_OPTIONS,
  CRM_AI_BOT_NEXT_STEP_OPTIONS,
  CRM_AI_BOT_SUCCESS_CRITERIA_OPTIONS,
  CRM_AI_BOT_TONE_OPTIONS,
  createEmptyDialogStep,
  type CrmAiBotDefaultLanguage,
  type CrmAiBotPersonaTone,
  type CrmAiHumanizationLevel,
  type CrmAiReplyLengthMode,
  type CrmAiReplySplitMode
} from '../../types/crmAiBotConfig';

const fieldClass =
  'w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';

interface AutovoronkiBotConfiguratorProps {
  config: CrmAiBotConfig;
  onChange: (next: CrmAiBotConfig) => void;
}

function SectionCard({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 shadow-sm space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {subtitle ? <p className="text-xs text-gray-500 mt-1">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

export const AutovoronkiBotConfigurator: React.FC<AutovoronkiBotConfiguratorProps> = ({ config, onChange }) => {
  const toggleSuccess = (value: string) => {
    const set = new Set(config.goal.successCriteria);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    onChange({ ...config, goal: { ...config.goal, successCriteria: [...set] } });
  };

  const toggleCollect = (value: string) => {
    const set = new Set(config.collectFields.builtIn);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    onChange({
      ...config,
      collectFields: { ...config.collectFields, builtIn: [...set] }
    });
  };

  const addStep = () => {
    const steps = [...config.dialogPlan.steps, createEmptyDialogStep(config.dialogPlan.steps.length)];
    onChange({ ...config, dialogPlan: { ...config.dialogPlan, steps } });
  };

  const removeStep = (index: number) => {
    const steps = config.dialogPlan.steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, order: i }));
    onChange({ ...config, dialogPlan: { ...config.dialogPlan, steps } });
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= config.dialogPlan.steps.length) return;
    const steps = [...config.dialogPlan.steps];
    [steps[index], steps[j]] = [steps[j], steps[index]];
    const renumbered = steps.map((s, i) => ({ ...s, order: i }));
    onChange({ ...config, dialogPlan: { ...config.dialogPlan, steps: renumbered } });
  };

  const patchStep = (index: number, patch: Partial<(typeof config.dialogPlan.steps)[0]>) => {
    const steps = config.dialogPlan.steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange({ ...config, dialogPlan: { ...config.dialogPlan, steps } });
  };

  const patchReplyStyle = (patch: Partial<(typeof config)['replyStyle']>) => {
    onChange({ ...config, replyStyle: { ...config.replyStyle, ...patch } });
  };

  return (
    <div className="rounded-2xl border-2 border-emerald-100/80 bg-gradient-to-b from-white to-emerald-50/30 p-5 md:p-7 shadow-sm space-y-6">
      <div>
        <h2 className="text-lg md:text-xl font-semibold text-gray-900">Сценарий и настройки бота</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-3xl">
          Опишите роль, цели и план диалога — позже эти данные пойдут в промпт и логику AI без изменения структуры
          Firestore.
        </p>
      </div>

      <SectionCard title="A. Роль бота" subtitle="Как бот представляется и в каком стиле общается">
        <div>
          <label htmlFor="cfg-display-name" className={labelClass}>
            Имя бота
          </label>
          <input
            id="cfg-display-name"
            type="text"
            value={config.persona.botDisplayName}
            onChange={(e) =>
              onChange({ ...config, persona: { ...config.persona, botDisplayName: e.target.value } })
            }
            placeholder="Например: Анна, Айдана, Менеджер HotWell"
            className={fieldClass}
            maxLength={120}
          />
        </div>
        <div>
          <label htmlFor="cfg-role" className={labelClass}>
            Роль / кто он
          </label>
          <textarea
            id="cfg-role"
            value={config.persona.role}
            onChange={(e) => onChange({ ...config, persona: { ...config.persona, role: e.target.value } })}
            placeholder="Например: Вы — опытный менеджер по продажам SIP-домов…"
            rows={4}
            className={`${fieldClass} resize-y min-h-[100px]`}
            maxLength={4000}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="cfg-tone" className={labelClass}>
              Тон общения
            </label>
            <select
              id="cfg-tone"
              value={config.persona.tone}
              onChange={(e) =>
                onChange({
                  ...config,
                  persona: { ...config.persona, tone: e.target.value as CrmAiBotPersonaTone }
                })
              }
              className={`${fieldClass} bg-white`}
            >
              {CRM_AI_BOT_TONE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cfg-lang" className={labelClass}>
              Язык общения по умолчанию
            </label>
            <select
              id="cfg-lang"
              value={config.persona.defaultLanguage}
              onChange={(e) =>
                onChange({
                  ...config,
                  persona: { ...config.persona, defaultLanguage: e.target.value as CrmAiBotDefaultLanguage }
                })
              }
              className={`${fieldClass} bg-white`}
            >
              {CRM_AI_BOT_LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="B. Цель бота" subtitle="Зачем бот ведёт диалог и что считать успехом">
        <div>
          <label htmlFor="cfg-primary-goal" className={labelClass}>
            Главная цель бота
          </label>
          <textarea
            id="cfg-primary-goal"
            value={config.goal.primaryGoal}
            onChange={(e) => onChange({ ...config, goal: { ...config.goal, primaryGoal: e.target.value } })}
            placeholder="Например: выявить интерес к SIP-домам и собрать параметры для расчёта…"
            rows={4}
            className={`${fieldClass} resize-y min-h-[100px]`}
            maxLength={4000}
          />
        </div>
        <div>
          <span className={labelClass}>Что считается успешным результатом</span>
          <div className="grid sm:grid-cols-2 gap-2.5 pt-1">
            {CRM_AI_BOT_SUCCESS_CRITERIA_OPTIONS.map((o) => (
              <label
                key={o.value}
                className="flex items-start gap-2.5 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={config.goal.successCriteria.includes(o.value)}
                  onChange={() => toggleSuccess(o.value)}
                  className="mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="cfg-next-step" className={labelClass}>
            Следующий шаг после успеха
          </label>
          <select
            id="cfg-next-step"
            value={config.goal.nextStepOnSuccess}
            onChange={(e) =>
              onChange({ ...config, goal: { ...config.goal, nextStepOnSuccess: e.target.value } })
            }
            className={`${fieldClass} sm:max-w-md bg-white`}
          >
            {CRM_AI_BOT_NEXT_STEP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </SectionCard>

      <SectionCard
        title="C. Что бот должен собирать"
        subtitle="Поля, которые бот будет стараться выяснить в диалоге (конфиг для будущего заполнения CRM)"
      >
        <div className="grid sm:grid-cols-2 gap-2.5">
          {CRM_AI_BOT_COLLECT_FIELD_OPTIONS.map((o) => (
            <label
              key={o.value}
              className="flex items-start gap-2.5 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={config.collectFields.builtIn.includes(o.value)}
                onChange={() => toggleCollect(o.value)}
                className="mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
        <div>
          <label htmlFor="cfg-custom-fields" className={labelClass}>
            Свои поля
          </label>
          <textarea
            id="cfg-custom-fields"
            value={config.collectFields.customFieldsText}
            onChange={(e) =>
              onChange({
                ...config,
                collectFields: { ...config.collectFields, customFieldsText: e.target.value }
              })
            }
            placeholder="Дополнительные поля через запятую или свободным текстом"
            rows={2}
            className={`${fieldClass} resize-y min-h-[72px]`}
            maxLength={2000}
          />
        </div>
      </SectionCard>

      <SectionCard title="D. План диалога" subtitle="Старт и этапы; порядок меняется кнопками вверх / вниз">
        <div>
          <label htmlFor="cfg-opening" className={labelClass}>
            Стартовое сообщение / заход
          </label>
          <textarea
            id="cfg-opening"
            value={config.dialogPlan.openingMessage}
            onChange={(e) =>
              onChange({
                ...config,
                dialogPlan: { ...config.dialogPlan, openingMessage: e.target.value }
              })
            }
            placeholder="Здравствуйте! Подскажите, вы рассматриваете строительство дома для себя?"
            rows={3}
            className={`${fieldClass} resize-y min-h-[88px]`}
            maxLength={4000}
          />
        </div>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-sm font-medium text-gray-800">Основные этапы диалога</span>
            <button
              type="button"
              onClick={addStep}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-2 text-sm font-medium hover:bg-emerald-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Добавить этап
            </button>
          </div>
          {config.dialogPlan.steps.length === 0 ? (
            <p className="text-sm text-gray-500 rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center">
              Пока нет этапов. Нажмите «Добавить этап», чтобы описать воронку шаг за шагом.
            </p>
          ) : (
            <ul className="space-y-4">
              {config.dialogPlan.steps.map((step, index) => (
                <li
                  key={step.id}
                  className="rounded-2xl border border-gray-200 bg-gray-50/50 p-4 md:p-5 space-y-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Этап {index + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveStep(index, -1)}
                        disabled={index === 0}
                        className="p-2 rounded-lg text-gray-600 hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-40 disabled:pointer-events-none"
                        aria-label="Выше"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStep(index, 1)}
                        disabled={index === config.dialogPlan.steps.length - 1}
                        className="p-2 rounded-lg text-gray-600 hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-40 disabled:pointer-events-none"
                        aria-label="Ниже"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStep(index)}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100"
                        aria-label="Удалить этап"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={`${labelClass} text-xs`}>Название этапа</label>
                    <input
                      type="text"
                      value={step.title}
                      onChange={(e) => patchStep(index, { title: e.target.value })}
                      placeholder="Например: Уточнить город и площадь"
                      className={fieldClass}
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <label className={`${labelClass} text-xs`}>Цель этапа</label>
                    <textarea
                      value={step.objective}
                      onChange={(e) => patchStep(index, { objective: e.target.value })}
                      rows={2}
                      className={`${fieldClass} resize-y min-h-[64px]`}
                      maxLength={2000}
                    />
                  </div>
                  <div>
                    <label className={`${labelClass} text-xs`}>Что нужно выяснить</label>
                    <textarea
                      value={step.collectWhat}
                      onChange={(e) => patchStep(index, { collectWhat: e.target.value })}
                      rows={2}
                      className={`${fieldClass} resize-y min-h-[64px]`}
                      maxLength={2000}
                    />
                  </div>
                  <div>
                    <label className={`${labelClass} text-xs`}>Пример вопроса</label>
                    <input
                      type="text"
                      value={step.exampleQuestion}
                      onChange={(e) => patchStep(index, { exampleQuestion: e.target.value })}
                      placeholder="Какой примерный метраж дома вы рассматриваете?"
                      className={fieldClass}
                      maxLength={500}
                    />
                  </div>
                  <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={step.skipIfAlreadyKnown}
                      onChange={(e) => patchStep(index, { skipIfAlreadyKnown: e.target.checked })}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Если клиент уже ответил — не спрашивать повторно
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      <SectionCard title="E. Правила и ограничения" subtitle="Обязательное поведение, запреты и стандарты компании">
        <div>
          <label htmlFor="cfg-must" className={labelClass}>
            Что бот обязан делать
          </label>
          <textarea
            id="cfg-must"
            value={config.rules.mustDo}
            onChange={(e) => onChange({ ...config, rules: { ...config.rules, mustDo: e.target.value } })}
            placeholder="Отвечать коротко, не повторять вопросы, если город уже назван…"
            rows={4}
            className={`${fieldClass} resize-y min-h-[100px]`}
            maxLength={8000}
          />
        </div>
        <div>
          <label htmlFor="cfg-forbidden" className={labelClass}>
            Что боту запрещено
          </label>
          <textarea
            id="cfg-forbidden"
            value={config.rules.forbidden}
            onChange={(e) => onChange({ ...config, rules: { ...config.rules, forbidden: e.target.value } })}
            placeholder="Не выдумывать цены, не обещать лишнего…"
            rows={4}
            className={`${fieldClass} resize-y min-h-[100px]`}
            maxLength={8000}
          />
        </div>
        <div>
          <label htmlFor="cfg-standards" className={labelClass}>
            Базовые стандарты компании
          </label>
          <textarea
            id="cfg-standards"
            value={config.rules.companyStandards}
            onChange={(e) =>
              onChange({ ...config, rules: { ...config.rules, companyStandards: e.target.value } })
            }
            placeholder="Стандартная кровля, продукт SIP, как отвечать на нестандарт…"
            rows={4}
            className={`${fieldClass} resize-y min-h-[100px]`}
            maxLength={8000}
          />
        </div>
      </SectionCard>

      <SectionCard title="F. База знаний и источники" subtitle="Пока только флаги и текст — интеграции подключим позже">
        <label className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 text-sm text-gray-800 cursor-pointer">
          <input
            type="checkbox"
            checked={config.knowledge.useCompanyKnowledgeBase}
            onChange={(e) =>
              onChange({
                ...config,
                knowledge: { ...config.knowledge, useCompanyKnowledgeBase: e.target.checked }
              })
            }
            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          Использовать AI Базу знаний компании
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 text-sm text-gray-800 cursor-pointer">
          <input
            type="checkbox"
            checked={config.knowledge.useQuickReplies}
            onChange={(e) =>
              onChange({
                ...config,
                knowledge: { ...config.knowledge, useQuickReplies: e.target.checked }
              })
            }
            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          Использовать быстрые ответы
        </label>
        <div>
          <label htmlFor="cfg-extra-knowledge" className={labelClass}>
            Дополнительные инструкции / локальная база этого бота
          </label>
          <textarea
            id="cfg-extra-knowledge"
            value={config.knowledge.extraInstructions}
            onChange={(e) =>
              onChange({
                ...config,
                knowledge: { ...config.knowledge, extraInstructions: e.target.value }
              })
            }
            rows={4}
            className={`${fieldClass} resize-y min-h-[100px]`}
            maxLength={8000}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="H. Стиль ответов AI"
        subtitle="Естественность речи, длина и разбиение на 1–2 сообщения в WhatsApp (автоворонка)"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="cfg-humanization" className={labelClass}>
              Уровень человечности
            </label>
            <select
              id="cfg-humanization"
              value={config.replyStyle.humanizationLevel}
              onChange={(e) =>
                patchReplyStyle({ humanizationLevel: e.target.value as CrmAiHumanizationLevel })
              }
              className={fieldClass}
            >
              <option value="low">Ниже — деловее и короче</option>
              <option value="medium">Средний (по умолчанию)</option>
              <option value="high">Выше — живее, без фамильярности</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Влияет на «температуру» модели и формулировки: low — сдержаннее, high — естественнее.
            </p>
          </div>
          <div>
            <label htmlFor="cfg-reply-length" className={labelClass}>
              Длина ответов
            </label>
            <select
              id="cfg-reply-length"
              value={config.replyStyle.replyLengthMode}
              onChange={(e) =>
                patchReplyStyle({ replyLengthMode: e.target.value as CrmAiReplyLengthMode })
              }
              className={fieldClass}
            >
              <option value="short">Короче в среднем</option>
              <option value="adaptive">По ситуации (рекомендуется)</option>
              <option value="detailed">Подробнее, без простыней</option>
            </select>
          </div>
          <div>
            <label htmlFor="cfg-split-mode" className={labelClass}>
              Разбиение на сообщения
            </label>
            <select
              id="cfg-split-mode"
              value={config.replyStyle.replySplitMode}
              onChange={(e) =>
                patchReplyStyle({ replySplitMode: e.target.value as CrmAiReplySplitMode })
              }
              className={fieldClass}
            >
              <option value="single">Всегда одно сообщение</option>
              <option value="auto">Авто: 1 или 2, если естественно</option>
              <option value="prefer_multi">Чаще 2 коротких при длинном ответе</option>
            </select>
          </div>
          <div>
            <label htmlFor="cfg-max-parts" className={labelClass}>
              Максимум частей ответа
            </label>
            <select
              id="cfg-max-parts"
              value={String(config.replyStyle.maxReplyParts)}
              onChange={(e) => patchReplyStyle({ maxReplyParts: Number(e.target.value) as 1 | 2 })}
              className={fieldClass}
            >
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Не более двух подряд в одном ответе бота.</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="cfg-delay-min" className={labelClass}>
              Мин. пауза между частями (мс)
            </label>
            <input
              id="cfg-delay-min"
              type="number"
              min={200}
              max={60000}
              value={config.replyStyle.interReplyDelayMinMs}
              onChange={(e) => patchReplyStyle({ interReplyDelayMinMs: Number(e.target.value) || 800 })}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="cfg-delay-max" className={labelClass}>
              Макс. пауза между частями (мс)
            </label>
            <input
              id="cfg-delay-max"
              type="number"
              min={200}
              max={60000}
              value={config.replyStyle.interReplyDelayMaxMs}
              onChange={(e) => patchReplyStyle({ interReplyDelayMaxMs: Number(e.target.value) || 2500 })}
              className={fieldClass}
            />
            <p className="text-xs text-gray-500 mt-1">Случайная задержка между 1-й и 2-й частью в WhatsApp.</p>
          </div>
          <div>
            <label htmlFor="cfg-agg-min" className={labelClass}>
              Мин. ожидание серии от клиента (мс)
            </label>
            <input
              id="cfg-agg-min"
              type="number"
              min={500}
              max={30000}
              value={config.replyStyle.clientAggregationMinMs}
              onChange={(e) =>
                patchReplyStyle({ clientAggregationMinMs: Number(e.target.value) || 2000 })
              }
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="cfg-agg-max" className={labelClass}>
              Макс. ожидание серии от клиента (мс)
            </label>
            <input
              id="cfg-agg-max"
              type="number"
              min={500}
              max={30000}
              value={config.replyStyle.clientAggregationMaxMs}
              onChange={(e) =>
                patchReplyStyle({ clientAggregationMaxMs: Number(e.target.value) || 4000 })
              }
              className={fieldClass}
            />
            <p className="text-xs text-gray-500 mt-1">
              После последнего входящего бот подождёт случайный интервал в этом диапазоне (кроме голосовых —
              там дольше, пока не будет расшифровки).
            </p>
          </div>
        </div>
        <div className="grid sm:grid-cols-1 gap-2">
          <label className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 text-sm text-gray-800 cursor-pointer">
            <input
              type="checkbox"
              checked={config.replyStyle.allowShortLeadIn}
              onChange={(e) => patchReplyStyle({ allowShortLeadIn: e.target.checked })}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            Короткие вводные («Да, можем», «Понял вас») — если уместно
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 text-sm text-gray-800 cursor-pointer">
            <input
              type="checkbox"
              checked={config.replyStyle.varySentenceLength}
              onChange={(e) => patchReplyStyle({ varySentenceLength: e.target.checked })}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            Варьировать длину фраз
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 text-sm text-gray-800 cursor-pointer">
            <input
              type="checkbox"
              checked={config.replyStyle.avoidTemplateRepetition}
              onChange={(e) => patchReplyStyle({ avoidTemplateRepetition: e.target.checked })}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            Избегать повторов и шаблонных CTA подряд
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 text-sm text-gray-800 cursor-pointer">
            <input
              type="checkbox"
              checked={config.replyStyle.allowSoftConversationalBridges}
              onChange={(e) => patchReplyStyle({ allowSoftConversationalBridges: e.target.checked })}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            Мягкие разговорные связки (без канцелярита)
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="G. CRM-действия"
        subtitle="Только конфигурация будущей автоматики — выполнение на следующих этапах"
      >
        <div className="grid sm:grid-cols-1 gap-2">
          {(
            [
              ['autofillClientCard', 'Автозаполнять карточку клиента'],
              ['autofillExtractedFields', 'Автозаполнять извлечённые поля'],
              ['autoDetectCity', 'Автоматически определять город'],
              ['autoQualifyLead', 'Автоматически отмечать квалификацию лида'],
              ['suggestCreateDeal', 'Рекомендовать создание сделки'],
              ['saveConversationSummary', 'Сохранять краткую сводку разговора'],
              ['saveNextStep', 'Сохранять следующий шаг']
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 text-sm text-gray-800 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={config.crmActions[key]}
                onChange={(e) =>
                  onChange({
                    ...config,
                    crmActions: { ...config.crmActions, [key]: e.target.checked }
                  })
                }
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              {label}
            </label>
          ))}
        </div>
      </SectionCard>
    </div>
  );
};
