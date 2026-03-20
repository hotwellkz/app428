import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { listVoiceNumbersByCompany } from '../../lib/firebase/voiceNumbers';
import { subscribeCrmAiBots } from '../../lib/firebase/crmAiBots';
import type { CrmAiBot } from '../../types/crmAiBot';
import { launchVoiceCall, type VoiceLaunchContext } from '../../lib/voice/voiceLauncherApi';
import { voiceFetch } from '../../lib/voice/voiceLauncherApi';

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
  const [integration, setIntegration] = useState<{
    connectionStatus: string;
    hasDefaultOutbound: boolean;
    voiceReady: boolean;
  } | null>(null);

  useEffect(() => {
    if (!open || !context.companyId) return;
    setPhone(context.phone ?? '');
    setSelectedBotId(context.botId ?? '');
    setFromNumberId(context.fromNumberId ?? '');
    const unsub = subscribeCrmAiBots(context.companyId, setBots);
    void (async () => {
      setLoading(true);
      try {
        const [nums, integRes] = await Promise.all([
          listVoiceNumbersByCompany(context.companyId),
          voiceFetch('/api/voice/integration', { method: 'GET' })
        ]);
        const integ = (await integRes.json().catch(() => ({}))) as {
          connectionStatus?: string;
          hasDefaultOutbound?: boolean;
          voiceReady?: boolean;
        };
        setIntegration({
          connectionStatus: integ.connectionStatus ?? 'not_connected',
          hasDefaultOutbound: integ.hasDefaultOutbound === true,
          voiceReady: integ.voiceReady === true
        });
        setNumbers(
          nums.map((n) => ({ id: n.id, e164: n.e164, label: n.label ?? null, isDefault: n.isDefault === true }))
        );
        const def = nums.find((n) => n.isDefault);
        if (!fromNumberId && def) setFromNumberId(def.id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Не удалось загрузить voice настройки');
      } finally {
        setLoading(false);
      }
    })();
    return () => unsub();
  }, [open, context.companyId]);

  const selectedBot = useMemo(() => bots.find((b) => b.id === selectedBotId) ?? null, [bots, selectedBotId]);
  const canCall = !!selectedBotId && !!normalizeE164(phone) && (integration?.voiceReady ?? false);
  const readyReason = useMemo(() => {
    if (!integration) return 'Проверяем интеграцию...';
    if (integration.connectionStatus !== 'connected') return 'Twilio не подключен';
    if (!integration.hasDefaultOutbound && !fromNumberId) return 'Не выбран outbound номер';
    if (!selectedBotId) return 'Выберите бота';
    if (!normalizeE164(phone)) return 'Введите номер в формате +7...';
    return null;
  }, [integration, selectedBotId, phone, fromNumberId]);

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
      toast.success('Звонок запущен');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось запустить звонок');
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
        {readyReason ? <div className="text-xs rounded-lg bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2">{readyReason}</div> : null}
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
