import React, { useState } from 'react';
import { getAuthToken } from '../../../lib/firebase/auth';
import { Loader2 } from 'lucide-react';
import { API_VOICE_INTEGRATION, API_VOICE_NUMBERS } from '../apiEndpoints';
import type { ZadarmaVoiceState, VoiceNumberRow, OutboundVoiceProviderPref } from '../hooks/useVoiceTelephonyData';

type Props = {
  userUid: string;
  outboundVoiceProvider: OutboundVoiceProviderPref;
  zadarmaState: ZadarmaVoiceState;
  zadarmaNumbers: VoiceNumberRow[];
  refetch: () => void;
};

export const ZadarmaVoiceIntegrationSection: React.FC<Props> = ({
  userUid,
  outboundVoiceProvider,
  zadarmaState,
  zadarmaNumbers,
  refetch
}) => {
  const [form, setForm] = useState({
    key: '',
    secret: '',
    callbackExtension: '',
    predicted: false,
    enabled: true
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (!userUid) return null;

  const runTest = async () => {
    setTesting(true);
    setErr(null);
    setOk(null);
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch(API_VOICE_INTEGRATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          provider: 'zadarma',
          testOnly: true,
          zadarmaKey: form.key.trim() || undefined,
          zadarmaSecret: form.secret.trim() || undefined
        })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setErr(data.error ?? 'Проверка Zadarma не пройдена');
        return;
      }
      setOk(data.message ?? 'Zadarma: подключение проверено');
      await refetch();
    } finally {
      setTesting(false);
    }
  };

  const runSave = async () => {
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch(API_VOICE_INTEGRATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          provider: 'zadarma',
          enabled: form.enabled,
          zadarmaKey: form.key.trim() || undefined,
          zadarmaSecret: form.secret.trim() || undefined,
          zadarmaCallbackExtension: form.callbackExtension.trim() || null,
          zadarmaPredicted: form.predicted
        })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setErr(data.error ?? 'Не удалось сохранить');
        return;
      }
      setOk(data.message ?? 'Сохранено');
      setForm((f) => ({ ...f, key: '', secret: '' }));
      await refetch();
    } finally {
      setSaving(false);
    }
  };

  const syncNumbers = async () => {
    setSaving(true);
    setErr(null);
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch(API_VOICE_NUMBERS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'sync_zadarma' })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setErr(data.error ?? 'Синхронизация не удалась');
        return;
      }
      setOk(data.message ?? 'Номера обновлены');
      await refetch();
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (numberId: string) => {
    const token = await getAuthToken();
    if (!token) return;
    await fetch(API_VOICE_NUMBERS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'set_default', numberId })
    });
    await refetch();
  };

  return (
    <div className="rounded-xl border border-violet-200 bg-white shadow-sm p-4 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Voice / Telephony (Zadarma)</h2>
        <p className="text-xs text-gray-600 mt-1">
          Обратный звонок через API <code className="text-[11px]">/v1/request/callback/</code> и уведомления{' '}
          <code className="text-[11px]">NOTIFY_OUT_*</code> по документации Zadarma.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span
          className={`px-2 py-1 rounded-full border ${
            zadarmaState.connectionStatus === 'connected'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          API: {zadarmaState.connectionStatus}
        </span>
        <span
          className={`px-2 py-1 rounded-full border ${
            zadarmaState.webhookSignatureOk ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          Webhook: {zadarmaState.webhookSignatureOk ? 'без блокирующих ошибок' : 'ошибка подписи / матчинг'}
        </span>
        <span
          className={`px-2 py-1 rounded-full border ${
            zadarmaState.voiceReady ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
          }`}
        >
          Voice ready: {zadarmaState.voiceReady ? 'да' : 'нет'}
        </span>
      </div>

      <div className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-[11px] text-gray-700 space-y-1">
        <p className="font-semibold text-gray-800">Чеклист готовности</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>API Key: {zadarmaState.apiKeySet ? 'сохранён' : 'нет'}</li>
          <li>Secret: {zadarmaState.apiSecretSet ? 'сохранён' : 'нет'}</li>
          <li>Extension (from): {zadarmaState.extensionSet ? 'задан' : 'нет'}</li>
          <li>Номера в CRM: {zadarmaState.hasAnyNumbers ? 'есть' : 'нет'}</li>
          <li>Default номер Zadarma: {zadarmaState.hasDefaultOutbound ? 'да' : 'нет'}</li>
          <li>Исходящий по умолчанию в CRM: {zadarmaState.defaultOutboundSelected ? 'Zadarma' : 'другой провайдер'}</li>
          <li>URL webhook (подсказка): {zadarmaState.webhookUrlHintReady ? 'сформирован' : 'нет базового URL'}</li>
        </ul>
        <p className="font-semibold text-gray-800 pt-1">Диагностика (без секретов)</p>
        <ul className="list-disc pl-4 space-y-0.5 text-gray-600">
          <li>
            Последний webhook:{' '}
            {zadarmaState.lastWebhookReceivedAt
              ? `${zadarmaState.lastWebhookReceivedAt}${zadarmaState.lastWebhookEventType ? ` · ${zadarmaState.lastWebhookEventType}` : ''}`
              : 'ещё не было'}
          </li>
          <li>
            Подпись (последняя проверка):{' '}
            {zadarmaState.lastWebhookSignatureOk === null
              ? 'нет данных'
              : zadarmaState.lastWebhookSignatureOk
                ? 'OK'
                : 'ошибка'}
          </li>
          <li>
            Последний исходящий звонок:{' '}
            {zadarmaState.lastOutboundAttemptAt
              ? `${zadarmaState.lastOutboundAttemptAt} · ${zadarmaState.lastOutboundOk === true ? 'успех' : zadarmaState.lastOutboundOk === false ? 'отказ' : '?'}`
              : 'не было'}
            {zadarmaState.lastOutboundFriendlyCode ? ` · ${zadarmaState.lastOutboundFriendlyCode}` : ''}
          </li>
          {zadarmaState.providerWebhookLastErrorCode ? (
            <li className="text-rose-800">
              Ошибка webhook: {zadarmaState.providerWebhookLastErrorCode}
              {zadarmaState.providerWebhookLastErrorAt ? ` (${zadarmaState.providerWebhookLastErrorAt})` : ''}
            </li>
          ) : null}
        </ul>
      </div>

      {zadarmaState.readinessMessages.length > 0 && !zadarmaState.voiceReady ? (
        <div className="text-xs rounded-lg border border-amber-200 bg-amber-50/90 text-amber-950 px-3 py-2 space-y-1">
          <p className="font-medium">Что мешает «Voice ready»</p>
          <ul className="list-disc pl-4">
            {zadarmaState.readinessMessages.slice(0, 8).map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {outboundVoiceProvider === 'zadarma' && !zadarmaState.voiceReady ? (
        <div className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2">
          <span className="font-medium">Выбран исходящий Zadarma,</span> но интеграция не готова.
          {zadarmaState.blockingReason ? ` ${zadarmaState.blockingReason}` : null}
        </div>
      ) : null}

      {zadarmaState.keyMasked ? (
        <p className="text-xs text-gray-600">
          Key сохранён ({zadarmaState.keyMasked}), Secret: {zadarmaState.secretMasked ?? '****'}
        </p>
      ) : null}

      {zadarmaState.outboundWebhookUrlHint ? (
        <div className="text-xs rounded-lg bg-violet-50 border border-violet-100 px-3 py-2 space-y-1">
          <p className="font-medium text-violet-900">URL для уведомлений АТС (скопируйте в Zadarma)</p>
          <code className="block break-all text-[11px] bg-white px-2 py-1 rounded border">
            {zadarmaState.outboundWebhookUrlHint}
          </code>
          <p className="text-gray-600">{zadarmaState.zdEchoNote}</p>
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-3">
        <input
          type="text"
          value={form.key}
          onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
          placeholder="Zadarma API Key (user key)"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="password"
          value={form.secret}
          onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))}
          placeholder="Zadarma Secret Key"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={form.callbackExtension}
          onChange={(e) => setForm((f) => ({ ...f, callbackExtension: e.target.value }))}
          placeholder="Extension для CallBack (from), напр. 100"
          className="w-full sm:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.predicted}
          onChange={(e) => setForm((f) => ({ ...f, predicted: e.target.checked }))}
        />
        Режим predicted (сначала вызывается абонент «to» по документации Zadarma)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
        />
        Интеграция активна
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={testing}
          onClick={() => void runTest()}
          className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm hover:border-violet-400"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Проверить подключение
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void runSave()}
          className="px-3 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Сохранить
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void syncNumbers()}
          className="px-3 py-2 rounded-lg bg-white border border-violet-300 text-sm text-violet-800 hover:bg-violet-50"
        >
          Синхронизировать номера
        </button>
      </div>

      {zadarmaNumbers.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-gray-800 mb-2">Номера Zadarma в CRM</p>
          <div className="space-y-2">
            {zadarmaNumbers.map((n) => (
              <div key={n.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-lg px-3 py-2 text-sm">
                <div>
                  <span className="font-mono">{n.e164}</span>
                  {n.label ? <span className="text-gray-600 ml-2">{n.label}</span> : null}
                </div>
                {n.isDefault ? (
                  <span className="text-xs text-emerald-700">default</span>
                ) : (
                  <button type="button" onClick={() => void setDefault(n.id)} className="text-xs text-violet-700">
                    Сделать default
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-500">Номера не загружены — нажмите «Синхронизировать номера».</p>
      )}

      {err ? <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</div> : null}
      {ok ? (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{ok}</div>
      ) : null}
    </div>
  );
};
