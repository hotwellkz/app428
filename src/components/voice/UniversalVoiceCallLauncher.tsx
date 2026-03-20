import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { listVoiceNumbersByCompany } from '../../lib/firebase/voiceNumbers';
import { subscribeVoiceCallSession } from '../../lib/firebase/voiceCallSessions';
import { subscribeCrmAiBots } from '../../lib/firebase/crmAiBots';
import type { CrmAiBot } from '../../types/crmAiBot';
import {
  fetchVoiceIntegrationStatus,
  launchVoiceCall,
  VoiceLaunchError,
  type VoiceLaunchContext,
  voiceFetch
} from '../../lib/voice/voiceLauncherApi';

type VoiceLauncherReadyReasonCode =
  | 'loading'
  | 'fetch_failed'
  | 'provider_not_connected'
  | 'no_default_outbound'
  | 'no_bot'
  | 'no_phone'
  | 'not_ready_unknown';

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

export const UniversalVoiceCallLauncher: React.FC<Props> = ({ open, onClose, context, title }) => {
  const [bots, setBots] = useState<CrmAiBot[]>([]);
  const [numbers, setNumbers] = useState<Array<{ id: string; e164: string; label: string | null; isDefault: boolean }>>([]);
  const [selectedBotId, setSelectedBotId] = useState(context.botId ?? '');
  const [phone, setPhone] = useState(context.phone ?? '');
  const [fromNumberId, setFromNumberId] = useState(context.fromNumberId ?? '');
  const [callbackAt, setCallbackAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [lastCallId, setLastCallId] = useState<string | null>(null);
  const lastObservedStatusRef = useRef<string | null>(null);
  const progressAnnouncedRef = useRef(false);
  const connectedAnnouncedRef = useRef(false);
  const terminalAnnouncedRef = useRef(false);
  const [integration, setIntegration] = useState<{
    configured: boolean;
    enabled: boolean;
    connectionStatus: string;
    connectionError: string | null;
    hasDefaultOutbound: boolean;
    voiceReady: boolean;
  } | null>(null);

  useEffect(() => {
    if (!open || !context.companyId) return;
    setPhone(context.phone ?? '');
    setSelectedBotId(context.botId ?? '');
    setFromNumberId(context.fromNumberId ?? '');
    setIntegration(null);
    const unsub = subscribeCrmAiBots(context.companyId, setBots);
    void (async () => {
      setLoading(true);
      try {
        const [nums, integResult] = await Promise.all([
          listVoiceNumbersByCompany(context.companyId),
          fetchVoiceIntegrationStatus()
        ]);
        if (!integResult.ok || !integResult.data) {
          setIntegration(null);
          toast.error('Не удалось загрузить статус Voice (проверьте сеть и деплой API)');
          return;
        }
        const integ = integResult.data;
        setIntegration({
          configured: integ.configured === true,
          enabled: integ.enabled === true,
          connectionStatus: String(integ.connectionStatus ?? 'not_connected'),
          connectionError: integ.connectionError != null ? String(integ.connectionError) : null,
          hasDefaultOutbound: integ.hasDefaultOutbound === true,
          voiceReady: integ.voiceReady === true
        });
        setNumbers(
          nums.map((n) => ({ id: n.id, e164: n.e164, label: n.label ?? null, isDefault: n.isDefault === true }))
        );
        const def = nums.find((n) => n.isDefault);
        if (!context.fromNumberId && def) setFromNumberId(def.id);
      } catch (e) {
        setIntegration(null);
        toast.error(e instanceof Error ? e.message : 'Не удалось загрузить voice настройки');
      } finally {
        setLoading(false);
      }
    })();
    return () => unsub();
  }, [open, context.companyId]);

  const selectedBot = useMemo(() => bots.find((b) => b.id === selectedBotId) ?? null, [bots, selectedBotId]);

  /** Совпадает с логикой outbound: Twilio подключён + есть caller ID (default или выбранный). */
  const twilioLineOk = useMemo(() => {
    if (!integration) return false;
    const connected = integration.enabled && integration.connectionStatus === 'connected';
    const hasCaller = integration.hasDefaultOutbound || !!fromNumberId.trim();
    return connected && hasCaller;
  }, [integration, fromNumberId]);

  const canCall = !!selectedBotId && !!normalizeE164(phone) && twilioLineOk;

  const { readyReason, reasonCode } = useMemo(() => {
    if (!integration) {
      return {
        readyReason: loading ? 'Проверяем интеграцию...' : 'Не удалось загрузить статус Voice',
        reasonCode: (loading ? 'loading' : 'fetch_failed') as VoiceLauncherReadyReasonCode
      };
    }
    const connected = integration.enabled && integration.connectionStatus === 'connected';
    if (connected && !integration.hasDefaultOutbound && !fromNumberId.trim()) {
      return { readyReason: 'Не выбран номер по умолчанию', reasonCode: 'no_default_outbound' as const };
    }
    if (!connected) {
      if (integration.connectionStatus === 'invalid_config' && integration.connectionError?.trim()) {
        return { readyReason: integration.connectionError.trim(), reasonCode: 'provider_not_connected' as const };
      }
      return { readyReason: 'Twilio не подключен', reasonCode: 'provider_not_connected' as const };
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
    if (!twilioLineOk) {
      return { readyReason: 'Voice не готов к звонку', reasonCode: 'not_ready_unknown' as const };
    }
    return { readyReason: null as string | null, reasonCode: null as VoiceLauncherReadyReasonCode | null };
  }, [integration, loading, selectedBotId, phone, fromNumberId, twilioLineOk]);

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

        if (s === 'dialing' || s === 'ringing') {
          if (!progressAnnouncedRef.current) {
            progressAnnouncedRef.current = true;
            toast('Провайдер принял звонок. Идёт вызов…');
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
          toast.error(reasonMsg ?? `Twilio: failed (${hint})`, { duration: 9000 });
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
        fromNumberId: fromNumberId || null,
        metadata: {
          launchSource: context.source,
          dealId: context.dealId ?? null,
          conversationId: context.conversationId ?? null
        }
      });
      setLastCallId(out.callId);
      toast('Звонок отправлен провайдеру. Ожидаем статус дозвона…', { duration: 5000 });
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
      await voiceFetch('/api/voice/operational', {
        method: 'POST',
        body: JSON.stringify({ action: 'schedule_callback', runId, callbackAt: d.toISOString() })
      });
      toast.success('Callback назначен');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось назначить callback');
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-black/45 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title ?? 'Запуск звонка'}</h3>
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Закрыть</button>
        </div>
        <p className="text-xs text-gray-500">Источник: {context.source} · Провайдер: Twilio</p>
        {loading ? <p className="text-sm text-gray-500">Загрузка...</p> : null}
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm text-gray-700">
            Бот
            <select className="mt-1 w-full border rounded-lg px-3 py-2" value={selectedBotId} onChange={(e) => setSelectedBotId(e.target.value)}>
              <option value="">Выберите бота</option>
              {bots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            С какого номера
            <select className="mt-1 w-full border rounded-lg px-3 py-2" value={fromNumberId} onChange={(e) => setFromNumberId(e.target.value)}>
              <option value="">По умолчанию</option>
              {numbers.map((n) => <option key={n.id} value={n.id}>{n.label || n.e164}{n.isDefault ? ' (default)' : ''}</option>)}
            </select>
          </label>
        </div>
        <label className="text-sm text-gray-700 block">
          Кому звонок
          <input className="mt-1 w-full border rounded-lg px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7701..." />
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
        <div className="text-[11px] rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2 text-sky-900">
          Checklist readiness:
          {` `}
          {integration?.enabled && integration?.connectionStatus === 'connected' ? 'account connected' : 'account not connected'}
          {` · `}
          {integration?.hasDefaultOutbound || !!fromNumberId.trim() ? 'number configured' : 'number missing'}
          {` · `}
          destination country allowed in Twilio Geo Permissions (manual check)
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!canCall || launching} onClick={() => void doCallNow()} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50">
            {launching ? 'Запуск...' : 'Позвонить сейчас'}
          </button>
          <input type="datetime-local" className="border rounded-lg px-2 py-2 text-sm" value={callbackAt} onChange={(e) => setCallbackAt(e.target.value)} />
          <button type="button" onClick={() => void doScheduleCallback()} className="px-4 py-2 rounded-lg border text-sm">
            Назначить callback
          </button>
          {lastCallId ? <a className="px-4 py-2 rounded-lg border text-sm" href={`/ai-control?search=${encodeURIComponent(lastCallId)}`}>Открыть voice case</a> : null}
        </div>
      </div>
    </div>
  );
};
