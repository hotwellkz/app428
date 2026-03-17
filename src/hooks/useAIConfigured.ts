import { useState, useEffect, useCallback } from 'react';
import { getAuthToken } from '../lib/firebase/auth';

const OPENAI_INTEGRATION_URL = '/.netlify/functions/openai-integration';

export interface AIConfiguredState {
  configured: boolean | null;
  apiKeyMasked: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAIConfigured(): AIConfiguredState {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [apiKeyMasked, setApiKeyMasked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setConfigured(false);
        setApiKeyMasked(null);
        setError('Войдите в аккаунт для проверки настроек AI');
        return;
      }
      const res = await fetch(OPENAI_INTEGRATION_URL, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setConfigured(false);
        setApiKeyMasked(null);
        const serverMessage = (data?.error as string) ?? '';
        setError(
          res.status === 401
            ? 'Сессия истекла или требуется повторный вход. Обновите страницу и войдите снова.'
            : serverMessage || 'Не удалось загрузить настройки AI'
        );
        return;
      }
      setConfigured(data.configured ?? false);
      setApiKeyMasked(data.apiKeyMasked ?? null);
    } catch (e) {
      setConfigured(false);
      setApiKeyMasked(null);
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { configured, apiKeyMasked, loading, error, refetch };
}
