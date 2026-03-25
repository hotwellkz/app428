import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue, type CollectionReference } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const COLLECTIONS = {
  CLIENTS: 'whatsappClients',
  CONVERSATIONS: 'whatsappConversations',
  MESSAGES: 'whatsappMessages',
  CRM_CLIENTS: 'clients',
  DEALS: 'deals',
  COMPANY_INVITES: 'company_invites',
  COMPANIES: 'companies',
  COMPANY_USERS: 'company_users',
  USERS: 'users',
  WAZZUP_INTEGRATIONS: 'wazzupIntegrations',
  OPENAI_INTEGRATIONS: 'openaiIntegrations',
  VOICE_INTEGRATIONS: 'voiceIntegrations',
  KASPI_INTEGRATIONS: 'kaspiIntegrations',
  KASPI_SYNC: 'kaspiSync'
} as const;

export type VoiceOutboundProviderPreference = 'twilio' | 'telnyx' | 'zadarma';

export type VoiceTelnyxConnectionStatus = 'connected' | 'not_connected' | 'invalid_config';

export type VoiceZadarmaConnectionStatus = 'connected' | 'not_connected' | 'invalid_config';

export interface VoiceIntegrationRow {
  companyId: string;
  provider: 'twilio';
  enabled: boolean;
  accountSid: string;
  accountSidMasked: string | null;
  authToken: string;
  authTokenMasked: string | null;
  connectionStatus: 'connected' | 'not_connected' | 'invalid_config';
  connectionError: string | null;
  lastCheckedAt: Timestamp | null;
  updatedAt: Timestamp;
  /** Последнее известное значение из Twilio API (Trial / Full и т.д.) */
  twilioAccountType?: string | null;
  twilioAccountStatus?: string | null;
  /** Какой провайдер используется для исходящих звонков (по умолчанию twilio). */
  outboundVoiceProvider?: VoiceOutboundProviderPreference;
  /** Telnyx: второй voice-провайдер в том же company-документе (merge, не затирает Twilio). */
  telnyxEnabled?: boolean;
  telnyxApiKey?: string;
  telnyxApiKeyMasked?: string | null;
  /** Публичный ключ Ed25519 (base64, 32 bytes) для проверки webhook. */
  telnyxPublicKey?: string;
  /** Опционально: Call Control Application / connection id для POST /v2/calls */
  telnyxConnectionId?: string | null;
  telnyxConnectionStatus?: VoiceTelnyxConnectionStatus;
  telnyxConnectionError?: string | null;
  telnyxLastCheckedAt?: Timestamp | null;
  /** Последняя успешная синхронизация номеров Telnyx из API. */
  telnyxLastSyncedAt?: Timestamp | null;
  /** Последняя ошибка webhook Telnyx (например неверная подпись) — для readiness/diagnostics. */
  telnyxWebhookLastErrorCode?: string | null;
  telnyxWebhookLastErrorAt?: Timestamp | null;
  /** Внутренняя причина (verify reason), не для показа пользователю как есть. */
  telnyxWebhookLastErrorDetail?: string | null;
  /** Zadarma: ключ API (user key) и секрет из личного кабинета my.zadarma.com/api/ */
  zadarmaEnabled?: boolean;
  zadarmaKey?: string;
  zadarmaKeyMasked?: string | null;
  zadarmaSecret?: string;
  zadarmaSecretMasked?: string | null;
  /** Внутренний номер АТС / SIP, на который сначала приходит CallBack (параметр from в request/callback). */
  zadarmaCallbackExtension?: string | null;
  /** Если true — режим predicted (сначала вызывается абонент to). */
  zadarmaPredicted?: boolean;
  zadarmaConnectionStatus?: VoiceZadarmaConnectionStatus;
  zadarmaConnectionError?: string | null;
  zadarmaLastCheckedAt?: Timestamp | null;
  zadarmaLastSyncedAt?: Timestamp | null;
  zadarmaWebhookLastErrorCode?: string | null;
  zadarmaWebhookLastErrorAt?: Timestamp | null;
  zadarmaWebhookLastErrorDetail?: string | null;
  /** Последний успешно принятый webhook Zadarma (после проверки подписи). */
  zadarmaLastWebhookAt?: Timestamp | null;
  zadarmaLastWebhookEventType?: string | null;
  /** Результат последней проверки подписи (true = ок). */
  zadarmaLastWebhookSignatureOk?: boolean | null;
  /** Исходящий звонок: попытка и результат (без секретов). */
  zadarmaLastOutboundAttemptAt?: Timestamp | null;
  zadarmaLastOutboundOk?: boolean | null;
  zadarmaLastOutboundFriendlyCode?: string | null;
}

function maskRight4(value: string): string {
  if (!value || value.length <= 4) return '****';
  return '****' + value.slice(-4);
}

export async function getVoiceIntegration(companyId: string): Promise<VoiceIntegrationRow | null> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.VOICE_INTEGRATIONS).doc(companyId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  const accountSid = ((d.accountSid as string) ?? '').trim();
  const authToken = ((d.authToken as string) ?? '').trim();
  const telnyxApiKey = ((d.telnyxApiKey as string) ?? '').trim();
  const zadarmaKey = ((d.zadarmaKey as string) ?? '').trim();
  const zadarmaSecret = ((d.zadarmaSecret as string) ?? '').trim();
  const outboundRaw = (d.outboundVoiceProvider as string) ?? 'twilio';
  const outboundVoiceProvider: VoiceOutboundProviderPreference =
    outboundRaw === 'telnyx' ? 'telnyx' : outboundRaw === 'zadarma' ? 'zadarma' : 'twilio';
  return {
    companyId,
    provider: 'twilio',
    enabled: d.enabled === true,
    accountSid,
    accountSidMasked: (d.accountSidMasked as string) ?? (accountSid ? maskRight4(accountSid) : null),
    authToken,
    authTokenMasked: (d.authTokenMasked as string) ?? (authToken ? maskRight4(authToken) : null),
    connectionStatus: (d.connectionStatus as VoiceIntegrationRow['connectionStatus']) ?? 'not_connected',
    connectionError: (d.connectionError as string) ?? null,
    lastCheckedAt: (d.lastCheckedAt as Timestamp) ?? null,
    updatedAt: (d.updatedAt as Timestamp) ?? Timestamp.now(),
    twilioAccountType: (d.twilioAccountType as string) ?? null,
    twilioAccountStatus: (d.twilioAccountStatus as string) ?? null,
    outboundVoiceProvider,
    telnyxEnabled: d.telnyxEnabled === true,
    telnyxApiKey,
    telnyxApiKeyMasked:
      (d.telnyxApiKeyMasked as string) ?? (telnyxApiKey ? maskRight4(telnyxApiKey) : null),
    telnyxPublicKey: ((d.telnyxPublicKey as string) ?? '').trim(),
    telnyxConnectionId: (d.telnyxConnectionId as string)?.trim() || null,
    telnyxConnectionStatus: (d.telnyxConnectionStatus as VoiceTelnyxConnectionStatus) ?? 'not_connected',
    telnyxConnectionError: (d.telnyxConnectionError as string) ?? null,
    telnyxLastCheckedAt: (d.telnyxLastCheckedAt as Timestamp) ?? null,
    telnyxLastSyncedAt: (d.telnyxLastSyncedAt as Timestamp) ?? null,
    telnyxWebhookLastErrorCode: (d.telnyxWebhookLastErrorCode as string) ?? null,
    telnyxWebhookLastErrorAt: (d.telnyxWebhookLastErrorAt as Timestamp) ?? null,
    telnyxWebhookLastErrorDetail: (d.telnyxWebhookLastErrorDetail as string) ?? null,
    zadarmaEnabled: d.zadarmaEnabled === true,
    zadarmaKey,
    zadarmaKeyMasked: (d.zadarmaKeyMasked as string) ?? (zadarmaKey ? maskRight4(zadarmaKey) : null),
    zadarmaSecret,
    zadarmaSecretMasked: (d.zadarmaSecretMasked as string) ?? (zadarmaSecret ? maskRight4(zadarmaSecret) : null),
    zadarmaCallbackExtension: (d.zadarmaCallbackExtension as string)?.trim() || null,
    zadarmaPredicted: d.zadarmaPredicted === true,
    zadarmaConnectionStatus: (d.zadarmaConnectionStatus as VoiceZadarmaConnectionStatus) ?? 'not_connected',
    zadarmaConnectionError: (d.zadarmaConnectionError as string) ?? null,
    zadarmaLastCheckedAt: (d.zadarmaLastCheckedAt as Timestamp) ?? null,
    zadarmaLastSyncedAt: (d.zadarmaLastSyncedAt as Timestamp) ?? null,
    zadarmaWebhookLastErrorCode: (d.zadarmaWebhookLastErrorCode as string) ?? null,
    zadarmaWebhookLastErrorAt: (d.zadarmaWebhookLastErrorAt as Timestamp) ?? null,
    zadarmaWebhookLastErrorDetail: (d.zadarmaWebhookLastErrorDetail as string) ?? null,
    zadarmaLastWebhookAt: (d.zadarmaLastWebhookAt as Timestamp) ?? null,
    zadarmaLastWebhookEventType: (d.zadarmaLastWebhookEventType as string) ?? null,
    zadarmaLastWebhookSignatureOk:
      d.zadarmaLastWebhookSignatureOk === true || d.zadarmaLastWebhookSignatureOk === false
        ? d.zadarmaLastWebhookSignatureOk
        : null,
    zadarmaLastOutboundAttemptAt: (d.zadarmaLastOutboundAttemptAt as Timestamp) ?? null,
    zadarmaLastOutboundOk:
      d.zadarmaLastOutboundOk === true || d.zadarmaLastOutboundOk === false ? d.zadarmaLastOutboundOk : null,
    zadarmaLastOutboundFriendlyCode: (d.zadarmaLastOutboundFriendlyCode as string) ?? null
  };
}

export async function setVoiceIntegration(
  companyId: string,
  data: {
    provider?: 'twilio';
    enabled?: boolean;
    accountSid?: string;
    authToken?: string;
    connectionStatus?: VoiceIntegrationRow['connectionStatus'];
    connectionError?: string | null;
    lastCheckedAt?: Timestamp | null;
    twilioAccountType?: string | null;
    twilioAccountStatus?: string | null;
    outboundVoiceProvider?: VoiceOutboundProviderPreference;
  }
): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.VOICE_INTEGRATIONS).doc(companyId);
  const snap = await ref.get();
  const now = Timestamp.now();
  const payload: Record<string, unknown> = {
    companyId,
    provider: data.provider ?? 'twilio',
    updatedAt: now
  };
  if (data.outboundVoiceProvider !== undefined) payload.outboundVoiceProvider = data.outboundVoiceProvider;
  if (data.enabled !== undefined) payload.enabled = data.enabled;
  if (data.connectionStatus !== undefined) payload.connectionStatus = data.connectionStatus;
  if (data.connectionError !== undefined) payload.connectionError = data.connectionError;
  if (data.lastCheckedAt !== undefined) payload.lastCheckedAt = data.lastCheckedAt;
  if (data.accountSid !== undefined) {
    const sid = data.accountSid.trim();
    payload.accountSid = sid;
    payload.accountSidMasked = sid ? maskRight4(sid) : null;
  }
  if (data.authToken !== undefined) {
    const token = data.authToken.trim();
    payload.authToken = token;
    payload.authTokenMasked = token ? maskRight4(token) : null;
  }
  if (data.twilioAccountType !== undefined) payload.twilioAccountType = data.twilioAccountType;
  if (data.twilioAccountStatus !== undefined) payload.twilioAccountStatus = data.twilioAccountStatus;
  if (!snap.exists) {
    payload.createdAt = now;
    payload.enabled = payload.enabled ?? false;
    payload.connectionStatus = payload.connectionStatus ?? 'not_connected';
    payload.connectionError = payload.connectionError ?? null;
    payload.lastCheckedAt = payload.lastCheckedAt ?? null;
    payload.accountSid = payload.accountSid ?? '';
    payload.accountSidMasked = payload.accountSidMasked ?? null;
    payload.authToken = payload.authToken ?? '';
    payload.authTokenMasked = payload.authTokenMasked ?? null;
    await ref.set(payload);
    return;
  }
  await ref.update(payload);
}

/**
 * Частичное обновление Telnyx-полей и/или предпочтения исходящего провайдера (merge).
 */
export async function mergeVoiceIntegrationTelnyx(
  companyId: string,
  data: {
    telnyxEnabled?: boolean;
    telnyxApiKey?: string;
    telnyxPublicKey?: string;
    telnyxConnectionId?: string | null;
    telnyxConnectionStatus?: VoiceTelnyxConnectionStatus;
    telnyxConnectionError?: string | null;
    telnyxLastCheckedAt?: Timestamp | null;
    telnyxLastSyncedAt?: Timestamp | null;
    telnyxWebhookLastErrorCode?: string | null;
    telnyxWebhookLastErrorAt?: Timestamp | null;
    telnyxWebhookLastErrorDetail?: string | null;
    outboundVoiceProvider?: VoiceOutboundProviderPreference;
  }
): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.VOICE_INTEGRATIONS).doc(companyId);
  const snap = await ref.get();
  const now = Timestamp.now();
  const payload: Record<string, unknown> = { companyId, updatedAt: now };
  if (data.telnyxEnabled !== undefined) payload.telnyxEnabled = data.telnyxEnabled;
  if (data.telnyxConnectionStatus !== undefined) payload.telnyxConnectionStatus = data.telnyxConnectionStatus;
  if (data.telnyxConnectionError !== undefined) payload.telnyxConnectionError = data.telnyxConnectionError;
  if (data.telnyxLastCheckedAt !== undefined) payload.telnyxLastCheckedAt = data.telnyxLastCheckedAt;
  if (data.telnyxLastSyncedAt !== undefined) payload.telnyxLastSyncedAt = data.telnyxLastSyncedAt;
  if (data.telnyxWebhookLastErrorCode !== undefined) payload.telnyxWebhookLastErrorCode = data.telnyxWebhookLastErrorCode;
  if (data.telnyxWebhookLastErrorAt !== undefined) payload.telnyxWebhookLastErrorAt = data.telnyxWebhookLastErrorAt;
  if (data.telnyxWebhookLastErrorDetail !== undefined) payload.telnyxWebhookLastErrorDetail = data.telnyxWebhookLastErrorDetail;
  if (data.telnyxConnectionId !== undefined) payload.telnyxConnectionId = data.telnyxConnectionId;
  if (data.outboundVoiceProvider !== undefined) payload.outboundVoiceProvider = data.outboundVoiceProvider;
  if (data.telnyxApiKey !== undefined) {
    const k = data.telnyxApiKey.trim();
    payload.telnyxApiKey = k;
    payload.telnyxApiKeyMasked = k ? maskRight4(k) : null;
  }
  if (data.telnyxPublicKey !== undefined) {
    payload.telnyxPublicKey = data.telnyxPublicKey.trim();
  }
  if (!snap.exists) {
    payload.provider = 'twilio';
    payload.enabled = false;
    payload.connectionStatus = 'not_connected';
    payload.connectionError = null;
    payload.lastCheckedAt = null;
    payload.accountSid = '';
    payload.accountSidMasked = null;
    payload.authToken = '';
    payload.authTokenMasked = null;
    payload.createdAt = now;
    await ref.set(payload);
    return;
  }
  await ref.update(payload);
}

export async function setOutboundVoiceProviderPreference(
  companyId: string,
  pref: VoiceOutboundProviderPreference
): Promise<void> {
  await mergeVoiceIntegrationZadarma(companyId, { outboundVoiceProvider: pref });
}

/**
 * Частичное обновление полей Zadarma и/или предпочтения исходящего провайдера (merge).
 */
export async function mergeVoiceIntegrationZadarma(
  companyId: string,
  data: {
    zadarmaEnabled?: boolean;
    zadarmaKey?: string;
    zadarmaSecret?: string;
    zadarmaCallbackExtension?: string | null;
    zadarmaPredicted?: boolean;
    zadarmaConnectionStatus?: VoiceZadarmaConnectionStatus;
    zadarmaConnectionError?: string | null;
    zadarmaLastCheckedAt?: Timestamp | null;
    zadarmaLastSyncedAt?: Timestamp | null;
    zadarmaWebhookLastErrorCode?: string | null;
    zadarmaWebhookLastErrorAt?: Timestamp | null;
    zadarmaWebhookLastErrorDetail?: string | null;
    zadarmaLastWebhookAt?: Timestamp | null;
    zadarmaLastWebhookEventType?: string | null;
    zadarmaLastWebhookSignatureOk?: boolean | null;
    zadarmaLastOutboundAttemptAt?: Timestamp | null;
    zadarmaLastOutboundOk?: boolean | null;
    zadarmaLastOutboundFriendlyCode?: string | null;
    outboundVoiceProvider?: VoiceOutboundProviderPreference;
  }
): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.VOICE_INTEGRATIONS).doc(companyId);
  const snap = await ref.get();
  const now = Timestamp.now();
  const payload: Record<string, unknown> = { companyId, updatedAt: now };
  if (data.zadarmaEnabled !== undefined) payload.zadarmaEnabled = data.zadarmaEnabled;
  if (data.zadarmaConnectionStatus !== undefined) payload.zadarmaConnectionStatus = data.zadarmaConnectionStatus;
  if (data.zadarmaConnectionError !== undefined) payload.zadarmaConnectionError = data.zadarmaConnectionError;
  if (data.zadarmaLastCheckedAt !== undefined) payload.zadarmaLastCheckedAt = data.zadarmaLastCheckedAt;
  if (data.zadarmaLastSyncedAt !== undefined) payload.zadarmaLastSyncedAt = data.zadarmaLastSyncedAt;
  if (data.zadarmaWebhookLastErrorCode !== undefined) payload.zadarmaWebhookLastErrorCode = data.zadarmaWebhookLastErrorCode;
  if (data.zadarmaWebhookLastErrorAt !== undefined) payload.zadarmaWebhookLastErrorAt = data.zadarmaWebhookLastErrorAt;
  if (data.zadarmaWebhookLastErrorDetail !== undefined) payload.zadarmaWebhookLastErrorDetail = data.zadarmaWebhookLastErrorDetail;
  if (data.zadarmaLastWebhookAt !== undefined) payload.zadarmaLastWebhookAt = data.zadarmaLastWebhookAt;
  if (data.zadarmaLastWebhookEventType !== undefined) payload.zadarmaLastWebhookEventType = data.zadarmaLastWebhookEventType;
  if (data.zadarmaLastWebhookSignatureOk !== undefined) payload.zadarmaLastWebhookSignatureOk = data.zadarmaLastWebhookSignatureOk;
  if (data.zadarmaLastOutboundAttemptAt !== undefined) payload.zadarmaLastOutboundAttemptAt = data.zadarmaLastOutboundAttemptAt;
  if (data.zadarmaLastOutboundOk !== undefined) payload.zadarmaLastOutboundOk = data.zadarmaLastOutboundOk;
  if (data.zadarmaLastOutboundFriendlyCode !== undefined)
    payload.zadarmaLastOutboundFriendlyCode = data.zadarmaLastOutboundFriendlyCode;
  if (data.zadarmaCallbackExtension !== undefined) payload.zadarmaCallbackExtension = data.zadarmaCallbackExtension;
  if (data.zadarmaPredicted !== undefined) payload.zadarmaPredicted = data.zadarmaPredicted;
  if (data.outboundVoiceProvider !== undefined) payload.outboundVoiceProvider = data.outboundVoiceProvider;
  if (data.zadarmaKey !== undefined) {
    const k = data.zadarmaKey.trim();
    payload.zadarmaKey = k;
    payload.zadarmaKeyMasked = k ? maskRight4(k) : null;
  }
  if (data.zadarmaSecret !== undefined) {
    const s = data.zadarmaSecret.trim();
    payload.zadarmaSecret = s;
    payload.zadarmaSecretMasked = s ? maskRight4(s) : null;
  }
  if (!snap.exists) {
    payload.provider = 'twilio';
    payload.enabled = false;
    payload.connectionStatus = 'not_connected';
    payload.connectionError = null;
    payload.lastCheckedAt = null;
    payload.accountSid = '';
    payload.accountSidMasked = null;
    payload.authToken = '';
    payload.authTokenMasked = null;
    payload.createdAt = now;
    await ref.set(payload);
    return;
  }
  await ref.update(payload);
}

/** Режим синхронизации заказов Kaspi */
export type KaspiSyncMode = 'manual' | 'four_times_daily' | 'every_4h' | 'every_2h';

/** Настройки интеграции Kaspi для компании (свой магазин на компанию). */
export interface KaspiIntegrationRow {
  companyId: string;
  enabled: boolean;
  apiKey: string;
  merchantId: string | null;
  merchantName: string | null;
  syncMode: KaspiSyncMode;
  lastSyncAt: Timestamp | null;
  lastSyncStatus: 'success' | 'error' | null;
  lastSyncMessage: string | null;
  lastSyncOrdersCount: number | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export async function getKaspiIntegration(companyId: string): Promise<KaspiIntegrationRow | null> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.KASPI_INTEGRATIONS).doc(companyId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return {
    companyId,
    enabled: (d.enabled as boolean) ?? false,
    apiKey: (d.apiKey as string) ?? '',
    merchantId: (d.merchantId as string) ?? null,
    merchantName: (d.merchantName as string) ?? null,
    syncMode: (d.syncMode as KaspiSyncMode) ?? 'manual',
    lastSyncAt: (d.lastSyncAt as Timestamp) ?? null,
    lastSyncStatus: (d.lastSyncStatus as 'success' | 'error') ?? null,
    lastSyncMessage: (d.lastSyncMessage as string) ?? null,
    lastSyncOrdersCount: (d.lastSyncOrdersCount as number) ?? null,
    createdAt: d.createdAt as Timestamp,
    updatedAt: d.updatedAt as Timestamp
  };
}

function maskKaspiApiKey(key: string): string {
  if (!key || key.length <= 4) return '****';
  return '****' + key.slice(-4);
}

export async function setKaspiIntegration(
  companyId: string,
  data: {
    enabled?: boolean;
    apiKey?: string;
    merchantId?: string | null;
    merchantName?: string | null;
    syncMode?: KaspiSyncMode;
    lastSyncAt?: Timestamp | null;
    lastSyncStatus?: 'success' | 'error' | null;
    lastSyncMessage?: string | null;
    lastSyncOrdersCount?: number | null;
  }
): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.KASPI_INTEGRATIONS).doc(companyId);
  const snap = await ref.get();
  const now = Timestamp.now();
  const payload: Record<string, unknown> = {
    companyId,
    updatedAt: now
  };
  if (data.enabled !== undefined) payload.enabled = data.enabled;
  if (data.apiKey !== undefined && data.apiKey.trim()) {
    payload.apiKey = data.apiKey.trim();
    payload.apiKeyMasked = maskKaspiApiKey(data.apiKey.trim());
  }
  if (data.merchantId !== undefined) payload.merchantId = data.merchantId?.trim() || null;
  if (data.merchantName !== undefined) payload.merchantName = data.merchantName?.trim() || null;
  if (data.syncMode !== undefined) payload.syncMode = data.syncMode;
  if (data.lastSyncAt !== undefined) payload.lastSyncAt = data.lastSyncAt;
  if (data.lastSyncStatus !== undefined) payload.lastSyncStatus = data.lastSyncStatus;
  if (data.lastSyncMessage !== undefined) payload.lastSyncMessage = data.lastSyncMessage;
  if (data.lastSyncOrdersCount !== undefined) payload.lastSyncOrdersCount = data.lastSyncOrdersCount;
  if (!snap.exists) {
    payload.createdAt = now;
    payload.enabled = payload.enabled ?? false;
    payload.merchantId = payload.merchantId ?? null;
    payload.merchantName = payload.merchantName ?? null;
    payload.syncMode = payload.syncMode ?? 'manual';
    payload.lastSyncAt = null;
    payload.lastSyncStatus = null;
    payload.lastSyncMessage = null;
    payload.lastSyncOrdersCount = null;
    if (!payload.apiKey) payload.apiKey = '';
    await ref.set(payload);
  } else {
    await ref.update(payload);
  }
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits ? `+${digits}` : phone.trim();
}

/** Собрать JSON из одной переменной или из частей FIREBASE_SA_1, FIREBASE_SA_2, ... (для обхода лимита 4KB в Lambda) */
function getFirebaseServiceAccountJson(): string {
  // Вариант A: классические env vars (удобно для Netlify UI)
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKeyRaw) {
    // Netlify обычно хранит многострочный ключ как строку с \n
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
    return JSON.stringify({
      type: 'service_account',
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey
    });
  }

  // Вариант B: готовый JSON (одной строкой)
  const single = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (single) return single;
  const parts: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const p = process.env[`FIREBASE_SA_${i}`];
    if (p) parts.push(p);
  }
  if (parts.length === 0) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SA_1,2,... is not set');
  return parts.join('');
}

export function getDb() {
  if (getApps().length === 0) {
    const json = getFirebaseServiceAccountJson();
    let credential: ServiceAccount;
    try {
      credential = JSON.parse(json) as ServiceAccount;
    } catch {
      throw new Error('Firebase service account JSON is invalid');
    }
    initializeApp({ credential: cert(credential) });
  }
  return getFirestore();
}

export interface WhatsAppClientRow {
  id: string;
  name: string;
  phone: string;
  createdAt: Timestamp;
  avatarUrl?: string | null;
}

export interface WhatsAppConversationRow {
  id: string;
  clientId: string;
  /** Номер для отображения/отправки, если клиент не загружен */
  phone?: string;
  /** ID канала Wazzup из webhook (отправка только через него) */
  wazzupChannelId?: string;
  /** instagram | whatsapp — транспорт из webhook */
  wazzupTransport?: string;
  /** chatId для API Wazzup (как во входящем сообщении) */
  wazzupChatId?: string;
  status: string;
  createdAt: Timestamp;
  unreadCount?: number;
  lastMessageAt?: Timestamp;
  /** Время последнего входящего сообщения (для derived state awaiting reply) */
  lastIncomingAt?: Timestamp;
  /** Время последнего исходящего сообщения (для derived state awaiting reply) */
  lastOutgoingAt?: Timestamp;
  /** Время последнего сообщения клиента (для аналитики unread) */
  lastClientMessageTime?: Timestamp;
  /** Время последнего сообщения менеджера (для аналитики unread) */
  lastManagerMessageTime?: Timestamp;
  /** Кто отправил последнее сообщение: client | manager */
  lastMessageSender?: 'client' | 'manager';
}

export async function findClientByPhone(phone: string, companyId?: string): Promise<WhatsAppClientRow | null> {
  const db = getDb();
  const normalized = normalizePhone(phone);
  const cid = companyId ?? DEFAULT_COMPANY_ID;
  const q = db
    .collection(COLLECTIONS.CLIENTS)
    .where('companyId', '==', cid)
    .where('phone', '==', normalized)
    .limit(1);
  const snap = await q.get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    id: d.id,
    name: (data.name as string) ?? '',
    phone: (data.phone as string) ?? normalized,
    createdAt: data.createdAt as Timestamp,
    avatarUrl: (data.avatarUrl as string | null) ?? null
  };
}

export const DEFAULT_COMPANY_ID = 'hotwell';

/** Настройки интеграции Wazzup для компании (self-service onboarding). */
export interface WazzupIntegrationRow {
  companyId: string;
  apiKey: string;
  whatsappChannelId: string | null;
  instagramChannelId: string | null;
  connectionStatus: 'ok' | 'error' | null;
  connectionError: string | null;
  lastCheckedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export async function getWazzupIntegration(companyId: string): Promise<WazzupIntegrationRow | null> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.WAZZUP_INTEGRATIONS).doc(companyId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return {
    companyId,
    apiKey: (d.apiKey as string) ?? '',
    whatsappChannelId: (d.whatsappChannelId as string) ?? null,
    instagramChannelId: (d.instagramChannelId as string) ?? null,
    connectionStatus: (d.connectionStatus as 'ok' | 'error') ?? null,
    connectionError: (d.connectionError as string) ?? null,
    lastCheckedAt: (d.lastCheckedAt as Timestamp) ?? null,
    createdAt: d.createdAt as Timestamp,
    updatedAt: d.updatedAt as Timestamp
  };
}

/** По channelId из webhook Wazzup определить companyId (по сохранённым настройкам интеграции). */
export async function getCompanyIdByWazzupChannelId(channelId: string): Promise<string | null> {
  const db = getDb();
  const cid = String(channelId ?? '').trim();
  if (!cid) return null;
  const snap = await db
    .collection(COLLECTIONS.WAZZUP_INTEGRATIONS)
    .where('whatsappChannelId', '==', cid)
    .limit(1)
    .get();
  if (!snap.empty) return snap.docs[0].id;
  const snapIg = await db
    .collection(COLLECTIONS.WAZZUP_INTEGRATIONS)
    .where('instagramChannelId', '==', cid)
    .limit(1)
    .get();
  if (!snapIg.empty) return snapIg.docs[0].id;
  return null;
}

/**
 * Найти единственную компанию с интеграцией Wazzup, у которой сохранён API-ключ,
 * но не указан channelId для данного транспорта (при первом входящем сообщении привязываем канал).
 */
export async function findSingleCompanyWithEmptyWazzupChannel(
  transport: 'whatsapp' | 'instagram'
): Promise<{ companyId: string; integration: WazzupIntegrationRow } | null> {
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.WAZZUP_INTEGRATIONS).get();
  const withKeyNoChannel: { companyId: string; integration: WazzupIntegrationRow }[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    const apiKey = (data.apiKey as string) ?? '';
    if (!apiKey.trim()) continue;
    const wa = (data.whatsappChannelId as string) ?? '';
    const ig = (data.instagramChannelId as string) ?? '';
    const waEmpty = !wa.trim();
    const igEmpty = !ig.trim();
    if (transport === 'whatsapp' && waEmpty) {
      withKeyNoChannel.push({
        companyId: d.id,
        integration: {
          companyId: d.id,
          apiKey: apiKey.trim(),
          whatsappChannelId: null,
          instagramChannelId: ig.trim() || null,
          connectionStatus: (data.connectionStatus as 'ok' | 'error') ?? null,
          connectionError: (data.connectionError as string) ?? null,
          lastCheckedAt: (data.lastCheckedAt as Timestamp) ?? null,
          createdAt: data.createdAt as Timestamp,
          updatedAt: data.updatedAt as Timestamp
        }
      });
    } else if (transport === 'instagram' && igEmpty) {
      withKeyNoChannel.push({
        companyId: d.id,
        integration: {
          companyId: d.id,
          apiKey: apiKey.trim(),
          whatsappChannelId: wa.trim() || null,
          instagramChannelId: null,
          connectionStatus: (data.connectionStatus as 'ok' | 'error') ?? null,
          connectionError: (data.connectionError as string) ?? null,
          lastCheckedAt: (data.lastCheckedAt as Timestamp) ?? null,
          createdAt: data.createdAt as Timestamp,
          updatedAt: data.updatedAt as Timestamp
        }
      });
    }
  }
  if (withKeyNoChannel.length !== 1) return null;
  return withKeyNoChannel[0];
}

/** Сохранить или обновить настройки Wazzup для компании. */
export async function setWazzupIntegration(
  companyId: string,
  data: {
    apiKey: string;
    whatsappChannelId?: string | null;
    instagramChannelId?: string | null;
    connectionStatus?: 'ok' | 'error' | null;
    connectionError?: string | null;
    lastCheckedAt?: Timestamp | null;
  }
): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.WAZZUP_INTEGRATIONS).doc(companyId);
  const snap = await ref.get();
  const now = Timestamp.now();
  const payload: Record<string, unknown> = {
    apiKey: data.apiKey.trim(),
    whatsappChannelId: data.whatsappChannelId?.trim() || null,
    instagramChannelId: data.instagramChannelId?.trim() || null,
    connectionStatus: data.connectionStatus ?? null,
    connectionError: data.connectionError ?? null,
    lastCheckedAt: data.lastCheckedAt ?? null,
    updatedAt: now
  };
  if (!snap.exists) {
    payload.companyId = companyId;
    payload.createdAt = now;
    await ref.set(payload);
  } else {
    await ref.update(payload);
  }
}

/** Получить API-ключ для отправки сообщений: из интеграции компании или из env (для DEFAULT_COMPANY_ID). */
export async function getWazzupApiKeyForCompany(companyId: string): Promise<string | null> {
  const integration = await getWazzupIntegration(companyId);
  if (integration?.apiKey?.trim()) return integration.apiKey.trim();
  if (companyId === DEFAULT_COMPANY_ID && process.env.WAZZUP_API_KEY?.trim()) {
    return process.env.WAZZUP_API_KEY.trim();
  }
  return null;
}

/** Получить companyId пользователя по uid (из company_users). */
export async function getCompanyIdForUser(uid: string): Promise<string | null> {
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.COMPANY_USERS).doc(uid).get();
  if (!snap.exists) return null;
  return (snap.data()?.companyId as string) ?? null;
}

/** OpenAI-интеграция компании: только ключ из БД, без fallback на env. */
export interface OpenAIIntegrationRow {
  companyId: string;
  apiKey: string;
  apiKeyMasked: string | null;
  updatedAt: Timestamp;
}

export async function getOpenAIIntegration(companyId: string): Promise<OpenAIIntegrationRow | null> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.OPENAI_INTEGRATIONS).doc(companyId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  const apiKey = (d.apiKey as string) ?? '';
  return {
    companyId,
    apiKey,
    apiKeyMasked: (d.apiKeyMasked as string) ?? (apiKey ? '****' + apiKey.slice(-4) : null),
    updatedAt: (d.updatedAt as Timestamp) ?? Timestamp.now()
  };
}

/** Получить OpenAI API key компании. Только из БД, без fallback на env. */
export async function getOpenAIApiKeyForCompany(companyId: string): Promise<string | null> {
  const row = await getOpenAIIntegration(companyId);
  if (row?.apiKey?.trim()) return row.apiKey.trim();
  return null;
}

function maskApiKeyForDisplay(key: string): string {
  if (!key || key.length <= 4) return '****';
  return '****' + key.slice(-4);
}

export async function setOpenAIIntegration(companyId: string, apiKey: string): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.OPENAI_INTEGRATIONS).doc(companyId);
  const trimmed = apiKey.trim();
  const now = Timestamp.now();
  const payload: Record<string, unknown> = {
    companyId,
    apiKey: trimmed,
    apiKeyMasked: maskApiKeyForDisplay(trimmed),
    updatedAt: now
  };
  const snap = await ref.get();
  if (!snap.exists) {
    payload.createdAt = now;
    await ref.set(payload);
  } else {
    await ref.update(payload);
  }
}

/** Стабильный ключ контакта Instagram (Wazzup chatId потока). */
export function instagramClientKey(chatId: string): string {
  return `instagram:${String(chatId).trim()}`;
}

export async function findClientByInstagramChatId(chatId: string, companyId?: string): Promise<WhatsAppClientRow | null> {
  const db = getDb();
  const key = instagramClientKey(chatId);
  const cid = companyId ?? DEFAULT_COMPANY_ID;
  const snap = await db
    .collection(COLLECTIONS.CLIENTS)
    .where('companyId', '==', cid)
    .where('phone', '==', key)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    id: d.id,
    name: (data.name as string) ?? '',
    phone: (data.phone as string) ?? key,
    createdAt: data.createdAt as Timestamp,
    avatarUrl: (data.avatarUrl as string | null) ?? null
  };
}

export async function createInstagramClient(
  chatId: string,
  name: string = '',
  avatarUrl?: string | null,
  companyId?: string
): Promise<string> {
  const db = getDb();
  const key = instagramClientKey(chatId);
  const cid = companyId ?? DEFAULT_COMPANY_ID;
  const ref = await db.collection(COLLECTIONS.CLIENTS).add({
    name: name || key,
    phone: key,
    avatarUrl: avatarUrl ?? null,
    createdAt: Timestamp.now(),
    companyId: cid,
    channel: 'instagram',
    source: 'Instagram'
  });
  return ref.id;
}

export async function createClient(phone: string, name: string = '', avatarUrl?: string | null, companyId?: string): Promise<string> {
  const db = getDb();
  const normalized = normalizePhone(phone);
  const cid = companyId ?? DEFAULT_COMPANY_ID;
  const ref = await db.collection(COLLECTIONS.CLIENTS).add({
    name: name || normalized,
    phone: normalized,
    avatarUrl: avatarUrl ?? null,
    createdAt: Timestamp.now(),
    companyId: cid
  });
  return ref.id;
}

export async function updateClientAvatar(clientId: string, avatarUrl: string): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.CLIENTS).doc(clientId);
  await ref.update({ avatarUrl });
}

export async function findConversationByClientId(clientId: string, companyId?: string): Promise<WhatsAppConversationRow | null> {
  const db = getDb();
  const cid = companyId ?? DEFAULT_COMPANY_ID;
  const snap = await db
    .collection(COLLECTIONS.CONVERSATIONS)
    .where('companyId', '==', cid)
    .where('clientId', '==', clientId)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    id: d.id,
    clientId: data.clientId as string,
    phone: data.phone as string | undefined,
    wazzupChannelId: data.wazzupChannelId as string | undefined,
    wazzupTransport: data.wazzupTransport as string | undefined,
    wazzupChatId: data.wazzupChatId as string | undefined,
    status: data.status as string,
    createdAt: data.createdAt as Timestamp,
    unreadCount: (data.unreadCount as number) ?? 0,
    lastMessageAt: data.lastMessageAt as Timestamp | undefined,
    lastIncomingAt: data.lastIncomingAt as Timestamp | undefined,
    lastOutgoingAt: data.lastOutgoingAt as Timestamp | undefined
  };
}

export async function createConversation(
  clientId: string,
  phone: string,
  options?: {
    channel?: 'whatsapp' | 'instagram';
    displayPhone?: string;
    wazzupChannelId?: string;
    wazzupTransport?: string;
    wazzupChatId?: string;
    companyId?: string;
  }
): Promise<string> {
  const db = getDb();
  const now = Timestamp.now();
  const channel = options?.channel ?? 'whatsapp';
  const phoneStored =
    channel === 'instagram' ? instagramClientKey(phone.replace(/^instagram:/, '')) : normalizePhone(phone);
  const cid = options?.companyId ?? DEFAULT_COMPANY_ID;
  const payload: Record<string, unknown> = {
    clientId,
    phone: options?.displayPhone ?? phoneStored,
    status: 'active',
    createdAt: now,
    lastMessageAt: now,
    unreadCount: 0,
    lastIncomingAt: null,
    lastOutgoingAt: null,
    lastClientMessageTime: null,
    lastManagerMessageTime: null,
    lastMessageSender: null,
    companyId: cid,
    channel,
    chatType: channel === 'instagram' ? 'instagram' : 'whatsapp'
  };
  if (options?.wazzupChannelId) payload.wazzupChannelId = options.wazzupChannelId;
  if (options?.wazzupTransport) payload.wazzupTransport = options.wazzupTransport;
  if (options?.wazzupChatId) payload.wazzupChatId = options.wazzupChatId;
  const ref = await db.collection(COLLECTIONS.CONVERSATIONS).add(payload);
  return ref.id;
}

/** Обновить маршрут Wazzup по каждому входящему webhook (несколько каналов без env). */
export async function syncConversationWazzupRouting(
  conversationId: string,
  meta: { channelId: string; transport: string; chatId: string }
): Promise<void> {
  const db = getDb();
  await db
    .collection(COLLECTIONS.CONVERSATIONS)
    .doc(conversationId)
    .update({
      wazzupChannelId: meta.channelId,
      wazzupTransport: meta.transport,
      wazzupChatId: meta.chatId
    });
}

/** Увеличить счётчик непрочитанных в диалоге (при входящем сообщении) */
export async function incrementUnreadCount(conversationId: string): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId);
  const now = Timestamp.now();
  await ref.update({
    unreadCount: FieldValue.increment(1),
    lastClientMessageTime: now,
    lastMessageSender: 'client'
  });
}

/**
 * Пометить диалог как прочитанный (источник истины в БД; после reload badge не вернётся).
 * Вызывается при открытии чата и при получении новых сообщений в уже открытом чате.
 */
export async function markConversationAsRead(
  conversationId: string,
  lastReadMessageId?: string | null,
  expectedCompanyId?: string
): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId);
  if (expectedCompanyId) {
    const snap = await ref.get();
    if (!snap.exists) {
      console.warn('[markConversationAsRead] conversation not found', { conversationId, expectedCompanyId });
      return;
    }
    const data = snap.data() as { companyId?: string } | undefined;
    if (data?.companyId && data.companyId !== expectedCompanyId) {
      console.warn('[markConversationAsRead] companyId mismatch, skip update', {
        conversationId,
        docCompanyId: data.companyId,
        expectedCompanyId
      });
      return;
    }
  }
  const update: Record<string, unknown> = {
    unreadCount: 0,
    lastReadAt: Timestamp.now()
  };
  if (lastReadMessageId) update.lastReadMessageId = lastReadMessageId;
  await ref.update(update);
}

export interface MessageAttachmentRow {
  type: 'image' | 'video' | 'audio' | 'voice' | 'file';
  url: string;
  mimeType?: string;
  fileName?: string;
  size?: number;
  thumbnailUrl?: string | null;
  /** Длительность в секундах (голосовое, аудио, видео), если известна */
  durationSeconds?: number;
}

type LastMessageMediaKind = 'image' | 'video' | 'audio' | 'voice' | 'file';

function formatDurationMmSsForPreview(totalSec: number): string {
  const s = Math.floor(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
  }
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/** Поля lastMessage* на диалоге: превью + тип медиа для списка чатов. */
function buildConversationLastMessageMediaFields(
  text: string,
  attachments?: MessageAttachmentRow[]
): {
  lastMessagePreview: string;
  lastMessageMedia: boolean;
  lastMessageMediaKind: LastMessageMediaKind | null;
  lastMessageAttachmentDurationSec: number | null;
} {
  const textPreview = (text || '').replace(/\s+/g, ' ').slice(0, 280);
  if (!attachments?.length) {
    return {
      lastMessagePreview: textPreview || '[медиа]',
      lastMessageMedia: false,
      lastMessageMediaKind: null,
      lastMessageAttachmentDurationSec: null
    };
  }
  const a = attachments[0];
  const durRaw =
    typeof a.durationSeconds === 'number' && Number.isFinite(a.durationSeconds) && a.durationSeconds >= 0
      ? Math.round(a.durationSeconds)
      : null;
  const durLabel = durRaw != null ? formatDurationMmSsForPreview(durRaw) : '';

  const kindRaw = a.type;
  const kind: LastMessageMediaKind = (
    ['image', 'video', 'audio', 'voice', 'file'].includes(kindRaw) ? kindRaw : 'file'
  ) as LastMessageMediaKind;

  const fileNameL = (a.fileName ?? '').toLowerCase();
  const mimeL = (a.mimeType ?? '').toLowerCase();
  const isVoiceLikeAudio =
    a.type === 'audio' &&
    (fileNameL.startsWith('voice.') ||
      (mimeL.includes('ogg') && mimeL.includes('opus')) ||
      mimeL.includes('codecs=opus') ||
      /^audio\/ogg\b/i.test(mimeL));

  const urlL = (a.url ?? '').toLowerCase();
  /** Wazzup: голосовые приходят как audio; в строке часто .ogg/opus, без fileName/mime. */
  const isWazzupStyleAudioAsVoice =
    a.type === 'audio' &&
    (urlL.includes('.ogg') ||
      urlL.includes('opus') ||
      (durRaw != null && !fileNameL.trim()) ||
      (!fileNameL.trim() && !mimeL.trim() && urlL.length > 0));

  if (a.type === 'voice' || isVoiceLikeAudio || isWazzupStyleAudioAsVoice) {
    return {
      lastMessagePreview: durLabel ? `Голосовое сообщение · ${durLabel}` : 'Голосовое сообщение',
      lastMessageMedia: true,
      lastMessageMediaKind: 'voice',
      lastMessageAttachmentDurationSec: durRaw
    };
  }

  return {
    lastMessagePreview: '[медиа]',
    lastMessageMedia: true,
    lastMessageMediaKind: kind,
    lastMessageAttachmentDurationSec: kind === 'audio' || kind === 'video' ? durRaw : null
  };
}

export interface SaveMessageOptions {
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  providerMessageId?: string | null;
  attachments?: MessageAttachmentRow[];
  errorMessage?: string | null;
  repliedToMessageId?: string | null;
  forwarded?: boolean;
  /** Канал сообщения (WhatsApp / Instagram). */
  channel?: 'whatsapp' | 'instagram';
  companyId?: string;
}

export async function saveMessage(
  conversationId: string,
  text: string,
  direction: 'incoming' | 'outgoing',
  options: SaveMessageOptions = {}
): Promise<string> {
  const db = getDb();
  const now = Timestamp.now();
  const data: Record<string, unknown> = {
    conversationId,
    text,
    direction,
    createdAt: now,
    channel: options.channel ?? 'whatsapp',
    companyId: options.companyId ?? DEFAULT_COMPANY_ID
  };
  if (options.status != null) data.status = options.status;
  if (options.providerMessageId != null) data.providerMessageId = options.providerMessageId;
  if (options.attachments != null && options.attachments.length > 0) {
    data.attachments = options.attachments;
  }
  if (options.errorMessage != null) data.errorMessage = options.errorMessage;
  if (options.repliedToMessageId != null) data.repliedToMessageId = options.repliedToMessageId;
  if (options.forwarded === true) data.forwarded = true;
  const ref = await db.collection(COLLECTIONS.MESSAGES).add(data);
  const convRef = db.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId);
  const mediaFields = buildConversationLastMessageMediaFields(text, options.attachments);
  const convUpdate: Record<string, unknown> = {
    lastMessageAt: now,
    lastMessagePreview: mediaFields.lastMessagePreview,
    lastMessageMedia: mediaFields.lastMessageMedia,
    lastMessageMediaKind: mediaFields.lastMessageMediaKind,
    lastMessageAttachmentDurationSec: mediaFields.lastMessageAttachmentDurationSec
  };
  if (direction === 'incoming') {
    convUpdate.lastIncomingAt = now;
    convUpdate.lastClientMessageTime = now;
    convUpdate.lastMessageSender = 'client';
    // Входящее сообщение увеличивает unreadCount, но здесь не изменяем счётчик:
    // для webhook используется incrementUnreadCount, чтобы избежать двойного инкремента.
  }
  if (direction === 'outgoing') {
    convUpdate.lastOutgoingAt = now;
    convUpdate.lastManagerMessageTime = now;
    convUpdate.lastMessageSender = 'manager';
    convUpdate.unreadCount = 0;
  }
  await convRef.update(convUpdate);
  return ref.id;
}

/** Вложения из документа сообщения Firestore → строка для preview builder. */
function attachmentsFromFirestoreForPreview(arr: unknown[] | undefined): MessageAttachmentRow[] | undefined {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  return arr.map((raw) => {
    const o = raw as Record<string, unknown>;
    const type = (o.type as MessageAttachmentRow['type']) || 'file';
    return {
      type: ['image', 'video', 'audio', 'voice', 'file'].includes(type) ? type : 'file',
      url: String(o.url ?? ''),
      mimeType: o.mimeType as string | undefined,
      fileName: o.fileName as string | undefined,
      size: typeof o.size === 'number' ? o.size : undefined,
      thumbnailUrl: (o.thumbnailUrl as string | null) ?? undefined,
      durationSeconds:
        typeof o.durationSeconds === 'number' && Number.isFinite(o.durationSeconds) && o.durationSeconds >= 0
          ? o.durationSeconds
          : undefined
    };
  });
}

/**
 * Upsert-сохранение сообщения по providerMessageId (используется в webhook Wazzup).
 * Если сообщение с таким providerMessageId уже есть — обновляем его (text/attachments) и conversation.last*,
 * иначе создаём новое сообщение как в saveMessage.
 */
export async function upsertMessageFromWebhook(
  conversationId: string,
  text: string,
  direction: 'incoming' | 'outgoing',
  options: SaveMessageOptions = {}
): Promise<{ id: string; created: boolean }> {
  const db = getDb();
  const now = Timestamp.now();
  const providerId = options.providerMessageId ?? null;

  if (providerId) {
    const existingSnap = await db
      .collection(COLLECTIONS.MESSAGES)
      .where('providerMessageId', '==', providerId)
      .limit(1)
      .get();
    if (!existingSnap.empty) {
      const docRef = existingSnap.docs[0].ref;
      const update: Record<string, unknown> = {};
      // Обновляем текст, если был пустой/технический
      const existingData = existingSnap.docs[0].data() as { text?: string; attachments?: unknown[] };
      if (text && (!existingData.text || existingData.text === '[no text]')) {
        update.text = text;
      }
      if (options.attachments && options.attachments.length > 0 && !existingData.attachments) {
        update.attachments = options.attachments;
      }
      if (direction && existingData && existingData['direction'] !== direction) {
        update.direction = direction;
      }
      if (Object.keys(update).length > 0) {
        await docRef.update(update);
      }
      const convRef = db.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId);
      /** Повторные webhook без attachments не должны затирать превью: берём вложения из запроса или из уже сохранённого сообщения. */
      const attachmentsForPreview =
        options.attachments && options.attachments.length > 0
          ? options.attachments
          : attachmentsFromFirestoreForPreview(existingData.attachments);
      const mergedText = (text || (existingData.text as string) || '').trim();
      const mediaFields = buildConversationLastMessageMediaFields(mergedText, attachmentsForPreview);
      const convUpdate: Record<string, unknown> = {
        lastMessageAt: now,
        lastMessagePreview: mediaFields.lastMessagePreview,
        lastMessageMedia: mediaFields.lastMessageMedia,
        lastMessageMediaKind: mediaFields.lastMessageMediaKind,
        lastMessageAttachmentDurationSec: mediaFields.lastMessageAttachmentDurationSec
      };
      if (direction === 'incoming') {
        convUpdate.lastIncomingAt = now;
        convUpdate.lastClientMessageTime = now;
        convUpdate.lastMessageSender = 'client';
      }
      if (direction === 'outgoing') {
        convUpdate.lastOutgoingAt = now;
        convUpdate.lastManagerMessageTime = now;
        convUpdate.lastMessageSender = 'manager';
        convUpdate.unreadCount = 0;
      }
      await convRef.update(convUpdate);
      return { id: docRef.id, created: false };
    }
  }

  const id = await saveMessage(conversationId, text, direction, {
    ...options,
    channel: options.channel ?? 'whatsapp'
  });
  return { id, created: true };
}

/** Обновить статус сообщения по providerMessageId (из webhook statuses). */
export async function updateMessageStatus(
  providerMessageId: string,
  status: 'sent' | 'delivered' | 'read' | 'failed',
  errorMessage?: string | null
): Promise<boolean> {
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.MESSAGES)
    .where('providerMessageId', '==', providerMessageId)
    .limit(1)
    .get();
  if (snap.empty) return false;
  const ref = snap.docs[0].ref;
   const docData = snap.docs[0].data() as { direction?: string; channel?: string } | undefined;
  const update: Record<string, unknown> = {
    status,
    statusUpdatedAt: Timestamp.now()
  };
  if (status === 'failed' && errorMessage != null) update.errorMessage = errorMessage;
  await ref.update(update);
  if (process.env.WAZZUP_WEBHOOK_DEBUG === '1') {
    // Диагностика: статусы в webhook в основном приходят для исходящих сообщений (direction === 'outgoing').
    // Это важно для понимания ограничений read/unread-sync: статусы не сигнализируют о прочтении входящих в сторонних клиентах.
    // eslint-disable-next-line no-console
    console.log('[firebaseAdmin.updateMessageStatus]', {
      providerMessageId,
      newStatus: status,
      direction: docData?.direction ?? null,
      channel: docData?.channel ?? null
    });
  }
  return true;
}

// --- CRM: clients (по phone) и deals (по clientPhone) ---

export interface CrmClientRow {
  id: string;
  phone: string;
  name: string | null;
  source: string;
  createdAt: Timestamp;
  lastMessageAt: Timestamp;
}

export async function findCrmClientByPhone(phone: string, companyId?: string): Promise<CrmClientRow | null> {
  const db = getDb();
  const normalized = normalizePhone(phone);
  const cid = companyId ?? DEFAULT_COMPANY_ID;
  const snap = await db
    .collection(COLLECTIONS.CRM_CLIENTS)
    .where('companyId', '==', cid)
    .where('phone', '==', normalized)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    id: d.id,
    phone: (data.phone as string) ?? normalized,
    name: (data.name as string) ?? null,
    source: (data.source as string) ?? 'whatsapp',
    createdAt: data.createdAt as Timestamp,
    lastMessageAt: data.lastMessageAt as Timestamp
  };
}

export async function createCrmClient(phone: string, companyId?: string): Promise<string> {
  const db = getDb();
  const normalized = normalizePhone(phone);
  const cid = companyId ?? DEFAULT_COMPANY_ID;
  const now = Timestamp.now();
  const ref = await db.collection(COLLECTIONS.CRM_CLIENTS).add({
    phone: normalized,
    name: null,
    source: 'whatsapp',
    createdAt: now,
    lastMessageAt: now,
    companyId: cid
  });
  return ref.id;
}

export async function findCrmClientByExternalKey(key: string, companyId?: string): Promise<CrmClientRow | null> {
  const db = getDb();
  const cid = companyId ?? DEFAULT_COMPANY_ID;
  const snap = await db
    .collection(COLLECTIONS.CRM_CLIENTS)
    .where('companyId', '==', cid)
    .where('phone', '==', key)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    id: d.id,
    phone: (data.phone as string) ?? key,
    name: (data.name as string) ?? null,
    source: (data.source as string) ?? 'Instagram',
    createdAt: data.createdAt as Timestamp,
    lastMessageAt: data.lastMessageAt as Timestamp
  };
}

export async function createCrmClientInstagram(chatId: string, displayName: string, companyId?: string): Promise<string> {
  const db = getDb();
  const key = instagramClientKey(chatId);
  const cid = companyId ?? DEFAULT_COMPANY_ID;
  const now = Timestamp.now();
  const ref = await db.collection(COLLECTIONS.CRM_CLIENTS).add({
    phone: key,
    name: displayName || null,
    source: 'Instagram',
    channel: 'instagram',
    createdAt: now,
    lastMessageAt: now,
    companyId: cid
  });
  return ref.id;
}

export async function updateCrmClientLastMessageAt(clientId: string): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTIONS.CRM_CLIENTS).doc(clientId).update({
    lastMessageAt: Timestamp.now()
  });
}

export type DealStatus = 'new' | 'in_progress' | 'closed' | 'lost';

export interface DealRow {
  id: string;
  clientPhone: string;
  status: DealStatus;
  source: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export async function findDealByClientPhone(phone: string, companyId?: string): Promise<DealRow | null> {
  const db = getDb();
  const normalized = normalizePhone(phone);
  const cid = companyId ?? DEFAULT_COMPANY_ID;
  const snap = await db
    .collection(COLLECTIONS.DEALS)
    .where('companyId', '==', cid)
    .where('clientPhone', '==', normalized)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    id: d.id,
    clientPhone: (data.clientPhone as string) ?? normalized,
    status: (data.status as DealStatus) ?? 'new',
    source: (data.source as string) ?? 'whatsapp',
    createdAt: data.createdAt as Timestamp,
    updatedAt: data.updatedAt as Timestamp
  };
}

export async function createDeal(phone: string, companyId?: string): Promise<string> {
  const db = getDb();
  const normalized = normalizePhone(phone);
  const cid = companyId ?? DEFAULT_COMPANY_ID;
  const now = Timestamp.now();
  const ref = await db.collection(COLLECTIONS.DEALS).add({
    clientPhone: normalized,
    status: 'new',
    source: 'whatsapp',
    createdAt: now,
    updatedAt: now,
    companyId: cid
  });
  return ref.id;
}

export async function findDealByClientKey(clientKey: string, companyId?: string): Promise<DealRow | null> {
  const db = getDb();
  const cid = companyId ?? DEFAULT_COMPANY_ID;
  const snap = await db
    .collection(COLLECTIONS.DEALS)
    .where('companyId', '==', cid)
    .where('clientPhone', '==', clientKey)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    id: d.id,
    clientPhone: (data.clientPhone as string) ?? clientKey,
    status: (data.status as DealStatus) ?? 'new',
    source: (data.source as string) ?? 'Instagram',
    createdAt: data.createdAt as Timestamp,
    updatedAt: data.updatedAt as Timestamp
  };
}

export async function createDealInstagram(chatId: string, companyId?: string): Promise<string> {
  const db = getDb();
  const key = instagramClientKey(chatId);
  const cid = companyId ?? DEFAULT_COMPANY_ID;
  const now = Timestamp.now();
  const ref = await db.collection(COLLECTIONS.DEALS).add({
    clientPhone: key,
    status: 'new',
    source: 'Instagram',
    createdAt: now,
    updatedAt: now,
    companyId: cid
  });
  return ref.id;
}

/** Получить роль пользователя из Firestore (users/{uid}). */
export async function getUserRole(uid: string): Promise<string | null> {
  const db = getDb();
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return null;
  return (snap.data()?.role as string) ?? null;
}

/** Инициализировать app и вернуть Auth (для verifyIdToken). */
function ensureApp() {
  if (getApps().length === 0) {
    const json = getFirebaseServiceAccountJson();
    let credential: ServiceAccount;
    try {
      credential = JSON.parse(json) as ServiceAccount;
    } catch {
      throw new Error('Firebase service account JSON is invalid');
    }
    initializeApp({ credential: cert(credential) });
  }
  return getAuth();
}

/** Проверить ID token и вернуть uid. */
export async function verifyIdToken(idToken: string): Promise<string> {
  const auth = ensureApp();
  const decoded = await auth.verifyIdToken(idToken);
  return decoded.uid;
}

/** Мягкое удаление компании: status = deleted, deletedAt, deletedBy. Связанные данные не удаляются. */
export async function softDeleteCompany(companyId: string, deletedByUid: string): Promise<void> {
  const db = getDb();
  const companyRef = db.collection('companies').doc(companyId);
  const companySnap = await companyRef.get();
  if (!companySnap.exists) throw new Error('Company not found');
  await companyRef.update({
    status: 'deleted',
    deletedAt: Timestamp.now(),
    deletedBy: deletedByUid,
    updatedAt: Timestamp.now()
  });
}

/** Удалить все данные компании (hard delete). Использовать только при необходимости полного удаления. */
export async function deleteCompanyData(companyId: string): Promise<void> {
  const db = getDb();
  const BATCH_SIZE = 500;

  const deleteQueryBatch = async (ref: CollectionReference, field: string) => {
    const q = ref.where(field, '==', companyId).limit(BATCH_SIZE);
    const snap = await q.get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size === BATCH_SIZE) await deleteQueryBatch(ref, field);
  };

  const companyRef = db.collection('companies').doc(companyId);
  const companySnap = await companyRef.get();
  if (!companySnap.exists) throw new Error('Company not found');

  const companyUsersRef = db.collection('company_users');
  await deleteQueryBatch(companyUsersRef, 'companyId');

  const clientsRef = db.collection(COLLECTIONS.CRM_CLIENTS);
  await deleteQueryBatch(clientsRef, 'companyId');

  const transactionsRef = db.collection('transactions');
  await deleteQueryBatch(transactionsRef, 'companyId');

  const messagesRef = db.collection('messages');
  await deleteQueryBatch(messagesRef, 'companyId');

  const dealsRef = db.collection(COLLECTIONS.DEALS);
  await deleteQueryBatch(dealsRef, 'companyId');

  await companyRef.delete();
}

export { normalizePhone };

// ---------- Приглашения в компанию (multi-tenant) ----------

export interface InvitePublicInfo {
  companyName: string;
  email: string;
  role: string;
}

/** Получить публичную информацию приглашения по токену (для экрана принятия). */
export async function getInviteByToken(token: string): Promise<InvitePublicInfo | null> {
  const db = getDb();
  const now = new Date();
  const snap = await db
    .collection(COLLECTIONS.COMPANY_INVITES)
    .where('token', '==', token)
    .where('status', '==', 'pending')
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = doc.data();
  const expiresAt = data.expiresAt as { toDate?: () => Date } | Date | null;
  const expires =
    expiresAt && typeof (expiresAt as { toDate?: () => Date }).toDate === 'function'
      ? (expiresAt as { toDate: () => Date }).toDate()
      : expiresAt instanceof Date
        ? expiresAt
        : null;
  if (expires && expires.getTime() < now.getTime()) return null;
  const companyId = data.companyId as string;
  const companySnap = await db.collection(COLLECTIONS.COMPANIES).doc(companyId).get();
  const companyName = companySnap.exists ? ((companySnap.data()?.name as string) ?? '') : '';
  return {
    companyName,
    email: (data.email as string) ?? '',
    role: (data.role as string) ?? 'member'
  };
}

/** Принять приглашение: создать пользователя Auth, users, company_users, обновить invite. Возвращает customToken для входа. */
export async function acceptInvite(
  token: string,
  displayName: string,
  password: string
): Promise<{ customToken: string }> {
  const db = getDb();
  const auth = ensureApp();
  const now = new Date();
  const snap = await db
    .collection(COLLECTIONS.COMPANY_INVITES)
    .where('token', '==', token)
    .where('status', '==', 'pending')
    .limit(1)
    .get();
  if (snap.empty) {
    throw new Error('Приглашение недействительно или истекло');
  }
  const inviteRef = snap.docs[0].ref;
  const data = snap.docs[0].data();
  const expiresAt = data.expiresAt as { toDate?: () => Date } | Date | null;
  const expires =
    expiresAt && typeof (expiresAt as { toDate?: () => Date }).toDate === 'function'
      ? (expiresAt as { toDate: () => Date }).toDate()
      : expiresAt instanceof Date
        ? expiresAt
        : null;
  if (expires && expires.getTime() < now.getTime()) {
    throw new Error('Приглашение недействительно или истекло');
  }
  const companyId = data.companyId as string;
  const email = (data.email as string) ?? '';
  const role = (data.role as string) ?? 'member';
  if (!email) {
    throw new Error('Приглашение недействительно или истекло');
  }
  const trimmedName = (displayName ?? '').trim() || email.split('@')[0];
  let uid: string;
  try {
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: trimmedName
    });
    uid = userRecord.uid;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'auth/email-already-exists' || code === 'auth/email-already-in-use') {
      throw new Error('Пользователь с таким email уже зарегистрирован. Войдите в систему или используйте «Присоединиться по приглашению» с другим приглашением.');
    }
    throw err;
  }
  const timestamp = Timestamp.now();
  await db.collection(COLLECTIONS.USERS).doc(uid).set({
    email,
    displayName: trimmedName,
    role,
    companyId,
    isApproved: true,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await db.collection(COLLECTIONS.COMPANY_USERS).doc(uid).set({
    companyId,
    userId: uid,
    email,
    role,
    status: 'active',
    invitedBy: data.invitedBy ?? null,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await inviteRef.update({
    status: 'accepted',
    updatedAt: timestamp
  });
  const customToken = await auth.createCustomToken(uid);
  return { customToken };
}
