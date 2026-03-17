import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getAuthToken } from '../lib/firebase/auth';
import { Plug, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react';

const API_INTEGRATION = '/.netlify/functions/wazzup-integration';
const API_VERIFY = '/.netlify/functions/wazzup-verify';
const API_OPENAI_INTEGRATION = '/.netlify/functions/openai-integration';

const looksLikeEmail = (s: string) => /@/.test(s.trim());

interface IntegrationState {
  configured: boolean;
  apiKeyMasked: string | null;
  whatsappChannelId: string | null;
  instagramChannelId: string | null;
  connectionStatus: string | null;
  connectionError: string | null;
  lastCheckedAt: string | null;
}

export const IntegrationsSettings: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const [state, setState] = useState<IntegrationState>({
    configured: false,
    apiKeyMasked: null,
    whatsappChannelId: null,
    instagramChannelId: null,
    connectionStatus: null,
    connectionError: null,
    lastCheckedAt: null
  });

  const [form, setForm] = useState({
    apiKey: '',
    whatsappChannelId: '',
    instagramChannelId: ''
  });

  const [aiState, setAiState] = useState<{ configured: boolean; apiKeyMasked: string | null }>({
    configured: false,
    apiKeyMasked: null
  });
  const [aiFormKey, setAiFormKey] = useState('');
  const [aiLoading, setAiLoading] = useState(true);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState<string | null>(null);

  const fetchIntegration = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setError('Ошибка авторизации. Обновите страницу и повторите попытку.');
        return;
      }
      const res = await fetch(API_INTEGRATION, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
      setState({
        configured: data.configured ?? false,
        apiKeyMasked: data.apiKeyMasked ?? null,
        whatsappChannelId: data.whatsappChannelId ?? null,
        instagramChannelId: data.instagramChannelId ?? null,
        connectionStatus: data.connectionStatus ?? null,
        connectionError: data.connectionError ?? null,
        lastCheckedAt: data.lastCheckedAt ?? null
      });
      if (data.configured && !form.apiKey) {
        const wa = data.whatsappChannelId ?? '';
        const ig = data.instagramChannelId ?? '';
        setForm((f) => ({
          ...f,
          whatsappChannelId: typeof wa === 'string' && !looksLikeEmail(wa) ? wa : '',
          instagramChannelId: typeof ig === 'string' && !looksLikeEmail(ig) ? ig : ''
        }));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Не удалось загрузить настройки';
      setError(msg);
      if (import.meta.env.DEV) console.warn('[IntegrationsSettings] fetchIntegration', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAIIntegration = async () => {
    if (!user) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch(API_OPENAI_INTEGRATION, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiState({ configured: false, apiKeyMasked: null });
        return;
      }
      setAiState({
        configured: data.configured ?? false,
        apiKeyMasked: data.apiKeyMasked ?? null
      });
    } catch {
      setAiState({ configured: false, apiKeyMasked: null });
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegration();
  }, [user?.uid]);

  useEffect(() => {
    fetchAIIntegration();
  }, [user?.uid]);

  const handleSaveAI = async () => {
    const apiKey = aiFormKey.trim();
    if (!apiKey || !user) {
      setAiError('Введите API ключ OpenAI');
      return;
    }
    setAiSaving(true);
    setAiError(null);
    setAiSuccess(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setAiError('Ошибка авторизации. Обновите страницу и повторите попытку.');
        setAiSaving(false);
        return;
      }
      const res = await fetch(API_OPENAI_INTEGRATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ apiKey })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data?.error as string) || 'Ошибка сохранения');
      setAiSuccess(data.message || 'API ключ сохранён. AI-функции доступны.');
      setAiFormKey('');
      fetchAIIntegration();
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Не удалось сохранить ключ.');
    } finally {
      setAiSaving(false);
    }
  };

  const handleVerify = async () => {
    const apiKey = form.apiKey.trim();
    if (!apiKey || !user) {
      setError('Введите API ключ');
      return;
    }
    setVerifying(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setError('Ошибка авторизации. Обновите страницу и повторите попытку.');
        return;
      }
      const res = await fetch(API_VERIFY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ apiKey })
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess('Подключение успешно. Ключ действителен.');
        setForm((f) => ({
          ...f,
          ...(data.whatsappChannelId && typeof data.whatsappChannelId === 'string' && !looksLikeEmail(data.whatsappChannelId)
            ? { whatsappChannelId: data.whatsappChannelId }
            : {}),
          ...(data.instagramChannelId && typeof data.instagramChannelId === 'string' && !looksLikeEmail(data.instagramChannelId)
            ? { instagramChannelId: data.instagramChannelId }
            : {})
        }));
      } else {
        setError(data.error || 'Проверка не пройдена');
      }
    } catch (e) {
      setError('Не удалось проверить подключение. Проверьте ключ и соединение.');
      if (import.meta.env.DEV) console.warn('[IntegrationsSettings] handleVerify', e);
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async () => {
    const apiKey = form.apiKey.trim();
    if (!apiKey || !user) {
      setError('Введите API ключ');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setError('Ошибка авторизации. Обновите страницу и повторите попытку.');
        setSaving(false);
        return;
      }
      const res = await fetch(API_INTEGRATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          apiKey,
          whatsappChannelId: form.whatsappChannelId.trim() || null,
          instagramChannelId: form.instagramChannelId.trim() || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сохранения');
      setSuccess(data.message || 'Настройки сохранены.');
      setForm((f) => ({ ...f, apiKey: '' }));
      fetchIntegration();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Не удалось сохранить интеграцию. Попробуйте ещё раз.';
      setError(msg);
      if (import.meta.env.DEV) console.warn('[IntegrationsSettings] handleSave', e);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="p-6 max-w-2xl">
        <p className="text-gray-500">Войдите в аккаунт, чтобы настроить интеграции.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
        <Plug className="w-6 h-6 text-emerald-600" />
        Интеграции
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Подключите каналы WhatsApp и Instagram через Wazzup, чтобы получать переписки в CRM.
      </p>

      {/* Блок Wazzup */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-800">Wazzup — WhatsApp / Instagram</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Один раз настройте подключение — переписки начнут поступать в раздел WhatsApp CRM.
          </p>
        </div>
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Загрузка…
            </div>
          ) : (
            <>
              {state.configured && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-800">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>Ключ сохранён</span>
                    {state.apiKeyMasked && (
                      <span className="text-emerald-600">(…{state.apiKeyMasked})</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span className={state.whatsappChannelId ? 'text-emerald-700' : 'text-amber-700'}>
                      WhatsApp: {state.whatsappChannelId ? 'подключён' : 'канал не найден — укажите ID вручную или дождитесь первого входящего'}
                    </span>
                    <span className={state.instagramChannelId ? 'text-emerald-700' : 'text-amber-700'}>
                      Instagram: {state.instagramChannelId ? 'подключён' : 'канал не найден — укажите ID вручную или дождитесь первого входящего'}
                    </span>
                  </div>
                </div>
              )}
              {(looksLikeEmail(form.whatsappChannelId) || looksLikeEmail(form.instagramChannelId)) && (
                <div className="flex gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    В поле ID канала указан email. Нужен идентификатор канала из ЛК Wazzup (не email).
                    Оставьте поле пустым — канал привяжется при первом входящем сообщении.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API ключ Wazzup <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                  placeholder="Вставьте ключ из личного кабинета Wazzup"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID канала WhatsApp
                </label>
                <input
                  type="text"
                  value={form.whatsappChannelId}
                  onChange={(e) => setForm((f) => ({ ...f, whatsappChannelId: e.target.value }))}
                  placeholder="ID канала из ЛК Wazzup (не email). Можно оставить пустым"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID канала Instagram
                </label>
                <input
                  type="text"
                  value={form.instagramChannelId}
                  onChange={(e) => setForm((f) => ({ ...f, instagramChannelId: e.target.value }))}
                  placeholder="ID канала из ЛК Wazzup (не email). Можно оставить пустым"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-700">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  {success}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={verifying || !form.apiKey.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Проверить подключение
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !form.apiKey.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Сохранить
                </button>
              </div>
            </>
          )}
        </div>

        {/* Сворачиваемая подсказка */}
        <div className="border-t border-gray-100">
          <button
            type="button"
            onClick={() => setShowHelp((h) => !h)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-600 hover:bg-gray-50"
          >
            <span>Где взять данные в Wazzup?</span>
            {showHelp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showHelp && (
            <div className="px-4 pb-4 pt-0 text-sm text-gray-600 space-y-2 border-t border-gray-50">
              <p>
                <strong>API ключ:</strong> зайдите в личный кабинет Wazzup24 → Настройки → API (или Интеграции).
                Скопируйте API ключ и вставьте в поле выше.
              </p>
              <p>
                <strong>ID канала WhatsApp / Instagram:</strong> это идентификатор канала из личного кабинета Wazzup
                (не email и не номер телефона). Можно оставить пустым — при первом входящем сообщении CRM привяжет
                канал автоматически (если компания одна). ID канала можно посмотреть в настройках канала в Wazzup.
              </p>
              <p>
                После сохранения укажите в Wazzup URL вебхука вашего CRM (вам подскажет поддержка или документация
                деплоя). Тогда входящие сообщения начнут поступать в раздел Чаты.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Блок OpenAI — AI-функции */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-600" />
            OpenAI — AI-функции
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Распознавание чеков, анализ переписок, смета vs факт и другие AI-функции работают только при сохранённом ключе компании. Общий ключ платформы не используется.
          </p>
        </div>
        <div className="p-4 space-y-4">
          {aiLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Загрузка…
            </div>
          ) : (
            <>
              {aiState.configured && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-800">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>Ключ сохранён</span>
                  {aiState.apiKeyMasked && (
                    <span className="text-emerald-600">({aiState.apiKeyMasked})</span>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API ключ OpenAI <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={aiFormKey}
                  onChange={(e) => setAiFormKey(e.target.value)}
                  placeholder="sk-... из личного кабинета OpenAI"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                />
              </div>
              {aiError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {aiError}
                </div>
              )}
              {aiSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-700">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  {aiSuccess}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSaveAI}
                  disabled={aiSaving || !aiFormKey.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {aiSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Сохранить ключ
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
