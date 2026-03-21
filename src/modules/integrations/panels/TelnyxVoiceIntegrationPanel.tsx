import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { getAuthToken } from '../../../lib/firebase/auth';
import { Loader2 } from 'lucide-react';
import { API_VOICE_INTEGRATION, API_VOICE_NUMBERS } from '../apiEndpoints';
import { IntegrationDetailLayout } from '../components/IntegrationDetailLayout';
import { IntegrationStatusBadge } from '../components/IntegrationStatusBadge';
import type { CatalogIntegrationStatus } from '../types';
import { getIntegrationById } from '../integrationRegistry';
import { useVoiceTelephonyData } from '../hooks/useVoiceTelephonyData';

export const TelnyxVoiceIntegrationPanel: React.FC = () => {
  const { user } = useAuth();
  const meta = getIntegrationById('telnyx');
  const { voiceState, telnyxState, telnyxNumbers, loading, loadError, refetch } = useVoiceTelephonyData(user?.uid);
  const [telnyxForm, setTelnyxForm] = useState({
    apiKey: '',
    publicKey: '',
    connectionId: '',
    enabled: true,
    numberE164: '',
    numberLabel: ''
  });
  const [voiceSaving, setVoiceSaving] = useState(false);
  const [voiceTesting, setVoiceTesting] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceSuccess, setVoiceSuccess] = useState<string | null>(null);
  const [telnyxSyncing, setTelnyxSyncing] = useState(false);

  useEffect(() => {
    setTelnyxForm((f) => ({
      ...f,
      connectionId: telnyxState.connectionId != null ? String(telnyxState.connectionId) : '',
      enabled: telnyxState.enabled === true
    }));
  }, [telnyxState.connectionId, telnyxState.enabled]);

  const telnyxMissionControlWebhookUrl =
    telnyxState.outboundWebhookBaseUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/.netlify/functions/voice-provider-webhook`
      : '');

  const handleTelnyxTest = async () => {
    if (!telnyxForm.apiKey.trim() && !telnyxState.apiKeyMasked) {
      setVoiceError('Укажите API Key Telnyx для проверки или сохраните ключ в интеграции');
      return;
    }
    setVoiceTesting(true);
    setVoiceError(null);
    setVoiceSuccess(null);
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch(API_VOICE_INTEGRATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          provider: 'telnyx',
          apiKey: telnyxForm.apiKey.trim(),
          testOnly: true,
          connectionId: telnyxForm.connectionId.trim() || null
        })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setVoiceError(data.error ?? 'Проверка Telnyx не пройдена');
        return;
      }
      setVoiceSuccess(data.message ?? 'Telnyx: подключение проверено');
      await refetch();
    } finally {
      setVoiceTesting(false);
    }
  };

  const handleTelnyxSave = async () => {
    const hasKeysInForm = !!(telnyxForm.apiKey.trim() && telnyxForm.publicKey.trim());
    const hasKeysOnServer = !!(telnyxState.apiKeyMasked && telnyxState.publicKeySet);
    if (!hasKeysInForm && !hasKeysOnServer) {
      setVoiceError('Укажите API Key и Public Key Telnyx (первое сохранение)');
      return;
    }
    setVoiceSaving(true);
    setVoiceError(null);
    setVoiceSuccess(null);
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch(API_VOICE_INTEGRATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          provider: 'telnyx',
          apiKey: telnyxForm.apiKey.trim(),
          publicKey: telnyxForm.publicKey.trim(),
          enabled: telnyxForm.enabled,
          connectionId: telnyxForm.connectionId.trim() || null
        })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setVoiceError(data.error ?? 'Ошибка сохранения Telnyx');
        return;
      }
      setVoiceSuccess(data.message ?? 'Telnyx сохранён');
      setTelnyxForm((f) => ({ ...f, apiKey: '', publicKey: '' }));
      await refetch();
    } finally {
      setVoiceSaving(false);
    }
  };

  const handleTelnyxNumberAdd = async () => {
    if (!telnyxForm.numberE164.trim()) return setVoiceError('Укажите номер в формате E.164');
    setVoiceSaving(true);
    setVoiceError(null);
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch(API_VOICE_NUMBERS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'upsert',
          e164: telnyxForm.numberE164.trim(),
          label: telnyxForm.numberLabel.trim() || null,
          provider: 'telnyx'
        })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setVoiceError(data.error ?? 'Не удалось добавить номер Telnyx');
        return;
      }
      setVoiceSuccess('Номер Telnyx сохранён');
      setTelnyxForm((f) => ({ ...f, numberE164: '', numberLabel: '' }));
      await refetch();
    } finally {
      setVoiceSaving(false);
    }
  };

  const handleTelnyxSetDefault = async (numberId: string) => {
    const token = await getAuthToken();
    if (!token) return;
    await fetch(API_VOICE_NUMBERS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'set_default', numberId })
    });
    await refetch();
  };

  const handleTelnyxSync = async () => {
    if (!user) return;
    setTelnyxSyncing(true);
    setVoiceError(null);
    setVoiceSuccess(null);
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch(API_VOICE_NUMBERS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'sync_telnyx' })
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        empty?: boolean;
      };
      if (!res.ok) {
        setVoiceError(data.error ?? 'Синхронизация Telnyx не удалась');
        return;
      }
      if (data.empty) {
        setVoiceSuccess(data.message ?? 'В Telnyx нет номеров для импорта');
      } else {
        setVoiceSuccess(data.message ?? 'Номера Telnyx синхронизированы');
      }
      await refetch();
    } catch {
      setVoiceError('Не удалось синхронизировать номера Telnyx');
    } finally {
      setTelnyxSyncing(false);
    }
  };

  if (!user) {
    return (
      <IntegrationDetailLayout title={meta?.title ?? 'Telnyx'} description={meta?.shortDescription ?? ''}>
        <p className="text-gray-500">Войдите в аккаунт.</p>
      </IntegrationDetailLayout>
    );
  }

  let st: CatalogIntegrationStatus = 'not_connected';
  let stLabel = 'Не подключено';
  if (telnyxState.configured || telnyxState.apiKeyMasked) {
    if (telnyxState.connectionStatus === 'invalid_config' || telnyxState.connectionError) {
      st = 'error';
      stLabel = 'Ошибка';
    } else if (!telnyxState.voiceReady) {
      st = 'needs_setup';
      stLabel = 'Требует настройки';
    } else {
      st = 'connected';
      stLabel = voiceState.outboundVoiceProvider === 'telnyx' ? 'Готово (исходящий)' : 'Готово';
    }
  }

  return (
    <IntegrationDetailLayout
      title={meta?.title ?? 'Telnyx'}
      description="Второй voice-провайдер на уровне компании. Выбор исходящего провайдера — на странице Twilio."
      meta={
        <div className="flex flex-wrap items-center gap-2">
          <IntegrationStatusBadge status={st} label={stLabel} />
          {loadError ? <span className="text-xs text-rose-600">{loadError}</span> : null}
          <Link to="/settings/integrations/twilio" className="text-xs text-violet-600 hover:underline">
            Исходящий провайдер:{' '}
            {voiceState.outboundVoiceProvider === 'telnyx'
              ? 'Telnyx'
              : voiceState.outboundVoiceProvider === 'zadarma'
                ? 'Zadarma'
                : 'Twilio'}{' '}
            → настроить
          </Link>
        </div>
      }
    >
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Загрузка…
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <span
                className={`px-2 py-1 rounded-full border ${
                  telnyxState.connectionStatus === 'connected'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                Provider: {telnyxState.connectionStatus === 'connected' ? 'connected' : telnyxState.connectionStatus}
              </span>
              <span
                className={`px-2 py-1 rounded-full border ${
                  telnyxState.hasDefaultOutbound
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                Default outbound: {telnyxState.hasDefaultOutbound ? 'selected' : 'missing'}
              </span>
              <span
                className={`px-2 py-1 rounded-full border ${
                  telnyxState.voiceReady
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                Voice: {telnyxState.voiceReady ? 'ready' : 'not ready'}
              </span>
              <span
                className={`px-2 py-1 rounded-full border ${
                  telnyxState.publicKeySet
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                Public key: {telnyxState.publicKeySet ? 'set' : 'missing'}
              </span>
              <span
                className={`px-2 py-1 rounded-full border ${
                  telnyxState.hasAnyNumbers
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                Numbers: {telnyxState.hasAnyNumbers ? 'in CRM' : 'none'}
              </span>
              <span
                className={`px-2 py-1 rounded-full border ${
                  telnyxState.webhookSignatureOk
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                Webhook: {telnyxState.webhookSignatureOk ? 'OK' : 'issue'}
              </span>
            </div>
            {(telnyxState.lastCheckedAt || telnyxState.lastSyncedAt) && (
              <p className="text-[11px] text-gray-500">
                {telnyxState.lastCheckedAt ? <>Проверка API: {new Date(telnyxState.lastCheckedAt).toLocaleString()}</> : null}
                {telnyxState.lastCheckedAt && telnyxState.lastSyncedAt ? ' · ' : null}
                {telnyxState.lastSyncedAt ? <>Синхронизация: {new Date(telnyxState.lastSyncedAt).toLocaleString()}</> : null}
              </p>
            )}
            {telnyxState.readinessMessages.length > 0 && !telnyxState.voiceReady ? (
              <ul className="text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 list-disc list-inside space-y-0.5">
                {telnyxState.readinessMessages.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : null}
            {telnyxState.providerWebhookLastErrorCode ? (
              <div className="text-xs rounded-lg border border-rose-100 bg-rose-50/90 px-3 py-2 text-rose-900 space-y-0.5">
                <p className="font-medium">Последняя ошибка webhook</p>
                <p className="font-mono text-[11px]">{telnyxState.providerWebhookLastErrorCode}</p>
                {telnyxState.providerWebhookLastErrorAt ? (
                  <p className="text-rose-800/90">{new Date(telnyxState.providerWebhookLastErrorAt).toLocaleString()}</p>
                ) : null}
              </div>
            ) : null}
            {telnyxState.apiKeyMasked ? (
              <p className="text-xs text-gray-600">API Key сохранён ({telnyxState.apiKeyMasked})</p>
            ) : null}
            {telnyxState.publicKeySet ? <p className="text-xs text-gray-600">Public Key для webhook сохранён</p> : null}
            {telnyxMissionControlWebhookUrl ? (
              <div className="rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2 text-xs space-y-2">
                <p className="font-medium text-gray-800">Webhook URL для Call Control (Telnyx Mission Control)</p>
                <p className="text-amber-900/95 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 leading-relaxed">
                  В приложении <strong>Call Control</strong> укажите <strong>ровно этот</strong> URL (HTTPS, без{' '}
                  <code className="text-[10px]">?companyId=</code>).
                </p>
                <code className="block break-all text-[11px] text-violet-900 bg-white/80 rounded px-2 py-1 border border-violet-100">
                  {telnyxMissionControlWebhookUrl}
                </code>
                <button
                  type="button"
                  className="text-xs font-medium text-violet-700 hover:underline"
                  onClick={() =>
                    void navigator.clipboard.writeText(telnyxMissionControlWebhookUrl).then(() => setVoiceSuccess('URL скопирован'))
                  }
                >
                  Копировать URL
                </button>
              </div>
            ) : null}
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                type="password"
                value={telnyxForm.apiKey}
                onChange={(e) => setTelnyxForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder="Telnyx API Key (секретный)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={telnyxForm.publicKey}
                onChange={(e) => setTelnyxForm((f) => ({ ...f, publicKey: e.target.value }))}
                placeholder="Telnyx Public Key (base64, Ed25519)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
              />
            </div>
            <input
              type="text"
              value={telnyxForm.connectionId}
              onChange={(e) => setTelnyxForm((f) => ({ ...f, connectionId: e.target.value }))}
              placeholder="ID Call Control или URL страницы приложения. Тот же аккаунт Telnyx, что и API Key."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={telnyxForm.enabled}
                onChange={(e) => setTelnyxForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              Интеграция Telnyx активна
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleTelnyxTest()}
                disabled={voiceTesting}
                className="px-4 py-2 text-sm font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg"
              >
                {voiceTesting ? 'Проверка…' : 'Проверить подключение'}
              </button>
              <button
                type="button"
                onClick={() => void handleTelnyxSave()}
                disabled={voiceSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg"
              >
                {voiceSaving ? 'Сохранение…' : 'Сохранить'}
              </button>
              <button
                type="button"
                onClick={() => void handleTelnyxSync()}
                disabled={telnyxSyncing || voiceSaving || !telnyxState.apiKeyMasked}
                title={!telnyxState.apiKeyMasked ? 'Сначала сохраните API Key Telnyx' : undefined}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-800 bg-gray-100 border border-gray-300 rounded-lg disabled:opacity-50"
              >
                {telnyxSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Синхронизировать номера
              </button>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">Telnyx voice numbers</p>
              <div className="grid sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={telnyxForm.numberE164}
                  onChange={(e) => setTelnyxForm((f) => ({ ...f, numberE164: e.target.value }))}
                  placeholder="+1..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={telnyxForm.numberLabel}
                  onChange={(e) => setTelnyxForm((f) => ({ ...f, numberLabel: e.target.value }))}
                  placeholder="Label"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleTelnyxNumberAdd()}
                className="mt-2 px-4 py-2 text-sm font-medium border rounded-lg"
              >
                Добавить / обновить номер
              </button>
              <div className="mt-2 space-y-2">
                {telnyxNumbers.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium text-gray-800 flex flex-wrap items-center gap-2">
                        {n.label || n.e164}
                        <span className="text-[10px] uppercase font-semibold bg-violet-100 text-violet-800 px-1.5 py-0.5 rounded">
                          Telnyx
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {n.e164} · {n.isActive ? 'active' : 'inactive'}
                      </p>
                    </div>
                    {n.isDefault ? (
                      <span className="text-xs text-emerald-700">default</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleTelnyxSetDefault(n.id)}
                        className="text-xs text-violet-700"
                      >
                        Сделать default
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {voiceError ? <div className="text-sm text-red-700 bg-red-50 border rounded-lg px-3 py-2">{voiceError}</div> : null}
            {voiceSuccess ? (
              <div className="text-sm text-emerald-700 bg-emerald-50 border rounded-lg px-3 py-2">{voiceSuccess}</div>
            ) : null}
            {telnyxState.connectionError ? (
              <div className="text-xs text-amber-800">{telnyxState.connectionError}</div>
            ) : null}
          </>
        )}
      </div>
    </IntegrationDetailLayout>
  );
};
