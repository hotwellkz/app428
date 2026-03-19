import React, { useCallback, useMemo, useState } from 'react';
import {
  Bot,
  ClipboardCopy,
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
import { useAIConfigured } from '../../hooks/useAIConfigured';

const API_URL = '/api/crm-ai-bot-test';

function makeId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export interface TestChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AutovoronkiBotTestingPanelProps {
  botId: string;
  botMeta: CrmAiBotPromptMeta;
  config: CrmAiBotConfig;
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

  const systemPrompt = useMemo(() => {
    void promptNonce;
    return buildCrmAiBotSystemPrompt(botMeta, config);
  }, [botMeta, config, promptNonce]);

  const previewCards = useMemo(() => buildCrmAiBotLogicPreview(botMeta, config), [botMeta, config]);

  const callApi = useCallback(
    async (history: TestChatMessage[]): Promise<string> => {
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
      const data = (await res.json().catch(() => ({}))) as { error?: string; answer?: string };
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Ошибка запроса');
      }
      const answer = typeof data.answer === 'string' ? data.answer.trim() : '';
      if (!answer) {
        throw new Error('Пустой ответ модели');
      }
      return answer;
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
    toast.success('Тестовый диалог очищен');
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
      const answer = await callApi(nextHistory);
      setMessages([...nextHistory, { id: makeId(), role: 'assistant', content: answer }]);
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
      const answer = await callApi(base);
      setMessages([...base, { id: makeId(), role: 'assistant', content: answer }]);
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

  return (
    <div className="rounded-2xl border-2 border-violet-100/90 bg-gradient-to-b from-white to-violet-50/20 p-5 md:p-7 shadow-sm space-y-8">
      <div>
        <h2 className="text-lg md:text-xl font-semibold text-gray-900 flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-violet-600" />
          Тестирование и промпт
        </h2>
        <p className="text-sm text-gray-500 mt-1 max-w-3xl">
          Песочница: ответы не уходят в WhatsApp и не пишутся в CRM. Нужен API-ключ OpenAI в{' '}
          <span className="font-medium text-gray-700">Интеграциях</span>.
        </p>
        {!aiLoading && configured === false && (
          <p className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            OpenAI для компании не настроен — тест-чат не сможет вызвать модель.
          </p>
        )}
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
                Генерация ответа…
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
    </div>
  );
};
