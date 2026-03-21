import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { getAuthToken } from '../../../lib/firebase/auth';
import { CheckCircle, AlertCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { API_WAZZUP_INTEGRATION, API_WAZZUP_VERIFY } from '../apiEndpoints';
import { IntegrationDetailLayout } from '../components/IntegrationDetailLayout';
import { IntegrationStatusBadge } from '../components/IntegrationStatusBadge';
import type { CatalogIntegrationStatus } from '../types';
import { getIntegrationById } from '../integrationRegistry';

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

function deriveStatus(s: IntegrationState): { status: CatalogIntegrationStatus; label: string } {
  if (!s.configured) return { status: 'not_connected', label: 'Не подключено' };
  if (s.connectionError) return { status: 'error', label: 'Ошибка' };
  return { status: 'connected', label: 'Подключено' };
}

export const WazzupIntegrationPanel: React.FC = () => {
  const { user } = useAuth();
  const meta = getIntegrationById('wazzup');
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

  const fetchIntegration = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setError('Ошибка авторизации. Обновите страницу и повторите попытку.');
        return;
      }
      const res = await fetch(API_WAZZUP_INTEGRATION, {
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
      setError(e instanceof Error ? e.message : 'Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void fetchIntegration();
  }, [fetchIntegration]);

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
      const res = await fetch(API_WAZZUP_VERIFY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ apiKey })
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess('Подключение успешно. Ключ действителен.');
        setForm((f) => ({
          ...f,
          ...(data.whatsappChannelId &&
          typeof data.whatsappChannelId === 'string' &&
          !looksLikeEmail(data.whatsappChannelId)
            ? { whatsappChannelId: data.whatsappChannelId }
            : {}),
          ...(data.instagramChannelId &&
          typeof data.instagramChannelId === 'string' &&
          !looksLikeEmail(data.instagramChannelId)
            ? { instagramChannelId: data.instagramChannelId }
            : {})
        }));
      } else {
        setError(data.error || 'Проверка не пройдена');
      }
    } catch {
      setError('Не удалось проверить подключение. Проверьте ключ и соединение.');
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
        return;
      }
      const res = await fetch(API_WAZZUP_INTEGRATION, {
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
      await fetchIntegration();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить интеграцию.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <IntegrationDetailLayout title={meta?.title ?? 'Wazzup'} description={meta?.shortDescription ?? ''}>
        <p className="text-gray-500">Войдите в аккаунт.</p>
      </IntegrationDetailLayout>
    );
  }

  const st = deriveStatus(state);

  return (
    <IntegrationDetailLayout
      title={meta?.title ?? 'Wazzup'}
      description={meta?.shortDescription ?? ''}
      meta={
        <div className="flex flex-wrap items-center gap-2">
          <IntegrationStatusBadge status={st.status} label={st.label} />
          {state.lastCheckedAt ? (
            <span className="text-xs text-gray-500">
              Проверка: {new Date(state.lastCheckedAt).toLocaleString('ru-RU')}
            </span>
          ) : null}
        </div>
      }
    >
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
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
                    {state.apiKeyMasked && <span className="text-emerald-600">(…{state.apiKeyMasked})</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span className={state.whatsappChannelId ? 'text-emerald-700' : 'text-amber-700'}>
                      WhatsApp:{' '}
                      {state.whatsappChannelId
                        ? 'подключён'
                        : 'канал не найден — укажите ID вручную или дождитесь первого входящего'}
                    </span>
                    <span className={state.instagramChannelId ? 'text-emerald-700' : 'text-amber-700'}>
                      Instagram:{' '}
                      {state.instagramChannelId
                        ? 'подключён'
                        : 'канал не найден — укажите ID вручную или дождитесь первого входящего'}
                    </span>
                  </div>
                </div>
              )}
              {(looksLikeEmail(form.whatsappChannelId) || looksLikeEmail(form.instagramChannelId)) && (
                <div className="flex gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    В поле ID канала указан email. Нужен идентификатор канала из ЛК Wazzup (не email). Оставьте поле
                    пустым — канал привяжется при первом входящем сообщении.
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
                <label className="block text-sm font-medium text-gray-700 mb-1">ID канала WhatsApp</label>
                <input
                  type="text"
                  value={form.whatsappChannelId}
                  onChange={(e) => setForm((f) => ({ ...f, whatsappChannelId: e.target.value }))}
                  placeholder="ID канала из ЛК Wazzup (не email). Можно оставить пустым"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID канала Instagram</label>
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
                  onClick={() => void handleVerify()}
                  disabled={verifying || !form.apiKey.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50"
                >
                  {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Проверить подключение
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving || !form.apiKey.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Сохранить
                </button>
              </div>
            </>
          )}
        </div>
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
                <strong>API ключ:</strong> личный кабинет Wazzup24 → Настройки → API (или Интеграции).
              </p>
              <p>
                <strong>ID канала:</strong> идентификатор канала из ЛК Wazzup (не email и не номер). Можно оставить
                пустым — при первом входящем CRM привяжет канал.
              </p>
              <p>После сохранения укажите в Wazzup URL вебхука вашего CRM (документация деплоя).</p>
            </div>
          )}
        </div>
      </div>
    </IntegrationDetailLayout>
  );
};
