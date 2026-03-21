import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { getAuthToken } from '../../../lib/firebase/auth';
import { Loader2 } from 'lucide-react';
import { API_VOICE_INTEGRATION, API_VOICE_NUMBERS } from '../apiEndpoints';
import { IntegrationDetailLayout } from '../components/IntegrationDetailLayout';
import { IntegrationStatusBadge } from '../components/IntegrationStatusBadge';
import type { CatalogIntegrationStatus } from '../types';
import { getIntegrationById } from '../integrationRegistry';
import { useVoiceTelephonyData, type OutboundVoiceProviderPref } from '../hooks/useVoiceTelephonyData';
import { ZadarmaVoiceIntegrationSection } from '../components/ZadarmaVoiceIntegrationSection';

export const TwilioVoiceIntegrationPanel: React.FC = () => {
  const { user } = useAuth();
  const meta = getIntegrationById('twilio');
  const { voiceState, telnyxState, zadarmaState, voiceNumbers, zadarmaNumbers, loading, loadError, refetch } =
    useVoiceTelephonyData(user?.uid);
  const [voiceForm, setVoiceForm] = useState({
    accountSid: '',
    authToken: '',
    enabled: true,
    numberE164: '',
    numberLabel: ''
  });
  const [outboundSaving, setOutboundSaving] = useState(false);
  const [voiceSaving, setVoiceSaving] = useState(false);
  const [voiceTesting, setVoiceTesting] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceSuccess, setVoiceSuccess] = useState<string | null>(null);

  const telnyxMissionControlWebhookUrl =
    telnyxState.outboundWebhookBaseUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/.netlify/functions/voice-provider-webhook`
      : '');

  const handleOutboundProviderChange = async (pref: OutboundVoiceProviderPref) => {
    if (!user) return;
    setOutboundSaving(true);
    setVoiceError(null);
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch(API_VOICE_INTEGRATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'set_outbound_provider', outboundVoiceProvider: pref })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setVoiceError(data.error ?? 'Не удалось сменить провайдер');
        return;
      }
      setVoiceSuccess(
        `Исходящий провайдер: ${pref === 'telnyx' ? 'Telnyx' : pref === 'zadarma' ? 'Zadarma' : 'Twilio'}`
      );
      await refetch();
    } finally {
      setOutboundSaving(false);
    }
  };

  const handleVoiceTest = async () => {
    if (!voiceForm.accountSid.trim() || !voiceForm.authToken.trim()) {
      setVoiceError('Укажите Account SID и Auth Token для проверки');
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
          accountSid: voiceForm.accountSid.trim(),
          authToken: voiceForm.authToken.trim(),
          testOnly: true
        })
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        accountType?: string;
        accountSidSuffix?: string;
        voiceSanityHint?: string | null;
      };
      if (!res.ok) {
        setVoiceError(data.error ?? 'Проверка не пройдена');
        return;
      }
      const extra =
        data.accountType != null
          ? ` Тип аккаунта Twilio: ${data.accountType === 'Full' ? 'Full (оплаченный)' : data.accountType}.`
          : '';
      const suffix = data.accountSidSuffix ? ` SID …${data.accountSidSuffix}.` : '';
      const hint = data.voiceSanityHint ? ` ${data.voiceSanityHint}` : '';
      setVoiceSuccess((data.message ?? 'Twilio подключение успешно проверено') + extra + suffix + hint);
    } finally {
      setVoiceTesting(false);
    }
  };

  const handleVoiceSave = async () => {
    if (!voiceForm.accountSid.trim() || !voiceForm.authToken.trim()) {
      setVoiceError('Укажите Account SID и Auth Token');
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
          accountSid: voiceForm.accountSid.trim(),
          authToken: voiceForm.authToken.trim(),
          enabled: voiceForm.enabled
        })
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        accountType?: string;
        incomingVoiceCapable?: number;
      };
      if (!res.ok) {
        setVoiceError(data.error ?? 'Ошибка сохранения');
        return;
      }
      let saveMsg = data.message ?? 'Voice интеграция сохранена';
      if (data.accountType === 'Full') saveMsg += ' Тип аккаунта Twilio: Full (оплаченный).';
      else if (data.accountType === 'Trial') saveMsg += ' Тип аккаунта Twilio: Trial.';
      if (data.incomingVoiceCapable === 0) {
        saveMsg += ' Внимание: в аккаунте не найдено номеров с Voice — проверьте Twilio Console.';
      }
      setVoiceSuccess(saveMsg);
      setVoiceForm((f) => ({ ...f, accountSid: '', authToken: '' }));
      await refetch();
    } finally {
      setVoiceSaving(false);
    }
  };

  const handleVoiceNumberAdd = async () => {
    if (!voiceForm.numberE164.trim()) return setVoiceError('Укажите номер в формате +7...');
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
          e164: voiceForm.numberE164.trim(),
          label: voiceForm.numberLabel.trim() || null,
          provider: 'twilio'
        })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setVoiceError(data.error ?? 'Не удалось добавить номер');
        return;
      }
      setVoiceSuccess('Номер сохранён');
      setVoiceForm((f) => ({ ...f, numberE164: '', numberLabel: '' }));
      await refetch();
    } finally {
      setVoiceSaving(false);
    }
  };

  const handleVoiceSetDefault = async (numberId: string) => {
    const token = await getAuthToken();
    if (!token) return;
    await fetch(API_VOICE_NUMBERS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'set_default', numberId })
    });
    await refetch();
  };

  if (!user) {
    return (
      <IntegrationDetailLayout title={meta?.title ?? 'Twilio'} description={meta?.shortDescription ?? ''}>
        <p className="text-gray-500">Войдите в аккаунт.</p>
      </IntegrationDetailLayout>
    );
  }

  let st: CatalogIntegrationStatus = 'not_connected';
  let stLabel = 'Не подключено';
  if (voiceState.configured) {
    if (voiceState.connectionError || voiceState.connectionStatus === 'invalid_config') {
      st = 'error';
      stLabel = 'Ошибка';
    } else if (!voiceState.voiceReady) {
      st = 'needs_setup';
      stLabel = 'Требует настройки';
    } else {
      st = 'connected';
      stLabel = 'Готово';
    }
  }

  return (
    <IntegrationDetailLayout
      title={meta?.title ?? 'Twilio'}
      description="Интеграция и номера изолированы по компании. Исходящий провайдер: Twilio, Telnyx или Zadarma."
      meta={
        <div className="flex flex-wrap items-center gap-2">
          <IntegrationStatusBadge status={st} label={stLabel} />
          {loadError ? <span className="text-xs text-rose-600">{loadError}</span> : null}
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
                  voiceState.connectionStatus === 'connected'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                Provider: {voiceState.connectionStatus === 'connected' ? 'connected' : voiceState.connectionStatus}
              </span>
              <span
                className={`px-2 py-1 rounded-full border ${
                  voiceState.hasDefaultOutbound
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                Default outbound: {voiceState.hasDefaultOutbound ? 'selected' : 'missing'}
              </span>
              <span
                className={`px-2 py-1 rounded-full border ${
                  voiceState.voiceReady
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                Voice: {voiceState.voiceReady ? 'ready' : 'not ready'}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
              <span className="text-gray-700 shrink-0">Исходящий провайдер (outbound):</span>
              <select
                value={voiceState.outboundVoiceProvider}
                disabled={outboundSaving || loading}
                onChange={(e) => void handleOutboundProviderChange(e.target.value as OutboundVoiceProviderPref)}
                className="w-full sm:w-auto rounded-lg border border-gray-300 px-2 py-1.5 text-sm max-w-xs"
              >
                <option value="twilio">Twilio</option>
                <option value="telnyx">Telnyx</option>
                <option value="zadarma">Zadarma</option>
              </select>
              {outboundSaving ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : null}
            </div>
            <p className="text-xs text-gray-500">
              Настройка Telnyx —{' '}
              <Link to="/settings/integrations/telnyx" className="text-violet-600 hover:underline">
                страница Telnyx
              </Link>
              .
            </p>
            {voiceState.outboundVoiceProvider === 'telnyx' && !telnyxState.voiceReady ? (
              <div className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2">
                <span className="font-medium">Внимание:</span> выбран Telnyx, но он ещё не готов к звонкам.
                {telnyxState.blockingReason
                  ? ` ${telnyxState.blockingReason}`
                  : ' Заполните ключи Telnyx, Connection ID, синхронизируйте номера.'}
              </div>
            ) : null}
            {voiceState.outboundVoiceProvider === 'zadarma' && !zadarmaState.voiceReady ? (
              <div className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2">
                <span className="font-medium">Внимание:</span> выбрана Zadarma, но интеграция не готова.
                {zadarmaState.blockingReason
                  ? ` ${zadarmaState.blockingReason}`
                  : ' Сохраните Key/Secret, extension, webhook URL и синхронизируйте номера (блок ниже).'}
              </div>
            ) : null}
            {voiceState.accountSidMasked ? (
              <p className="text-xs text-gray-600">
                Account SID сохранён ({voiceState.accountSidMasked})
                {voiceState.twilioAccountType ? (
                  <span className="ml-2 text-sky-800 font-medium">
                    · Twilio: {voiceState.twilioAccountType === 'Full' ? 'Full (оплаченный)' : voiceState.twilioAccountType}
                    {voiceState.twilioAccountStatus ? `, статус ${voiceState.twilioAccountStatus}` : ''}
                  </span>
                ) : null}
              </p>
            ) : null}
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={voiceForm.accountSid}
                onChange={(e) => setVoiceForm((f) => ({ ...f, accountSid: e.target.value }))}
                placeholder="Twilio Account SID"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                type="password"
                value={voiceForm.authToken}
                onChange={(e) => setVoiceForm((f) => ({ ...f, authToken: e.target.value }))}
                placeholder="Twilio Auth Token"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={voiceForm.enabled}
                onChange={(e) => setVoiceForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              Интеграция активна
            </label>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => void handleVoiceTest()}
                disabled={voiceTesting}
                className="px-4 py-2 text-sm font-medium text-sky-700 bg-sky-50 border border-sky-200 rounded-lg"
              >
                {voiceTesting ? 'Проверка…' : 'Проверить подключение'}
              </button>
              <button
                type="button"
                onClick={() => void handleVoiceSave()}
                disabled={voiceSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg"
              >
                {voiceSaving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">Voice numbers (Twilio)</p>
              <div className="grid sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={voiceForm.numberE164}
                  onChange={(e) => setVoiceForm((f) => ({ ...f, numberE164: e.target.value }))}
                  placeholder="+7..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={voiceForm.numberLabel}
                  onChange={(e) => setVoiceForm((f) => ({ ...f, numberLabel: e.target.value }))}
                  placeholder="Label"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleVoiceNumberAdd()}
                className="mt-2 px-4 py-2 text-sm font-medium border rounded-lg"
              >
                Добавить / обновить номер
              </button>
              <div className="mt-2 space-y-2">
                {voiceNumbers.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium text-gray-800 flex flex-wrap items-center gap-2">
                        {n.label || n.e164}
                        <span className="text-[10px] uppercase font-semibold bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded">
                          Twilio
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
                        onClick={() => void handleVoiceSetDefault(n.id)}
                        className="text-xs text-sky-700"
                      >
                        Сделать default
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {voiceError ? (
              <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{voiceError}</div>
            ) : null}
            {voiceSuccess ? (
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                {voiceSuccess}
              </div>
            ) : null}
            {voiceState.connectionError ? (
              <div className="text-xs text-amber-800">{voiceState.connectionError}</div>
            ) : null}
          </>
        )}
      </div>
      {user?.uid ? (
        <ZadarmaVoiceIntegrationSection
          userUid={user.uid}
          outboundVoiceProvider={voiceState.outboundVoiceProvider}
          zadarmaState={zadarmaState}
          zadarmaNumbers={zadarmaNumbers}
          refetch={refetch}
        />
      ) : null}
      {telnyxMissionControlWebhookUrl ? (
        <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 text-xs text-gray-600">
          <p className="font-medium text-gray-800 mb-1">Связь с Telnyx webhook</p>
          <p>
            Базовый URL webhook для Call Control (если используете Telnyx):{' '}
            <code className="break-all text-[11px] bg-white px-1 rounded border">{telnyxMissionControlWebhookUrl}</code>
          </p>
        </div>
      ) : null}
    </IntegrationDetailLayout>
  );
};
