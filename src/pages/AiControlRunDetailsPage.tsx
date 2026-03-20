import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  MessageSquare,
  User,
  Bot,
  Ban,
  PauseCircle,
  PlayCircle,
  Link2,
  Clock3,
  Phone,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageMetadata } from '../components/PageMetadata';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useCompanyId } from '../contexts/CompanyContext';
import { useCurrentCompanyUser } from '../hooks/useCurrentCompanyUser';
import { db } from '../lib/firebase/config';
import { getWhatsappAiBotRunById, type WhatsAppAiBotRunRecord } from '../lib/firebase/whatsappAiBotRuns';
import { COLLECTIONS, updateWhatsAppConversationAiRuntime } from '../lib/firebase/whatsappDb';
import { getCrmAiBotById, updateCrmAiBot } from '../lib/firebase/crmAiBots';
import { computeAggregatedStatus, computeRunResultFlags } from '../lib/aiControl/aggregateAiRun';
import { AiRunStatusBadge } from '../components/ai-control/AiRunStatusBadge';
import { channelLabel } from '../components/ai-control/AiControlFilters';
import { parseWhatsAppAiRuntime } from '../types/whatsappAiRuntime';
import { parseCrmAiBotExtractionResult } from '../types/crmAiBotExtraction';
import type { CrmAiBot } from '../types/crmAiBot';
import type { WhatsAppAiRuntimeMode } from '../types/whatsappAiRuntime';
import type { CrmAiBotExtractionResult } from '../types/crmAiBotExtraction';
import { stashChatDraft } from '../lib/ai-control/openChatDraftBridge';
import { humanizeFallbackReasons } from '../lib/ai-control/fallbackReasonLabels';
import { deriveAiRunListPresentation } from '../lib/ai-control/deriveAiRunListPresentation';
import { deriveAiRunWorkflow } from '../lib/ai-control/deriveAiRunWorkflow';
import { deriveAiRunChannelFromRun } from '../lib/ai-control/deriveAiRunChannel';
import {
  getVoiceCallSnapshotFromRun,
  getVoicePostCallFromRun,
  getVoiceCallSessionIdFromRun,
  getVoiceQaFromRun,
  getVoiceRetryFromRun
} from '../lib/ai-control/voiceRunBridge';
import {
  getVoiceCallSession,
  getVoiceCallSessionByLinkedRunId,
  getVoiceCallTurnsOrdered
} from '../lib/firebase/voiceCallSessions';
import type { VoiceCallSession } from '../types/voice';
import {
  appendWhatsappAiRunWorkflowEvent,
  subscribeWhatsappAiRunWorkflowByRunId,
  upsertWhatsappAiRunWorkflow,
  type WhatsAppAiRunWorkflowRecord
} from '../lib/firebase/whatsappAiRunWorkflow';
import type { AiRunWorkflowResolutionType, AiRunWorkflowStatus } from '../types/aiControl';
import { auth } from '../lib/firebase/auth';
import { getVoiceProviderCatalogItem } from '../lib/voice/providerCatalog';

const CRM_CLIENTS = 'clients';
const CRM_DEALS = 'deals';

async function copyText(label: string, text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} скопировано`);
  } catch {
    toast.error('Не удалось скопировать');
  }
}

function parseSnapshotJson<T>(raw: string | null | undefined): T | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function dataSourceLabel(snapshotValue: unknown, fallbackValue: unknown): string {
  if (snapshotValue != null && String(snapshotValue).trim()) return 'Snapshot run';
  if (fallbackValue != null && String(fallbackValue).trim()) return 'Fallback aiRuntime';
  return 'Нет данных';
}

function tsToMs(v: unknown): number | null {
  if (!v) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'object' && v && 'toMillis' in (v as { toMillis?: unknown })) {
    const fn = (v as { toMillis?: () => number }).toMillis;
    if (typeof fn === 'function') return fn();
  }
  return null;
}

export const AiControlRunDetailsPage: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const companyId = useCompanyId();
  const navigate = useNavigate();
  const { canAccess } = useCurrentCompanyUser();
  const can = canAccess('autovoronki');

  const [run, setRun] = useState<WhatsAppAiBotRunRecord | null>(undefined);
  const [conv, setConv] = useState<Record<string, unknown> | null>(null);
  const [client, setClient] = useState<{ name?: string; phone?: string } | null>(null);
  const [bot, setBot] = useState<CrmAiBot | null>(null);
  const [dealPreview, setDealPreview] = useState<{
    id: string;
    nextAction?: string | null;
    nextActionAt?: unknown;
  } | null>(null);
  const [triggerMsg, setTriggerMsg] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRawExtraction, setShowRawExtraction] = useState(false);
  const [workflow, setWorkflow] = useState<WhatsAppAiRunWorkflowRecord | null>(null);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [voiceSession, setVoiceSession] = useState<VoiceCallSession | null>(null);
  const [voiceTurns, setVoiceTurns] = useState<Array<{ id: string; speaker: string; text: string; turnIndex: number }>>(
    []
  );
  const [voiceOpBusy, setVoiceOpBusy] = useState(false);
  const [callbackInput, setCallbackInput] = useState('');
  const [qaReviewNote, setQaReviewNote] = useState('');
  const [qaDisposition, setQaDisposition] = useState('');
  const [qaNeedsPromptFix, setQaNeedsPromptFix] = useState(false);
  const [qaNeedsOpsFix, setQaNeedsOpsFix] = useState(false);
  const [qaNeedsRetryTuning, setQaNeedsRetryTuning] = useState(false);
  const [qaNeedsHumanFollowup, setQaNeedsHumanFollowup] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const load = useCallback(async () => {
    if (!companyId || !runId || !can) return;
    const r = await getWhatsappAiBotRunById(companyId, runId);
    setRun(r);
    setConv(null);
    setClient(null);
    setDealPreview(null);
    setTriggerMsg(null);
    setBot(null);
    if (!r) return;

    const isVoiceRun = deriveAiRunChannelFromRun(r) === 'voice';

    const [convSnap, botDoc] = await Promise.all([
      !isVoiceRun && r.conversationId
        ? getDoc(doc(db, COLLECTIONS.CONVERSATIONS, r.conversationId))
        : Promise.resolve(null as Awaited<ReturnType<typeof getDoc>> | null),
      getCrmAiBotById(r.botId)
    ]);
    if (convSnap?.exists()) {
      const cd = convSnap.data() as Record<string, unknown>;
      if ((cd.companyId as string) === companyId) {
        setConv(cd);
        const runClientId =
          (typeof r.clientIdSnapshot === 'string' && r.clientIdSnapshot.trim()) ||
          (typeof r.appliedClientId === 'string' && r.appliedClientId.trim()) ||
          '';
        let clientDoc: Record<string, unknown> | null = null;
        if (runClientId) {
          const cl = await getDoc(doc(db, CRM_CLIENTS, runClientId));
          if (cl.exists()) {
            const d = cl.data() as Record<string, unknown>;
            if ((d.companyId as string) === companyId) clientDoc = d;
          }
        }
        if (clientDoc) {
          const fn = String(clientDoc.firstName ?? '').trim();
          const ln = String(clientDoc.lastName ?? '').trim();
          const nm = String(clientDoc.name ?? '').trim();
          const display = nm || [fn, ln].filter(Boolean).join(' ').trim() || '—';
          setClient({ name: display, phone: String(clientDoc.phone ?? '').trim() || undefined });
        }
      }
    }
    setBot(botDoc && botDoc.companyId === companyId ? botDoc : null);

    const convDealId = convSnap?.exists() ? (convSnap.data() as { dealId?: string }).dealId : null;
    const dealId = r.createdDealId || r.dealId || convDealId;
    if (dealId) {
      const ds = await getDoc(doc(db, CRM_DEALS, dealId));
      if (ds.exists()) {
        const dd = ds.data() as Record<string, unknown>;
        if (dd.companyId === companyId) {
          setDealPreview({
            id: ds.id,
            nextAction: (dd.nextAction as string) ?? null,
            nextActionAt: dd.nextActionAt
          });
        }
      }
    }

    if (r.triggerMessageId && !r.triggerMessageId.startsWith('deal_') && !r.triggerMessageId.startsWith('task_')) {
      const ms = await getDoc(doc(db, COLLECTIONS.MESSAGES, r.triggerMessageId));
      if (ms.exists()) setTriggerMsg(ms.data() as Record<string, unknown>);
    }
  }, [companyId, runId, can]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!companyId || !run || deriveAiRunChannelFromRun(run) !== 'voice') {
      setVoiceSession(null);
      setVoiceTurns([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const sid = getVoiceCallSessionIdFromRun(run);
      const session = sid
        ? await getVoiceCallSession(companyId, sid)
        : await getVoiceCallSessionByLinkedRunId(companyId, run.id);
      if (cancelled) return;
      setVoiceSession(session);
      if (session?.id) {
        const turns = await getVoiceCallTurnsOrdered(companyId, session.id, 60);
        if (!cancelled) setVoiceTurns(turns);
      } else {
        setVoiceTurns([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, run]);

  useEffect(() => {
    const qa = run ? getVoiceQaFromRun(run) : null;
    setQaReviewNote(qa?.reviewNote ?? '');
    setQaDisposition(qa?.reviewDisposition ?? '');
    setQaNeedsPromptFix(qa?.needsPromptFix === true);
    setQaNeedsOpsFix(qa?.needsOpsFix === true);
    setQaNeedsRetryTuning(qa?.needsRetryTuning === true);
    setQaNeedsHumanFollowup(qa?.needsHumanFollowup === true);
  }, [run?.id, run?.updatedAt]);

  useEffect(() => {
    if (!runId) return;
    const unsub = subscribeWhatsappAiRunWorkflowByRunId(runId, (item) => {
      if (item && companyId && item.companyId !== companyId) return;
      setWorkflow(item);
      setCommentDraft(item?.lastComment ?? '');
    });
    return () => unsub();
  }, [runId, companyId]);

  const aiRt = conv ? parseWhatsAppAiRuntime(conv as Record<string, unknown>) : null;
  const extractionRawFromRun = run?.extractedSnapshotJson ?? null;
  const extractionRawFallback = aiRt?.lastExtractionJson ?? null;
  const extractionRawActive = extractionRawFromRun || extractionRawFallback;
  const extraction: CrmAiBotExtractionResult | null = useMemo(() => {
    const raw = extractionRawActive;
    if (!raw || typeof raw !== 'string') return null;
    try {
      return parseCrmAiBotExtractionResult(JSON.parse(raw));
    } catch {
      return null;
    }
  }, [extractionRawActive]);
  const answerText = run?.answerSnapshot || run?.generatedReply || '';
  const summaryText = run?.summarySnapshot || run?.extractedSummary || '';
  const applySnapshot = parseSnapshotJson<Record<string, unknown>>(run?.extractionApplySnapshotJson);
  const dealSnapshot = parseSnapshotJson<Record<string, unknown>>(run?.dealRecommendationSnapshotJson);
  const taskSnapshot = parseSnapshotJson<Record<string, unknown>>(run?.taskRecommendationSnapshotJson);
  const fallbackHuman = humanizeFallbackReasons(run?.createUsedFallbacks);

  const pauseBot = async () => {
    if (!bot) return;
    setBusy(true);
    try {
      await updateCrmAiBot(bot.id, {
        name: bot.name,
        description: bot.description,
        botType: bot.botType,
        channel: bot.channel,
        status: 'paused'
      });
      toast.success('Бот на паузе');
      setBot({ ...bot, status: 'paused' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const resumeBot = async () => {
    if (!bot) return;
    setBusy(true);
    try {
      await updateCrmAiBot(bot.id, {
        name: bot.name,
        description: bot.description,
        botType: bot.botType,
        channel: bot.channel,
        status: 'active'
      });
      toast.success('Бот снова активен');
      setBot({ ...bot, status: 'active' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const disableAiChat = async () => {
    if (!run || !companyId) return;
    setBusy(true);
    try {
      await updateWhatsAppConversationAiRuntime(
        run.conversationId,
        { enabled: false, mode: 'off' },
        { ensureCompanyId: companyId }
      );
      toast.success('AI в чате выключен');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const setChatRuntimeMode = async (mode: WhatsAppAiRuntimeMode) => {
    if (!run || !companyId) return;
    setBusy(true);
    try {
      await updateWhatsAppConversationAiRuntime(
        run.conversationId,
        {
          enabled: mode !== 'off',
          mode
        },
        { ensureCompanyId: companyId }
      );
      toast.success(`Режим чата: ${mode}`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const openChatWithDraft = () => {
    if (!run) return;
    const draft = answerText.trim();
    if (!draft) {
      toast.error('В этом run нет текста ответа');
      return;
    }
    stashChatDraft(run.conversationId, draft);
    navigate(`/whatsapp?chatId=${encodeURIComponent(run.conversationId)}`);
  };

  if (!can) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Нет доступа.</p>
      </div>
    );
  }

  if (run === undefined) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <p className="text-gray-600">Запись не найдена или другая компания.</p>
        <Link to="/ai-control" className="text-indigo-600 text-sm mt-2 inline-block">
          ← К журналу
        </Link>
      </div>
    );
  }

  const agg = computeAggregatedStatus(run);
  const flags = computeRunResultFlags(run);
  const presentation = deriveAiRunListPresentation(run, agg);
  const derivedWorkflow = deriveAiRunWorkflow(run, presentation, workflow);
  const isVoice = deriveAiRunChannelFromRun(run) === 'voice';
  const voiceSnap = getVoiceCallSnapshotFromRun(run);
  const voiceQa = getVoiceQaFromRun(run);
  const voiceRetry = getVoiceRetryFromRun(run);
  const voicePost = getVoicePostCallFromRun(run);
  const dealOpenId = run.createdDealId || run.dealId || dealPreview?.id;
  const clientOpenId = run.clientIdSnapshot || run.appliedClientId || null;
  const runtimeMode = run.runtimeMode || run.mode || 'unknown';
  const phone = run.phoneSnapshot || client?.phone || voiceSession?.toE164 || '—';
  const runAny = run as unknown as Record<string, unknown>;
  const voiceDebug = (voiceSession?.metadata?.voiceProviderDebug as Record<string, unknown> | undefined) ?? null;
  const callbackTimeline = Array.isArray(voiceDebug?.callbackTimeline)
    ? (voiceDebug?.callbackTimeline as Array<Record<string, unknown>>)
    : Array.isArray(voiceSnap?.callbackTimeline)
      ? (voiceSnap?.callbackTimeline as Array<Record<string, unknown>>)
      : [];
  const voiceFailureReasonCode = voiceSession?.voiceFailureReasonCode ?? voiceSnap?.voiceFailureReasonCode ?? null;
  const voiceFailureReasonMessage = voiceSession?.voiceFailureReasonMessage ?? voiceSnap?.voiceFailureReasonMessage ?? null;
  const providerCatalog = getVoiceProviderCatalogItem(voiceSession?.provider ?? voiceSnap?.provider ?? null);
  const diagnosticPayload = useMemo(() => {
    if (!isVoice) return null;
    return {
      runId: run.id,
      callId: voiceSession?.id ?? getVoiceCallSessionIdFromRun(run) ?? null,
      provider: voiceSession?.provider ?? voiceSnap?.provider ?? null,
      providerCallId: voiceSession?.providerCallId ?? voiceSnap?.providerCallId ?? null,
      from: voiceSession?.fromE164 ?? voiceSnap?.fromE164 ?? null,
      to: voiceSession?.toE164 ?? voiceSnap?.toE164 ?? run.phoneSnapshot ?? null,
      callStatus: voiceSession?.status ?? voiceSnap?.callStatus ?? null,
      finalProviderStatus: voiceSession?.twilioFinalStatus ?? voiceSnap?.twilioFinalStatus ?? null,
      durationSec: voiceSession?.durationSec ?? voiceSnap?.durationSec ?? null,
      hadInProgress: voiceSnap?.hadInProgress ?? (voiceSession?.connectedAt ? true : null),
      failureReasonCode: voiceFailureReasonCode,
      failureReasonMessage: voiceFailureReasonMessage,
      callbackTimeline
    };
  }, [isVoice, run, voiceSession, voiceSnap, callbackTimeline, voiceFailureReasonCode, voiceFailureReasonMessage]);
  const me = auth.currentUser;
  const meName = me?.displayName || me?.email || 'Пользователь';

  const updateWorkflow = async (
    patch: Partial<WhatsAppAiRunWorkflowRecord> & { status?: AiRunWorkflowStatus; resolutionType?: AiRunWorkflowResolutionType }
  ) => {
    if (!companyId || !runId) return;
    setWorkflowBusy(true);
    try {
      await upsertWhatsappAiRunWorkflow(companyId, runId, {
        ...patch,
        updatedBy: meName,
        firstAttentionAt: workflow?.firstAttentionAt ?? (presentation.requiresAttention ? new Date() : null),
        dueAt: patch.status === 'resolved' || patch.status === 'ignored' ? null : derivedWorkflow.dueAtMs ? new Date(derivedWorkflow.dueAtMs) : null,
        slaMinutes: derivedWorkflow.slaMinutes,
        priority: derivedWorkflow.priority,
        priorityReason: derivedWorkflow.priorityReasons
      });
      await appendWhatsappAiRunWorkflowEvent(companyId, runId, {
        type:
          patch.status === 'resolved'
            ? 'resolved'
            : patch.status === 'ignored'
              ? 'ignored'
              : patch.status === 'escalated'
                ? 'escalated'
                : patch.status
                  ? 'status_changed'
                  : patch.lastComment != null
                    ? 'comment_saved'
                    : 'assigned',
        by: me?.uid ?? null,
        byName: meName,
        payload: { status: patch.status ?? null, resolutionType: patch.resolutionType ?? null }
      });
      toast.success('Статус обработки обновлён');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось обновить workflow');
    } finally {
      setWorkflowBusy(false);
    }
  };

  const triggerManualAlert = async () => {
    if (!runId) return;
    setWorkflowBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/ai-control-alert-dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ runId })
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success('Alert отправлен');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось отправить alert');
    } finally {
      setWorkflowBusy(false);
    }
  };

  const voiceOperationalFetch = async (body: Record<string, unknown>) => {
    if (!run?.id) return;
    setVoiceOpBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/voice/operational', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ ...body, runId: run.id })
      });
      const text = await res.text();
      let data: { error?: string; ok?: boolean } = {};
      try {
        data = JSON.parse(text) as { error?: string; ok?: boolean };
      } catch {
        /* noop */
      }
      if (!res.ok) throw new Error(data.error || text || res.statusText);
      toast.success('Готово');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка voice operational');
    } finally {
      setVoiceOpBusy(false);
    }
  };

  const voiceQaReviewAction = async (body: Record<string, unknown>) => {
    await voiceOperationalFetch(body);
  };

  const extRows: { label: string; value: string }[] = extraction
    ? [
        { label: 'Имя', value: extraction.clientName ?? '—' },
        { label: 'Город', value: extraction.city ?? '—' },
        { label: 'Площадь', value: extraction.areaM2 ?? '—' },
        { label: 'Этажи', value: extraction.floors ?? '—' },
        { label: 'Тип дома', value: extraction.houseFormat ?? extraction.projectType ?? '—' },
        { label: 'Стены', value: extraction.wallType ?? '—' },
        { label: 'Крыша', value: extraction.roofType ?? '—' },
        { label: 'Высота потолка', value: extraction.ceilingHeight ?? '—' },
        { label: 'Бюджет', value: extraction.budget ?? '—' },
        { label: 'Сроки', value: extraction.timeline ?? '—' },
        { label: 'Финансирование', value: extraction.financing ?? '—' },
        { label: 'Участок', value: extraction.landStatus ?? '—' },
        { label: 'Интерес', value: extraction.interestLevel ?? '—' },
        { label: 'Температура', value: extraction.leadTemperature ?? '—' },
        { label: 'КП', value: extraction.wantsCommercialOffer == null ? '—' : extraction.wantsCommercialOffer ? 'да' : 'нет' },
        { label: 'Консультация', value: extraction.wantsConsultation == null ? '—' : extraction.wantsConsultation ? 'да' : 'нет' },
        { label: 'След. шаг', value: extraction.nextStep ?? '—' },
        { label: 'Сводка', value: extraction.summaryComment ?? '—' },
        { label: 'Контакт (предпочтение)', value: extraction.preferredContactMode ?? '—' }
      ]
    : [];

  return (
    <div className="min-h-full bg-gray-50/80 p-4 sm:p-6 max-w-4xl mx-auto pb-24">
      <PageMetadata title={`AI run ${run.id.slice(0, 8)}…`} />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => navigate('/ai-control')}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Журнал
        </button>
      </div>

      <div className="rounded-xl border bg-white shadow-sm p-4 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Срабатывание AI</h1>
            <p className="text-xs text-gray-500 font-mono mt-1 break-all">{run.id}</p>
          </div>
          <AiRunStatusBadge status={agg} />
        </div>
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-gray-500 text-xs">Бот</dt>
            <dd>
              {bot?.name ?? run.botId}
              {bot?.status === 'paused' && (
                <span className="ml-2 text-xs font-medium text-amber-700">(на паузе)</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">Канал</dt>
            <dd>{channelLabel(run.channel || bot?.channel)}</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">Режим run (лог)</dt>
            <dd>{run.runtimeMode || run.mode}</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">Runtime в чате сейчас</dt>
            <dd>
              {aiRt
                ? `${aiRt.enabled ? 'вкл' : 'выкл'} · ${aiRt.mode}${aiRt.botId ? ` · бот ${aiRt.botId.slice(0, 8)}…` : ''}`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">Статус записи</dt>
            <dd>{run.status}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500 text-xs">conversationId</dt>
            <dd className="font-mono text-xs break-all">{run.conversationId}</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">Клиент</dt>
            <dd>{client?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500 text-xs">Телефон</dt>
            <dd>{client?.phone ?? '—'}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {!isVoice ? (
          <Link
            to={`/whatsapp?chatId=${encodeURIComponent(run.conversationId)}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
          >
            <MessageSquare className="w-4 h-4" />
            Открыть чат
          </Link>
          ) : (
            <span className="text-xs text-violet-800 bg-violet-100 px-2 py-1 rounded">Это голосовой run — чата WhatsApp не привязано</span>
          )}
          <button
            type="button"
            disabled={!clientOpenId}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm hover:bg-gray-50 disabled:opacity-40"
            onClick={() => clientOpenId && navigate(`/clients?clientId=${encodeURIComponent(clientOpenId)}`)}
            title={clientOpenId ? `Открыть клиента (${clientOpenId})` : 'Клиент не найден'}
          >
            <User className="w-4 h-4" />
            Открыть клиента
          </button>
          <button
            type="button"
            disabled={!dealOpenId}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm hover:bg-gray-50 disabled:opacity-40"
            onClick={() => dealOpenId && navigate(`/deals?deal=${encodeURIComponent(dealOpenId)}`)}
            title={dealOpenId ? `Открыть сделку (${dealOpenId})` : 'Сделка не найдена'}
          >
            <ExternalLink className="w-4 h-4" />
            Открыть сделку
          </button>
          <button
            type="button"
            disabled={!bot}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm hover:bg-gray-50 disabled:opacity-40"
            onClick={() => bot && navigate(`/autovoronki/${bot.id}`)}
            title={bot ? 'Открыть настройки бота' : 'Бот не найден'}
          >
            <Bot className="w-4 h-4" />
            Открыть бота
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm"
            onClick={() => copyText('Ответ', answerText)}
          >
            <Copy className="w-4 h-4" />
            Копировать ответ
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm"
            onClick={openChatWithDraft}
          >
            <MessageSquare className="w-4 h-4" />
            Подставить draft в чат
          </button>
          <button
            type="button"
            disabled={!summaryText}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40"
            onClick={() => copyText('Сводка', summaryText)}
            title={summaryText ? 'Копировать summary' : 'Summary не найден'}
          >
            <Copy className="w-4 h-4" />
            Копировать summary
          </button>
          <button
            type="button"
            disabled={!extractionRawActive}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40"
            onClick={() => extractionRawActive && copyText('JSON', extractionRawActive)}
            title={extractionRawActive ? 'Копировать extracted JSON' : 'Extracted JSON не найден'}
          >
            <Copy className="w-4 h-4" />
            JSON extraction
          </button>
          {!isVoice ? (
          <button
            type="button"
            disabled={busy}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-amber-800 border-amber-200 bg-amber-50 text-sm disabled:opacity-50"
            onClick={() => void disableAiChat()}
          >
            <Ban className="w-4 h-4" />
            Выключить AI в чате
          </button>
          ) : null}
          {bot?.status === 'active' ? (
            <button
              type="button"
              disabled={busy}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm"
              onClick={() => void pauseBot()}
            >
              <PauseCircle className="w-4 h-4" />
              Пауза бота
            </button>
          ) : bot?.status === 'paused' ? (
            <button
              type="button"
              disabled={busy}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm text-emerald-800"
              onClick={() => void resumeBot()}
            >
              <PlayCircle className="w-4 h-4" />
              Включить бота
            </button>
          ) : null}
        </div>

        {!isVoice ? (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">Режим AI в этом чате</p>
          <div className="flex flex-wrap gap-2">
            {(['off', 'draft', 'auto'] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={busy}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium disabled:opacity-50 hover:bg-gray-50"
                onClick={() => void setChatRuntimeMode(m)}
              >
                {m === 'off' ? 'Выкл' : m === 'draft' ? 'Черновик' : 'Авто'}
              </button>
            ))}
          </div>
        </div>
        ) : null}
      </div>

      {isVoice ? (
        <>
          <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 mb-4">
            <h2 className="font-semibold text-violet-900 mb-2">Голосовой звонок</h2>
            <p className="text-xs text-violet-800 mb-3">
              Операционный канал <strong>Voice</strong> (Twilio). Данные из run + привязанной сессии voiceCallSessions.
            </p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-gray-500 text-xs">Канал</dt>
                <dd>Voice</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Провайдер</dt>
                <dd>
                  {voiceSession?.provider ?? voiceSnap?.provider ?? '—'} · readiness: {providerCatalog.readiness}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Provider capabilities</dt>
                <dd>
                  countries: {providerCatalog.supportedCountries.join(', ') || '—'} · local caller ID:{' '}
                  {providerCatalog.localCallerIdSupported ? 'yes' : 'no'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-gray-500 text-xs">Provider Call SID</dt>
                <dd className="font-mono text-xs break-all">{voiceSession?.providerCallId ?? voiceSnap?.providerCallId ?? '—'}</dd>
              </div>
              {voiceFailureReasonCode === 'telecom_route_uncertain' ? (
                <div className="sm:col-span-2">
                  <dt className="text-gray-500 text-xs">Telecom</dt>
                  <dd className="inline-flex items-center gap-1 text-[11px] text-amber-900 bg-amber-100 border border-amber-200 px-2 py-1 rounded">
                    <AlertTriangle className="w-3 h-3" />
                    Возможна проблема маршрута/оператора (telecom route uncertain)
                  </dd>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <dt className="text-gray-500 text-xs">Twilio diagnostic</dt>
                <dd className="text-xs break-words">
                  SID: <span className="font-mono">{voiceSession?.providerCallId ?? voiceSnap?.providerCallId ?? '—'}</span>
                  {' · '}final: {voiceSession?.twilioFinalStatus ?? voiceSnap?.twilioFinalStatus ?? voiceSession?.status ?? '—'}
                  {' · '}SIP: {voiceSession?.twilioSipResponseCode ?? voiceSnap?.twilioSipResponseCode ?? '—'}
                  {' · '}reason: {voiceSession?.twilioProviderReason ?? voiceSnap?.twilioProviderReason ?? '—'}
                  {' · '}errorCode: {voiceSession?.twilioErrorCode ?? voiceSnap?.twilioErrorCode ?? '—'}
                </dd>
                {(voiceSession?.providerCallId ?? voiceSnap?.providerCallId) ? (
                  <a
                    href={`https://console.twilio.com/us1/monitor/logs/calls/${encodeURIComponent(
                      voiceSession?.providerCallId ?? voiceSnap?.providerCallId ?? ''
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-sky-700 hover:text-sky-900 mt-1"
                  >
                    Open in Twilio Console <ExternalLink className="w-3 h-3" />
                  </a>
                ) : null}
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Статус звонка</dt>
                <dd>{voiceSession?.status ?? voiceSnap?.callStatus ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Исход (outcome)</dt>
                <dd>{voiceSession?.outcome ?? voiceSnap?.outcome ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">С / На</dt>
                <dd>
                  {voiceSession?.fromE164 ?? voiceSnap?.fromE164 ?? '—'} → {voiceSession?.toE164 ?? voiceSnap?.toE164 ?? run.phoneSnapshot ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Длительность</dt>
                <dd>
                  {(voiceSession?.durationSec ?? voiceSnap?.durationSec) != null
                    ? `${voiceSession?.durationSec ?? voiceSnap?.durationSec} с`
                    : '—'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-gray-500 text-xs">Failure reason</dt>
                <dd>
                  <span className="font-mono text-[11px]">{voiceFailureReasonCode ?? '—'}</span>
                  {voiceFailureReasonMessage ? ` — ${voiceFailureReasonMessage}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">voiceCallSessionId</dt>
                <dd className="font-mono text-xs break-all">{voiceSession?.id ?? getVoiceCallSessionIdFromRun(run) ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">linkedRunId</dt>
                <dd className="font-mono text-xs break-all">{voiceSession?.linkedRunId ?? run.id}</dd>
              </div>
            </dl>
            <div className="mt-3 pt-3 border-t border-violet-200/80">
              <p className="text-xs text-violet-900 mb-1">Lifecycle timeline</p>
              {(() => {
                const lifecycle =
                  ((voiceDebug?.lifecycle as Record<string, unknown> | undefined) ??
                    (voiceSnap?.lifecycle as Record<string, unknown> | undefined) ??
                    {}) as Record<string, unknown>;
                return (
              <div className="space-y-1 text-xs text-violet-900/90">
                <p>Created: {String(lifecycle.createdAt ?? '—')}</p>
                <p>Connected: {String(lifecycle.connectedAt ?? '—')}</p>
                <p>Ended: {String(lifecycle.endedAt ?? '—')}</p>
                <p>Callbacks: {callbackTimeline.length}</p>
              </div>
                );
              })()}
              {callbackTimeline.length > 0 ? (
                <div className="mt-2 max-h-32 overflow-auto rounded border border-violet-200 bg-white/70 p-2 text-[11px]">
                  {callbackTimeline.map((x, i) => (
                    <p key={`${String(x.at ?? i)}-${i}`} className="font-mono">
                      {String(x.at ?? '—')} · {String(x.eventType ?? '—')} · provider:{String(x.providerCallStatus ?? '—')} ·
                      crm:{String(x.crmStatusAfter ?? '—')}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm bg-white"
                onClick={() => diagnosticPayload && copyText('Диагностика', JSON.stringify(diagnosticPayload))}
              >
                <Copy className="w-4 h-4" />
                Скопировать диагностику
              </button>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 mb-4">
            <h2 className="font-semibold text-gray-900 mb-2">Итог разговора (post-call)</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-gray-500 text-xs">post-call (сессия)</dt>
                <dd>{voiceSession?.postCallStatus ?? voiceSnap?.postCallStatus ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Сводка</dt>
                <dd className="break-words">{summaryText || voicePost?.summary || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">CRM apply</dt>
                <dd>{run.extractionApplyStatus ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Follow-up</dt>
                <dd>
                  {voiceSnap?.followUpStatus ?? '—'}
                  {voiceSnap?.followUpError ? ` (${voiceSnap.followUpError})` : ''}
                </dd>
              </div>
              {voicePost?.warnings?.length ? (
                <div className="sm:col-span-2">
                  <dt className="text-gray-500 text-xs">Предупреждения pipeline</dt>
                  <dd>{voicePost.warnings.join(', ')}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-xl border bg-white p-4 mb-4">
            <h2 className="font-semibold text-gray-900 mb-2">Quality / QA</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-gray-500 text-xs">QA status</dt>
                <dd>{voiceQa?.status ?? voiceSession?.voiceQaStatus ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">QA score / band</dt>
                <dd>
                  {voiceQa?.score ?? voiceSession?.voiceQaScore ?? '—'}
                  {' / '}
                  {voiceQa?.band ?? voiceSession?.voiceQaBand ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Needs review</dt>
                <dd>{voiceQa?.needsReview || voiceSession?.voiceQaNeedsReview ? 'Да' : 'Нет'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Outcome confidence</dt>
                <dd>{voiceQa?.outcomeConfidence ?? voiceSession?.voiceQaOutcomeConfidence ?? '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-gray-500 text-xs">QA summary</dt>
                <dd className="break-words">{voiceQa?.summary ?? voiceSession?.voiceQaSummary ?? '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-gray-500 text-xs">Flags</dt>
                <dd>{voiceQa?.flags?.length ? voiceQa.flags.join(', ') : '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-gray-500 text-xs">Failure reasons</dt>
                <dd>{voiceQa?.failureReasons?.length ? voiceQa.failureReasons.join(', ') : '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-gray-500 text-xs">Warnings</dt>
                <dd>{voiceQa?.warnings?.length ? voiceQa.warnings.join(', ') : '—'}</dd>
              </div>
            </dl>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">Review workflow</p>
              <div className="flex flex-wrap gap-2 mb-2">
                <button
                  type="button"
                  disabled={voiceOpBusy || !can}
                  className="px-3 py-1.5 rounded border text-xs disabled:opacity-50"
                  onClick={() => void voiceQaReviewAction({ action: 'mark_reviewed' })}
                >
                  Reviewed
                </button>
                <button
                  type="button"
                  disabled={voiceOpBusy || !can}
                  className="px-3 py-1.5 rounded border text-xs text-amber-800 border-amber-200 bg-amber-50 disabled:opacity-50"
                  onClick={() => void voiceQaReviewAction({ action: 'accept_issue' })}
                >
                  Accept issue
                </button>
                <button
                  type="button"
                  disabled={voiceOpBusy || !can}
                  className="px-3 py-1.5 rounded border text-xs text-indigo-800 border-indigo-200 bg-indigo-50 disabled:opacity-50"
                  onClick={() => void voiceQaReviewAction({ action: 'mark_false_positive' })}
                >
                  False positive
                </button>
              </div>
              <div className="flex flex-wrap items-end gap-2 mb-2">
                <div className="min-w-[220px]">
                  <label className="block text-[10px] text-gray-500 uppercase mb-1">Disposition</label>
                  <select
                    className="w-full text-xs border rounded px-2 py-1.5 bg-white"
                    value={qaDisposition}
                    onChange={(e) => setQaDisposition(e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="false_positive">false_positive</option>
                    <option value="bot_script_issue">bot_script_issue</option>
                    <option value="extraction_issue">extraction_issue</option>
                    <option value="crm_issue">crm_issue</option>
                    <option value="follow_up_issue">follow_up_issue</option>
                    <option value="retry_issue">retry_issue</option>
                    <option value="client_issue">client_issue</option>
                    <option value="provider_issue">provider_issue</option>
                    <option value="unclear">unclear</option>
                  </select>
                </div>
                <button
                  type="button"
                  disabled={voiceOpBusy || !can}
                  className="px-3 py-1.5 rounded border text-xs disabled:opacity-50"
                  onClick={() =>
                    void voiceQaReviewAction({
                      action: 'set_disposition',
                      reviewDisposition: qaDisposition || null
                    })
                  }
                >
                  Save disposition
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2 text-xs">
                <label className="inline-flex items-center gap-1">
                  <input type="checkbox" checked={qaNeedsPromptFix} onChange={(e) => setQaNeedsPromptFix(e.target.checked)} />
                  needsPromptFix
                </label>
                <label className="inline-flex items-center gap-1">
                  <input type="checkbox" checked={qaNeedsOpsFix} onChange={(e) => setQaNeedsOpsFix(e.target.checked)} />
                  needsOpsFix
                </label>
                <label className="inline-flex items-center gap-1">
                  <input type="checkbox" checked={qaNeedsRetryTuning} onChange={(e) => setQaNeedsRetryTuning(e.target.checked)} />
                  needsRetryTuning
                </label>
                <label className="inline-flex items-center gap-1">
                  <input type="checkbox" checked={qaNeedsHumanFollowup} onChange={(e) => setQaNeedsHumanFollowup(e.target.checked)} />
                  needsHumanFollowup
                </label>
              </div>
              <button
                type="button"
                disabled={voiceOpBusy || !can}
                className="px-3 py-1.5 rounded border text-xs mb-2 disabled:opacity-50"
                onClick={() =>
                  void voiceQaReviewAction({
                    action: 'set_improvement_markers',
                    needsPromptFix: qaNeedsPromptFix,
                    needsOpsFix: qaNeedsOpsFix,
                    needsRetryTuning: qaNeedsRetryTuning,
                    needsHumanFollowup: qaNeedsHumanFollowup
                  })
                }
              >
                Save improvement markers
              </button>
              <label className="block text-[10px] text-gray-500 uppercase mb-1">Review note</label>
              <textarea
                className="w-full rounded border px-2 py-1.5 text-xs min-h-[72px]"
                value={qaReviewNote}
                onChange={(e) => setQaReviewNote(e.target.value)}
              />
              <button
                type="button"
                disabled={voiceOpBusy || !can}
                className="mt-2 px-3 py-1.5 rounded border text-xs disabled:opacity-50"
                onClick={() => void voiceQaReviewAction({ action: 'save_review_note', reviewNote: qaReviewNote || null })}
              >
                Save note
              </button>
              <p className="text-[11px] text-gray-500 mt-2">
                Review status: {voiceQa?.reviewStatus ?? voiceSession?.voiceQaReviewStatus ?? 'none'} · by:{' '}
                {voiceQa?.reviewedBy ?? voiceSession?.voiceQaReviewedBy ?? '—'} · at:{' '}
                {(voiceQa?.reviewedAt as unknown as string) ?? (voiceSession?.voiceQaReviewedAt as unknown as string) ?? '—'}
              </p>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 mb-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left font-semibold text-gray-900 mb-2"
              onClick={() => setTranscriptOpen((v) => !v)}
            >
              Транскрипт ({voiceTurns.length} реплик)
              <span className="text-xs text-gray-500">{transcriptOpen ? 'Скрыть' : 'Показать'}</span>
            </button>
            {transcriptOpen ? (
              <div className="max-h-80 overflow-auto space-y-1 text-sm border rounded-lg p-2 bg-gray-50">
                {voiceTurns.length === 0 ? (
                  <p className="text-gray-500 text-xs">Нет реплик или нет доступа к чтению turns.</p>
                ) : (
                  voiceTurns.map((t) => (
                    <p key={t.id} className="text-xs">
                      <span className="font-medium text-gray-600">
                        {t.speaker === 'bot' ? 'Бот' : t.speaker === 'client' ? 'Клиент' : t.speaker}:
                      </span>{' '}
                      {t.text}
                    </p>
                  ))
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500">Компактный вид: откройте, чтобы увидеть полный диалог.</p>
            )}
          </section>

          <section className="rounded-xl border bg-white p-4 mb-4">
            <h2 className="font-semibold text-gray-900 mb-2">Связанные сущности (voice)</h2>
            <div className="text-sm space-y-1">
              <p>
                <span className="text-gray-500">Сделка:</span>{' '}
                {dealOpenId ? (
                  <Link className="text-indigo-600 hover:underline" to={`/deals?deal=${encodeURIComponent(dealOpenId)}`}>
                    {dealOpenId}
                  </Link>
                ) : (
                  '—'
                )}
              </p>
              <p>
                <span className="text-gray-500">Задача (next deal):</span> {run.taskId ?? voiceSession?.linkedTaskId ?? '—'}
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 mb-4">
            <h2 className="font-semibold text-amber-950 mb-2 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Повторы и callback
            </h2>
            <p className="text-xs text-amber-900/90 mb-3">
              Один операционный кейс (linkedRunId), новые попытки — новые voiceCallSessions. Авто-retry выполняет плановый
              sweep; ниже — ручной перезвон и время callback.
            </p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-4">
              <div>
                <dt className="text-gray-500 text-xs">Статус retry</dt>
                <dd>{voiceRetry?.retryStatus ?? voiceSession?.voiceRetryStatus ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Причина</dt>
                <dd>{voiceRetry?.retryReason ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Авто-dispatch / лимит</dt>
                <dd>
                  {voiceRetry?.autoDispatchCount ?? 0}
                  {voiceRetry?.maxAutoDispatches != null ? ` / ${voiceRetry.maxAutoDispatches}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Ручных перезвонов</dt>
                <dd>{voiceRetry?.manualRedialCount ?? 0}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-gray-500 text-xs">След. retry (run)</dt>
                <dd className="break-all">{voiceRetry?.nextRetryAt ?? '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-gray-500 text-xs">Callback (клиент)</dt>
                <dd className="break-all">{voiceRetry?.callbackAt ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">rootCallId</dt>
                <dd className="font-mono text-xs break-all">{voiceRetry?.rootCallId ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">parentCallId</dt>
                <dd className="font-mono text-xs break-all">{voiceRetry?.parentCallId ?? '—'}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2 items-end">
              <button
                type="button"
                disabled={voiceOpBusy || !can}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-sm text-amber-950 disabled:opacity-50"
                onClick={() => void voiceOperationalFetch({ action: 'redial' })}
              >
                <Phone className="w-4 h-4" />
                Перезвонить
              </button>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-500 uppercase">Время callback</label>
                <input
                  type="datetime-local"
                  className="text-sm border rounded-lg px-2 py-1.5 bg-white"
                  value={callbackInput}
                  onChange={(e) => setCallbackInput(e.target.value)}
                />
              </div>
              <button
                type="button"
                disabled={voiceOpBusy || !can || !callbackInput.trim()}
                className="px-3 py-1.5 rounded-lg border text-sm bg-white disabled:opacity-50"
                onClick={() => {
                  const d = new Date(callbackInput);
                  if (Number.isNaN(d.getTime())) {
                    toast.error('Укажите дату и время');
                    return;
                  }
                  void voiceOperationalFetch({ action: 'schedule_callback', callbackAt: d.toISOString() });
                }}
              >
                Назначить callback
              </button>
              <button
                type="button"
                disabled={voiceOpBusy || !can}
                className="px-3 py-1.5 rounded-lg border text-sm bg-white text-amber-900 border-amber-300 disabled:opacity-50"
                onClick={() => void voiceOperationalFetch({ action: 'mark_need_alt_provider', note: 'manual_tag_from_ai_control' })}
              >
                Нужен другой провайдер
              </button>
            </div>
          </section>
        </>
      ) : null}

      <section className="rounded-xl border bg-white p-4 mb-4">
        <h2 className="font-semibold text-gray-900 mb-2">Итог run</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
          <p><span className="text-gray-500">Статус:</span> {agg}</p>
          <p><span className="text-gray-500">Канал:</span> {channelLabel(run.channel || bot?.channel)}</p>
          <p><span className="text-gray-500">Режим runtime:</span> {runtimeMode}</p>
          <p><span className="text-gray-500">Бот:</span> {bot?.name ?? run.botId}</p>
          <p><span className="text-gray-500">Клиент:</span> {client?.name ?? clientOpenId ?? '—'}</p>
          <p><span className="text-gray-500">Телефон:</span> {phone}</p>
          <p><span className="text-gray-500">Extraction:</span> {extractionRawActive ? 'есть' : 'нет'}</p>
          <p><span className="text-gray-500">CRM apply:</span> {run.extractionApplyStatus ?? '—'}</p>
          <p><span className="text-gray-500">Fallback:</span> {(run.createUsedFallbacks?.length ?? 0) > 0 ? 'да' : 'нет'}</p>
          <p><span className="text-gray-500">Сделка:</span> {run.createdDealId || run.dealCreateStatus === 'created' ? 'создана' : run.dealRecommendationStatus === 'recommended' ? 'рекомендована' : 'нет'}</p>
          <p><span className="text-gray-500">Задача:</span> {run.taskCreateStatus === 'created' ? 'создана' : run.taskRecommendationStatus === 'recommended' ? 'рекомендована' : 'нет'}</p>
          <p><span className="text-gray-500">Время:</span> {run.createdAt || '—'}</p>
          <p className="sm:col-span-2 lg:col-span-3 break-all">
            <span className="text-gray-500">conversationId:</span> <span className="font-mono text-xs">{run.conversationId}</span>
          </p>
        </div>
      </section>

      {presentation.requiresAttention && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4">
          <h2 className="font-semibold text-amber-900 mb-2">Почему run требует внимания</h2>
          <ul className="text-sm text-amber-900 space-y-1">
            {presentation.attentionReasons.map((reason, idx) => (
              <li key={`${reason}-${idx}`}>• {reason}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border bg-white p-4 mb-4">
        <h2 className="font-semibold text-gray-900 mb-2">Обработка менеджером</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
          <p><span className="text-gray-500">Статус:</span> {derivedWorkflow.statusLabel}</p>
          <p><span className="text-gray-500">Приоритет:</span> {derivedWorkflow.priorityLabel}</p>
          <p><span className="text-gray-500">SLA до:</span> {derivedWorkflow.dueAtMs ? new Date(derivedWorkflow.dueAtMs).toLocaleString('ru-RU') : '—'}</p>
          <p><span className="text-gray-500">Просрочка:</span> {derivedWorkflow.isOverdue ? 'Да' : 'Нет'}</p>
          <p><span className="text-gray-500">Возраст:</span> {derivedWorkflow.ageMinutes != null ? `${derivedWorkflow.ageMinutes} мин` : '—'}</p>
          <p><span className="text-gray-500">Назначен:</span> {derivedWorkflow.assigneeName || 'Не назначен'}</p>
          <p><span className="text-gray-500">Обновил:</span> {derivedWorkflow.updatedBy || '—'}</p>
          <p>
            <span className="text-gray-500">Обновлено:</span>{' '}
            {derivedWorkflow.updatedAtMs ? new Date(derivedWorkflow.updatedAtMs).toLocaleString('ru-RU') : '—'}
          </p>
        </div>
        <label className="block text-xs text-gray-500 mb-1">Комментарий менеджера</label>
        <textarea
          className="w-full rounded-lg border px-3 py-2 text-sm min-h-[84px]"
          placeholder="Коротко: что проверено, что сделано, что осталось"
          value={commentDraft}
          onChange={(e) => setCommentDraft(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={workflowBusy}
            className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40"
            onClick={() =>
              void updateWorkflow({
                status: 'in_progress',
                assigneeId: me?.uid ?? null,
                assigneeName: meName,
                lastComment: commentDraft || null,
                resolutionType: null
              })
            }
          >
            Взять в работу
          </button>
          <button
            type="button"
            disabled={workflowBusy}
            className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40"
            onClick={() =>
              void updateWorkflow({
                lastComment: commentDraft || null
              })
            }
          >
            Сохранить комментарий
          </button>
          <button
            type="button"
            disabled={workflowBusy}
            className="px-3 py-1.5 rounded-lg border text-sm text-emerald-800 border-emerald-200 bg-emerald-50 disabled:opacity-40"
            onClick={() =>
              void updateWorkflow({
                status: 'resolved',
                assigneeId: me?.uid ?? null,
                assigneeName: meName,
                lastComment: commentDraft || null,
                resolvedAt: new Date(),
                resolutionType: 'fixed'
              })
            }
          >
            Пометить решённым
          </button>
          <button
            type="button"
            disabled={workflowBusy}
            className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40"
            onClick={() =>
              void updateWorkflow({
                status: 'ignored',
                assigneeId: me?.uid ?? null,
                assigneeName: meName,
                lastComment: commentDraft || null,
                resolutionType: 'ignored'
              })
            }
          >
            Игнорировать
          </button>
          <button
            type="button"
            disabled={workflowBusy}
            className="px-3 py-1.5 rounded-lg border text-sm text-amber-800 border-amber-200 bg-amber-50 disabled:opacity-40"
            onClick={() =>
              void updateWorkflow({
                status: 'escalated',
                assigneeId: me?.uid ?? null,
                assigneeName: meName,
                lastComment: commentDraft || null,
                resolutionType: 'escalated'
              })
            }
          >
            Эскалировать
          </button>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">Почему такой приоритет</p>
          <ul className="text-xs text-gray-600 mb-3 space-y-0.5">
            {derivedWorkflow.priorityReasons.map((reason, idx) => (
              <li key={`${reason}-${idx}`}>• {reason}</li>
            ))}
          </ul>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">Уведомления и эскалации</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700 mb-2">
            <p>Первый alert: {derivedWorkflow.firstAlertAtMs ? new Date(derivedWorkflow.firstAlertAtMs).toLocaleString('ru-RU') : '—'}</p>
            <p>Последний alert: {derivedWorkflow.lastAlertAtMs ? new Date(derivedWorkflow.lastAlertAtMs).toLocaleString('ru-RU') : '—'}</p>
            <p>Последний reminder: {derivedWorkflow.lastReminderAtMs ? new Date(derivedWorkflow.lastReminderAtMs).toLocaleString('ru-RU') : '—'}</p>
            <p>Эскалация: {derivedWorkflow.lastEscalationAtMs ? new Date(derivedWorkflow.lastEscalationAtMs).toLocaleString('ru-RU') : '—'}</p>
            <p>Состояние: {derivedWorkflow.isMuted ? 'muted' : derivedWorkflow.isSnoozed ? 'snoozed' : 'active'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={workflowBusy} className="px-3 py-1.5 rounded border text-xs disabled:opacity-40" onClick={() => void triggerManualAlert()}>
              Отправить alert повторно
            </button>
            <button type="button" disabled={workflowBusy} className="px-3 py-1.5 rounded border text-xs disabled:opacity-40" onClick={() => void updateWorkflow({ alertState: { ...(workflow?.alertState ?? {}), snoozedUntil: new Date(Date.now() + 15 * 60000) } })}>
              Snooze 15 мин
            </button>
            <button type="button" disabled={workflowBusy} className="px-3 py-1.5 rounded border text-xs disabled:opacity-40" onClick={() => void updateWorkflow({ alertState: { ...(workflow?.alertState ?? {}), snoozedUntil: new Date(Date.now() + 60 * 60000) } })}>
              Snooze 1 час
            </button>
            <button type="button" disabled={workflowBusy} className="px-3 py-1.5 rounded border text-xs disabled:opacity-40" onClick={() => {
              const end = new Date();
              end.setHours(23, 59, 59, 999);
              void updateWorkflow({ alertState: { ...(workflow?.alertState ?? {}), mutedUntil: end } });
            }}>
              Mute до конца дня
            </button>
            <button type="button" disabled={workflowBusy} className="px-3 py-1.5 rounded border text-xs disabled:opacity-40" onClick={() => void updateWorkflow({ alertState: { ...(workflow?.alertState ?? {}), mutedUntil: null, snoozedUntil: null } })}>
              Снять mute/snooze
            </button>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">Ручные действия</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40" title="Пока нет backend-обработчика retry CRM apply">
              Повторить CRM apply
            </button>
            <button type="button" disabled className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40" title="Пока нет backend-обработчика ручного создания сделки из AI-control">
              Создать сделку вручную
            </button>
            <button type="button" disabled className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40" title="Пока нет backend-обработчика ручного создания задачи из AI-control">
              Создать задачу вручную
            </button>
            <button type="button" disabled className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40" title="Пока нет backend-обработчика retry/re-run AI из AI-control">
              Retry / re-run AI
            </button>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">История обработки</p>
          <div className="space-y-1.5">
            {(derivedWorkflow.history ?? []).slice(-10).reverse().map((ev, idx) => (
              <p key={`${ev.type}-${idx}`} className="text-xs text-gray-600">
                {ev.byName || ev.by || 'Пользователь'} · {ev.type} · {tsToMs(ev.at) ? new Date(tsToMs(ev.at) as number).toLocaleString('ru-RU') : '—'}
              </p>
            ))}
            {(derivedWorkflow.history?.length ?? 0) === 0 ? <p className="text-xs text-gray-500">История пока пуста</p> : null}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">История уведомлений</p>
          <div className="space-y-1.5">
            {(derivedWorkflow.notificationHistory ?? []).slice(-10).reverse().map((ev, idx) => (
              <p key={`${ev.type}-${idx}`} className="text-xs text-gray-600">
                {ev.type} · {ev.channel} · {ev.status}
                {ev.target ? ` · ${ev.target}` : ''}
                {tsToMs(ev.sentAt) ? ` · ${new Date(tsToMs(ev.sentAt) as number).toLocaleString('ru-RU')}` : ''}
              </p>
            ))}
            {(derivedWorkflow.notificationHistory?.length ?? 0) === 0 ? <p className="text-xs text-gray-500">История уведомлений пока пуста</p> : null}
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4 mb-4">
        <h2 className="font-semibold text-gray-900 mb-2 inline-flex items-center gap-2">
          <Link2 className="w-4 h-4" />
          Связанные сущности
        </h2>
        <div className="space-y-2 text-sm">
          {[
            { label: 'conversationId', value: run.conversationId, open: `/whatsapp?chatId=${encodeURIComponent(run.conversationId)}` },
            { label: 'clientId', value: clientOpenId, open: clientOpenId ? `/clients?clientId=${encodeURIComponent(clientOpenId)}` : null },
            { label: 'dealId', value: dealOpenId, open: dealOpenId ? `/deals?deal=${encodeURIComponent(dealOpenId)}` : null },
            { label: 'botId', value: run.botId, open: `/autovoronki/${run.botId}` },
            { label: 'createdDealId', value: run.createdDealId, open: run.createdDealId ? `/deals?deal=${encodeURIComponent(run.createdDealId)}` : null },
            { label: 'taskId', value: run.taskId, open: null }
          ].map((row) => (
            <div key={row.label} className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500 w-28">{row.label}</span>
              <span className="font-mono text-xs break-all">{row.value || 'Не найдено'}</span>
              {row.value ? (
                <button
                  type="button"
                  className="text-xs text-indigo-600 hover:underline"
                  onClick={() => copyText(row.label, String(row.value))}
                >
                  копировать
                </button>
              ) : null}
              {row.open ? (
                <Link className="text-xs text-indigo-600 hover:underline" to={row.open}>
                  открыть
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4 mb-4">
        <h2 className="font-semibold text-gray-900 mb-2">Входящее сообщение (триггер)</h2>
        {triggerMsg ? (
          <div className="text-sm space-y-1">
            <p className="text-xs text-gray-500">
              Тип:{' '}
              {triggerMsg.attachments && Array.isArray(triggerMsg.attachments) && triggerMsg.attachments.length
                ? 'медиа / голос'
                : 'текст'}
            </p>
            <p className="whitespace-pre-wrap break-words bg-gray-50 p-2 rounded">
              {(triggerMsg.transcription as string) || (triggerMsg.text as string) || '—'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Нет загрузки сообщения (id: {run.triggerMessageId})</p>
        )}
      </section>

      <section className="rounded-xl border bg-white p-4 mb-4">
        <h2 className="font-semibold text-gray-900 mb-2">Ответ AI</h2>
        <p className="text-[11px] text-gray-500 mb-2">
          Источник ответа: {dataSourceLabel(run.answerSnapshot, run.generatedReply)}
        </p>
        {flags.isDraftMode && (
          <p className="text-xs text-amber-800 bg-amber-50 px-2 py-1 rounded mb-2">Режим черновика — клиенту не отправлялось</p>
        )}
        {flags.isAutoMode && run.status === 'success' && (
          <p className="text-xs text-emerald-800 bg-emerald-50 px-2 py-1 rounded mb-2">Авто — ответ ушёл в чат (если отправка не упала)</p>
        )}
        <pre className="text-sm whitespace-pre-wrap break-words bg-gray-50 p-3 rounded max-h-64 overflow-auto">
          {answerText || '—'}
        </pre>
      </section>

      <section className="rounded-xl border bg-white p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="font-semibold text-gray-900">Извлечённые данные</h2>
          {extractionRawActive ? (
            <button
              type="button"
              className="text-xs text-indigo-600 hover:underline"
              onClick={() => setShowRawExtraction((v) => !v)}
            >
              {showRawExtraction ? 'Скрыть raw JSON' : 'Показать raw JSON'}
            </button>
          ) : null}
        </div>
        {extRows.length ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {extRows.map((row) => (
              <div key={row.label}>
                <dt className="text-xs text-gray-500">{row.label}</dt>
                <dd className="break-words">{row.value || '—'}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-gray-500">Нет extraction snapshot для этого run</p>
        )}
        {showRawExtraction && extractionRawActive ? (
          <pre className="mt-3 text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-auto max-h-64">
            {extractionRawActive}
          </pre>
        ) : null}
        <p className="text-[11px] text-gray-500 mt-2">Источник extraction: {dataSourceLabel(extractionRawFromRun, extractionRawFallback)}</p>
        <p className="text-[11px] text-gray-500 mt-1">Источник summary: {dataSourceLabel(run.summarySnapshot, run.extractedSummary)}</p>
        {summaryText ? (
          <p className="text-xs text-gray-600 mt-2">
            <span className="font-medium">Краткая сводка:</span> {summaryText}
          </p>
        ) : null}
        {run.extractionError ? (
          <p className="text-xs text-red-700 mt-2">Ошибка extraction (лог): {run.extractionError}</p>
        ) : null}
      </section>

      <section className="rounded-xl border bg-white p-4 mb-4">
        <h2 className="font-semibold text-gray-900 mb-2">Запись в CRM (apply)</h2>
        <p className="text-[11px] text-gray-500 mb-2">Источник: {dataSourceLabel(run.extractionApplySnapshotJson, run.extractionApplyStatus)}</p>
        <ul className="text-sm space-y-1">
          <li>Статус: {String(applySnapshot?.extractionApplyStatus ?? run.extractionApplyStatus ?? '—')}</li>
          <li>Причина: {String(applySnapshot?.extractionApplyReason ?? run.extractionApplyReason ?? '—')}</li>
          <li>Полей: {Number(applySnapshot?.extractionAppliedFieldCount ?? run.extractionAppliedFieldCount ?? 0)}</li>
          <li>
            Ключи полей:{' '}
            {(run.extractionAppliedFields ?? []).length
              ? (run.extractionAppliedFields ?? []).join(', ')
              : '—'}
          </li>
          <li>Метки: {(run.extractionAppliedLabels ?? []).join(', ') || '—'}</li>
          <li>Время: {run.extractionAppliedAt ?? '—'}</li>
        </ul>
      </section>

      <section className="rounded-xl border bg-white p-4 mb-4">
        <h2 className="font-semibold text-gray-900 mb-2">Сделка</h2>
        <p className="text-[11px] text-gray-500">Источник: {dataSourceLabel(run.dealRecommendationSnapshotJson, run.dealRecommendationStatus)}</p>
        <p className="text-sm">Рекомендация: {String(dealSnapshot?.status ?? run.dealRecommendationStatus ?? '—')}</p>
        <p className="text-sm text-gray-600 text-xs">Причина рекомендации: {String(dealSnapshot?.reason ?? run.dealRecommendationReason ?? '—')}</p>
        <p className="text-sm">Черновик: {String(dealSnapshot?.draftTitle ?? run.dealDraftTitle ?? '—')}</p>
        <p className="text-sm">Создание (лог): {run.dealCreateStatus ?? '—'}</p>
        <p className="text-sm text-gray-600 text-xs">{run.dealCreateReason ? `Детали: ${run.dealCreateReason}` : null}</p>
        {run.createdDealTitle ? (
          <p className="text-sm mt-1">
            Созданная сделка: <strong>{run.createdDealTitle}</strong>
          </p>
        ) : null}
        <p className="text-xs text-gray-600 mt-2">
          Уверенность маршрутизации: {run.dealRoutingConfidence ?? '—'}
        </p>
        <p className="text-xs text-gray-600 mt-2">
          Воронка: {run.dealRoutingPipelineName ?? run.finalPipelineName ?? '—'} /{' '}
          {run.dealRoutingStageName ?? run.finalStageName ?? '—'}
        </p>
        <p className="text-xs text-gray-600">Ответственный: {run.dealRoutingAssigneeName ?? run.finalAssigneeName ?? '—'}</p>
        {(run.dealRoutingWarnings?.length ?? 0) > 0 && (
          <p className="text-xs text-amber-800 mt-1">Предупреждения: {run.dealRoutingWarnings!.join('; ')}</p>
        )}
        {(run.dealRoutingReason?.length ?? 0) > 0 && (
          <p className="text-xs text-gray-600 mt-1">Причины: {run.dealRoutingReason!.join('; ')}</p>
        )}
        {(fallbackHuman.length ?? 0) > 0 && (
          <p className="text-xs text-amber-800 mt-1">Fallback: {fallbackHuman.join('; ')}</p>
        )}
      </section>

      <section className="rounded-xl border bg-white p-4 mb-4">
        <h2 className="font-semibold text-gray-900 mb-2">Следующий шаг / задача</h2>
        <p className="text-[11px] text-gray-500">Источник: {dataSourceLabel(run.taskRecommendationSnapshotJson, run.taskRecommendationStatus)}</p>
        <p className="text-sm">{String(taskSnapshot?.recommendedTaskTitle ?? run.taskRecommendationTitle ?? '—')}</p>
        <p className="text-xs text-gray-600">Тип: {run.taskRecommendationType ?? '—'} · приоритет: {run.taskRecommendationPriority ?? '—'}</p>
        <p className="text-xs">Создание: {run.taskCreateStatus ?? '—'} {run.taskCreateReason ? `(${run.taskCreateReason})` : ''}</p>
        {run.finalNextActionAt ? (
          <p className="text-xs text-gray-600 mt-1">nextActionAt (лог): {run.finalNextActionAt}</p>
        ) : null}
        {dealPreview?.nextAction ? (
          <p className="text-sm mt-2">
            На сделке сейчас: <strong>{dealPreview.nextAction}</strong>
          </p>
        ) : null}
        {dealOpenId ? (
          <Link
            to={`/deals?deal=${encodeURIComponent(dealOpenId)}`}
            className="inline-flex items-center gap-1 mt-2 text-sm text-indigo-600 hover:underline"
          >
            Открыть сделку
          </Link>
        ) : null}
      </section>

      <section className="rounded-xl border bg-white p-4 mb-4">
        <h2 className="font-semibold text-gray-900 mb-3 inline-flex items-center gap-2">
          <Clock3 className="w-4 h-4" />
          Хронология run
        </h2>
        <div className="space-y-2">
          {[
            { key: 'incoming', ok: !!run.triggerMessageId, text: `incoming: ${run.triggerMessageId || '—'}`, ts: run.createdAt ?? null },
            { key: 'answered', ok: !!answerText, text: `answered: ${answerText ? 'сгенерирован' : 'нет'}`, ts: runAny.answeredAt ?? null },
            { key: 'extracted', ok: !!extractionRawActive, text: `extracted: ${extractionRawActive ? 'готов' : 'нет'}`, ts: runAny.extractedAt ?? null },
            { key: 'applied', ok: run.extractionApplyStatus === 'applied', text: `applied: ${run.extractionApplyStatus ?? '—'}`, ts: run.extractionAppliedAt ?? null },
            { key: 'deal_created', ok: run.dealCreateStatus === 'created' || !!run.createdDealId, text: `deal_created: ${run.dealCreateStatus ?? run.dealRecommendationStatus ?? '—'}`, ts: runAny.dealCreatedAt ?? null },
            { key: 'task_created', ok: run.taskCreateStatus === 'created', text: `task_created: ${run.taskCreateStatus ?? '—'}`, ts: runAny.taskCreatedAt ?? null },
            { key: 'duplicate', ok: run.dealCreateStatus === 'duplicate' || run.taskCreateStatus === 'duplicate', text: 'duplicate: обнаружен', ts: null },
            { key: 'skipped', ok: run.status === 'skipped', text: `skipped: ${run.status === 'skipped' ? run.reason || '—' : '—'}`, ts: null },
            { key: 'error', ok: run.status === 'error', text: `error: ${run.status === 'error' ? run.reason || 'runtime error' : '—'}`, ts: null }
          ].map((item) => (
            <div key={item.key} className="flex items-start gap-2 text-sm">
              <span className={`mt-0.5 inline-block w-2.5 h-2.5 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              <span>
                {item.text}
                {item.ts ? <span className="text-xs text-gray-500 ml-2">{String(item.ts)}</span> : null}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-red-100 bg-red-50/40 p-4">
        <h2 className="font-semibold text-red-900 mb-2">Ошибки и причины</h2>
        <p className="text-sm">{run.reason || '—'}</p>
        {run.status === 'skipped' && <p className="text-xs text-gray-600 mt-1">Запись со статусом skipped</p>}
        {extraction?.missingFields?.length ? (
          <p className="text-xs text-gray-700 mt-2">
            Не хватило полей (extraction): {extraction.missingFields.join(', ')}
          </p>
        ) : null}
        {run.extractionApplyStatus === 'error' && (
          <p className="text-xs text-red-800 mt-1">Ошибка apply в CRM: {run.extractionApplyReason ?? '—'}</p>
        )}
        {run.taskCreateStatus === 'duplicate' || run.dealCreateStatus === 'duplicate' ? (
          <p className="text-xs text-amber-900 mt-1">Дубликат: задача или сделка уже существовали</p>
        ) : null}
      </section>
    </div>
  );
};

export default AiControlRunDetailsPage;
