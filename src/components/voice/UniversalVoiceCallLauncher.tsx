import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { listVoiceNumbersByCompany } from '../../lib/firebase/voiceNumbers';
import { subscribeVoiceCallSession } from '../../lib/firebase/voiceCallSessions';
import { subscribeCrmAiBots } from '../../lib/firebase/crmAiBots';
import type { CrmAiBot } from '../../types/crmAiBot';
import type { VoiceNumber } from '../../types/voice';
import {
  fetchVoiceIntegrationStatus,
  launchVoiceCall,
  VoiceLaunchError,
  type VoiceLaunchContext,
  voiceFetch,
  type VoiceIntegrationClientSnapshot
} from '../../lib/voice/voiceLauncherApi';

type VoiceLauncherReadyReasonCode =
  | 'loading'
  | 'fetch_failed'
  | 'provider_not_connected'
  | 'no_default_outbound'
  | 'no_bot'
  | 'no_phone'
  | 'not_ready_unknown'
  | 'outbound_not_ready'
  | 'no_numbers_for_provider';

type VoiceProviderId = 'twilio' | 'telnyx' | 'zadarma';

const PROVIDER_LABEL: Record<VoiceProviderId, string> = {
  twilio: 'Twilio',
  telnyx: 'Telnyx',
  zadarma: 'Zadarma'
};

type Props = {
  open: boolean;
  onClose: () => void;
  context: VoiceLaunchContext;
  title?: string;
};

function normalizeE164(raw: string): string | null {
  const s = String(raw ?? '').trim();
  if (!/^\+[1-9]\d{7,14}$/.test(s)) return null;
  return s;
}

function getReadyProviders(integ: VoiceIntegrationClientSnapshot): VoiceProviderId[] {
  const out: VoiceProviderId[] = [];
  if (integ.voiceReady === true) out.push('twilio');
  if (integ.telnyx?.voiceReady === true) out.push('telnyx');
  if (integ.zadarma?.voiceReady === true) out.push('zadarma');
  return out;
}

/** Провайдеры, по которым в компании уже начата настройка (можно переключать в UI до полной готовности). */
function getSelectableProviders(integ: VoiceIntegrationClientSnapshot): VoiceProviderId[] {
  const out: VoiceProviderId[] = [];
  const twilioConfigured =
    integ.configured === true ||
    !!(integ.accountSidMasked && String(integ.accountSidMasked).trim()) ||
    integ.connectionStatus === 'connected';
  if (twilioConfigured) out.push('twilio');
  const t = integ.telnyx;
  const telnyxConfigured =
    t &&
    (t.configured === true ||
      !!(t.apiKeyMasked && String(t.apiKeyMasked).trim()) ||
      t.connectionStatus === 'connected');
  if (telnyxConfigured) out.push('telnyx');
  const z = integ.zadarma;
  const zadarmaConfigured =
    z &&
    (z.configured === true ||
      !!(z.keyMasked && String(z.keyMasked).trim()) ||
      z.connectionStatus === 'connected');
  if (zadarmaConfigured) out.push('zadarma');
  return [...new Set(out)];
}

function pickInitialProvider(
  selectable: VoiceProviderId[],
  ready: VoiceProviderId[],
  outboundPref: 'twilio' | 'telnyx' | 'zadarma' | undefined
): VoiceProviderId {
  const pref: VoiceProviderId =
    outboundPref === 'telnyx' ? 'telnyx' : outboundPref === 'zadarma' ? 'zadarma' : 'twilio';
  if (selectable.length === 0) return pref;
  if (selectable.includes(pref)) return pref;
  const firstReadySelectable = ready.find((r) => selectable.includes(r));
  if (firstReadySelectable) return firstReadySelectable;
  return selectable[0];
}

function filterNumbersForProvider(nums: VoiceNumber[], provider: VoiceProviderId): VoiceNumber[] {
  return nums
    .filter((n) => String(n.provider ?? 'twilio') === provider)
    .filter((n) => n.isActive !== false)
    .sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return (a.e164 || '').localeCompare(b.e164 || '');
    });
}

/** Пустая строка = «по умолчанию» (backend подставит default), иначе id номера. */
function pickFromNumberId(filtered: VoiceNumber[], contextFromId?: string | null): string {
  if (contextFromId && filtered.some((n) => n.id === contextFromId)) return contextFromId;
  const def = filtered.find((n) => n.isDefault);
  if (def) return '';
  const first = filtered[0];
  return first ? first.id : '';
}

function providerConnected(provider: VoiceProviderId, integ: VoiceIntegrationClientSnapshot): boolean {
  if (provider === 'telnyx') {
    const t = integ.telnyx;
    return !!(t?.enabled && t.connectionStatus === 'connected');
  }
  if (provider === 'zadarma') {
    const z = integ.zadarma;
    return !!(z?.enabled && z.connectionStatus === 'connected');
  }
  return !!(integ.enabled && integ.connectionStatus === 'connected');
}

export const UniversalVoiceCallLauncher: React.FC<Props> = ({ open, onClose, context, title }) => {
  const [bots, setBots] = useState<CrmAiBot[]>([]);
  const [numbersAll, setNumbersAll] = useState<VoiceNumber[]>([]);
  const [integ, setInteg] = useState<VoiceIntegrationClientSnapshot | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<VoiceProviderId>('twilio');
  const [selectedBotId, setSelectedBotId] = useState(context.botId ?? '');
  const [phone, setPhone] = useState(context.phone ?? '');
  const [fromNumberId, setFromNumberId] = useState('');
  const [callbackAt, setCallbackAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [lastCallId, setLastCallId] = useState<string | null>(null);
  const lastObservedStatusRef = useRef<string | null>(null);
  const progressAnnouncedRef = useRef(false);
  const connectedAnnouncedRef = useRef(false);
  const terminalAnnouncedRef = useRef(false);
  /** Только при ручном переключении провайдера — пересобрать «с какого номера». */
  const userChangedProviderRef = useRef(false);

  const readyProviders = useMemo(() => (integ ? getReadyProviders(integ) : []), [integ]);
  const selectableProviders = useMemo(() => (integ ? getSelectableProviders(integ) : []), [integ]);

  const filteredNumbers = useMemo(
    () => filterNumbersForProvider(numbersAll, selectedProvider),
    [numbersAll, selectedProvider]
  );

  const hasDefaultInList = useMemo(() => filteredNumbers.some((n) => n.isDefault), [filteredNumbers]);

  const callerLineOk = useMemo(() => {
    if (!hasDefaultInList && !fromNumberId.trim()) return false;
    if (hasDefaultInList && !fromNumberId.trim()) return true;
    if (fromNumberId.trim()) return true;
    return false;
  }, [hasDefaultInList, fromNumberId]);

  useEffect(() => {
    if (!open || !context.companyId) return;
    setPhone(context.phone ?? '');
    setSelectedBotId(context.botId ?? '');
    setInteg(null);
    setNumbersAll([]);
    userChangedProviderRef.current = false;
    const unsub = subscribeCrmAiBots(context.companyId, setBots);
    void (async () => {
      setLoading(true);
      try {
        const [nums, integResult] = await Promise.all([
          listVoiceNumbersByCompany(context.companyId),
          fetchVoiceIntegrationStatus()
        ]);
        if (!integResult.ok || !integResult.data) {
          setInteg(null);
          toast.error('Не удалось загрузить статус Voice (проверьте сеть и деплой API)');
          return;
        }
        const data = integResult.data;
        setInteg(data);
        setNumbersAll(nums);

        const ready = getReadyProviders(data);
        const selectable = getSelectableProviders(data);
        const outboundPref =
          data.outboundVoiceProvider === 'telnyx'
            ? 'telnyx'
            : data.outboundVoiceProvider === 'zadarma'
              ? 'zadarma'
              : 'twilio';
        const initial = pickInitialProvider(selectable, ready, outboundPref);

        let ctxFrom = context.fromNumberId ?? null;
        if (ctxFrom) {
          const row = nums.find((n) => n.id === ctxFrom);
          const p = row ? (String(row.provider ?? 'twilio') as VoiceProviderId) : null;
          if (p && p !== initial) ctxFrom = null;
        }

        setSelectedProvider(initial);
        const filtered = filterNumbersForProvider(nums, initial);
        setFromNumberId(pickFromNumberId(filtered, ctxFrom));
      } catch (e) {
        setInteg(null);
        toast.error(e instanceof Error ? e.message : 'Не удалось загрузить voice настройки');
      } finally {
        setLoading(false);
      }
    })();
    return () => unsub();
  }, [open, context.companyId, context.fromNumberId]);

  useEffect(() => {
    if (!open || !integ) return;
    if (!userChangedProviderRef.current) return;
    userChangedProviderRef.current = false;
    const filtered = filterNumbersForProvider(numbersAll, selectedProvider);
    setFromNumberId(pickFromNumberId(filtered, null));
  }, [selectedProvider, open, integ, numbersAll]);

  const selectedBot = useMemo(() => bots.find((b) => b.id === selectedBotId) ?? null, [bots, selectedBotId]);

  const canCall =
    !!integ &&
    readyProviders.includes(selectedProvider) &&
    !!selectedBotId &&
    !!normalizeE164(phone) &&
    callerLineOk &&
    providerConnected(selectedProvider, integ) &&
    filteredNumbers.length > 0;

  const { readyReason, reasonCode } = useMemo(() => {
    if (!integ) {
      return {
        readyReason: loading ? 'Проверяем интеграцию...' : 'Не удалось загрузить статус Voice',
        reasonCode: (loading ? 'loading' : 'fetch_failed') as VoiceLauncherReadyReasonCode
      };
    }
    if (selectableProviders.length === 0) {
      return {
        readyReason:
          'Нет настроенных voice-провайдеров — откройте Интеграции и подключите Twilio, Telnyx или Zadarma для этой компании.',
        reasonCode: 'outbound_not_ready' as const
      };
    }
    if (!selectableProviders.includes(selectedProvider)) {
      return {
        readyReason: 'Выбранный провайдер недоступен для этой компании — обновите страницу или настройки.',
        reasonCode: 'outbound_not_ready' as const
      };
    }
    if (!readyProviders.includes(selectedProvider)) {
      return {
        readyReason: `Выбранный провайдер (${PROVIDER_LABEL[selectedProvider]}) не готов к исходящим звонкам.`,
        reasonCode: 'outbound_not_ready' as const
      };
    }
    const snap =
      selectedProvider === 'telnyx'
        ? {
            voiceReady: integ.telnyx?.voiceReady === true,
            blockingReason: integ.telnyx?.blockingReason,
            readinessMessages: integ.telnyx?.readinessMessages ?? []
          }
        : selectedProvider === 'zadarma'
          ? {
              voiceReady: integ.zadarma?.voiceReady === true,
              blockingReason: integ.zadarma?.blockingReason,
              readinessMessages: integ.zadarma?.readinessMessages ?? []
            }
          : {
              voiceReady: integ.voiceReady === true,
              blockingReason: null as string | null,
              readinessMessages: [] as string[]
            };

    if (snap.voiceReady === false) {
      const first =
        snap.blockingReason?.trim() ||
        snap.readinessMessages[0] ||
        (selectedProvider === 'telnyx'
          ? 'Интеграция Telnyx не готова к исходящим звонкам.'
          : selectedProvider === 'zadarma'
            ? 'Интеграция Zadarma не готова к исходящим звонкам.'
            : 'Интеграция Twilio не готова к исходящим звонкам.');
      return { readyReason: first, reasonCode: 'outbound_not_ready' as const };
    }
    if (!providerConnected(selectedProvider, integ)) {
      if (selectedProvider === 'twilio' && integ.connectionStatus === 'invalid_config' && integ.connectionError?.trim()) {
        return { readyReason: integ.connectionError.trim(), reasonCode: 'provider_not_connected' as const };
      }
      if (selectedProvider === 'telnyx' && integ.telnyx?.connectionStatus === 'invalid_config' && integ.telnyx?.connectionError?.trim()) {
        return { readyReason: String(integ.telnyx.connectionError).trim(), reasonCode: 'provider_not_connected' as const };
      }
      if (selectedProvider === 'zadarma' && integ.zadarma?.connectionStatus === 'invalid_config' && integ.zadarma?.connectionError?.trim()) {
        return { readyReason: String(integ.zadarma.connectionError).trim(), reasonCode: 'provider_not_connected' as const };
      }
      return {
        readyReason:
          selectedProvider === 'telnyx'
            ? 'Telnyx не подключён или не проверен'
            : selectedProvider === 'zadarma'
              ? 'Zadarma не подключена или не проверена'
              : 'Twilio не подключён',
        reasonCode: 'provider_not_connected' as const
      };
    }
    if (filteredNumbers.length === 0) {
      return {
        readyReason: 'У выбранного провайдера нет доступных исходящих номеров',
        reasonCode: 'no_numbers_for_provider' as const
      };
    }
    if (!hasDefaultInList && !fromNumberId.trim()) {
      return { readyReason: 'Не выбран исходящий номер для этого провайдера', reasonCode: 'no_default_outbound' as const };
    }
    if (!selectedBotId) {
      return { readyReason: 'Не выбран бот', reasonCode: 'no_bot' as const };
    }
    if (!normalizeE164(phone)) {
      const raw = String(phone ?? '').trim();
      return {
        readyReason: raw ? 'Нет телефона клиента (нужен формат E.164, например +77001234567)' : 'Нет телефона клиента',
        reasonCode: 'no_phone' as const
      };
    }
    if (!callerLineOk) {
      return { readyReason: 'Укажите номер для caller ID или выберите default в Интеграциях', reasonCode: 'not_ready_unknown' as const };
    }
    return { readyReason: null as string | null, reasonCode: null as VoiceLauncherReadyReasonCode | null };
  }, [
    integ,
    loading,
    readyProviders,
    selectableProviders,
    selectedProvider,
    selectedBotId,
    phone,
    fromNumberId,
    callerLineOk,
    filteredNumbers.length,
    hasDefaultInList
  ]);

  useEffect(() => {
    if (!open || !context.companyId || !lastCallId) return;
    lastObservedStatusRef.current = null;
    progressAnnouncedRef.current = false;
    connectedAnnouncedRef.current = false;
    terminalAnnouncedRef.current = false;
    return subscribeVoiceCallSession(
      context.companyId,
      lastCallId,
      (session) => {
        const s = session?.status ?? null;
        if (!s || s === lastObservedStatusRef.current) return;
        lastObservedStatusRef.current = s;
        const reasonMsg = session?.voiceFailureReasonMessage?.trim();
        const prov = session?.provider != null ? String(session.provider) : '';

        if (s === 'dialing' || s === 'ringing') {
          if (!progressAnnouncedRef.current) {
            progressAnnouncedRef.current = true;
            toast('Звонок инициирован, устанавливается соединение…');
          }
        }
        if (s === 'in_progress') {
          connectedAnnouncedRef.current = true;
          toast.success('Соединено: разговор идёт');
        }
        if (s === 'completed') {
          if (terminalAnnouncedRef.current) return;
          terminalAnnouncedRef.current = true;
          const dur = session?.durationSec ?? 0;
          if (connectedAnnouncedRef.current || dur > 0) {
            toast.success('Звонок завершён');
          } else {
            toast('Звонок завершён без подтверждённого соединения на стороне клиента', { duration: 9000 });
          }
        }
        if (s === 'failed') {
          const hint = session?.twilioErrorCode ? `код ${session.twilioErrorCode}` : session?.endReason ?? 'failed';
          toast.error(reasonMsg ?? `Звонок не удался (${prov ? `${prov}: ` : ''}${hint})`, { duration: 9000 });
        }
        if (s === 'busy') {
          const sip = session?.twilioSipResponseCode;
          const sipPart = sip != null ? ` (SIP ${sip})` : '';
          toast.error(reasonMsg ?? `Клиент занят или сеть назначения отклонила вызов${sipPart}`, {
            duration: 9000
          });
        }
        if (s === 'no_answer') {
          toast.error(reasonMsg ?? 'Нет ответа (no-answer)', { duration: 9000 });
        }
        if (s === 'canceled') toast.error(reasonMsg ?? 'Звонок отменён');
      },
      (e) => {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Не удалось получить статус звонка: ${msg}`);
      }
    );
  }, [open, context.companyId, lastCallId]);

  if (!open) return null;

  const doCallNow = async () => {
    if (!canCall) return;
    setLaunching(true);
    try {
      const out = await launchVoiceCall({
        botId: selectedBotId,
        linkedRunId: `voice_manual_${Date.now().toString(36)}`,
        toE164: normalizeE164(phone)!,
        clientId: context.clientId ?? null,
        outboundVoiceProvider: selectedProvider,
        fromNumberId: fromNumberId || null,
        metadata: {
          launchSource: context.source,
          dealId: context.dealId ?? null,
          conversationId: context.conversationId ?? null
        }
      });
      setLastCallId(out.callId);
      toast.success(`Звонок запущен через ${PROVIDER_LABEL[selectedProvider]}`, { duration: 5000 });
    } catch (e) {
      if (e instanceof VoiceLaunchError) {
        const text = e.hint ? `${e.message}\n${e.hint}` : e.message;
        toast.error(text, { duration: 9000 });
      } else {
        toast.error(e instanceof Error ? e.message : 'Не удалось запустить звонок');
      }
    } finally {
      setLaunching(false);
    }
  };

  const doScheduleCallback = async () => {
    if (!callbackAt) return toast.error('Укажите время callback');
    const runId = context.dealId ?? context.conversationId ?? context.clientId;
    if (!runId) return toast.error('Для callback нужен связанный кейс');
    try {
      const d = new Date(callbackAt);
      if (!Number.isFinite(d.getTime())) return toast.error('Некорректное время callback');
      const res = await voiceFetch('/api/voice/operational', {
        method: 'POST',
        body: JSON.stringify({
          action: 'schedule_callback',
          runId,
          callbackAt: d.toISOString(),
          outboundVoiceProvider: selectedProvider,
          fromNumberId: fromNumberId.trim() || null
        })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : `Ошибка ${res.status}`);
      }
      toast.success('Callback назначен');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось назначить callback');
    }
  };

  const fromPreview = fromNumberId.trim()
    ? filteredNumbers.find((n) => n.id === fromNumberId)?.e164 ?? '—'
    : hasDefaultInList
      ? 'по умолчанию'
      : '—';

  const showProviderPicker = selectableProviders.length >= 2;

  const checklistNeutral =
    integ &&
    readyProviders.includes(selectedProvider) &&
    providerConnected(selectedProvider, integ) &&
    filteredNumbers.length > 0 &&
    (hasDefaultInList || !!fromNumberId.trim());

  const checklistBlock = (() => {
    if (!integ) return null;
    if (selectedProvider === 'twilio') {
      const accOk = integ.enabled && integ.connectionStatus === 'connected';
      const numOk = hasDefaultInList || !!fromNumberId.trim();
      if (checklistNeutral && accOk && numOk) {
        return (
          <div className="text-[11px] rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-emerald-900">
            Twilio: учётная запись OK, caller ID / номер OK. Проверьте Geo Permissions в консоли Twilio для направления
            звонка.
          </div>
        );
      }
      return (
        <div className="text-[11px] rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2 text-sky-900">
          <span className="font-medium">Twilio</span>
          {` · `}
          {accOk ? 'учётная запись OK' : 'учётная запись не готова'}
          {` · `}
          {numOk ? 'номер для исходящих' : 'номер не задан'}
          {` · Geo Permissions Twilio — проверьте вручную в консоли`}
        </div>
      );
    }
    if (selectedProvider === 'telnyx') {
      const tx = integ.telnyx;
      const accOk = tx?.enabled && tx.connectionStatus === 'connected';
      const numOk = hasDefaultInList || !!fromNumberId.trim();
      const webhookOk = tx?.webhookSignatureOk !== false;
      if (checklistNeutral && accOk && numOk && webhookOk) {
        return (
          <div className="text-[11px] rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-emerald-900">
            Telnyx: API key и public key заданы, webhook в порядке, номер для исходящих выбран.
          </div>
        );
      }
      return (
        <div className="text-[11px] rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2 text-sky-900">
          <span className="font-medium">Telnyx</span>
          {` · `}
          {accOk ? 'подключение OK' : 'подключение не готово'}
          {` · `}
          {tx?.publicKeySet ? 'public key задан' : 'нужен public key'}
          {` · `}
          {webhookOk ? 'webhook OK' : 'проверьте подпись webhook'}
          {` · `}
          {numOk ? 'номер для исходящих' : 'номер не задан / нет в CRM'}
        </div>
      );
    }
    const z = integ.zadarma;
    const accOk = z?.enabled && z.connectionStatus === 'connected';
    const extOk = !!(z?.callbackExtension && String(z.callbackExtension).trim());
    const numOk = hasDefaultInList || !!fromNumberId.trim();
    const webhookOk = z?.webhookSignatureOk !== false;
    if (checklistNeutral && accOk && extOk && numOk && webhookOk) {
      return (
        <div className="text-[11px] rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-emerald-900">
          Zadarma: ключи и внутренний номер (extension) заданы, webhook в порядке, номер для исходящих выбран.
        </div>
      );
    }
    return (
      <div className="text-[11px] rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2 text-sky-900">
        <span className="font-medium">Zadarma</span>
        {` · `}
        {accOk ? 'подключение OK' : 'подключение не готово'}
        {` · `}
        {extOk ? 'extension для callback OK' : 'укажите extension (внутренний номер) для request/callback'}
        {` · `}
        {webhookOk ? 'webhook OK' : 'проверьте URL и подпись webhook в кабинете Zadarma'}
        {` · `}
        {numOk ? 'номер для исходящих' : 'номер не задан / нет в CRM'}
      </div>
    );
  })();

  return (
    <div className="fixed inset-0 z-[1200] bg-black/45 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title ?? 'Запуск звонка'}</h3>
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
            Закрыть
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Источник: {context.source}
          {' · '}
          From: {fromPreview}
        </p>

        {loading ? <p className="text-sm text-gray-500">Загрузка...</p> : null}

        {!loading && integ ? (
          <div className="space-y-2">
            {showProviderPicker ? (
              <div>
                <p className="text-xs text-gray-600 mb-1.5">Исходящий провайдер</p>
                <div className="inline-flex flex-wrap rounded-lg border border-gray-200 p-0.5 gap-0.5 bg-gray-50">
                  {selectableProviders.map((p) => {
                    const isReady = readyProviders.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        title={isReady ? undefined : 'Интеграция ещё не готова к звонкам — см. чеклист ниже'}
                        onClick={() => {
                          userChangedProviderRef.current = true;
                          setSelectedProvider(p);
                        }}
                        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                          selectedProvider === p
                            ? 'bg-gray-900 text-white shadow-sm'
                            : isReady
                              ? 'bg-white text-gray-700 hover:bg-gray-100'
                              : 'bg-amber-50/90 text-amber-950 border border-amber-200/80 hover:bg-amber-100'
                        }`}
                      >
                        {PROVIDER_LABEL[p]}
                        {!isReady ? ' · настройка' : ''}
                      </button>
                    );
                  })}
                </div>
                {integ.outboundVoiceProvider &&
                (integ.outboundVoiceProvider === 'twilio' ||
                  integ.outboundVoiceProvider === 'telnyx' ||
                  integ.outboundVoiceProvider === 'zadarma') ? (
                  <p className="text-[11px] text-gray-500 mt-1">
                    По умолчанию в Интеграциях выбрано:{' '}
                    <span className="font-medium text-gray-700">
                      {PROVIDER_LABEL[integ.outboundVoiceProvider as VoiceProviderId]}
                    </span>
                    . Можно переключить для этого звонка.
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-800 mt-1">
                    В настройках телефонии не задан исходящий провайдер по умолчанию — выберите подходящий вкладкой выше.
                  </p>
                )}
                {selectableProviders.length >= 2 &&
                integ.outboundVoiceProvider &&
                !selectableProviders.includes(integ.outboundVoiceProvider as VoiceProviderId) ? (
                  <p className="text-[11px] text-amber-800 mt-1">
                    Сохранённый по умолчанию провайдер ({PROVIDER_LABEL[integ.outboundVoiceProvider as VoiceProviderId]}) не
                    подключён в этой компании — используйте доступные вкладки.
                  </p>
                ) : null}
              </div>
            ) : selectableProviders.length === 1 ? (
              <div className="text-xs text-gray-700 space-y-1">
                <p>
                  Исходящий провайдер:{' '}
                  <span className="font-semibold text-gray-900">{PROVIDER_LABEL[selectableProviders[0]]}</span>
                </p>
                {!readyProviders.includes(selectableProviders[0]) ? (
                  <p className="text-amber-800">Интеграция ещё не готова к звонкам — завершите шаги в чеклисте ниже.</p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-amber-800">
                Нет настроенных voice-провайдеров — откройте раздел Интеграции для этой компании.
              </p>
            )}
          </div>
        ) : null}

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm text-gray-700">
            Бот
            <select
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={selectedBotId}
              onChange={(e) => setSelectedBotId(e.target.value)}
            >
              <option value="">Выберите бота</option>
              {bots.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <div className="text-sm text-gray-700">
            <div className="flex items-center justify-between gap-2">
              <span>С какого номера</span>
              <span className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 border border-gray-200 rounded px-1.5 py-0.5">
                {PROVIDER_LABEL[selectedProvider]}
              </span>
            </div>
            <select
              className="mt-1 w-full border rounded-lg px-3 py-2"
              value={fromNumberId}
              onChange={(e) => setFromNumberId(e.target.value)}
              disabled={filteredNumbers.length === 0}
            >
              {hasDefaultInList ? <option value="">По умолчанию</option> : null}
              {filteredNumbers.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label || n.e164}
                  {n.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
            {filteredNumbers.length === 0 ? (
              <p className="mt-1 text-xs text-amber-700">У выбранного провайдера нет доступных исходящих номеров</p>
            ) : null}
          </div>
        </div>
        <label className="text-sm text-gray-700 block">
          Кому звонок
          <input
            className="mt-1 w-full border rounded-lg px-3 py-2"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7701..."
          />
        </label>
        {selectedBot ? <p className="text-xs text-gray-500">Бот: {selectedBot.name}</p> : null}
        {readyReason ? (
          <div
            className="text-xs rounded-lg bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2"
            data-voice-ready-reason={reasonCode ?? 'unknown'}
            title={reasonCode ? `Код: ${reasonCode}` : undefined}
          >
            {readyReason}
            {import.meta.env.DEV && reasonCode ? (
              <span className="block mt-1 font-mono text-[10px] text-amber-700/90">debug: {reasonCode}</span>
            ) : null}
          </div>
        ) : null}
        {checklistBlock}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canCall || launching}
            onClick={() => void doCallNow()}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50"
          >
            {launching ? 'Запуск...' : 'Позвонить сейчас'}
          </button>
          <input
            type="datetime-local"
            className="border rounded-lg px-2 py-2 text-sm"
            value={callbackAt}
            onChange={(e) => setCallbackAt(e.target.value)}
          />
          <button type="button" onClick={() => void doScheduleCallback()} className="px-4 py-2 rounded-lg border text-sm">
            Назначить callback
          </button>
          {lastCallId ? (
            <a
              className="px-4 py-2 rounded-lg border text-sm"
              href={`/ai-control?search=${encodeURIComponent(lastCallId)}`}
            >
              Открыть voice case
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
};
