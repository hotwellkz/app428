import { useCallback, useEffect, useState } from 'react';
import { getAuthToken } from '../../../lib/firebase/auth';
import { API_VOICE_INTEGRATION, API_VOICE_NUMBERS } from '../apiEndpoints';

export type OutboundVoiceProviderPref = 'twilio' | 'telnyx' | 'zadarma';

export interface VoiceIntegrationState {
  configured: boolean;
  enabled: boolean;
  accountSidMasked: string | null;
  twilioAccountType: string | null;
  twilioAccountStatus: string | null;
  connectionStatus: 'connected' | 'not_connected' | 'invalid_config';
  connectionError: string | null;
  voiceReady: boolean;
  hasDefaultOutbound: boolean;
  outboundVoiceProvider: OutboundVoiceProviderPref;
}

export interface TelnyxVoiceState {
  configured: boolean;
  enabled: boolean;
  apiKeyMasked: string | null;
  publicKeySet: boolean;
  connectionId: string | null;
  connectionStatus: 'connected' | 'not_connected' | 'invalid_config';
  connectionError: string | null;
  voiceReady: boolean;
  hasDefaultOutbound: boolean;
  hasAnyNumbers: boolean;
  readinessMessages: string[];
  blockingReason: string | null;
  lastCheckedAt: string | null;
  lastSyncedAt: string | null;
  providerWebhookLastErrorCode: string | null;
  providerWebhookLastErrorAt: string | null;
  webhookSignatureOk: boolean;
  outboundWebhookBaseUrl: string | null;
}

export interface ZadarmaVoiceState {
  configured: boolean;
  enabled: boolean;
  keyMasked: string | null;
  secretMasked: string | null;
  callbackExtension: string | null;
  predicted: boolean;
  connectionStatus: 'connected' | 'not_connected' | 'invalid_config';
  connectionError: string | null;
  voiceReady: boolean;
  hasDefaultOutbound: boolean;
  hasAnyNumbers: boolean;
  readinessMessages: string[];
  blockingReason: string | null;
  lastCheckedAt: string | null;
  lastSyncedAt: string | null;
  providerWebhookLastErrorCode: string | null;
  providerWebhookLastErrorAt: string | null;
  webhookSignatureOk: boolean;
  outboundWebhookUrlHint: string | null;
  zdEchoNote: string | null;
  apiKeySet: boolean;
  apiSecretSet: boolean;
  extensionSet: boolean;
  webhookUrlHintReady: boolean;
  defaultOutboundSelected: boolean;
  lastWebhookReceivedAt: string | null;
  lastWebhookEventType: string | null;
  lastWebhookSignatureOk: boolean | null;
  lastOutboundAttemptAt: string | null;
  lastOutboundOk: boolean | null;
  lastOutboundFriendlyCode: string | null;
}

export interface VoiceNumberRow {
  id: string;
  e164: string;
  label: string | null;
  isDefault: boolean;
  isActive: boolean;
  provider: string;
}

const defaultVoice: VoiceIntegrationState = {
  configured: false,
  enabled: false,
  accountSidMasked: null,
  twilioAccountType: null,
  twilioAccountStatus: null,
  connectionStatus: 'not_connected',
  connectionError: null,
  voiceReady: false,
  hasDefaultOutbound: false,
  outboundVoiceProvider: 'twilio'
};

const defaultZadarma: ZadarmaVoiceState = {
  configured: false,
  enabled: false,
  keyMasked: null,
  secretMasked: null,
  callbackExtension: null,
  predicted: false,
  connectionStatus: 'not_connected',
  connectionError: null,
  voiceReady: false,
  hasDefaultOutbound: false,
  hasAnyNumbers: false,
  readinessMessages: [],
  blockingReason: null,
  lastCheckedAt: null,
  lastSyncedAt: null,
  providerWebhookLastErrorCode: null,
  providerWebhookLastErrorAt: null,
  webhookSignatureOk: true,
  outboundWebhookUrlHint: null,
  zdEchoNote: null,
  apiKeySet: false,
  apiSecretSet: false,
  extensionSet: false,
  webhookUrlHintReady: false,
  defaultOutboundSelected: false,
  lastWebhookReceivedAt: null,
  lastWebhookEventType: null,
  lastWebhookSignatureOk: null,
  lastOutboundAttemptAt: null,
  lastOutboundOk: null,
  lastOutboundFriendlyCode: null
};

const defaultTelnyx: TelnyxVoiceState = {
  configured: false,
  enabled: false,
  apiKeyMasked: null,
  publicKeySet: false,
  connectionId: null,
  connectionStatus: 'not_connected',
  connectionError: null,
  voiceReady: false,
  hasDefaultOutbound: false,
  hasAnyNumbers: false,
  readinessMessages: [],
  blockingReason: null,
  lastCheckedAt: null,
  lastSyncedAt: null,
  providerWebhookLastErrorCode: null,
  providerWebhookLastErrorAt: null,
  webhookSignatureOk: true,
  outboundWebhookBaseUrl: null
};

export function useVoiceTelephonyData(userUid: string | undefined) {
  const [voiceState, setVoiceState] = useState<VoiceIntegrationState>(defaultVoice);
  const [telnyxState, setTelnyxState] = useState<TelnyxVoiceState>(defaultTelnyx);
  const [zadarmaState, setZadarmaState] = useState<ZadarmaVoiceState>(defaultZadarma);
  const [voiceNumbers, setVoiceNumbers] = useState<VoiceNumberRow[]>([]);
  const [telnyxNumbers, setTelnyxNumbers] = useState<VoiceNumberRow[]>([]);
  const [zadarmaNumbers, setZadarmaNumbers] = useState<VoiceNumberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!userUid) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const token = await getAuthToken();
        if (!token || cancelled) {
          setLoading(false);
          return;
        }
        const [integrationRes, numbersRes, telnyxIntRes, telnyxNumRes, zadarmaIntRes, zadarmaNumRes] =
          await Promise.all([
            fetch(API_VOICE_INTEGRATION, { method: 'GET', headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_VOICE_NUMBERS}?provider=twilio`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_VOICE_INTEGRATION}?provider=telnyx`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_VOICE_NUMBERS}?provider=telnyx`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_VOICE_INTEGRATION}?provider=zadarma`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_VOICE_NUMBERS}?provider=zadarma`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } })
          ]);
        const integrationData = (await integrationRes.json().catch(() => ({}))) as Record<string, unknown>;
        const numbersData = (await numbersRes.json().catch(() => ({}))) as { items?: Array<Record<string, unknown>> };
        const telnyxData = (await telnyxIntRes.json().catch(() => ({}))) as Record<string, unknown>;
        const telnyxNums = (await telnyxNumRes.json().catch(() => ({}))) as { items?: Array<Record<string, unknown>> };
        const zadarmaData = (await zadarmaIntRes.json().catch(() => ({}))) as Record<string, unknown>;
        const zadarmaNums = (await zadarmaNumRes.json().catch(() => ({}))) as { items?: Array<Record<string, unknown>> };

        if (cancelled) return;

        const outbound: OutboundVoiceProviderPref =
          integrationData.outboundVoiceProvider === 'telnyx'
            ? 'telnyx'
            : integrationData.outboundVoiceProvider === 'zadarma'
              ? 'zadarma'
              : 'twilio';
        setVoiceState({
          configured: integrationData.configured === true,
          enabled: integrationData.enabled === true,
          accountSidMasked: (integrationData.accountSidMasked as string) ?? null,
          twilioAccountType: (integrationData.twilioAccountType as string) ?? null,
          twilioAccountStatus: (integrationData.twilioAccountStatus as string) ?? null,
          connectionStatus:
            (integrationData.connectionStatus as VoiceIntegrationState['connectionStatus']) ?? 'not_connected',
          connectionError: (integrationData.connectionError as string) ?? null,
          voiceReady: integrationData.voiceReady === true,
          hasDefaultOutbound: integrationData.hasDefaultOutbound === true,
          outboundVoiceProvider: outbound
        });
        setVoiceNumbers(
          (numbersData.items ?? []).map((x) => ({
            id: String(x.id ?? ''),
            e164: String(x.e164 ?? ''),
            label: (x.label as string) ?? null,
            isDefault: x.isDefault === true,
            isActive: x.isActive !== false,
            provider: String(x.provider ?? 'twilio')
          }))
        );
        setTelnyxState({
          configured: telnyxData.configured === true,
          enabled: telnyxData.enabled === true,
          apiKeyMasked: (telnyxData.apiKeyMasked as string) ?? null,
          publicKeySet: telnyxData.publicKeySet === true,
          connectionId: (telnyxData.connectionId as string) ?? null,
          connectionStatus:
            (telnyxData.connectionStatus as TelnyxVoiceState['connectionStatus']) ?? 'not_connected',
          connectionError: (telnyxData.connectionError as string) ?? null,
          voiceReady: telnyxData.voiceReady === true,
          hasDefaultOutbound: telnyxData.hasDefaultOutbound === true,
          hasAnyNumbers: telnyxData.hasAnyNumbers === true,
          readinessMessages: Array.isArray(telnyxData.readinessMessages)
            ? (telnyxData.readinessMessages as string[])
            : [],
          blockingReason: (telnyxData.blockingReason as string) ?? null,
          lastCheckedAt: (telnyxData.lastCheckedAt as string) ?? null,
          lastSyncedAt: (telnyxData.lastSyncedAt as string) ?? null,
          providerWebhookLastErrorCode: (telnyxData.providerWebhookLastErrorCode as string) ?? null,
          providerWebhookLastErrorAt: (telnyxData.providerWebhookLastErrorAt as string) ?? null,
          webhookSignatureOk: telnyxData.webhookSignatureOk !== false,
          outboundWebhookBaseUrl:
            typeof telnyxData.outboundWebhookBaseUrl === 'string' &&
            telnyxData.outboundWebhookBaseUrl.startsWith('http')
              ? telnyxData.outboundWebhookBaseUrl
              : null
        });
        setTelnyxNumbers(
          (telnyxNums.items ?? []).map((x) => ({
            id: String(x.id ?? ''),
            e164: String(x.e164 ?? ''),
            label: (x.label as string) ?? null,
            isDefault: x.isDefault === true,
            isActive: x.isActive !== false,
            provider: String(x.provider ?? 'telnyx')
          }))
        );
        setZadarmaState({
          configured: zadarmaData.configured === true,
          enabled: zadarmaData.enabled === true,
          keyMasked: (zadarmaData.keyMasked as string) ?? null,
          secretMasked: (zadarmaData.secretMasked as string) ?? null,
          callbackExtension: (zadarmaData.callbackExtension as string) ?? null,
          predicted: zadarmaData.predicted === true,
          connectionStatus:
            (zadarmaData.connectionStatus as ZadarmaVoiceState['connectionStatus']) ?? 'not_connected',
          connectionError: (zadarmaData.connectionError as string) ?? null,
          voiceReady: zadarmaData.voiceReady === true,
          hasDefaultOutbound: zadarmaData.hasDefaultOutbound === true,
          hasAnyNumbers: zadarmaData.hasAnyNumbers === true,
          readinessMessages: Array.isArray(zadarmaData.readinessMessages)
            ? (zadarmaData.readinessMessages as string[])
            : [],
          blockingReason: (zadarmaData.blockingReason as string) ?? null,
          lastCheckedAt: (zadarmaData.lastCheckedAt as string) ?? null,
          lastSyncedAt: (zadarmaData.lastSyncedAt as string) ?? null,
          providerWebhookLastErrorCode: (zadarmaData.providerWebhookLastErrorCode as string) ?? null,
          providerWebhookLastErrorAt: (zadarmaData.providerWebhookLastErrorAt as string) ?? null,
          webhookSignatureOk: zadarmaData.webhookSignatureOk !== false,
          outboundWebhookUrlHint:
            typeof zadarmaData.outboundWebhookUrlHint === 'string' ? zadarmaData.outboundWebhookUrlHint : null,
          zdEchoNote: typeof zadarmaData.zdEchoNote === 'string' ? zadarmaData.zdEchoNote : null,
          apiKeySet: zadarmaData.apiKeySet === true,
          apiSecretSet: zadarmaData.apiSecretSet === true,
          extensionSet: zadarmaData.extensionSet === true,
          webhookUrlHintReady: zadarmaData.webhookUrlHintReady === true,
          defaultOutboundSelected: zadarmaData.defaultOutboundSelected === true,
          lastWebhookReceivedAt: (zadarmaData.lastWebhookReceivedAt as string) ?? null,
          lastWebhookEventType: (zadarmaData.lastWebhookEventType as string) ?? null,
          lastWebhookSignatureOk:
            zadarmaData.lastWebhookSignatureOk === true || zadarmaData.lastWebhookSignatureOk === false
              ? zadarmaData.lastWebhookSignatureOk
              : null,
          lastOutboundAttemptAt: (zadarmaData.lastOutboundAttemptAt as string) ?? null,
          lastOutboundOk:
            zadarmaData.lastOutboundOk === true || zadarmaData.lastOutboundOk === false
              ? zadarmaData.lastOutboundOk
              : null,
          lastOutboundFriendlyCode: (zadarmaData.lastOutboundFriendlyCode as string) ?? null
        });
        setZadarmaNumbers(
          (zadarmaNums.items ?? []).map((x) => ({
            id: String(x.id ?? ''),
            e164: String(x.e164 ?? ''),
            label: (x.label as string) ?? null,
            isDefault: x.isDefault === true,
            isActive: x.isActive !== false,
            provider: String(x.provider ?? 'zadarma')
          }))
        );
      } catch {
        if (!cancelled) setLoadError('Не удалось загрузить Voice настройки');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userUid, tick]);

  return {
    voiceState,
    telnyxState,
    zadarmaState,
    voiceNumbers,
    telnyxNumbers,
    zadarmaNumbers,
    loading,
    loadError,
    refetch
  };
}
