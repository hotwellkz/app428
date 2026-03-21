import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { getAuthToken } from '../../../lib/firebase/auth';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { API_KASPI_INTEGRATION, API_KASPI_VERIFY, API_KASPI_SYNC } from '../apiEndpoints';
import { IntegrationDetailLayout } from '../components/IntegrationDetailLayout';
import { IntegrationStatusBadge } from '../components/IntegrationStatusBadge';
import type { CatalogIntegrationStatus } from '../types';
import { getIntegrationById } from '../integrationRegistry';

type KaspiSyncMode = 'manual' | 'four_times_daily' | 'every_4h' | 'every_2h';

interface KaspiState {
  configured: boolean;
  enabled: boolean;
  apiKeyMasked: string | null;
  merchantId: string | null;
  merchantName: string | null;
  syncMode: KaspiSyncMode;
  lastSyncAt: string | null;
  lastSyncStatus: 'success' | 'error' | null;
  lastSyncMessage: string | null;
  lastSyncOrdersCount: number | null;
}

export const KaspiIntegrationPanel: React.FC = () => {
  const { user } = useAuth();
  const meta = getIntegrationById('kaspi');
  const [kaspiState, setKaspiState] = useState<KaspiState>({
    configured: false,
    enabled: false,
    apiKeyMasked: null,
    merchantId: null,
    merchantName: null,
    syncMode: 'manual',
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSyncMessage: null,
    lastSyncOrdersCount: null
  });
  const [kaspiForm, setKaspiForm] = useState({
    apiKey: '',
    merchantId: '',
    merchantName: '',
    enabled: true,
    syncMode: 'four_times_daily' as KaspiSyncMode
  });
  const [kaspiLoading, setKaspiLoading] = useState(true);
  const [kaspiSaving, setKaspiSaving] = useState(false);
  const [kaspiVerifying, setKaspiVerifying] = useState(false);
  const [kaspiSyncing, setKaspiSyncing] = useState(false);
  const [kaspiError, setKaspiError] = useState<string | null>(null);
  const [kaspiSuccess, setKaspiSuccess] = useState<string | null>(null);

  const fetchKaspi = useCallback(async () => {
    if (!user) return;
    setKaspiLoading(true);
    setKaspiError(null);
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch(API_KASPI_INTEGRATION, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = (await res.json().catch(() => ({}))) as {
        configured?: boolean;
        enabled?: boolean;
        apiKeyMasked?: string | null;
        merchantId?: string | null;
        merchantName?: string | null;
        syncMode?: KaspiSyncMode;
        lastSyncAt?: string | null;
        lastSyncStatus?: 'success' | 'error' | null;
        lastSyncMessage?: string | null;
        lastSyncOrdersCount?: number | null;
      };
      if (!res.ok) {
        setKaspiState((s) => ({ ...s, configured: false, enabled: false }));
        return;
      }
      setKaspiState({
        configured: data.configured ?? false,
        enabled: data.enabled ?? false,
        apiKeyMasked: data.apiKeyMasked ?? null,
        merchantId: data.merchantId ?? null,
        merchantName: data.merchantName ?? null,
        syncMode: data.syncMode ?? 'manual',
        lastSyncAt: data.lastSyncAt ?? null,
        lastSyncStatus: data.lastSyncStatus ?? null,
        lastSyncMessage: data.lastSyncMessage ?? null,
        lastSyncOrdersCount: data.lastSyncOrdersCount ?? null
      });
      if (data.configured) {
        setKaspiForm((f) => ({
          ...f,
          merchantId: data.merchantId ?? '',
          merchantName: data.merchantName ?? '',
          enabled: data.enabled ?? false,
          syncMode: data.syncMode ?? 'four_times_daily'
        }));
      }
    } catch {
      /* ignore */
    } finally {
      setKaspiLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void fetchKaspi();
  }, [fetchKaspi]);

  const handleKaspiVerify = async () => {
    const apiKey = kaspiForm.apiKey.trim();
    if (!user) return;
    if (!apiKey && !kaspiState.configured) {
      setKaspiError('Введите API ключ Kaspi или сохраните его в настройках.');
      return;
    }
    setKaspiVerifying(true);
    setKaspiError(null);
    setKaspiSuccess(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setKaspiError('Ошибка авторизации.');
        return;
      }
      const res = await fetch(API_KASPI_VERIFY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(apiKey ? { apiKey } : {})
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
      if (data.ok) {
        setKaspiSuccess(data.message ?? 'Подключение успешно. Ключ действителен.');
      } else {
        setKaspiError(data.error ?? 'Проверка не пройдена');
      }
    } catch {
      setKaspiError('Не удалось проверить подключение.');
    } finally {
      setKaspiVerifying(false);
    }
  };

  const handleKaspiSave = async () => {
    if (!user) return;
    const apiKey = kaspiForm.apiKey.trim();
    if (!apiKey && !kaspiState.configured) {
      setKaspiError('Укажите API ключ Kaspi для сохранения.');
      return;
    }
    setKaspiSaving(true);
    setKaspiError(null);
    setKaspiSuccess(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setKaspiError('Ошибка авторизации.');
        return;
      }
      const res = await fetch(API_KASPI_INTEGRATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...(apiKey ? { apiKey } : {}),
          merchantId: kaspiForm.merchantId.trim() || null,
          merchantName: kaspiForm.merchantName.trim() || null,
          enabled: kaspiForm.enabled,
          syncMode: kaspiForm.syncMode
        })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setKaspiError(data.error ?? 'Ошибка сохранения');
        return;
      }
      setKaspiSuccess(data.message ?? 'Настройки Kaspi сохранены.');
      setKaspiForm((f) => ({ ...f, apiKey: '' }));
      await fetchKaspi();
    } catch {
      setKaspiError('Не удалось сохранить настройки.');
    } finally {
      setKaspiSaving(false);
    }
  };

  const handleKaspiSyncNow = async () => {
    if (!user || !kaspiState.configured) {
      setKaspiError('Сначала сохраните API ключ Kaspi и включите интеграцию.');
      return;
    }
    setKaspiSyncing(true);
    setKaspiError(null);
    setKaspiSuccess(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setKaspiError('Ошибка авторизации.');
        return;
      }
      const res = await fetch(API_KASPI_SYNC, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        processed?: number;
        found?: number;
      };
      if (data.ok) {
        setKaspiSuccess(
          data.processed !== undefined
            ? `Синхронизация завершена. Новых заказов: ${data.processed}${data.found != null ? ` (найдено: ${data.found})` : ''}.`
            : 'Синхронизация запущена.'
        );
        await fetchKaspi();
      } else {
        setKaspiError(data.error ?? 'Ошибка синхронизации');
      }
    } catch {
      setKaspiError('Не удалось запустить синхронизацию.');
    } finally {
      setKaspiSyncing(false);
    }
  };

  if (!user) {
    return (
      <IntegrationDetailLayout title={meta?.title ?? 'Kaspi'} description={meta?.shortDescription ?? ''}>
        <p className="text-gray-500">Войдите в аккаунт.</p>
      </IntegrationDetailLayout>
    );
  }

  let cardStatus: CatalogIntegrationStatus = 'not_connected';
  let cardLabel = 'Не подключено';
  if (kaspiState.configured) {
    if (kaspiState.lastSyncStatus === 'error') {
      cardStatus = 'error';
      cardLabel = 'Ошибка синхр.';
    } else if (!kaspiState.enabled) {
      cardStatus = 'needs_setup';
      cardLabel = 'Выключена';
    } else {
      cardStatus = 'connected';
      cardLabel = 'Активна';
    }
  }

  return (
    <IntegrationDetailLayout
      title={meta?.title ?? 'Kaspi'}
      description={meta?.shortDescription ?? ''}
      meta={
        <div className="flex flex-wrap items-center gap-2">
          <IntegrationStatusBadge status={cardStatus} label={cardLabel} />
          {kaspiState.lastSyncAt ? (
            <span className="text-xs text-gray-500">
              Синхр.: {new Date(kaspiState.lastSyncAt).toLocaleString('ru-RU')}
            </span>
          ) : null}
        </div>
      }
    >
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 space-y-4">
        {kaspiLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Загрузка…
          </div>
        ) : (
          <>
            {kaspiState.configured && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-800">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>Ключ сохранён</span>
                  {kaspiState.apiKeyMasked && <span className="text-emerald-600">({kaspiState.apiKeyMasked})</span>}
                </div>
                {(kaspiState.lastSyncAt || kaspiState.lastSyncStatus) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                    {kaspiState.lastSyncAt && (
                      <span>Последняя синхронизация: {new Date(kaspiState.lastSyncAt).toLocaleString('ru-RU')}</span>
                    )}
                    {kaspiState.lastSyncStatus === 'success' && kaspiState.lastSyncOrdersCount != null && (
                      <span>Заказов: {kaspiState.lastSyncOrdersCount}</span>
                    )}
                    {kaspiState.lastSyncStatus === 'error' && kaspiState.lastSyncMessage && (
                      <span className="text-amber-700">Ошибка: {kaspiState.lastSyncMessage}</span>
                    )}
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API ключ (токен) Kaspi <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={kaspiForm.apiKey}
                onChange={(e) => setKaspiForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder="Токен из личного кабинета Магазина на Kaspi.kz → Настройки → API"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Merchant ID / ID магазина</label>
              <input
                type="text"
                value={kaspiForm.merchantId}
                onChange={(e) => setKaspiForm((f) => ({ ...f, merchantId: e.target.value }))}
                placeholder="Если требуется API Kaspi"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название магазина</label>
              <input
                type="text"
                value={kaspiForm.merchantName}
                onChange={(e) => setKaspiForm((f) => ({ ...f, merchantName: e.target.value }))}
                placeholder="Для отображения (необязательно)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="kaspi-enabled"
                checked={kaspiForm.enabled}
                onChange={(e) => setKaspiForm((f) => ({ ...f, enabled: e.target.checked }))}
                className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="kaspi-enabled" className="text-sm font-medium text-gray-700">
                Интеграция активна
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Частота синхронизации</label>
              <select
                value={kaspiForm.syncMode}
                onChange={(e) => setKaspiForm((f) => ({ ...f, syncMode: e.target.value as KaspiSyncMode }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="manual">Только вручную</option>
                <option value="four_times_daily">4 раза в день</option>
                <option value="every_4h">Каждые 4 часа</option>
                <option value="every_2h">Каждые 2 часа</option>
              </select>
            </div>
            {kaspiError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {kaspiError}
              </div>
            )}
            {kaspiSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle className="w-4 h-4 shrink-0" />
                {kaspiSuccess}
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => void handleKaspiVerify()}
                disabled={kaspiVerifying || (!kaspiForm.apiKey.trim() && !kaspiState.configured)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50"
              >
                {kaspiVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Проверить подключение
              </button>
              <button
                type="button"
                onClick={() => void handleKaspiSave()}
                disabled={kaspiSaving || (!kaspiForm.apiKey.trim() && !kaspiState.configured)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {kaspiSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Сохранить
              </button>
              <button
                type="button"
                onClick={() => void handleKaspiSyncNow()}
                disabled={kaspiSyncing || !kaspiState.configured}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg disabled:opacity-50"
              >
                {kaspiSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Синхронизировать сейчас
              </button>
            </div>
          </>
        )}
      </div>
      <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 text-sm text-gray-600">
        <p className="font-medium text-gray-800 mb-2">Где взять данные</p>
        <p>Токен и реквизиты магазина — в личном кабинете продавца на Kaspi.kz (раздел настроек магазина и API).</p>
      </div>
    </IntegrationDetailLayout>
  );
};
