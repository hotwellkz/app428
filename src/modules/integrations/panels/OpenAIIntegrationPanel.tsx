import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { getAuthToken } from '../../../lib/firebase/auth';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { API_OPENAI_INTEGRATION } from '../apiEndpoints';
import { IntegrationDetailLayout } from '../components/IntegrationDetailLayout';
import { IntegrationStatusBadge } from '../components/IntegrationStatusBadge';
import type { CatalogIntegrationStatus } from '../types';
import { getIntegrationById } from '../integrationRegistry';

export const OpenAIIntegrationPanel: React.FC = () => {
  const { user } = useAuth();
  const meta = getIntegrationById('openai');
  const [aiState, setAiState] = useState<{ configured: boolean; apiKeyMasked: string | null }>({
    configured: false,
    apiKeyMasked: null
  });
  const [aiFormKey, setAiFormKey] = useState('');
  const [aiLoading, setAiLoading] = useState(true);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState<string | null>(null);

  const fetchAI = useCallback(async () => {
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
  }, [user?.uid]);

  useEffect(() => {
    void fetchAI();
  }, [fetchAI]);

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
      await fetchAI();
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Не удалось сохранить ключ.');
    } finally {
      setAiSaving(false);
    }
  };

  if (!user) {
    return (
      <IntegrationDetailLayout title={meta?.title ?? 'OpenAI'} description={meta?.shortDescription ?? ''}>
        <p className="text-gray-500">Войдите в аккаунт.</p>
      </IntegrationDetailLayout>
    );
  }

  let status: CatalogIntegrationStatus = 'not_connected';
  let label = 'Не подключено';
  if (aiState.configured) {
    status = 'connected';
    label = 'Ключ сохранён';
  }

  return (
    <IntegrationDetailLayout
      title={meta?.title ?? 'OpenAI'}
      description="Распознавание чеков, анализ переписок, смета vs факт и другие AI-функции работают только при сохранённом ключе компании."
      meta={<IntegrationStatusBadge status={status} label={label} />}
    >
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 space-y-4">
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
                {aiState.apiKeyMasked && <span className="text-emerald-600">({aiState.apiKeyMasked})</span>}
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
            <button
              type="button"
              onClick={() => void handleSaveAI()}
              disabled={aiSaving || !aiFormKey.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
            >
              {aiSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Сохранить ключ
            </button>
          </>
        )}
      </div>
      <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 text-sm text-gray-600">
        <p className="font-medium text-gray-800 mb-2">Подсказка</p>
        <p>
          Ключ создаётся в{' '}
          <a href="https://platform.openai.com/api-keys" className="text-violet-600 hover:underline" target="_blank" rel="noreferrer">
            OpenAI Platform
          </a>
          . Общий ключ платформы не используется — только ключ компании в CRM.
        </p>
      </div>
    </IntegrationDetailLayout>
  );
};
