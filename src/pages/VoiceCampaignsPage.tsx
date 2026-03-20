import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useCompanyId } from '../contexts/CompanyContext';
import { subscribeCrmAiBots } from '../lib/firebase/crmAiBots';
import { listVoiceNumbersByCompany } from '../lib/firebase/voiceNumbers';
import {
  createVoiceCampaign,
  subscribeVoiceCampaignItems,
  subscribeVoiceCampaigns,
  updateVoiceCampaignStatus
} from '../lib/firebase/voiceCampaigns';
import type { CrmAiBot } from '../types/crmAiBot';
import type { VoiceCampaign, VoiceCampaignItem } from '../types/voiceCampaign';

type Filter = 'all' | VoiceCampaign['status'];

export const VoiceCampaignsPage: React.FC = () => {
  const companyId = useCompanyId();
  const [campaigns, setCampaigns] = useState<VoiceCampaign[]>([]);
  const [items, setItems] = useState<VoiceCampaignItem[]>([]);
  const [bots, setBots] = useState<CrmAiBot[]>([]);
  const [numbers, setNumbers] = useState<Array<{ id: string; e164: string; label: string | null }>>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    botId: '',
    fromNumberId: '',
    sourceType: 'manual' as 'manual' | 'csv',
    phonesText: '',
    maxConcurrentCalls: 2,
    callsPerMinute: 20
  });

  useEffect(() => {
    if (!companyId) return;
    const unsub = subscribeVoiceCampaigns(companyId, setCampaigns);
    const unsubBots = subscribeCrmAiBots(companyId, setBots);
    void listVoiceNumbersByCompany(companyId).then((rows) =>
      setNumbers(rows.map((r) => ({ id: r.id, e164: r.e164, label: r.label ?? null })))
    );
    return () => {
      unsub();
      unsubBots();
    };
  }, [companyId]);

  useEffect(() => {
    if (!companyId || !selectedCampaignId) return;
    const unsub = subscribeVoiceCampaignItems(companyId, selectedCampaignId, setItems);
    return () => unsub();
  }, [companyId, selectedCampaignId]);

  const filtered = useMemo(
    () => (filter === 'all' ? campaigns : campaigns.filter((c) => c.status === filter)),
    [campaigns, filter]
  );

  const selected = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  );

  const create = async () => {
    if (!form.name.trim() || !form.botId || !form.fromNumberId) {
      toast.error('Укажите название, бота и outbound number');
      return;
    }
    const phones = form.phonesText
      .split(/\n|,|;/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (!phones.length) {
      toast.error('Добавьте список телефонов');
      return;
    }
    setCreating(true);
    try {
      const out = await createVoiceCampaign({
        name: form.name.trim(),
        botId: form.botId,
        fromNumberId: form.fromNumberId,
        sourceType: form.sourceType,
        phones,
        maxConcurrentCalls: form.maxConcurrentCalls,
        callsPerMinute: form.callsPerMinute
      });
      toast.success('Кампания создана');
      setSelectedCampaignId(out.campaignId);
      setForm((f) => ({ ...f, name: '', phonesText: '' }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось создать кампанию');
    } finally {
      setCreating(false);
    }
  };

  const action = async (campaignId: string, a: 'start' | 'pause' | 'resume' | 'stop' | 'dispatch_now') => {
    try {
      await updateVoiceCampaignStatus(campaignId, a);
      toast.success('Готово');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось выполнить действие');
    }
  };

  return (
    <div className="min-h-full bg-gray-50 p-4 md:p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Voice Campaigns</h1>
      <p className="text-sm text-gray-500 mt-1">P0 массовый обзвон: draft → running → progress по item.</p>

      <div className="mt-4 grid lg:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Новая кампания</h2>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Название кампании" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.botId} onChange={(e) => setForm((f) => ({ ...f, botId: e.target.value }))}>
            <option value="">Выберите бота</option>
            {bots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.fromNumberId} onChange={(e) => setForm((f) => ({ ...f, fromNumberId: e.target.value }))}>
            <option value="">Выберите outbound номер</option>
            {numbers.map((n) => <option key={n.id} value={n.id}>{n.label || n.e164}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min={1} max={10} className="w-full border rounded-lg px-3 py-2 text-sm" value={form.maxConcurrentCalls} onChange={(e) => setForm((f) => ({ ...f, maxConcurrentCalls: Number(e.target.value) || 2 }))} placeholder="max concurrent" />
            <input type="number" min={1} max={120} className="w-full border rounded-lg px-3 py-2 text-sm" value={form.callsPerMinute} onChange={(e) => setForm((f) => ({ ...f, callsPerMinute: Number(e.target.value) || 20 }))} placeholder="calls/min" />
          </div>
          <textarea className="w-full border rounded-lg px-3 py-2 text-sm min-h-[120px]" value={form.phonesText} onChange={(e) => setForm((f) => ({ ...f, phonesText: e.target.value }))} placeholder="+7701...\n+7702...\n..." />
          <button disabled={creating} onClick={() => void create()} className="w-full rounded-lg bg-emerald-600 text-white py-2 text-sm font-medium disabled:opacity-50">
            {creating ? 'Создание...' : 'Создать draft'}
          </button>
        </div>

        <div className="rounded-xl border bg-white p-4 lg:col-span-2">
          <div className="flex flex-wrap gap-2 mb-3">
            {(['all', 'draft', 'running', 'paused', 'completed', 'failed'] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs rounded-lg border ${filter === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}>
                {f}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {filtered.map((c) => (
              <button key={c.id} onClick={() => setSelectedCampaignId(c.id)} className={`w-full text-left rounded-lg border px-3 py-2 ${selectedCampaignId === c.id ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                <p className="text-xs text-gray-600">
                  {c.status} · {c.completedCount}/{c.totalCount} · failed {c.failedCount} · busy {c.busyCount} · no_answer {c.noAnswerCount}
                </p>
              </button>
            ))}
            {!filtered.length && <p className="text-sm text-gray-500">Нет кампаний</p>}
          </div>
        </div>
      </div>

      {selected ? (
        <div className="mt-4 rounded-xl border bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">{selected.name}</h3>
            <span className="text-xs px-2 py-1 rounded-full border">{selected.status}</span>
            <button onClick={() => void action(selected.id, 'start')} className="px-3 py-1.5 text-xs rounded-lg border">Старт</button>
            <button onClick={() => void action(selected.id, 'pause')} className="px-3 py-1.5 text-xs rounded-lg border">Пауза</button>
            <button onClick={() => void action(selected.id, 'resume')} className="px-3 py-1.5 text-xs rounded-lg border">Продолжить</button>
            <button onClick={() => void action(selected.id, 'stop')} className="px-3 py-1.5 text-xs rounded-lg border">Завершить</button>
            <button onClick={() => void action(selected.id, 'dispatch_now')} className="px-3 py-1.5 text-xs rounded-lg bg-gray-900 text-white">Dispatch now</button>
          </div>
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${selected.totalCount > 0 ? (selected.completedCount / selected.totalCount) * 100 : 0}%` }} />
          </div>
          <div className="mt-3 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2">Phone</th><th>Status</th><th>Attempts</th><th>Outcome</th><th>Error</th><th>Links</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t">
                    <td className="py-2">{it.normalizedPhone}</td>
                    <td>{it.status}</td>
                    <td>{it.attemptsCount}</td>
                    <td>{it.outcome || '—'}</td>
                    <td className="text-xs text-red-700">{it.lastError || '—'}</td>
                    <td className="text-xs">
                      {it.linkedRunId ? <a className="text-emerald-700 mr-2" href={`/ai-control/${it.linkedRunId}`}>AI-control</a> : null}
                      {it.lastCallId ? <a className="text-emerald-700" href={`/ai-control?search=${encodeURIComponent(it.lastCallId)}`}>session</a> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default VoiceCampaignsPage;

