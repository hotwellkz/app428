import React, { useCallback, useMemo, useState } from 'react';
import {
  Bot,
  ClipboardCopy,
  Database,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Trash2,
  Wand2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthToken } from '../../lib/firebase/auth';
import {
  buildCrmAiBotLogicPreview,
  buildCrmAiBotSystemPrompt,
  type CrmAiBotPromptMeta
} from '../../lib/ai/crmAiBotPrompt';
import type { CrmAiBotConfig } from '../../types/crmAiBotConfig';
import type { CrmAiBotExtractionResult } from '../../types/crmAiBotExtraction';
import { useAIConfigured } from '../../hooks/useAIConfigured';
import { API_CONFIG } from '../../config/api';
import { extractionHasApplicableData } from '../../lib/autovoronki/extractionCrmMapper';
import { ApplyExtractionToClientModal } from './ApplyExtractionToClientModal';

/**
 * Дефолт: /.netlify/functions/crm-ai-bot-test (как WhatsApp и др.) — тот же прокси на 2wix.ru.
 * Путь /api/crm-ai-bot-test — только redirect на Netlify (netlify.toml), без прокси часто 404.
 * При кросс-домене задайте: VITE_CRM_AI_BOT_TEST_URL=https://….netlify.app/.netlify/functions/crm-ai-bot-test
 */
const API_URL =
  (typeof import.meta.env.VITE_CRM_AI_BOT_TEST_URL === 'string' &&
    import.meta.env.VITE_CRM_AI_BOT_TEST_URL.trim()) ||
  `${API_CONFIG.BASE_URL}/crm-ai-bot-test`;

function makeId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export interface TestChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface KnowledgeMetaResponse {
  companyKnowledgeBaseLoaded: boolean;
  quickRepliesLoaded: boolean;
  knowledgeArticlesUsed: number;
  quickRepliesUsed: number;
  truncated: boolean;
}

interface TestApiResponse {
  answer?: string;
  answerParts?: string[];
  replyMode?: string;
  extracted?: CrmAiBotExtractionResult | null;
  extractionError?: string;
  knowledgeMeta?: KnowledgeMetaResponse;
  error?: string;
}

interface AutovoronkiBotTestingPanelProps {
  botId: string;
  botMeta: CrmAiBotPromptMeta;
  config: CrmAiBotConfig;
}

function Field({
  label,
  value
}: {
  label: string;
  value: string | boolean | null | undefined;
}) {
  const display =
    value === null || value === undefined || value === ''
      ? '—'
      : typeof value === 'boolean'
        ? value
          ? 'Да'
          : 'Нет'
        : String(value);
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-900 break-words">{display}</span>
    </div>
  );
}

function SubCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
      <h4 className="text-xs font-semibold text-gray-800">{title}</h4>
      {children}
    </div>
  );
}

export const AutovoronkiBotTestingPanel: React.FC<AutovoronkiBotTestingPanelProps> = ({
  botId,
  botMeta,
  config
}) => {
  const { configured, loading: aiLoading } = useAIConfigured();
  const [promptNonce, setPromptNonce] = useState(0);
  const [messages, setMessages] = useState<TestChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [generating, setGenerating] = useState(false);
  const [extracted, setExtracted] = useState<CrmAiBotExtractionResult | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [lastKnowledgeMeta, setLastKnowledgeMeta] = useState<KnowledgeMetaResponse | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  /** Ключ текущего извлечения, к которому уже применили запись в этой сессии */
  const [appliedExtractionKey, setAppliedExtractionKey] = useState<string | null>(null);
  const [appliedClientLabel, setAppliedClientLabel] = useState<string | null>(null);

  const extractionStableKey = useMemo(() => (extracted ? JSON.stringify(extracted) : ''), [extracted]);

  const systemPrompt = useMemo(() => {
    void promptNonce;
    return buildCrmAiBotSystemPrompt(botMeta, config);
  }, [botMeta, config, promptNonce]);

  const previewCards = useMemo(() => buildCrmAiBotLogicPreview(botMeta, config), [botMeta, config]);

  const callApi = useCallback(
    async (history: TestChatMessage[]): Promise<TestApiResponse> => {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Нет авторизации');
      }
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          botId,
          botMeta,
          config,
          messages: history.map(({ role, content }) => ({ role, content }))
        })
      });
      const data = (await res.json().catch(() => ({}))) as TestApiResponse;
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Ошибка запроса');
      }
      const answer = typeof data.answer === 'string' ? data.answer.trim() : '';
      if (!answer) {
        throw new Error('Пустой ответ модели');
      }
      return data;
    },
    [botId, botMeta, config]
  );

  const handleRefreshPrompt = () => {
    setPromptNonce((n) => n + 1);
    toast.success('Промпт пересобран из текущих настроек');
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(systemPrompt);
      toast.success('Промпт скопирован');
    } catch {
      toast.error('Не удалось скопировать');
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setExtracted(null);
    setExtractionError(null);
    setLastKnowledgeMeta(null);
    setAppliedExtractionKey(null);
    setAppliedClientLabel(null);
    toast.success('Тестовый диалог очищен');
  };

  const applyApiResult = (data: TestApiResponse) => {
    setLastKnowledgeMeta(data.knowledgeMeta ?? null);
    if (data.extracted) {
      setExtracted(data.extracted);
      setExtractionError(null);
    } else if (data.extractionError) {
      setExtractionError(data.extractionError);
    }
  };

  const assistantMessagesFromResponse = (data: TestApiResponse): TestChatMessage[] => {
    const parts =
      Array.isArray(data.answerParts) && data.answerParts.length > 0
        ? data.answerParts.map((p) => String(p).trim()).filter(Boolean)
        : [];
    const single = typeof data.answer === 'string' ? data.answer.trim() : '';
    const list = parts.length ? parts : single ? [single] : [];
    return list.map((content) => ({ id: makeId(), role: 'assistant' as const, content }));
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || generating) return;
    if (configured === false) {
      toast.error('Подключите OpenAI в разделе Интеграции');
      return;
    }
    const userMsg: TestChatMessage = { id: makeId(), role: 'user', content: text };
    const nextHistory = [...messages, userMsg];
    setDraft('');
    setMessages(nextHistory);
    setGenerating(true);
    try {
      const data = await callApi(nextHistory);
      setMessages([...nextHistory, ...assistantMessagesFromResponse(data)]);
      applyApiResult(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось получить ответ бота');
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateLast = async () => {
    if (generating) return;
    let base = [...messages];
    while (base.length && base[base.length - 1].role === 'assistant') {
      base.pop();
    }
    if (base.length === 0 || base[base.length - 1].role !== 'user') {
      toast.error('Нет сообщения клиента для перегенерации');
      return;
    }
    if (configured === false) {
      toast.error('Подключите OpenAI в разделе Интеграции');
      return;
    }
    setMessages(base);
    setGenerating(true);
    try {
      const data = await callApi(base);
      setMessages([...base, ...assistantMessagesFromResponse(data)]);
      applyApiResult(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось получить ответ бота');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyLastAnswer = async () => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        try {
          await navigator.clipboard.writeText(messages[i].content);
          toast.success('Ответ скопирован');
        } catch {
          toast.error('Не удалось скопировать');
        }
        return;
      }
    }
    toast.error('Нет ответа бота');
  };

  const langLabel =
    extracted?.detectedLanguage === 'ru'
      ? 'Русский'
      : extracted?.detectedLanguage === 'kz'
        ? 'Казахский'
        : extracted?.detectedLanguage === 'unknown'
          ? 'Не определён'
          : '—';

  return (
    <div className="rounded-2xl border-2 border-violet-100/90 bg-gradient-to-b from-white to-violet-50/20 p-5 md:p-7 shadow-sm space-y-8">
      <div>
        <h2 className="text-lg md:text-xl font-semibold text-gray-900 flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-violet-600" />
          Тестирование и промпт
        </h2>
        <p className="text-sm text-gray-500 mt-1 max-w-3xl">
          Песочница: ответы не уходят в WhatsApp. Запись в CRM только вручную через «Применить в карточку клиента»
          (с предпросмотром). Нужен API-ключ OpenAI в <span className="font-medium text-gray-700">Интеграциях</span>.
        </p>
        {!aiLoading && configured === false && (
          <p className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            OpenAI для компании не настроен — тест-чат не сможет вызвать модель.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-lg bg-white border border-gray-200 px-2.5 py-1.5 text-gray-600">
            <Database className="w-3.5 h-3.5 text-violet-500" />
            База знаний:{' '}
            <strong className="text-gray-800">{config.knowledge.useCompanyKnowledgeBase ? 'включена' : 'выкл.'}</strong>
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-white border border-gray-200 px-2.5 py-1.5 text-gray-600">
            Быстрые ответы:{' '}
            <strong className="text-gray-800">{config.knowledge.useQuickReplies ? 'включены' : 'выкл.'}</strong>
          </span>
          {lastKnowledgeMeta && (config.knowledge.useCompanyKnowledgeBase || config.knowledge.useQuickReplies) && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-violet-50 border border-violet-100 px-2.5 py-1.5 text-violet-900">
              Последний запрос: статьи {lastKnowledgeMeta.knowledgeArticlesUsed}, шаблоны{' '}
              {lastKnowledgeMeta.quickRepliesUsed}
              {lastKnowledgeMeta.truncated ? ' · контекст усечён' : ''}
            </span>
          )}
        </div>
      </div>

      {/* A. Предпросмотр логики */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">A. Предпросмотр логики</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {previewCards.map((card) => (
            <div
              key={card.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-2 min-h-[120px]"
            >
              <p className="text-xs font-semibold text-violet-700">{card.title}</p>
              <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
                {card.lines.map((line, i) => (
                  <li key={i} className="leading-snug">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* B. System prompt */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">B. Собранный system prompt</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRefreshPrompt}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Обновить prompt
            </button>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <ClipboardCopy className="w-3.5 h-3.5" />
              Скопировать
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Здесь базовый текст без блока компании. При включённых флагах знаний сервер добавляет к промпту фрагменты базы
          и быстрых ответов (с лимитом объёма) — это видно по ответам бота и счётчику «Последний запрос».
        </p>
        <textarea
          readOnly
          value={systemPrompt}
          className="w-full min-h-[220px] max-h-[480px] rounded-xl border border-gray-300 bg-gray-900/95 text-gray-100 font-mono text-xs leading-relaxed px-3 py-3 resize-y focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
          spellCheck={false}
        />
      </section>

      {/* C. Тест-чат */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide flex items-center gap-2">
            <Bot className="w-4 h-4 text-violet-600" />
            Тест-чат
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleClearChat}
              disabled={generating || messages.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Очистить диалог
            </button>
            <button
              type="button"
              onClick={handleRegenerateLast}
              disabled={generating || messages.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Перегенерировать ответ
            </button>
            <button
              type="button"
              onClick={handleCopyLastAnswer}
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              <ClipboardCopy className="w-3.5 h-3.5" />
              Копировать последний ответ
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white min-h-[200px] max-h-[360px] overflow-y-auto p-3 space-y-3">
          {messages.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">
              Напишите реплику клиента ниже и нажмите «Отправить в тест».
            </p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                    m.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-900 border border-gray-200 rounded-bl-md'
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wide opacity-80 block mb-1">
                    {m.role === 'user' ? 'Клиент' : 'Бот'}
                  </span>
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                </div>
              </div>
            ))
          )}
          {generating && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-2xl bg-violet-50 border border-violet-100 px-4 py-2.5 text-sm text-violet-800">
                <Loader2 className="w-4 h-4 animate-spin" />
                Генерация ответа и извлечения…
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="test-chat-input" className="text-sm font-medium text-gray-700">
            Сообщение клиента
          </label>
          <textarea
            id="test-chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Например: Здравствуйте, хочу дом 120 м² в Алматы"
            rows={3}
            disabled={generating}
            className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none resize-y disabled:opacity-60"
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs text-gray-400">Ctrl+Enter / ⌘+Enter — отправить</p>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={generating || !draft.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:pointer-events-none"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Отправка…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Отправить в тест
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* D. Извлечение */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
              D. Что бот извлёк из диалога
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">
              Отдельный проход модели: факты из переписки. В CRM попадают только после выбора клиента и подтверждения.
            </p>
            {extracted &&
              appliedExtractionKey &&
              appliedExtractionKey === extractionStableKey &&
              appliedClientLabel && (
                <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mt-2 inline-block">
                  В этой сессии уже применено к: <strong>{appliedClientLabel}</strong>
                </p>
              )}
          </div>
          <button
            type="button"
            disabled={!extracted || !extractionHasApplicableData(extracted)}
            onClick={() => setApplyModalOpen(true)}
            className="shrink-0 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-40 disabled:pointer-events-none disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
            title={
              !extracted
                ? 'Сначала получите извлечение из диалога'
                : !extractionHasApplicableData(extracted)
                  ? 'Нет данных для записи в CRM'
                  : 'Выбрать клиента и записать'
            }
          >
            Применить в карточку клиента
          </button>
        </div>

        {extracted && (
          <ApplyExtractionToClientModal
            open={applyModalOpen}
            onClose={() => setApplyModalOpen(false)}
            extraction={extracted}
            onApplied={({ displayName, extractionKey }) => {
              setAppliedExtractionKey(extractionKey);
              setAppliedClientLabel(displayName);
            }}
          />
        )}

        {!extracted && !extractionError && messages.length === 0 && (
          <p className="text-sm text-gray-400 rounded-xl border border-dashed border-gray-200 bg-white/80 px-4 py-6 text-center">
            Отправьте сообщение в тест-чат — здесь появится структура данных.
          </p>
        )}

        {extractionError && !extracted && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm px-4 py-3">
            {extractionError}
          </div>
        )}

        {extractionError && extracted && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs px-3 py-2">
            Последний ответ получен, но извлечение не обновилось: {extractionError}
          </div>
        )}

        {extracted && (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <SubCard title="1. Основное">
                <div className="grid grid-cols-1 gap-3">
                  <Field label="Имя" value={extracted.clientName} />
                  <Field label="Город" value={extracted.city} />
                  <Field label="Площадь" value={extracted.areaM2} />
                  <Field label="Этажность" value={extracted.floors} />
                  <Field label="Тип / назначение" value={extracted.projectType} />
                  <Field label="Формат дома" value={extracted.houseFormat} />
                  <Field label="Стены" value={extracted.wallType} />
                  <Field label="Кровля" value={extracted.roofType} />
                  <Field label="Высота потолков" value={extracted.ceilingHeight} />
                </div>
              </SubCard>
              <SubCard title="2. Запрос клиента">
                <div className="grid grid-cols-1 gap-3">
                  <Field label="Интерес / уровень" value={extracted.interestLevel} />
                  <Field label="Бюджет" value={extracted.budget} />
                  <Field label="Сроки" value={extracted.timeline} />
                  <Field label="Финансирование" value={extracted.financing} />
                  <Field label="Участок / земля" value={extracted.landStatus} />
                  <Field label="Предпочтительный контакт" value={extracted.preferredContactMode} />
                  <Field label="Хочет КП" value={extracted.wantsCommercialOffer} />
                  <Field label="Нужна консультация" value={extracted.wantsConsultation} />
                  <Field label="Свой проект" value={extracted.hasOwnProject} />
                </div>
              </SubCard>
              <SubCard title="3. Следующее действие">
                <div className="grid grid-cols-1 gap-3">
                  <Field label="Следующий шаг" value={extracted.nextStep} />
                  <Field label="Температура лида" value={extracted.leadTemperature} />
                  <Field label="Язык диалога" value={langLabel} />
                </div>
              </SubCard>
            </div>

            <SubCard title="4. Комментарий для CRM">
              <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                {extracted.summaryComment ?? '—'}
              </p>
            </SubCard>

            <SubCard title="5. Чего не хватает">
              {extracted.missingFields.length ? (
                <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                  {extracted.missingFields.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">Список пуст (или модель не указала пробелы).</p>
              )}
            </SubCard>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <button
                type="button"
                onClick={() => setShowRawJson((v) => !v)}
                className="text-xs font-medium text-violet-700 hover:underline"
              >
                {showRawJson ? 'Скрыть сырой JSON' : 'Показать сырой JSON'}
              </button>
              {showRawJson && (
                <pre className="mt-2 text-[11px] font-mono text-gray-700 overflow-x-auto max-h-64 overflow-y-auto p-2 bg-white rounded-lg border border-gray-200">
                  {JSON.stringify(extracted, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
