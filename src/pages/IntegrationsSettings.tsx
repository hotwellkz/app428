import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getAuthToken } from '../lib/firebase/auth';
import { Plug, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Loader2, Sparkles, ShoppingBag, Phone } from 'lucide-react';

const API_INTEGRATION = '/.netlify/functions/wazzup-integration';
const API_VERIFY = '/.netlify/functions/wazzup-verify';
const API_OPENAI_INTEGRATION = '/.netlify/functions/openai-integration';
const API_KASPI_INTEGRATION = '/.netlify/functions/kaspi-integration';
const API_KASPI_VERIFY = '/.netlify/functions/kaspi-verify';
const API_KASPI_SYNC = '/.netlify/functions/kaspi-sync-orders';
const API_VOICE_INTEGRATION = '/.netlify/functions/voice-integration';
const API_VOICE_NUMBERS = '/.netlify/functions/voice-numbers';

const looksLikeEmail = (s: string) => /@/.test(s.trim());

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

interface IntegrationState {
  configured: boolean;
  apiKeyMasked: string | null;
  whatsappChannelId: string | null;
  instagramChannelId: string | null;
  connectionStatus: string | null;
  connectionError: string | null;
  lastCheckedAt: string | null;
}

interface VoiceIntegrationState {
  configured: boolean;
  enabled: boolean;
  accountSidMasked: string | null;
  twilioAccountType: string | null;
  twilioAccountStatus: string | null;
  connectionStatus: 'connected' | 'not_connected' | 'invalid_config';
  connectionError: string | null;
  voiceReady: boolean;
  hasDefaultOutbound: boolean;
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
  const [voiceState, setVoiceState] = useState<VoiceIntegrationState>({
    configured: false,
    enabled: false,
    accountSidMasked: null,
    twilioAccountType: null,
    twilioAccountStatus: null,
    connectionStatus: 'not_connected',
    connectionError: null,
    voiceReady: false,
    hasDefaultOutbound: false
  });
  const [voiceForm, setVoiceForm] = useState({
    accountSid: '',
    authToken: '',
    enabled: true,
    numberE164: '',
    numberLabel: ''
  });
  const [voiceNumbers, setVoiceNumbers] = useState<
    Array<{ id: string; e164: string; label: string | null; isDefault: boolean; isActive: boolean }>
  >([]);
  const [voiceLoading, setVoiceLoading] = useState(true);
  const [voiceSaving, setVoiceSaving] = useState(false);
  const [voiceTesting, setVoiceTesting] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceSuccess, setVoiceSuccess] = useState<string | null>(null);

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

  const fetchKaspi = async () => {
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
      if (data.configured && !kaspiForm.apiKey) {
        setKaspiForm((f) => ({
          ...f,
          merchantId: data.merchantId ?? '',
          merchantName: data.merchantName ?? '',
          enabled: data.enabled ?? false,
          syncMode: data.syncMode ?? 'four_times_daily'
        }));
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[IntegrationsSettings] fetchKaspi', e);
    } finally {
      setKaspiLoading(false);
    }
  };

  useEffect(() => {
    fetchKaspi();
  }, [user?.uid]);

  const fetchVoice = async () => {
    if (!user) return;
    setVoiceLoading(true);
    setVoiceError(null);
    try {
      const token = await getAuthToken();
      if (!token) return;
      const [integrationRes, numbersRes] = await Promise.all([
        fetch(API_VOICE_INTEGRATION, { method: 'GET', headers: { Authorization: `Bearer ${token}` } }),
        fetch(API_VOICE_NUMBERS, { method: 'GET', headers: { Authorization: `Bearer ${token}` } })
      ]);
      const integrationData = (await integrationRes.json().catch(() => ({}))) as Record<string, unknown>;
      const numbersData = (await numbersRes.json().catch(() => ({}))) as { items?: Array<Record<string, unknown>> };
      setVoiceState({
        configured: integrationData.configured === true,
        enabled: integrationData.enabled === true,
        accountSidMasked: (integrationData.accountSidMasked as string) ?? null,
        twilioAccountType: (integrationData.twilioAccountType as string) ?? null,
        twilioAccountStatus: (integrationData.twilioAccountStatus as string) ?? null,
        connectionStatus: (integrationData.connectionStatus as VoiceIntegrationState['connectionStatus']) ?? 'not_connected',
        connectionError: (integrationData.connectionError as string) ?? null,
        voiceReady: integrationData.voiceReady === true,
        hasDefaultOutbound: integrationData.hasDefaultOutbound === true
      });
      setVoiceNumbers(
        (numbersData.items ?? []).map((x) => ({
          id: String(x.id ?? ''),
          e164: String(x.e164 ?? ''),
          label: (x.label as string) ?? null,
          isDefault: x.isDefault === true,
          isActive: x.isActive !== false
        }))
      );
    } catch (e) {
      setVoiceError('Не удалось загрузить Voice настройки');
    } finally {
      setVoiceLoading(false);
    }
  };

  useEffect(() => {
    fetchVoice();
  }, [user?.uid]);

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
    } catch (e) {
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
        setKaspiSaving(false);
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
        setKaspiSaving(false);
        return;
      }
      setKaspiSuccess(data.message ?? 'Настройки Kaspi сохранены.');
      setKaspiForm((f) => ({ ...f, apiKey: '' }));
      fetchKaspi();
    } catch (e) {
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
        setKaspiSyncing(false);
        return;
      }
      const res = await fetch(API_KASPI_SYNC, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; processed?: number; found?: number };
      if (data.ok) {
        setKaspiSuccess(
          data.processed !== undefined
            ? `Синхронизация завершена. Новых заказов: ${data.processed}${data.found != null ? ` (найдено: ${data.found})` : ''}.`
            : 'Синхронизация запущена.'
        );
        fetchKaspi();
      } else {
        setKaspiError(data.error ?? 'Ошибка синхронизации');
      }
    } catch (e) {
      setKaspiError('Не удалось запустить синхронизацию.');
    } finally {
      setKaspiSyncing(false);
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
      fetchVoice();
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
      fetchVoice();
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
    fetchVoice();
  };

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

      {/* Блок Kaspi — заказы магазина */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-amber-600" />
            Kaspi — заказы магазина
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Подключите свой магазин на Kaspi.kz — заказы будут подтягиваться в CRM и отображаться в разделе Чаты. У каждой компании свой магазин и свои реквизиты.
          </p>
        </div>
        <div className="p-4 space-y-4">
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
                    {kaspiState.apiKeyMasked && (
                      <span className="text-emerald-600">({kaspiState.apiKeyMasked})</span>
                    )}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Merchant ID / ID магазина
                </label>
                <input
                  type="text"
                  value={kaspiForm.merchantId}
                  onChange={(e) => setKaspiForm((f) => ({ ...f, merchantId: e.target.value }))}
                  placeholder="Если требуется API Kaspi — укажите идентификатор магазина"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название магазина
                </label>
                <input
                  type="text"
                  value={kaspiForm.merchantName}
                  onChange={(e) => setKaspiForm((f) => ({ ...f, merchantName: e.target.value }))}
                  placeholder="Для отображения в интерфейсе (необязательно)"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Частота синхронизации
                </label>
                <select
                  value={kaspiForm.syncMode}
                  onChange={(e) => setKaspiForm((f) => ({ ...f, syncMode: e.target.value as KaspiSyncMode }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
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
                  onClick={handleKaspiVerify}
                  disabled={kaspiVerifying || (!kaspiForm.apiKey.trim() && !kaspiState.configured)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {kaspiVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Проверить подключение
                </button>
                <button
                  type="button"
                  onClick={handleKaspiSave}
                  disabled={kaspiSaving || (!kaspiForm.apiKey.trim() && !kaspiState.configured)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {kaspiSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={handleKaspiSyncNow}
                  disabled={kaspiSyncing || !kaspiState.configured}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {kaspiSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Синхронизировать сейчас
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Phone className="w-4 h-4 text-sky-600" />
            Voice / Telephony (Twilio)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Интеграция и номера изолированы по компании. Общий billing платформы не используется.
          </p>
        </div>
        <div className="p-4 space-y-4">
          {voiceLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Загрузка…
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className={`px-2 py-1 rounded-full border ${voiceState.connectionStatus === 'connected' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                  Provider: {voiceState.connectionStatus === 'connected' ? 'connected' : voiceState.connectionStatus}
                </span>
                <span className={`px-2 py-1 rounded-full border ${voiceState.hasDefaultOutbound ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                  Default outbound: {voiceState.hasDefaultOutbound ? 'selected' : 'missing'}
                </span>
                <span className={`px-2 py-1 rounded-full border ${voiceState.voiceReady ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  Voice: {voiceState.voiceReady ? 'ready' : 'not ready'}
                </span>
              </div>
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
                <input type="checkbox" checked={voiceForm.enabled} onChange={(e) => setVoiceForm((f) => ({ ...f, enabled: e.target.checked }))} />
                Интеграция активна
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={handleVoiceTest} disabled={voiceTesting} className="px-4 py-2 text-sm font-medium text-sky-700 bg-sky-50 border border-sky-200 rounded-lg">
                  {voiceTesting ? 'Проверка…' : 'Проверить подключение'}
                </button>
                <button type="button" onClick={handleVoiceSave} disabled={voiceSaving} className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg">
                  {voiceSaving ? 'Сохранение…' : 'Сохранить'}
                </button>
              </div>
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-gray-700 mb-2">Voice numbers</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={voiceForm.numberE164}
                    onChange={(e) => setVoiceForm((f) => ({ ...f, numberE164: e.target.value }))}
                    placeholder="+7701..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    value={voiceForm.numberLabel}
                    onChange={(e) => setVoiceForm((f) => ({ ...f, numberLabel: e.target.value }))}
                    placeholder="Label (Sales line)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <button type="button" onClick={handleVoiceNumberAdd} className="mt-2 px-4 py-2 text-sm font-medium border rounded-lg">
                  Добавить номер
                </button>
                <div className="mt-2 space-y-2">
                  {voiceNumbers.map((n) => (
                    <div key={n.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium text-gray-800">{n.label || n.e164}</p>
                        <p className="text-xs text-gray-500">{n.e164} · {n.isActive ? 'active' : 'inactive'}</p>
                      </div>
                      {n.isDefault ? (
                        <span className="text-xs text-emerald-700">default</span>
                      ) : (
                        <button type="button" onClick={() => void handleVoiceSetDefault(n.id)} className="text-xs text-sky-700">
                          Сделать default
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                ElevenLabs: coming soon (placeholder).
              </div>
              {voiceError ? <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{voiceError}</div> : null}
              {voiceSuccess ? <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{voiceSuccess}</div> : null}
              {voiceState.connectionError ? <div className="text-xs text-amber-800">{voiceState.connectionError}</div> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
