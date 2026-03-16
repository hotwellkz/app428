import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Plug, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

const API_INTEGRATION = '/.netlify/functions/wazzup-integration';
const API_VERIFY = '/.netlify/functions/wazzup-verify';

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

  const fetchIntegration = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
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
        setForm((f) => ({
          ...f,
          whatsappChannelId: data.whatsappChannelId ?? '',
          instagramChannelId: data.instagramChannelId ?? ''
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegration();
  }, [user?.uid]);

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
      const token = await user.getIdToken();
      const res = await fetch(API_VERIFY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ apiKey })
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess('Подключение успешно. Ключ действителен.');
      } else {
        setError(data.error || 'Проверка не пройдена');
      }
    } catch (e) {
      setError('Не удалось проверить подключение');
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
      const token = await user.getIdToken();
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
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
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
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-800">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>Интеграция настроена</span>
                  {state.apiKeyMasked && (
                    <span className="text-emerald-600">(ключ …{state.apiKeyMasked})</span>
                  )}
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
                  placeholder="Опционально — подставится из первого входящего сообщения"
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
                  placeholder="Опционально — подставится из первого входящего сообщения"
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
                <strong>ID канала WhatsApp / Instagram:</strong> можно не заполнять — при первом входящем сообщении
                CRM сохранит канал автоматически. Если у вас несколько каналов и вы хотите указать их заранее,
                найдите ID канала в настройках канала в Wazzup.
              </p>
              <p>
                После сохранения укажите в Wazzup URL вебхука вашего CRM (вам подскажет поддержка или документация
                деплоя). Тогда входящие сообщения начнут поступать в раздел Чаты.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
