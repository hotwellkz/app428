import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  addDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  deleteField
} from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import { getAuthToken } from '../../lib/firebase/auth';
import { getChatAiAnalysis, setChatAiAnalysis } from '../../lib/firebase/chatAiAnalysis';
import { useCompanyId } from '../../contexts/CompanyContext';
import { useAIConfigured } from '../../hooks/useAIConfigured';
import { createDeal, ensureDefaultPipeline, listStages, moveDealToStage } from '../../lib/firebase/deals';
import { removeCompanyCity, renameCompanyCity, resolveCityForAutoAssign } from '../../lib/firebase/companyCities';
import { useClampedMenuPosition } from '../../hooks/useClampedMenuPosition';
import type { Deal } from '../../types/deals';
import toast from 'react-hot-toast';
import { Sparkles, MoreVertical, X, ExternalLink, GitBranch, Bot, ListChecks } from 'lucide-react';
import { ChatSalesAnalysisBlock, type SalesAnalysisResult } from './ChatSalesAnalysisBlock';
import { UniversalVoiceCallLauncher } from '../voice/UniversalVoiceCallLauncher';
import {
  transcribeVoiceBatch,
  getVoiceMessagesToTranscribe,
  type PrepareForAnalysisResult,
  type PrepareForAnalysisStatus,
} from '../../utils/transcribeVoiceBatch';
import { getMessageTextContentForAi } from '../../utils/whatsappAiMessageContent';
import type { WhatsAppAiRuntime, WhatsAppAiRuntimeMode } from '../../types/whatsappAiRuntime';
import { defaultWhatsAppAiRuntime } from '../../types/whatsappAiRuntime';
import type { CrmAiBot } from '../../types/crmAiBot';
import { labelCrmAiBotStatus } from '../../types/crmAiBot';
import type { WhatsAppAiRuntimePatch } from '../../lib/firebase/whatsappDb';

const COLLECTION_WHATSAPP_CONVERSATIONS = 'whatsappConversations';

const COLLECTION_CLIENTS = 'clients';
const COLLECTION_DEALS = 'deals';

export interface DealCard {
  id: string;
  clientPhone: string;
  /** Идентификатор статуса сделки (из коллекции dealStatuses) */
  statusId?: string | null;
  /** Старое поле статуса (для обратной совместимости) */
  status?: string | null;
  /** Идентификатор ответственного менеджера (из коллекции chatManagers) */
  managerId?: string | null;
  source: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface DealStatusRecord {
  id: string;
  name: string;
  color: string;
}

export interface ChatManagerRecord {
  id: string;
  name: string;
  color: string;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits ? `+${digits}` : phone.trim();
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  let ms: number;
  if (typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    ms = (value as { toMillis: () => number }).toMillis();
  } else if (typeof value === 'object' && value !== null && 'seconds' in (value as object)) {
    ms = ((value as { seconds: number }).seconds ?? 0) * 1000;
  } else {
    ms = new Date(value as string).getTime();
  }
  return new Date(ms).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export interface WhatsAppClientCard {
  id: string;
  phone: string;
  name: string;
  source: string;
  comment: string;
  createdAt: unknown;
  /** Извлечённые / сохранённые поля карточки */
  city?: string | null;
  areaSqm?: number | null;
  houseType?: string | null;
  floors?: string | null;
  clientIntent?: string | null;
  aiSummary?: string | null;
  leadTemperature?: string | null;
  leadStage?: string | null;
  leadIntent?: string | null;
  aiClassifiedAt?: unknown;
}

async function getClientByPhone(phone: string, companyId: string): Promise<WhatsAppClientCard | null> {
  const normalized = normalizePhone(phone);
  const q = query(
    collection(db, COLLECTION_CLIENTS),
    where('companyId', '==', companyId),
    where('phone', '==', normalized)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  const data = d.data();
  const num = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  const ts = (v: unknown) => (v != null ? v : undefined);
  return {
    id: d.id,
    phone: (data.phone as string) ?? normalized,
    name: (data.name as string) ?? '',
    source: (data.source as string) ?? '',
    comment: (data.comment as string) ?? '',
    createdAt: data.createdAt,
    city: (data.city as string) ?? undefined,
    areaSqm: num(data.areaSqm),
    houseType: (data.houseType as string) ?? undefined,
    floors: (data.floors as string) ?? undefined,
    clientIntent: (data.clientIntent as string) ?? undefined,
    aiSummary: (data.aiSummary as string) ?? undefined,
    leadTemperature: (data.leadTemperature as string) ?? undefined,
    leadStage: (data.leadStage as string) ?? undefined,
    leadIntent: (data.leadIntent as string) ?? undefined,
    aiClassifiedAt: ts(data.aiClassifiedAt),
  };
}

async function getDealByClientPhone(phone: string, companyId: string): Promise<DealCard | null> {
  const normalized = normalizePhone(phone);
  const q = query(
    collection(db, COLLECTION_DEALS),
    where('companyId', '==', companyId),
    where('clientPhone', '==', normalized)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  const data = d.data();
  return {
    id: d.id,
    clientPhone: (data.clientPhone as string) ?? normalized,
    statusId: (data.statusId as string | undefined) ?? (data.status as string | undefined) ?? null,
    status: (data.status as string | undefined) ?? null,
    managerId: (data.managerId as string | undefined) ?? null,
    source: (data.source as string) ?? 'whatsapp',
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

const AI_NAME_FALLBACKS = ['Дом SIP', 'Клиент SIP', 'Домокомплект', 'Консультация по дому'];

/** Имена, совпадающие с baseName или baseName-NNN; возвращает уникальное имя для нового клиента */
async function generateUniqueName(baseName: string, companyId: string): Promise<string> {
  const trimmed = baseName.trim();
  if (!trimmed) return AI_NAME_FALLBACKS[0];
  const q = query(
    collection(db, COLLECTION_CLIENTS),
    where('companyId', '==', companyId),
    where('name', '>=', trimmed),
    where('name', '<=', trimmed + '\uf8ff')
  );
  const snapshot = await getDocs(q);
  let maxNumber = 0;
  const suffixRegex = /^(.+)-(\d+)$/;
  snapshot.docs.forEach((d) => {
    const name = (d.data().name as string) ?? '';
    if (name === trimmed) {
      maxNumber = Math.max(maxNumber, 0);
      return;
    }
    const m = name.match(suffixRegex);
    if (m && m[1].trim() === trimmed) {
      const num = parseInt(m[2], 10);
      if (!Number.isNaN(num)) maxNumber = Math.max(maxNumber, num);
    }
  });
  if (snapshot.empty) return trimmed;
  const nextNumber = maxNumber + 1;
  return `${trimmed}-${String(nextNumber).padStart(3, '0')}`;
}

async function createDealForClient(phone: string, companyId: string): Promise<DealCard> {
  const normalized = normalizePhone(phone);
  const ref = await addDoc(collection(db, COLLECTION_DEALS), {
    clientPhone: normalized,
    statusId: 'new',
    status: 'new',
    source: 'whatsapp',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    companyId,
  });
  return {
    id: ref.id,
    clientPhone: normalized,
    statusId: 'new',
    status: 'new',
    managerId: null,
    source: 'whatsapp',
    createdAt: null,
    updatedAt: null,
  };
}

import type { WhatsAppMessage } from '../../types/whatsappDb';

const COLLECTION_MANAGERS = 'chatManagers';

interface ClientInfoPanelProps {
  /** Номер телефона (chatId) выбранного диалога */
  phone: string | null;
  /** ID диалога WhatsApp (whatsappConversations) — для связи со сделкой */
  conversationId?: string | null;
  /** Уже привязанная сделка воронки (денорм. с диалога) */
  conversationDealId?: string | null;
  conversationDealTitle?: string | null;
  conversationStageName?: string | null;
  conversationStageColor?: string | null;
  conversationResponsibleName?: string | null;
  /** Сообщения текущего диалога (для AI-анализа имени) */
  messages?: WhatsAppMessage[];
  /** Настроенные статусы сделок компании */
  dealStatuses?: DealStatusRecord[];
  /** Справочник менеджеров для назначения на клиента */
  managers?: ChatManagerRecord[];
  /** Количество клиентов по статусам (для бейджей в карточке) */
  dealStatusCounts?: { none: number; byId: Record<string, number> };
  /** Количество клиентов по менеджерам (для бейджей в карточке) */
  managerCounts?: { none: number; byId: Record<string, number> };
  /** Список городов для выбора (справочник + из чатов) */
  cities?: string[];
  /** Количество контактов по городам (для бейджей в блоке «Город») */
  cityCounts?: { none: number; byCity: Record<string, number> };
  /** Добавить новый город в справочник компании; возвращает нормализованное название. */
  onAddCity?: (name: string) => Promise<string>;
  /** Встроен в bottom sheet (мобильный): не создавать свой scroll, чтобы скроллил только контейнер шторки */
  embeddedInSheet?: boolean;
  /** Ширина на 100% родителя (для resizable правой панели на desktop) */
  fillWidth?: boolean;
  /** Вставить текст готового AI-ответа в поле ввода чата (режим: заменить или добавить в конец). Не отправляет сообщение. */
  onInsertNextMessage?: (text: string, mode: 'replace' | 'append') => void;
  /** Текущее значение поля ввода чата (для выбора «заменить» / «добавить в конец» при непустом поле). */
  getCurrentInputValue?: () => string;
  /** Идёт ли массовая расшифровка из ChatWindow (кнопка «Расшифровать всё») — дизейблить «Проанализировать чат». */
  isTranscribeBatchRunning?: boolean;
  /** Вызвать перед началом подготовки к анализу (расшифровка) — родитель может дизейблить «Расшифровать всё». */
  onPrepareForAnalysisStart?: () => void;
  /** Вызвать по завершении подготовки к анализу. */
  onPrepareForAnalysisEnd?: () => void;
  /** Тест: AI-бот включён для этого чата */
  aiBotEnabled?: boolean;
  /** Тест: разрешить боту отправлять КП */
  aiBotAutoProposalEnabled?: boolean;
  /** Обновить флаги AI-бота (тест) */
  onAiBotFlagsChange?: (flags: { aiBotEnabled?: boolean; aiBotAutoProposalEnabled?: boolean }) => void;
  /** Идёт сохранение флагов AI-бота — дизейблить переключатель */
  aiBotFlagsSaving?: boolean;
  /** Зарегистрировать функцию применения фактов из AI-бота (город и т.д.) к карточке клиента. Вызывается после ответа бота с extractedFacts. */
  registerAiBotApplyFacts?: (fn: ((facts: { city?: string | null; area_m2?: number | null; floors?: number | null }) => void) | null) => void;
  /** Канал диалога (runtime автоворонок только для WhatsApp) */
  conversationChannel?: 'whatsapp' | 'instagram';
  /** Настройки AI из модуля «Автоворонки» (поле aiRuntime в whatsappConversations) */
  aiRuntime?: WhatsAppAiRuntime | null;
  /** Боты компании для выбора в чате */
  crmAiBots?: CrmAiBot[];
  /** Частичное обновление aiRuntime */
  onAiRuntimePatch?: (patch: WhatsAppAiRuntimePatch) => void;
  /** Сохранение aiRuntime */
  aiRuntimeSaving?: boolean;
  /** Создать сделку по рекомендации AI (Netlify, с проверкой) */
  onCreateDealFromAiRecommendation?: () => void | Promise<void>;
  /** Идёт создание сделки по рекомендации AI */
  creatingAiDealFromRec?: boolean;
  /** Записать следующий шаг на сделку по рекомендации AI (Netlify) */
  onCreateTaskFromAiRecommendation?: () => void | Promise<void>;
  creatingAiTaskFromRec?: boolean;
  /** Метаданные заказа Kaspi для выбранного диалога (если есть) */
  kaspiOrderNumber?: string | null;
  kaspiOrderAmount?: number | null;
  kaspiOrderStatus?: string | null;
  kaspiOrderCustomerName?: string | null;
  kaspiOrderAddress?: string | null;
  kaspiOrderUrl?: string | null;
}

const COUNT_BADGE_CLASS = 'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 py-0 rounded-[10px] text-[11px] font-medium bg-[#f1f3f5] text-[#555] flex-shrink-0';

/** Обёртки для dl-терминов (теги не задаём литералами 'dt'/'dd', чтобы минификатор не создавал переменную dt). */
const TAG_DEF_TERM = 'd' + 't';
const TAG_DEF_DESC = 'd' + 'd';
const DefTerm = (props: React.HTMLAttributes<HTMLElement>) => React.createElement(TAG_DEF_TERM, props);
const DefDesc = (props: React.HTMLAttributes<HTMLElement>) => React.createElement(TAG_DEF_DESC, props);

const ClientInfoPanel: React.FC<ClientInfoPanelProps> = ({
  phone,
  conversationId = null,
  conversationDealId = null,
  conversationDealTitle = null,
  conversationStageName = null,
  conversationStageColor = null,
  conversationResponsibleName = null,
  messages = [],
  dealStatuses,
  managers = [],
  dealStatusCounts,
  managerCounts,
  cities = [],
  cityCounts,
  onAddCity,
  embeddedInSheet = false,
  fillWidth = false,
  onInsertNextMessage,
  getCurrentInputValue,
  isTranscribeBatchRunning = false,
  onPrepareForAnalysisStart,
  onPrepareForAnalysisEnd,
  aiBotEnabled = false,
  aiBotAutoProposalEnabled = false,
  onAiBotFlagsChange,
  aiBotFlagsSaving = false,
  registerAiBotApplyFacts,
  conversationChannel = 'whatsapp',
  aiRuntime: aiRuntimeProp,
  crmAiBots = [],
  onAiRuntimePatch,
  aiRuntimeSaving = false,
  onCreateDealFromAiRecommendation,
  creatingAiDealFromRec = false,
  onCreateTaskFromAiRecommendation,
  creatingAiTaskFromRec = false,
  kaspiOrderNumber,
  kaspiOrderAmount,
  kaspiOrderStatus,
  kaspiOrderCustomerName,
  kaspiOrderAddress,
  kaspiOrderUrl,
}) => {
  const aiRuntime = aiRuntimeProp ?? defaultWhatsAppAiRuntime();
  const runtimeBots = useMemo(() => crmAiBots.filter((b) => b.status !== 'archived'), [crmAiBots]);
  const companyId = useCompanyId();
  const navigate = useNavigate();
  const { configured: aiConfigured, loading: aiLoadingConfigured } = useAIConfigured();
  const [client, setClient] = useState<WhatsAppClientCard | null>(null);
  const [deal, setDeal] = useState<DealCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingDeal, setCreatingDeal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editComment, setEditComment] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiRunGuardRef = useRef(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#6B7280');
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [newManagerName, setNewManagerName] = useState('');
  const [newManagerColor, setNewManagerColor] = useState('#3B82F6');
  const [statusContextMenu, setStatusContextMenu] = useState<{ x: number; y: number; status: DealStatusRecord } | null>(null);
  const [editingStatus, setEditingStatus] = useState<DealStatusRecord | null>(null);
  const [editStatusName, setEditStatusName] = useState('');
  const [editStatusColor, setEditStatusColor] = useState('#6B7280');
  const [deletingStatus, setDeletingStatus] = useState<{ status: DealStatusRecord; dealCount: number } | null>(null);
  const [deleteStatusLoading, setDeleteStatusLoading] = useState(false);
  const statusMenuPosition = useClampedMenuPosition(
    !!statusContextMenu,
    statusContextMenu?.x ?? 0,
    statusContextMenu?.y ?? 0
  );
  const [managerContextMenu, setManagerContextMenu] = useState<{ x: number; y: number; manager: ChatManagerRecord } | null>(null);
  const [mobileStatusPickerOpen, setMobileStatusPickerOpen] = useState(false);
  const [mobileManagerPickerOpen, setMobileManagerPickerOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<ChatManagerRecord | null>(null);
  const [editManagerName, setEditManagerName] = useState('');
  const [editManagerColor, setEditManagerColor] = useState('#3B82F6');
  const [deletingManager, setDeletingManager] = useState<{ manager: ChatManagerRecord; dealCount: number } | null>(null);
  const [voiceLauncherOpen, setVoiceLauncherOpen] = useState(false);
  const [deleteManagerLoading, setDeleteManagerLoading] = useState(false);
  const [citySaving, setCitySaving] = useState(false);
  const [citySaveFeedback, setCitySaveFeedback] = useState<'idle' | 'success' | 'error'>('idle');
  const [showAddCityModal, setShowAddCityModal] = useState(false);
  const [newCityName, setNewCityName] = useState('');
  const [addCityLoading, setAddCityLoading] = useState(false);
  const [cityContextMenu, setCityContextMenu] = useState<{ x: number; y: number; cityName: string } | null>(null);
  const [deletingCity, setDeletingCity] = useState<string | null>(null);
  const [deleteCityLoading, setDeleteCityLoading] = useState(false);
  const [renamingCity, setRenamingCity] = useState<string | null>(null);
  const [renameCityValue, setRenameCityValue] = useState('');
  const managerMenuPosition = useClampedMenuPosition(
    !!managerContextMenu,
    managerContextMenu?.x ?? 0,
    managerContextMenu?.y ?? 0
  );
  const cityMenuPosition = useClampedMenuPosition(
    !!cityContextMenu,
    cityContextMenu?.x ?? 0,
    cityContextMenu?.y ?? 0
  );

  const [pipelineDeal, setPipelineDeal] = useState<Deal | null>(null);
  const [pipelineStages, setPipelineStages] = useState<Array<{ id: string; name: string; color?: string | null }>>([]);
  const [pipelineDealLoading, setPipelineDealLoading] = useState(false);
  const [creatingPipelineDeal, setCreatingPipelineDeal] = useState(false);
  const [pipelineStageModal, setPipelineStageModal] = useState(false);
  const [salesAnalysisCache, setSalesAnalysisCache] = useState<Record<string, SalesAnalysisResult>>({});
  const [analyzedAtByConversation, setAnalyzedAtByConversation] = useState<Record<string, Date | null>>({});

  /** Извлечённые из переписки данные (AI client) — не сохраняются без подтверждения */
  type ExtractedClientData = {
    city: string;
    areaSqm: string;
    houseType: string;
    floors: string;
    clientIntent: string;
    aiSummary: string;
  };
  const emptyExtracted = (): ExtractedClientData => ({
    city: '',
    areaSqm: '',
    houseType: '',
    floors: '',
    clientIntent: '',
    aiSummary: '',
  });
  const [extractedClientData, setExtractedClientData] = useState<ExtractedClientData | null>(null);
  const [extractedClientVisible, setExtractedClientVisible] = useState(true);
  const [extractedClientEditMode, setExtractedClientEditMode] = useState(false);
  const [extractedClientDraft, setExtractedClientDraft] = useState<ExtractedClientData>(emptyExtracted);
  const [extractedSaveLoading, setExtractedSaveLoading] = useState(false);
  const [leadClassApplyLoading, setLeadClassApplyLoading] = useState(false);
  /** Скрытие блока «Классификация лида» по выбору «Не сохранять» (по conversationId) */
  const [leadClassDismissed, setLeadClassDismissed] = useState<Record<string, boolean>>({});

  const loadPipelineDeal = useCallback(async () => {
    if (!conversationDealId || !companyId) {
      setPipelineDeal(null);
      return;
    }
    setPipelineDealLoading(true);
    try {
      const d = await getDoc(doc(db, COLLECTION_DEALS, conversationDealId));
      if (!d.exists()) {
        setPipelineDeal(null);
        if (conversationId) {
          await updateDoc(doc(db, COLLECTION_WHATSAPP_CONVERSATIONS, conversationId), {
            dealId: deleteField(),
            dealStageId: deleteField(),
            dealStageName: deleteField(),
            dealStageColor: deleteField(),
            dealTitle: deleteField(),
            dealResponsibleName: deleteField()
          });
        }
        return;
      }
      const data = d.data();
      if (data.deletedAt != null) {
        setPipelineDeal(null);
        if (conversationId) {
          await updateDoc(doc(db, COLLECTION_WHATSAPP_CONVERSATIONS, conversationId), {
            dealId: deleteField(),
            dealStageId: deleteField(),
            dealStageName: deleteField(),
            dealStageColor: deleteField(),
            dealTitle: deleteField(),
            dealResponsibleName: deleteField()
          });
        }
        return;
      }
      setPipelineDeal({
        id: d.id,
        companyId: (data.companyId as string) ?? '',
        pipelineId: (data.pipelineId as string) ?? '',
        stageId: (data.stageId as string) ?? '',
        title: (data.title as string) ?? '',
        clientId: (data.clientId as string | null) ?? null,
        clientNameSnapshot: data.clientNameSnapshot as string | undefined,
        clientPhoneSnapshot: data.clientPhoneSnapshot as string | undefined,
        sortOrder: (data.sortOrder as number) ?? 0,
        whatsappConversationId: (data.whatsappConversationId as string) ?? null,
        responsibleNameSnapshot: data.responsibleNameSnapshot as string | undefined
      } as Deal);
      const stages = await listStages(companyId, (data.pipelineId as string) ?? '');
      setPipelineStages(stages.map((s) => ({ id: s.id, name: s.name, color: s.color })));
    } catch {
      setPipelineDeal(null);
    } finally {
      setPipelineDealLoading(false);
    }
  }, [conversationDealId, companyId, conversationId]);

  useEffect(() => {
    loadPipelineDeal();
  }, [loadPipelineDeal]);

  const handleCreatePipelineDeal = async () => {
    if (!phone || !companyId || !conversationId) return;
    setCreatingPipelineDeal(true);
    try {
      const pipeline = await ensureDefaultPipeline(companyId);
      if (!pipeline) return;
      const stages = await listStages(companyId, pipeline.id);
      const first = stages[0];
      if (!first) return;
      const title =
        client?.name?.trim() ? `Сделка: ${client.name.trim()}` : `WhatsApp ${normalizePhone(phone)}`;
      const deal = await createDeal(companyId, pipeline.id, first.id, {
        title,
        clientPhoneSnapshot: normalizePhone(phone),
        clientNameSnapshot: client?.name ?? undefined,
        clientId: client?.id ?? null
      });
      await updateDoc(doc(db, COLLECTION_WHATSAPP_CONVERSATIONS, conversationId), {
        dealId: deal.id
      });
      await updateDoc(doc(db, COLLECTION_DEALS, deal.id), {
        whatsappConversationId: conversationId
      });
      setPipelineDeal(deal);
      setPipelineStages(stages.map((s) => ({ id: s.id, name: s.name, color: s.color })));
    } catch (e) {
      console.error('[ClientInfoPanel] create pipeline deal', e);
      alert(
        e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'permission-denied'
          ? 'Нет прав (Firestore). Админ: задеплойте правила с коллекцией deal_history.'
          : 'Не удалось создать сделку. Проверьте права Firestore.'
      );
    } finally {
      setCreatingPipelineDeal(false);
    }
  };

  const handlePipelineStageSelect = async (stageId: string, stageName: string, stageColor?: string | null) => {
    if (!pipelineDeal || !companyId || !conversationId) return;
    setCreatingPipelineDeal(true);
    try {
      await moveDealToStage(companyId, pipelineDeal.id, stageId, Date.now(), {
        name: stageName,
        color: stageColor ?? null
      });
      setPipelineDeal({ ...pipelineDeal, stageId });
      setPipelineStageModal(false);
    } finally {
      setCreatingPipelineDeal(false);
    }
  };

  const loadClientAndDeal = React.useCallback(() => {
    if (!phone) return;
    setLoading(true);
    Promise.all([getClientByPhone(phone, companyId), getDealByClientPhone(phone, companyId)])
      .then(([c, d]) => {
        setClient(c);
        setDeal(d);
        setEditName(c?.name ?? '');
        setEditSource(c?.source ?? '');
        setEditComment(c?.comment ?? '');
      })
      .catch(() => {
        setClient(null);
        setDeal(null);
      })
      .finally(() => setLoading(false));
  }, [phone, companyId]);

  useEffect(() => {
    if (!phone) {
      setClient(null);
      setDeal(null);
      setEditing(false);
      setExtractedClientData(null);
      setExtractedClientVisible(true);
      return;
    }
    setExtractedClientData(null);
    setExtractedClientVisible(true);
    loadClientAndDeal();
  }, [phone, loadClientAndDeal]);

  // Загрузка сохранённого AI-разбора при открытии чата
  useEffect(() => {
    if (!companyId || !conversationId) return;
    let cancelled = false;
    getChatAiAnalysis(companyId, conversationId).then((saved) => {
      if (cancelled || !saved) return;
      setSalesAnalysisCache((prev) => ({ ...prev, [conversationId]: saved.result }));
      setAnalyzedAtByConversation((prev) => ({ ...prev, [conversationId]: saved.analyzedAt }));
    });
    return () => { cancelled = true; };
  }, [companyId, conversationId]);

  const handleSalesAnalysisCacheResult = useCallback((convId: string, result: SalesAnalysisResult) => {
    setSalesAnalysisCache((prev) => ({ ...prev, [convId]: result }));
    setAnalyzedAtByConversation((prev) => ({ ...prev, [convId]: new Date() }));
    setLeadClassDismissed((prev) => ({ ...prev, [convId]: false }));
    if (companyId) {
      setChatAiAnalysis(companyId, convId, result).catch((err) => {
        if (import.meta.env.DEV) console.warn('[ClientInfoPanel] save chat AI analysis', err);
      });
    }
  }, [companyId]);

  /** Подготовка чата к анализу: расшифровать голосовые без текста, вернуть результат и обновления для подстановки в анализ */
  const prepareForAnalysis = useCallback(
    async (
      onProgress?: (current: number, total: number) => void
    ): Promise<PrepareForAnalysisResult> => {
      const list = getVoiceMessagesToTranscribe(messages ?? []);
      if (list.length === 0) {
        return { status: 'none', updates: {}, done: 0, errors: 0, total: 0 };
      }
      onPrepareForAnalysisStart?.();
      try {
        const result = await transcribeVoiceBatch(list, getAuthToken, onProgress);
        const total = list.length;
        let status: PrepareForAnalysisStatus =
          result.errors === total ? 'failed' : result.errors > 0 ? 'partial' : 'done';
        return {
          status,
          updates: result.updates,
          done: result.done,
          errors: result.errors,
          total,
        };
      } finally {
        onPrepareForAnalysisEnd?.();
      }
    },
    [messages, onPrepareForAnalysisStart, onPrepareForAnalysisEnd]
  );

  useEffect(() => {
    if (!statusContextMenu) return;
    const close = () => setStatusContextMenu(null);
    const onDocClick = (e: MouseEvent) => {
      if (statusMenuPosition.ref.current && !statusMenuPosition.ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [statusContextMenu]);

  useEffect(() => {
    if (!managerContextMenu) return;
    const close = () => setManagerContextMenu(null);
    const onDocClick = (e: MouseEvent) => {
      if (managerMenuPosition.ref.current && !managerMenuPosition.ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [managerContextMenu]);

  useEffect(() => {
    if (!cityContextMenu) return;
    const close = () => setCityContextMenu(null);
    const onDocClick = (e: MouseEvent) => {
      if (cityMenuPosition.ref.current && !cityMenuPosition.ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [cityContextMenu]);

  /** Сначала прямой вызов функции Netlify (на хостинге без редиректа /api даёт 404 HTML) */
  const AI_ANALYZE_ENDPOINTS = ['/.netlify/functions/ai-analyze-client', '/api/ai/analyze-client'] as const;

  const handleAIAnalyze = async () => {
    if (!phone || aiLoading) return;
    if (aiRunGuardRef.current) return;
    const recent = messages
      .map((m) => ({
        ...m,
        _content: getMessageTextContentForAi(m)
      }))
      .filter((m) => m._content.length > 0 && !m.deleted)
      .slice(-30);
    if (recent.length === 0) {
      setAiError('Нет сообщений для анализа.');
      return;
    }

    aiRunGuardRef.current = true;
    setAiError(null);
    setAiLoading(true);
    const payload = {
      chatId: normalizePhone(phone),
      messages: recent.map((m) => ({
        role: m.direction === 'incoming' ? ('client' as const) : ('manager' as const),
        text: m._content.replace(/<[^>]*>/g, '').trim(),
      })),
    };
    console.log('AI request', { urls: AI_ANALYZE_ENDPOINTS, chatId: payload.chatId, messagesCount: payload.messages.length });
    try {
      let res: Response | null = null;
      let rawBody = '';
      let data: {
        name?: string | null;
        city?: string | null;
        areaSqm?: number | null;
        houseType?: string | null;
        floors?: string | null;
        houseSummary?: string | null;
        leadTitle?: string | null;
        lead_title?: string | null;
        clientIntent?: string | null;
        comment?: string | null;
        summary?: string | null;
        error?: string;
      } = {};

      const token = await getAuthToken();
      for (const url of AI_ANALYZE_ENDPOINTS) {
        try {
          const currentRes = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(payload),
          });
          const currentRawBody = await currentRes.text();
          const looksLikeHtml =
            currentRawBody.trimStart().startsWith('<') || currentRawBody.includes('<!DOCTYPE');
          if (looksLikeHtml || currentRes.status === 404) {
            console.warn('AI analyze: skip non-JSON / 404', { url, status: currentRes.status });
            continue;
          }
          let currentData: typeof data = {};
          try {
            currentData = currentRawBody ? (JSON.parse(currentRawBody) as typeof data) : {};
          } catch {
            console.error('AI response invalid JSON', url, currentRawBody?.slice(0, 200));
            continue;
          }

          console.log('AI response', { url, status: currentRes.status, body: currentData });

          res = currentRes;
          rawBody = currentRawBody;
          data = currentData;

          if (currentRes.ok && !currentData.error) break;
        } catch (endpointError) {
          console.error('AI endpoint failed', { url, endpointError });
        }
      }

      if (!res || !res.ok) {
        const msg = (data?.error && typeof data.error === 'string') ? data.error : 'Ошибка AI анализа. Попробуйте позже.';
        setAiError(msg);
        if (res?.status === 403 && msg.includes('AI не подключен')) return;
        console.error('AI error', { status: res?.status, body: data, raw: rawBody?.slice(0, 300) });
        return;
      }
      if (data.error) {
        setAiError(typeof data.error === 'string' ? data.error : 'Ошибка AI анализа. Попробуйте позже.');
        console.error('AI error', data.error, data);
        return;
      }

      const rawName =
        typeof data.name === 'string' ? data.name.trim() : data.name === null ? null : null;
      const city =
        typeof data.city === 'string' && data.city.trim().length > 0 ? data.city.trim() : null;
      const houseSummary =
        typeof data.houseSummary === 'string' && data.houseSummary.trim().length > 0
          ? data.houseSummary.trim()
          : null;
      const rawLeadTitle =
        typeof data.leadTitle === 'string'
          ? data.leadTitle.trim()
          : typeof data.lead_title === 'string'
          ? data.lead_title.trim()
          : data.leadTitle === null
          ? null
          : null;
      const typeAndArea = houseSummary || rawLeadTitle || null;
      const nextComment =
        typeof data.comment === 'string'
          ? data.comment.trim()
          : typeof data.summary === 'string'
          ? data.summary.trim()
          : data.comment === null
          ? null
          : null;

      /** Имя в CRM: город в имени всегда, если найден */
      let baseName: string;
      if (city) {
        if (rawName) baseName = `${rawName} — ${city}`;
        else if (typeAndArea && !/^лид/i.test(typeAndArea)) baseName = `${typeAndArea} — ${city}`;
        else baseName = `Клиент — ${city}`;
      } else {
        const genericLead = /^лид\s/i.test(typeAndArea ?? '');
        const nextName =
          rawName && rawName.length > 0
            ? rawName
            : typeAndArea && typeAndArea.length > 0 && !genericLead
              ? typeAndArea
              : null;
        baseName = nextName && nextName.length > 0 ? nextName : AI_NAME_FALLBACKS[0];
      }
      let uniqueName = baseName;
      if (companyId) {
        try {
          uniqueName = await generateUniqueName(baseName, companyId);
        } catch (idxErr) {
          console.error('generateUniqueName (нужен индекс Firestore clients: companyId+name)', idxErr);
          uniqueName = baseName;
        }
      }
      setEditName(uniqueName);
      if (nextComment != null && nextComment.length > 0) {
        setEditComment(nextComment);
      }
      const areaSqmVal = typeof data.areaSqm === 'number' && Number.isFinite(data.areaSqm) ? data.areaSqm : null;
      const houseTypeStr = typeof data.houseType === 'string' && data.houseType.trim() ? data.houseType.trim() : '';
      const floorsStr = typeof data.floors === 'string' && data.floors.trim() ? data.floors.trim() : '';
      const intentStr = typeof data.clientIntent === 'string' && data.clientIntent.trim() ? data.clientIntent.trim() : '';
      setExtractedClientData({
        city: city ?? '',
        areaSqm: areaSqmVal != null ? String(areaSqmVal) : '',
        houseType: houseTypeStr,
        floors: floorsStr,
        clientIntent: intentStr,
        aiSummary: nextComment ?? '',
      });
      setExtractedClientVisible(true);
      setExtractedClientEditMode(false);
      if (city && cities?.length > 0) {
        const toAssign = resolveCityForAutoAssign(city, cities, client?.city);
        if (toAssign) {
          await saveCity(toAssign);
          toast.success(`Город определён из переписки: ${toAssign}`);
        }
      }
    } catch (e) {
      setAiError('Ошибка AI анализа. Попробуйте позже.');
      console.error('AI error', e);
    } finally {
      setAiLoading(false);
      aiRunGuardRef.current = false;
    }
  };

  const startEdit = () => {
    setEditName(client?.name ?? '');
    setEditSource(client?.source ?? '');
    setEditComment(client?.comment ?? '');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!phone) return;
    setSaving(true);
    try {
      const normalized = normalizePhone(phone);
      if (client) {
        await updateDoc(doc(db, COLLECTION_CLIENTS, client.id), {
          name: editName.trim(),
          source: editSource.trim(),
          comment: editComment.trim(),
        });
        setClient({
          ...client,
          name: editName.trim(),
          source: editSource.trim(),
          comment: editComment.trim(),
        });
      } else {
        const ref = await addDoc(collection(db, COLLECTION_CLIENTS), {
          phone: normalized,
          name: editName.trim(),
          source: editSource.trim(),
          comment: editComment.trim(),
          createdAt: serverTimestamp(),
          companyId,
        });
        setClient({
          id: ref.id,
          phone: normalized,
          name: editName.trim(),
          source: editSource.trim(),
          comment: editComment.trim(),
          createdAt: null,
        });
      }
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditName(client?.name ?? '');
    setEditSource(client?.source ?? '');
    setEditComment(client?.comment ?? '');
    setEditing(false);
  };

  const saveCity = useCallback(
    async (value: string | null) => {
      if (!phone || !companyId) return;
      setCitySaving(true);
      setCitySaveFeedback('idle');
      try {
        const normalized = normalizePhone(phone);
        if (client) {
          await updateDoc(doc(db, COLLECTION_CLIENTS, client.id), {
            city: value ?? null,
          });
          setClient({ ...client, city: value ?? undefined } as WhatsAppClientCard);
        } else {
          const ref = await addDoc(collection(db, COLLECTION_CLIENTS), {
            phone: normalized,
            name: 'Клиент',
            source: 'whatsapp',
            comment: '',
            companyId,
            createdAt: serverTimestamp(),
            city: value ?? null,
          });
          setClient({
            id: ref.id,
            phone: normalized,
            name: 'Клиент',
            source: 'whatsapp',
            comment: '',
            createdAt: null,
            city: value ?? undefined,
          } as WhatsAppClientCard);
        }
        setCitySaveFeedback('success');
        const t = window.setTimeout(() => setCitySaveFeedback('idle'), 2000);
        return () => window.clearTimeout(t);
      } catch {
        setCitySaveFeedback('error');
        const t = window.setTimeout(() => setCitySaveFeedback('idle'), 3000);
        return () => window.clearTimeout(t);
      } finally {
        setCitySaving(false);
      }
    },
    [phone, companyId, client]
  );

  /** Автоподстановка города после AI-анализа (Проанализировать чат): город извлечён, сверяем со справочником и сохраняем только если у контакта нет города. */
  const handleExtractedCityFromAnalysis = useCallback(
    (detectedCity: string) => {
      if (!cities?.length) return;
      const toAssign = resolveCityForAutoAssign(detectedCity, cities, client?.city);
      if (toAssign) {
        saveCity(toAssign).then(() => {
          toast.success(`Город определён из переписки: ${toAssign}`);
        });
      }
    },
    [cities, client?.city, saveCity]
  );

  /** Регистрация функции применения фактов из AI-бота (город и т.д.) — вызывается после ответа бота при голосовых/текстовых сообщениях. */
  useEffect(() => {
    if (!registerAiBotApplyFacts || !cities?.length) return;
    const apply = (facts: { city?: string | null; area_m2?: number | null; floors?: number | null }) => {
      if (!facts.city || typeof facts.city !== 'string' || !facts.city.trim()) return;
      const toAssign = resolveCityForAutoAssign(facts.city.trim(), cities, client?.city);
      if (toAssign) {
        saveCity(toAssign).then(() => {
          toast.success(`Город определён из переписки: ${toAssign}`);
        });
      }
    };
    registerAiBotApplyFacts(apply);
    return () => {
      registerAiBotApplyFacts(null);
    };
  }, [registerAiBotApplyFacts, cities, client?.city, saveCity]);

  /** Заполнить карточку клиента из блока «Извлечено из переписки» (только непустые поля) */
  const handleFillCardFromExtracted = useCallback(async () => {
    if (!phone || !companyId) return;
    const source = extractedClientEditMode ? extractedClientDraft : extractedClientData;
    if (!source) return;
    setExtractedSaveLoading(true);
    try {
      const normalized = normalizePhone(phone);
      const payload: Record<string, unknown> = {};
      if (source.city.trim()) payload.city = source.city.trim();
      if (source.areaSqm.trim()) {
        const n = parseFloat(source.areaSqm.replace(',', '.'));
        if (Number.isFinite(n) && n > 0) payload.areaSqm = n;
      }
      if (source.houseType.trim()) payload.houseType = source.houseType.trim();
      if (source.floors.trim()) payload.floors = source.floors.trim();
      if (source.clientIntent.trim()) payload.clientIntent = source.clientIntent.trim();
      if (source.aiSummary.trim()) payload.aiSummary = source.aiSummary.trim();
      if (Object.keys(payload).length === 0) {
        setExtractedSaveLoading(false);
        return;
      }
      if (client) {
        await updateDoc(doc(db, COLLECTION_CLIENTS, client.id), payload);
        setClient({ ...client, ...payload } as WhatsAppClientCard);
      } else {
        const ref = await addDoc(collection(db, COLLECTION_CLIENTS), {
          phone: normalized,
          name: editName.trim() || 'Клиент',
          source: editSource.trim() || 'whatsapp',
          comment: editComment.trim() || (source.aiSummary.trim() || ''),
          companyId,
          createdAt: serverTimestamp(),
          ...payload,
        });
        setClient({
          id: ref.id,
          phone: normalized,
          name: editName.trim() || 'Клиент',
          source: editSource.trim() || 'whatsapp',
          comment: editComment.trim() || (source.aiSummary.trim() || ''),
          createdAt: null,
          ...payload,
        } as WhatsAppClientCard);
      }
      setExtractedClientEditMode(false);
    } finally {
      setExtractedSaveLoading(false);
    }
  }, [
    phone,
    companyId,
    client,
    editName,
    editSource,
    editComment,
    extractedClientData,
    extractedClientDraft,
    extractedClientEditMode,
  ]);

  /** Применить классификацию лида из AI в карточку клиента */
  const handleApplyLeadClassification = useCallback(async () => {
    if (!phone || !companyId || !conversationId) return;
    const cached = salesAnalysisCache[conversationId];
    if (!cached?.leadTemperature && !cached?.leadStage && !cached?.leadIntent) return;
    setLeadClassApplyLoading(true);
    try {
      const normalized = normalizePhone(phone);
      const existing = client ?? (await getClientByPhone(normalized, companyId));
      const payload: Record<string, unknown> = {
        leadTemperature: cached.leadTemperature || null,
        leadStage: cached.leadStage || null,
        leadIntent: cached.leadIntent || null,
        aiClassifiedAt: serverTimestamp(),
      };
      if (existing) {
        await updateDoc(doc(db, COLLECTION_CLIENTS, existing.id), payload);
        setClient((prev) => (prev ? { ...prev, ...payload } as WhatsAppClientCard : prev));
      } else {
        const ref = await addDoc(collection(db, COLLECTION_CLIENTS), {
          phone: normalized,
          name: 'Клиент',
          source: 'whatsapp',
          comment: '',
          companyId,
          createdAt: serverTimestamp(),
          ...payload,
        });
        setClient({
          id: ref.id,
          phone: normalized,
          name: 'Клиент',
          source: 'whatsapp',
          comment: '',
          createdAt: null,
          ...payload,
        } as WhatsAppClientCard);
      }
    } finally {
      setLeadClassApplyLoading(false);
    }
  }, [phone, companyId, conversationId, salesAnalysisCache, client]);

  const asideClass = embeddedInSheet
    ? 'w-full max-w-[320px] mx-auto bg-transparent border-0 p-0'
    : fillWidth
      ? 'w-full min-w-0 flex-shrink-0 bg-white border-l border-[#eee] p-4 min-h-full'
      : 'w-[320px] flex-shrink-0 bg-white border-l border-[#eee] p-4 overflow-y-auto';

  if (!phone) {
    return (
      <aside className={asideClass}>
        <h2 className="text-sm font-semibold text-gray-500">Клиент</h2>
        <p className="mt-2 text-sm text-gray-400">Выберите диалог</p>
      </aside>
    );
  }

  return (
    <aside className={asideClass}>
      <h2 className="text-sm font-semibold text-gray-700">Клиент</h2>

      {loading ? (
        <p className="mt-2 text-sm text-gray-500">Загрузка…</p>
      ) : (
        <>
          {kaspiOrderNumber && (
            <div className="mb-4 p-3 rounded-xl border border-amber-200 bg-amber-50">
              <h3 className="text-xs font-semibold text-amber-800 uppercase tracking-wide flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400" aria-hidden />
                Kaspi заказ
              </h3>
              <p className="mt-1 text-sm font-medium text-gray-900">
                Заказ №{kaspiOrderNumber}
                {typeof kaspiOrderAmount === 'number' && kaspiOrderAmount > 0 && (
                  <span className="ml-1 text-xs text-gray-700">
                    • {kaspiOrderAmount.toLocaleString('ru-RU')} ₸
                  </span>
                )}
              </p>
              {kaspiOrderCustomerName && (
                <p className="text-xs text-gray-700 mt-1">Клиент: {kaspiOrderCustomerName}</p>
              )}
              {kaspiOrderAddress && (
                <p className="text-xs text-gray-600 mt-1">Адрес: {kaspiOrderAddress}</p>
              )}
              <div className="mt-3 flex flex-col gap-2">
                {onInsertNextMessage && (
                  <button
                    type="button"
                    onClick={() => {
                      const template =
                        'Здравствуйте!\nПишем по вашему заказу из Kaspi Магазина.\nХотели уточнить несколько деталей.';
                      const current = getCurrentInputValue ? getCurrentInputValue() : '';
                      const mode =
                        typeof current === 'string' && current.trim().length > 0 ? ('append' as const) : ('replace' as const);
                      onInsertNextMessage(template, mode);
                    }}
                    className="w-full py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
                  >
                    Вставить сообщение для WhatsApp
                  </button>
                )}
                {kaspiOrderUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      if (kaspiOrderUrl) window.open(kaspiOrderUrl, '_blank', 'noopener,noreferrer');
                    }}
                    className="w-full py-2 text-xs font-medium text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-100"
                  >
                    Открыть заказ в Kaspi
                  </button>
                )}
              </div>
            </div>
          )}

          <p className="mt-1 text-base font-medium text-gray-900">
            {client ? (client.name || client.phone) : 'Новый клиент'}
          </p>
          <button
            type="button"
            onClick={() => setVoiceLauncherOpen(true)}
            disabled={!phone}
            className="mt-2 w-full py-2 text-xs font-medium text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Позвонить
          </button>

          {conversationId && (
            <div className="mt-4 p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100">
              {pipelineDealLoading && conversationDealId ? (
                <>
                  <h3 className="text-xs font-semibold text-emerald-800 uppercase tracking-wide flex items-center gap-1">
                    <GitBranch className="w-3.5 h-3.5" />
                    Сделка (воронка)
                  </h3>
                  <p className="mt-2 text-xs text-gray-500">Загрузка…</p>
                </>
              ) : pipelineDeal ? (
                <>
                  <h3 className="text-xs font-semibold text-emerald-800 uppercase tracking-wide flex items-center gap-1">
                    <GitBranch className="w-3.5 h-3.5" />
                    Сделка (воронка)
                  </h3>
                  <p className="mt-2 text-sm font-medium text-gray-900 truncate">{pipelineDeal.title}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Этап:{' '}
                    {(() => {
                      const st = pipelineStages.find((s) => s.id === pipelineDeal.stageId);
                      const col = st?.color && /^#[0-9A-Fa-f]{3,8}$/i.test(st.color) ? st.color : '#6B7280';
                      return (
                        <span className="font-medium px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: col }}>
                          {st?.name ?? '—'}
                        </span>
                      );
                    })()}
                  </p>
                  {pipelineDeal.responsibleNameSnapshot && (
                    <p className="text-xs text-gray-600 mt-1">
                      Ответственный: {pipelineDeal.responsibleNameSnapshot}
                    </p>
                  )}
                  <div className="mt-3 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/deals?deal=${pipelineDeal.id}`)}
                      className="w-full py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Открыть сделку
                    </button>
                    <button
                      type="button"
                      onClick={() => setPipelineStageModal(true)}
                      disabled={creatingPipelineDeal}
                      className="w-full py-2 text-xs font-medium text-emerald-700 border border-emerald-500 rounded-lg hover:bg-emerald-50"
                    >
                      Изменить статус
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">Воронка</h3>
                  <p className="text-xs text-gray-600 mt-1 mb-2">Нет активной сделки по этому чату</p>
                  <button
                    type="button"
                    onClick={handleCreatePipelineDeal}
                    disabled={creatingPipelineDeal}
                    className="w-full py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {creatingPipelineDeal ? 'Создание…' : 'Создать сделку'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Автоворонки: AI runtime в WhatsApp-чате */}
          {conversationId && onAiRuntimePatch != null && (
            <div className="mt-4 p-3 rounded-xl border border-violet-200/80 bg-violet-50/40">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4 text-violet-700 shrink-0" />
                <h3 className="text-xs font-semibold text-violet-900 uppercase tracking-wide">
                  Автоворонки · AI в чате
                </h3>
                {aiRuntimeSaving && <span className="text-[10px] text-violet-600">сохранение…</span>}
              </div>
              {conversationChannel === 'instagram' ? (
                <p className="text-xs text-amber-800">
                  Runtime автоворонок доступен только для канала WhatsApp.
                </p>
              ) : (
                <>
                  {!aiConfigured && !aiLoadingConfigured && (
                    <p className="mb-2 text-xs text-amber-700">
                      Для генерации ответов нужен API-ключ AI в разделе Интеграции.
                    </p>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={aiRuntime.enabled}
                      disabled={aiRuntimeSaving}
                      onChange={(e) => {
                        const on = e.target.checked;
                        if (on && !aiLoadingConfigured && !aiConfigured) {
                          toast.error('Сначала настройте AI API ключ в Интеграциях');
                          return;
                        }
                        onAiRuntimePatch({
                          enabled: on,
                          ...(on ? {} : { mode: 'off' as WhatsAppAiRuntimeMode })
                        });
                      }}
                      className="rounded border-gray-300 text-violet-600 focus:ring-violet-500 disabled:opacity-50"
                    />
                    <span className="text-sm font-medium text-gray-800">AI-режим</span>
                  </label>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Бот</label>
                      <select
                        className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                        disabled={aiRuntimeSaving || !aiRuntime.enabled}
                        value={aiRuntime.botId ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          onAiRuntimePatch({ botId: v.length ? v : null });
                        }}
                      >
                        <option value="">— не выбран —</option>
                        {runtimeBots.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                            {b.status !== 'active' ? ` (${labelCrmAiBotStatus(b.status)})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Режим</label>
                      <select
                        className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                        disabled={aiRuntimeSaving || !aiRuntime.enabled}
                        value={aiRuntime.mode}
                        onChange={(e) => {
                          const v = e.target.value as WhatsAppAiRuntimeMode;
                          onAiRuntimePatch({ mode: v });
                        }}
                      >
                        <option value="off">Выключен</option>
                        <option value="draft">Черновик ответа</option>
                        <option value="auto">Автоответ</option>
                      </select>
                    </div>
                  </div>
                  <dl className="mt-2 space-y-1 text-[11px] text-gray-600">
                    <div className="flex justify-between gap-2">
                      <DefTerm className="text-gray-500 shrink-0">Бот</DefTerm>
                      <DefDesc className="text-right truncate">
                        {aiRuntime.botId
                          ? runtimeBots.find((b) => b.id === aiRuntime.botId)?.name ?? aiRuntime.botId
                          : 'не выбран'}
                      </DefDesc>
                    </div>
                    <div className="flex justify-between gap-2">
                      <DefTerm className="text-gray-500 shrink-0">Режим</DefTerm>
                      <DefDesc className="text-right">
                        {aiRuntime.mode === 'off' && 'выкл.'}
                        {aiRuntime.mode === 'draft' && 'черновик'}
                        {aiRuntime.mode === 'auto' && 'автоответ'}
                      </DefDesc>
                    </div>
                    <div className="flex justify-between gap-2">
                      <DefTerm className="text-gray-500 shrink-0">Последний запуск</DefTerm>
                      <DefDesc className="text-right">{formatDate(aiRuntime.lastRunAt)}</DefDesc>
                    </div>
                    <div className="flex justify-between gap-2">
                      <DefTerm className="text-gray-500 shrink-0">Статус</DefTerm>
                      <DefDesc className="text-right truncate max-w-[65%]" title={aiRuntime.lastReason ?? undefined}>
                        {aiRuntime.lastStatus === 'success'
                          ? 'успех'
                          : aiRuntime.lastStatus === 'error'
                            ? 'ошибка'
                            : aiRuntime.lastStatus === 'skipped'
                              ? 'пропуск'
                              : aiRuntime.lastStatus === 'idle'
                                ? 'ожидание'
                                : '—'}
                        {aiRuntime.lastReason ? ` · ${aiRuntime.lastReason}` : ''}
                      </DefDesc>
                    </div>
                  </dl>
                  <div className="mt-2 pt-2 border-t border-violet-200/60">
                    <p className="text-[10px] font-semibold text-violet-800 uppercase mb-1">
                      Запись в CRM (extraction)
                    </p>
                    <dl className="space-y-1 text-[11px] text-gray-600">
                      <div className="flex justify-between gap-2">
                        <DefTerm className="text-gray-500 shrink-0">Статус apply</DefTerm>
                        <DefDesc
                          className="text-right truncate max-w-[60%]"
                          title={aiRuntime.lastExtractionApplyReason ?? undefined}
                        >
                          {aiRuntime.lastExtractionApplyStatus === 'applied' && (
                            <span className="text-emerald-700 font-medium">применено</span>
                          )}
                          {aiRuntime.lastExtractionApplyStatus === 'skipped' && (
                            <span className="text-amber-800">пропуск</span>
                          )}
                          {aiRuntime.lastExtractionApplyStatus === 'error' && (
                            <span className="text-red-700">ошибка</span>
                          )}
                          {!aiRuntime.lastExtractionApplyStatus && '—'}
                        </DefDesc>
                      </div>
                      {(aiRuntime.lastExtractionApplyReason ?? '').length > 0 && (
                        <div className="flex justify-between gap-2">
                          <DefTerm className="text-gray-500 shrink-0">Причина</DefTerm>
                          <DefDesc className="text-right text-[10px] max-w-[70%] break-words">
                            {aiRuntime.lastExtractionApplyReason}
                          </DefDesc>
                        </div>
                      )}
                      <div className="flex justify-between gap-2">
                        <DefTerm className="text-gray-500 shrink-0">Полей</DefTerm>
                        <DefDesc className="text-right">
                          {aiRuntime.lastExtractionAppliedFieldCount != null
                            ? String(aiRuntime.lastExtractionAppliedFieldCount)
                            : '—'}
                        </DefDesc>
                      </div>
                      {(aiRuntime.lastExtractionAppliedLabels?.length ?? 0) > 0 && (
                        <div className="text-[10px] text-gray-700 break-words">
                          <span className="text-gray-500">Обновлено: </span>
                          {(aiRuntime.lastExtractionAppliedLabels ?? []).join(', ')}
                        </div>
                      )}
                      <div className="flex justify-between gap-2">
                        <DefTerm className="text-gray-500 shrink-0">Время apply</DefTerm>
                        <DefDesc className="text-right text-[10px]">
                          {aiRuntime.lastExtractionAppliedAt
                            ? new Date(aiRuntime.lastExtractionAppliedAt).toLocaleString('ru-RU')
                            : '—'}
                        </DefDesc>
                      </div>
                    </dl>
                  </div>
                  {conversationChannel === 'whatsapp' &&
                    onCreateDealFromAiRecommendation &&
                    aiRuntime.dealRecommendation &&
                    (aiRuntime.dealRecommendation.status === 'recommended' ||
                      aiRuntime.dealRecommendation.status === 'insufficient_data' ||
                      aiRuntime.dealFromAi?.createdDealId) && (
                      <div className="mt-2 pt-2 border-t border-emerald-200/70 rounded-lg bg-emerald-50/40 p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <GitBranch className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <p className="text-[10px] font-semibold text-emerald-900 uppercase">
                            Рекомендация сделки от AI
                          </p>
                        </div>
                        {aiRuntime.dealFromAi?.createdDealId ? (
                          <div className="space-y-2 text-[11px] text-gray-700">
                            <p className="text-emerald-800 font-medium">Сделка уже создана из рекомендации</p>
                            <p className="break-words">{aiRuntime.dealFromAi.createdDealTitle ?? '—'}</p>
                            <div className="text-[10px] text-gray-600 space-y-0.5">
                              {(aiRuntime.dealFromAi.finalPipelineName ?? '').length > 0 && (
                                <p>Воронка: {aiRuntime.dealFromAi.finalPipelineName}</p>
                              )}
                              {(aiRuntime.dealFromAi.finalStageName ?? '').length > 0 && (
                                <p>Этап: {aiRuntime.dealFromAi.finalStageName}</p>
                              )}
                              {(aiRuntime.dealFromAi.finalAssigneeName ?? '').length > 0 && (
                                <p>Ответственный: {aiRuntime.dealFromAi.finalAssigneeName}</p>
                              )}
                              {(aiRuntime.dealFromAi.createUsedFallbacks?.length ?? 0) > 0 && (
                                <p className="text-amber-700">
                                  Fallback: {(aiRuntime.dealFromAi.createUsedFallbacks ?? []).join(', ')}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/deals?deal=${encodeURIComponent(aiRuntime.dealFromAi!.createdDealId!)}`)
                              }
                              className="w-full py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Открыть сделку
                            </button>
                          </div>
                        ) : conversationDealId ? (
                          <div className="space-y-2 text-[11px] text-amber-800">
                            <p>У чата уже привязана сделка. Создание по рекомендации недоступно.</p>
                            <button
                              type="button"
                              onClick={() => navigate(`/deals?deal=${encodeURIComponent(conversationDealId)}`)}
                              className="w-full py-1.5 text-xs font-medium text-amber-900 border border-amber-600 rounded-lg hover:bg-amber-50 flex items-center justify-center gap-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Открыть сделку чата
                            </button>
                          </div>
                        ) : aiRuntime.dealRecommendation.status === 'insufficient_data' ? (
                          <div className="text-[11px] text-gray-600 space-y-1">
                            <p className="font-medium text-gray-700">Недостаточно данных для рекомендации</p>
                            {aiRuntime.dealRecommendation.reason && (
                              <p className="break-words">{aiRuntime.dealRecommendation.reason}</p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2 text-[11px] text-gray-700">
                            <p className="text-emerald-900 font-medium">Рекомендуем создать сделку</p>
                            {aiRuntime.dealRecommendation.summary && (
                              <p className="text-gray-600 break-words">{aiRuntime.dealRecommendation.summary}</p>
                            )}
                            {aiRuntime.dealRecommendation.draftTitle && (
                              <p>
                                <span className="text-gray-500">Название: </span>
                                <span className="font-medium">{aiRuntime.dealRecommendation.draftTitle}</span>
                              </p>
                            )}
                            {(aiRuntime.dealRecommendation.signals?.length ?? 0) > 0 && (
                              <p className="text-[10px] text-gray-600">
                                Признаки: {(aiRuntime.dealRecommendation.signals ?? []).join(', ')}
                              </p>
                            )}
                            <div className="rounded border border-emerald-200 bg-white/70 p-2 text-[10px] text-gray-700 space-y-1">
                              <p>
                                <span className="text-gray-500">Воронка: </span>
                                {aiRuntime.dealRecommendation.routing?.recommendedPipelineName ?? '—'}
                              </p>
                              <p>
                                <span className="text-gray-500">Этап: </span>
                                {aiRuntime.dealRecommendation.routing?.recommendedStageName ?? '—'}
                              </p>
                              <p>
                                <span className="text-gray-500">Ответственный: </span>
                                {aiRuntime.dealRecommendation.routing?.recommendedAssigneeName ?? 'не назначен'}
                              </p>
                              {(aiRuntime.dealRecommendation.routing?.routingReason?.length ?? 0) > 0 && (
                                <p className="text-gray-600">
                                  Причина: {(aiRuntime.dealRecommendation.routing?.routingReason ?? []).join('; ')}
                                </p>
                              )}
                              {(aiRuntime.dealRecommendation.routing?.routingWarnings?.length ?? 0) > 0 && (
                                <p className="text-amber-700">
                                  Предупреждения: {(aiRuntime.dealRecommendation.routing?.routingWarnings ?? []).join('; ')}
                                </p>
                              )}
                              <p>
                                <span className="text-gray-500">Уверенность routing: </span>
                                {aiRuntime.dealRecommendation.routing?.routingConfidence === 'high'
                                  ? 'высокая'
                                  : aiRuntime.dealRecommendation.routing?.routingConfidence === 'medium'
                                    ? 'средняя'
                                    : 'низкая'}
                              </p>
                            </div>
                            <p className="text-[10px] text-gray-500">
                              Уверенность:{' '}
                              {aiRuntime.dealRecommendation.confidence === 'high'
                                ? 'высокая'
                                : aiRuntime.dealRecommendation.confidence === 'medium'
                                  ? 'средняя'
                                  : 'низкая'}
                            </p>
                            <button
                              type="button"
                              disabled={creatingAiDealFromRec}
                              onClick={() => void onCreateDealFromAiRecommendation()}
                              className="w-full py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {creatingAiDealFromRec ? 'Создание…' : 'Создать сделку'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  {conversationChannel === 'whatsapp' &&
                    aiRuntime.taskRecommendation &&
                    aiRuntime.taskRecommendation.status !== 'skipped' &&
                    onCreateTaskFromAiRecommendation && (
                      <div className="mt-2 pt-2 border-t border-indigo-200/70 rounded-lg bg-indigo-50/50 p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <ListChecks className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                          <p className="text-[10px] font-semibold text-indigo-900 uppercase">
                            Следующее действие от AI
                          </p>
                        </div>
                        {(() => {
                          const tr = aiRuntime.taskRecommendation!;
                          const tf = aiRuntime.taskFromAi;
                          const created =
                            tf?.createdFromPayloadHash &&
                            tr.payloadHash &&
                            tf.createdFromPayloadHash === tr.payloadHash;
                          const priLabel =
                            tr.recommendedPriority === 'urgent'
                              ? 'срочно'
                              : tr.recommendedPriority === 'high'
                                ? 'высокий'
                                : tr.recommendedPriority === 'low'
                                  ? 'низкий'
                                  : 'обычный';
                          const typeLabel: Record<string, string> = {
                            send_quote: 'КП / коммерческое',
                            call_back: 'Звонок',
                            clarify_parameters: 'Уточнение параметров',
                            schedule_meeting: 'Встреча',
                            prepare_estimate: 'Расчёт / смета',
                            consultation: 'Консультация',
                            follow_up: 'Связаться',
                            manual_review: 'Ручная проверка'
                          };
                          const statusLabel =
                            tr.status === 'recommended'
                              ? 'готово'
                              : tr.status === 'manual_review'
                                ? 'ручная проверка'
                                : tr.status === 'insufficient_data'
                                  ? 'мало данных'
                                  : tr.status;
                          return (
                            <div className="space-y-1.5 text-[11px] text-gray-800">
                              <p className="text-[10px] text-indigo-800">
                                Статус: <span className="font-medium">{statusLabel}</span>
                                {tr.confidence ? (
                                  <>
                                    {' '}
                                    · уверенность:{' '}
                                    {tr.confidence === 'high' ? 'высокая' : tr.confidence === 'medium' ? 'средняя' : 'низкая'}
                                  </>
                                ) : null}
                              </p>
                              <p className="font-semibold text-gray-900">{tr.recommendedTaskTitle}</p>
                              {tr.recommendedTaskDescription ? (
                                <p className="text-[10px] text-gray-600 whitespace-pre-wrap break-words max-h-20 overflow-y-auto">
                                  {tr.recommendedTaskDescription}
                                </p>
                              ) : null}
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-gray-600">
                                <span>Тип: {typeLabel[tr.recommendedTaskType] ?? tr.recommendedTaskType}</span>
                                <span>Приоритет: {priLabel}</span>
                                <span>
                                  Срок:{' '}
                                  {tr.recommendedDueAt
                                    ? new Date(tr.recommendedDueAt).toLocaleString('ru-RU', {
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })
                                    : tr.dueHint || 'уточнить'}
                                </span>
                              </div>
                              {(tr.reasons?.length ?? 0) > 0 && (
                                <p className="text-[10px] text-gray-600">
                                  <span className="text-gray-500">Почему: </span>
                                  {(tr.reasons ?? []).join('; ')}
                                </p>
                              )}
                              {(tr.warnings?.length ?? 0) > 0 && (
                                <p className="text-[10px] text-amber-800">
                                  {(tr.warnings ?? []).join(' ')}
                                </p>
                              )}
                              {created && tf?.dealId ? (
                                <div className="space-y-2 pt-1">
                                  <p className="text-emerald-800 font-medium text-[11px]">
                                    Следующий шаг записан в сделку
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/deals?deal=${encodeURIComponent(tf.dealId)}`)}
                                    className="w-full py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-1"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Открыть сделку
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={creatingAiTaskFromRec || !tr.canCreateTask}
                                  onClick={() => void onCreateTaskFromAiRecommendation()}
                                  className="w-full py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title={!tr.canCreateTask ? 'Сначала создайте сделку или дождитесь данных' : ''}
                                >
                                  {creatingAiTaskFromRec ? 'Создание…' : 'Создать задачу (след. шаг)'}
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  {aiRuntime.lastGeneratedReply && (
                    <div className="mt-2 rounded-lg border border-violet-100 bg-white/80 p-2">
                      <p className="text-[10px] font-semibold text-violet-800 uppercase mb-1">
                        Последний ответ AI
                      </p>
                      <p className="text-xs text-gray-800 whitespace-pre-wrap break-words max-h-28 overflow-y-auto">
                        {aiRuntime.lastGeneratedReply}
                      </p>
                      {aiRuntime.mode === 'draft' && onInsertNextMessage && (
                        <button
                          type="button"
                          className="mt-2 w-full py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700"
                          onClick={() => {
                            const cur = (getCurrentInputValue?.() ?? '').trim();
                            onInsertNextMessage(aiRuntime.lastGeneratedReply!, cur ? 'append' : 'replace');
                            toast.success('Текст подставлен в поле ответа');
                          }}
                        >
                          Подставить в поле ответа
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* AI-бот (тест): переключатель и опция авто-КП */}
          {conversationId && onAiBotFlagsChange != null && (
            <div className="mt-4 p-3 rounded-xl border border-gray-200 bg-gray-50/80">
              {!aiConfigured && !aiLoadingConfigured && (
                <p className="mb-2 text-xs text-amber-700">
                  Чтобы AI-бот отвечал, настройте API ключ в разделе Интеграции.
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <label className="inline-flex items-center gap-2 cursor-pointer" title="AI может отвечать в этом чате, собирать данные и отправлять КП через калькулятор">
                  <input
                    type="checkbox"
                    checked={aiBotEnabled}
                    disabled={aiBotFlagsSaving}
                    onChange={(e) => {
                      const nextEnabled = e.target.checked;
                      if (nextEnabled && !aiLoadingConfigured && !aiConfigured) {
                        toast.error('Нельзя включить AI-бот: у компании не сохранён AI API ключ в разделе Интеграции');
                        return;
                      }
                      onAiBotFlagsChange({ aiBotEnabled: nextEnabled, aiBotAutoProposalEnabled: nextEnabled ? aiBotAutoProposalEnabled : false });
                    }}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
                  />
                  <span className="text-sm font-medium text-gray-800">AI-бот</span>
                  {aiBotFlagsSaving && <span className="text-xs text-gray-500">сохранение…</span>}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">тест</span>
                </label>
              </div>
              {aiBotEnabled && (
                <>
                  <p className="mt-1.5 text-xs text-emerald-700 font-medium">AI-режим активен</p>
                  <label className="mt-2 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aiBotAutoProposalEnabled}
                      onChange={(e) => onAiBotFlagsChange({ aiBotAutoProposalEnabled: e.target.checked })}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-gray-700">Разрешить AI отправлять КП</span>
                  </label>
                </>
              )}
            </div>
          )}

          {pipelineStageModal && pipelineStages.length > 0 && (
            <div
              className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center bg-black/40 p-4"
              role="dialog"
              aria-label="Этап сделки"
            >
              <div className="bg-white rounded-xl shadow-xl max-w-sm w-full max-h-[70vh] overflow-y-auto p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-gray-900">Этап воронки</h4>
                  <button type="button" onClick={() => setPipelineStageModal(false)} className="p-1 rounded hover:bg-gray-100">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <ul className="space-y-1">
                  {pipelineStages.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => handlePipelineStageSelect(s.id, s.name, s.color)}
                        disabled={creatingPipelineDeal}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm flex items-center gap-2"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              s.color && /^#[0-9A-Fa-f]{3,8}$/.test(s.color) ? s.color : '#9CA3AF'
                          }}
                        />
                        {s.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {!editing ? (
            <>
              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  <DefTerm className="text-gray-500">Имя</DefTerm>
                  <DefDesc className="text-gray-900">{client?.name || '—'}</DefDesc>
                </div>
                <div>
                  <DefTerm className="text-gray-500">Телефон</DefTerm>
                  <DefDesc className="text-gray-900">{client?.phone ?? phone}</DefDesc>
                </div>
                <div>
                  <DefTerm className="text-gray-500">Источник</DefTerm>
                  <DefDesc className="text-gray-900">{client?.source || '—'}</DefDesc>
                </div>
                <div>
                  <DefTerm className="text-gray-500">Комментарий</DefTerm>
                  <DefDesc className="text-gray-900 whitespace-pre-wrap">{client?.comment || '—'}</DefDesc>
                </div>
                <div>
                  <DefTerm className="text-gray-500">Дата первого обращения</DefTerm>
                  <DefDesc className="text-gray-900">{client?.createdAt ? formatDate(client.createdAt) : '—'}</DefDesc>
                </div>
              </dl>
              <button
                type="button"
                onClick={startEdit}
                className="mt-4 w-full py-2 text-sm font-medium text-green-600 border border-green-500 rounded-lg hover:bg-green-50"
              >
                Редактировать
              </button>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Сделка</h3>
                {embeddedInSheet ? (
                  <>
                    <p className="text-sm text-gray-600 mb-1">
                      Текущий статус:{' '}
                      {(() => {
                        const currentStatusId = deal?.statusId ?? deal?.status ?? null;
                        const current =
                          (currentStatusId && dealStatuses?.find((s) => s.id === currentStatusId)) ?? null;
                        return <span className="font-medium text-gray-900">{current?.name ?? 'Без статуса'}</span>;
                      })()}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (!deal && phone) {
                          setCreatingDeal(true);
                          createDealForClient(phone, companyId).then((newDeal) => {
                            setDeal(newDeal);
                            setCreatingDeal(false);
                            setMobileStatusPickerOpen(true);
                          }).catch(() => setCreatingDeal(false));
                        } else {
                          setMobileStatusPickerOpen(true);
                        }
                      }}
                      disabled={creatingDeal || (dealStatuses?.length === 0)}
                      className="w-full py-2 text-sm font-medium text-green-600 border border-green-500 rounded-lg hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creatingDeal ? '…' : 'Изменить статус'}
                    </button>
                    {dealStatuses?.length === 0 && (
                      <button
                        type="button"
                        onClick={() => setShowStatusModal(true)}
                        className="mt-1 text-[11px] text-green-600 hover:text-green-700"
                      >
                        + Добавить статус
                      </button>
                    )}
                  </>
                ) : dealStatuses && dealStatuses.length > 0 ? (
                  <div className="space-y-2">
                    {(() => {
                      const currentStatusId = deal?.statusId ?? deal?.status ?? null;
                      const current =
                        (currentStatusId &&
                          dealStatuses.find((s) => s.id === currentStatusId)) ??
                        null;
                      return (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border border-gray-200 bg-gray-50"
                        >
                          <span
                            className="inline-flex h-2 w-2 rounded-full"
                            style={{ backgroundColor: current?.color ?? '#6B7280' }}
                          />
                          <span>{current?.name ?? 'Без статуса'}</span>
                        </button>
                      );
                    })()}
                    <div className="mt-1 space-y-1">
                      <div className="group flex items-center gap-1 w-full">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!phone || !deal) return;
                            setCreatingDeal(true);
                            try {
                              await updateDoc(doc(db, COLLECTION_DEALS, deal.id), {
                                statusId: null,
                                status: null,
                                updatedAt: serverTimestamp()
                              });
                              setDeal({ ...deal, statusId: null, status: null });
                            } finally {
                              setCreatingDeal(false);
                            }
                          }}
                          className="flex-1 min-w-0 text-left px-2 py-1 rounded-md text-xs hover:bg-gray-100 flex items-center gap-2"
                        >
                          <span className="inline-flex h-2 w-2 rounded-full flex-shrink-0 bg-gray-300" />
                          <span className="truncate">Без статуса</span>
                        </button>
                        {dealStatusCounts != null && (
                          <span className={COUNT_BADGE_CLASS}>{dealStatusCounts.none}</span>
                        )}
                      </div>
                      {dealStatuses.map((s) => (
                        <div
                          key={s.id}
                          className="group flex items-center gap-1 w-full"
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setStatusContextMenu({ x: e.clientX, y: e.clientY, status: s });
                          }}
                        >
                          <button
                            type="button"
                            onClick={async () => {
                              if (!phone) return;
                              setCreatingDeal(true);
                              try {
                                if (!deal) {
                                  const newDeal = await createDealForClient(phone, companyId);
                                  await updateDoc(doc(db, COLLECTION_DEALS, newDeal.id), {
                                    statusId: s.id,
                                    status: s.id,
                                    updatedAt: serverTimestamp()
                                  });
                                  setDeal({ ...newDeal, statusId: s.id, status: s.id });
                                } else {
                                  await updateDoc(doc(db, COLLECTION_DEALS, deal.id), {
                                    statusId: s.id,
                                    status: s.id,
                                    updatedAt: serverTimestamp()
                                  });
                                  setDeal({ ...deal, statusId: s.id, status: s.id });
                                }
                              } finally {
                                setCreatingDeal(false);
                              }
                            }}
                            className="flex-1 min-w-0 text-left px-2 py-1 rounded-md text-xs hover:bg-gray-100 flex items-center gap-2"
                          >
                            <span
                              className="inline-flex h-2 w-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: s.color }}
                            />
                            <span className="truncate">{s.name}</span>
                          </button>
                          {dealStatusCounts != null && (
                            <span className={COUNT_BADGE_CLASS}>{dealStatusCounts.byId[s.id] ?? 0}</span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatusContextMenu({ x: e.clientX, y: e.clientY, status: s });
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 text-gray-500 flex-shrink-0"
                            aria-label="Меню статуса"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowStatusModal(true)}
                      className="mt-1 text-[11px] text-green-600 hover:text-green-700"
                    >
                      + Добавить статус
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Статусы сделок ещё не настроены.</p>
                    <button
                      type="button"
                      onClick={() => setShowStatusModal(true)}
                      className="mt-1 text-[11px] text-green-600 hover:text-green-700"
                    >
                      + Добавить первый статус
                    </button>
                    {!deal && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!phone) return;
                          setCreatingDeal(true);
                          try {
                            const newDeal = await createDealForClient(phone, companyId);
                            setDeal(newDeal);
                          } finally {
                            setCreatingDeal(false);
                          }
                        }}
                        disabled={creatingDeal}
                        className="mt-2 w-full py-2 text-sm font-medium text-green-600 border border-green-500 rounded-lg hover:bg-green-50 disabled:opacity-50"
                      >
                        {creatingDeal ? 'Создание…' : 'Создать сделку'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Ответственный менеджер</h3>
                {embeddedInSheet ? (
                  <>
                    <p className="text-sm text-gray-600 mb-1">
                      Текущий менеджер:{' '}
                      <span className="font-medium text-gray-900">
                        {deal?.managerId
                          ? managers.find((m) => m.id === deal.managerId)?.name ?? '—'
                          : 'Без менеджера'}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (!deal && phone) {
                          setCreatingDeal(true);
                          createDealForClient(phone, companyId).then((newDeal) => {
                            setDeal(newDeal);
                            setCreatingDeal(false);
                            setMobileManagerPickerOpen(true);
                          }).catch(() => setCreatingDeal(false));
                        } else {
                          setMobileManagerPickerOpen(true);
                        }
                      }}
                      disabled={creatingDeal}
                      className="w-full py-2 text-sm font-medium text-green-600 border border-green-500 rounded-lg hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creatingDeal ? '…' : 'Изменить менеджера'}
                    </button>
                    {managers.length === 0 && (
                      <button
                        type="button"
                        onClick={() => setShowManagerModal(true)}
                        className="mt-1 text-[11px] text-green-600 hover:text-green-700"
                      >
                        + Добавить менеджера
                      </button>
                    )}
                  </>
                ) : managers.length > 0 ? (
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer w-full min-w-0">
                      <input
                        type="radio"
                        name="manager"
                        checked={!deal?.managerId}
                        onChange={async () => {
                          if (!phone || !deal) return;
                          setCreatingDeal(true);
                          try {
                            await updateDoc(doc(db, COLLECTION_DEALS, deal.id), {
                              managerId: null,
                              updatedAt: serverTimestamp()
                            });
                            setDeal({ ...deal, managerId: null });
                          } finally {
                            setCreatingDeal(false);
                          }
                        }}
                        className="text-green-600"
                      />
                      <span className="text-sm text-gray-600 truncate">Без менеджера</span>
                      {managerCounts != null && (
                        <span className={COUNT_BADGE_CLASS + ' ml-auto'}>{managerCounts.none}</span>
                      )}
                    </label>
                    {managers.map((mg) => (
                      <div
                        key={mg.id}
                        className="group flex items-center gap-1 w-full"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setManagerContextMenu({ x: e.clientX, y: e.clientY, manager: mg });
                        }}
                      >
                        <label className="flex-1 flex items-center gap-2 cursor-pointer min-w-0">
                          <input
                            type="radio"
                            name="manager"
                            checked={deal?.managerId === mg.id}
                            onChange={async () => {
                              if (!phone) return;
                              setCreatingDeal(true);
                              try {
                                if (!deal) {
                                  const newDeal = await createDealForClient(phone, companyId);
                                  await updateDoc(doc(db, COLLECTION_DEALS, newDeal.id), {
                                    managerId: mg.id,
                                    updatedAt: serverTimestamp()
                                  });
                                  setDeal({ ...newDeal, managerId: mg.id });
                                } else {
                                  await updateDoc(doc(db, COLLECTION_DEALS, deal.id), {
                                    managerId: mg.id,
                                    updatedAt: serverTimestamp()
                                  });
                                  setDeal({ ...deal, managerId: mg.id });
                                }
                              } finally {
                                setCreatingDeal(false);
                              }
                            }}
                            className="text-green-600"
                          />
                          <span
                            className="inline-flex h-2 w-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: mg.color }}
                          />
                          <span className="text-sm text-gray-800 truncate">{mg.name}</span>
                        </label>
                        {managerCounts != null && (
                          <span className={COUNT_BADGE_CLASS}>{managerCounts.byId[mg.id] ?? 0}</span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setManagerContextMenu({ x: e.clientX, y: e.clientY, manager: mg });
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 text-gray-500 flex-shrink-0"
                          aria-label="Меню менеджера"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowManagerModal(true)}
                      className="mt-1 text-[11px] text-green-600 hover:text-green-700"
                    >
                      + Добавить менеджера
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-500 mb-1">Менеджеры не добавлены.</p>
                    <button
                      type="button"
                      onClick={() => setShowManagerModal(true)}
                      className="text-[11px] text-green-600 hover:text-green-700"
                    >
                      + Добавить первого менеджера
                    </button>
                  </>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Город</h3>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 cursor-pointer w-full min-w-0">
                    <input
                      type="radio"
                      name="city"
                      checked={!(client?.city ?? '').trim()}
                      onChange={() => saveCity(null)}
                      disabled={citySaving}
                      className="text-green-600"
                    />
                    <span className="text-sm text-gray-600">Без города</span>
                    {cityCounts != null && (
                      <span className={COUNT_BADGE_CLASS + ' ml-auto'}>{cityCounts.none}</span>
                    )}
                  </label>
                  {cities.map((cityName) => (
                    <div
                      key={cityName}
                      className="group flex items-center gap-1 w-full"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setCityContextMenu({ x: e.clientX, y: e.clientY, cityName });
                      }}
                    >
                      <label className="flex-1 flex items-center gap-2 cursor-pointer min-w-0">
                        <input
                          type="radio"
                          name="city"
                          checked={(client?.city ?? '').trim() === cityName}
                          onChange={() => saveCity(cityName)}
                          disabled={citySaving}
                          className="text-green-600"
                        />
                        <span className="text-sm text-gray-800 truncate">{cityName}</span>
                      </label>
                      {cityCounts != null && (
                        <span className={COUNT_BADGE_CLASS}>{cityCounts.byCity[cityName] ?? 0}</span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCityContextMenu({ x: e.clientX, y: e.clientY, cityName });
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 text-gray-500 flex-shrink-0"
                        aria-label="Меню города"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {onAddCity && (
                    <button
                      type="button"
                      onClick={() => setShowAddCityModal(true)}
                      className="mt-1 text-[11px] text-green-600 hover:text-green-700"
                    >
                      + Добавить город
                    </button>
                  )}
                </div>
                {citySaving && (
                  <p className="mt-1 text-[11px] text-gray-500">Сохранение…</p>
                )}
                {citySaveFeedback === 'success' && !citySaving && (
                  <p className="mt-1 text-[11px] text-green-600">Сохранено</p>
                )}
                {citySaveFeedback === 'error' && !citySaving && (
                  <p className="mt-1 text-[11px] text-red-600">Ошибка сохранения</p>
                )}
              </div>

              <ChatSalesAnalysisBlock
                messages={messages}
                phone={phone}
                conversationId={conversationId ?? null}
                cachedResult={conversationId ? salesAnalysisCache[conversationId] ?? null : null}
                analyzedAt={conversationId ? analyzedAtByConversation[conversationId] ?? null : null}
                onCacheResult={handleSalesAnalysisCacheResult}
                compact={embeddedInSheet}
                onInsertNextMessage={onInsertNextMessage}
                getCurrentInputValue={getCurrentInputValue}
                onPrepareForAnalysis={prepareForAnalysis}
                isTranscribeBatchRunning={isTranscribeBatchRunning}
                onExtractedCity={handleExtractedCityFromAnalysis}
              />

              {/* Извлечено из переписки */}
              {extractedClientVisible && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/80 p-2.5">
                  <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                    Извлечено из переписки
                  </h4>
                  {!extractedClientData ? (
                    <>
                      <p className="text-xs text-gray-500 mb-2">Данные по переписке появятся после анализа.</p>
                      <button
                        type="button"
                        onClick={handleAIAnalyze}
                        disabled={aiLoading || !messages?.length}
                        className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800 disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {aiLoading ? 'Загрузка…' : 'Извлечь из переписки'}
                      </button>
                    </>
                  ) : (
                    <>
                      {extractedClientEditMode ? (
                        <div className="space-y-1.5">
                          {(['city', 'areaSqm', 'houseType', 'floors', 'clientIntent', 'aiSummary'] as const).map((fieldKey) => (
                            <div key={fieldKey}>
                              <label className="block text-[10px] text-gray-500 mb-0.5">
                                {fieldKey === 'city' && 'Город'}
                                {fieldKey === 'areaSqm' && 'Площадь (м²)'}
                                {fieldKey === 'houseType' && 'Тип дома'}
                                {fieldKey === 'floors' && 'Этажность'}
                                {fieldKey === 'clientIntent' && 'Интерес / запрос'}
                                {fieldKey === 'aiSummary' && 'Краткий комментарий'}
                              </label>
                              {fieldKey === 'aiSummary' ? (
                                <textarea
                                  value={extractedClientDraft[fieldKey]}
                                  onChange={(e) => setExtractedClientDraft((p) => ({ ...p, [fieldKey]: e.target.value }))}
                                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs min-h-[60px]"
                                  rows={2}
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={extractedClientDraft[fieldKey]}
                                  onChange={(e) => setExtractedClientDraft((p) => ({ ...p, [fieldKey]: e.target.value }))}
                                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                                />
                              )}
                            </div>
                          ))}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <button
                              type="button"
                              onClick={handleFillCardFromExtracted}
                              disabled={extractedSaveLoading}
                              className="px-2.5 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              {extractedSaveLoading ? '…' : 'Сохранить в карточку'}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setExtractedClientEditMode(false); setExtractedClientDraft(extractedClientData ? { ...extractedClientData } : emptyExtracted()); }}
                              className="px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <dl className="space-y-1 text-xs">
                            {extractedClientData.city && <><DefTerm className="text-gray-500">Город</DefTerm><DefDesc className="text-gray-800">{extractedClientData.city}</DefDesc></>}
                            {extractedClientData.areaSqm && <><DefTerm className="text-gray-500">Площадь</DefTerm><DefDesc className="text-gray-800">{extractedClientData.areaSqm} м²</DefDesc></>}
                            {extractedClientData.houseType && <><DefTerm className="text-gray-500">Тип дома</DefTerm><DefDesc className="text-gray-800">{extractedClientData.houseType}</DefDesc></>}
                            {extractedClientData.floors && <><DefTerm className="text-gray-500">Этажность</DefTerm><DefDesc className="text-gray-800">{extractedClientData.floors}</DefDesc></>}
                            {extractedClientData.clientIntent && <><DefTerm className="text-gray-500">Интерес</DefTerm><DefDesc className="text-gray-800">{extractedClientData.clientIntent}</DefDesc></>}
                            {extractedClientData.aiSummary && <><DefTerm className="text-gray-500">Комментарий</DefTerm><DefDesc className="text-gray-800 whitespace-pre-wrap">{extractedClientData.aiSummary}</DefDesc></>}
                          </dl>
                          {!extractedClientData.city && !extractedClientData.areaSqm && !extractedClientData.houseType && !extractedClientData.floors && !extractedClientData.clientIntent && !extractedClientData.aiSummary && (
                            <p className="text-xs text-gray-400 italic">Ничего не извлечено</p>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <button
                              type="button"
                              onClick={handleFillCardFromExtracted}
                              disabled={extractedSaveLoading}
                              className="px-2.5 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              {extractedSaveLoading ? '…' : 'Заполнить карточку'}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setExtractedClientEditMode(true); setExtractedClientDraft(extractedClientData ? { ...extractedClientData } : emptyExtracted()); }}
                              className="px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                            >
                              Редактировать
                            </button>
                            <button
                              type="button"
                              onClick={() => setExtractedClientVisible(false)}
                              className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                            >
                              Скрыть
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
              {!extractedClientVisible && (
                <button
                  type="button"
                  onClick={() => setExtractedClientVisible(true)}
                  className="mt-2 text-xs text-gray-500 hover:text-gray-700"
                >
                  Показать «Извлечено из переписки»
                </button>
              )}

              {/* Классификация лида */}
              {conversationId && !leadClassDismissed[conversationId] && (() => {
                const cached = salesAnalysisCache[conversationId];
                const hasLead = cached && (cached.leadTemperature || cached.leadStage || cached.leadIntent);
                const leadTempLabels: Record<string, string> = { hot: 'Горячий', warm: 'Тёплый', cold: 'Холодный' };
                const leadStageLabels: Record<string, string> = {
                  primary_interest: 'Первичный интерес',
                  need_quote: 'Нужен расчёт',
                  send_proposal: 'Отправить КП',
                  thinking: 'Думает',
                  meeting: 'Встреча',
                  in_progress: 'В работе',
                  lost: 'Потерян',
                };
                const leadIntentLabels: Record<string, string> = {
                  build_house: 'Строить дом',
                  get_price: 'Узнать цену',
                  compare_tech: 'Сравнить технологии',
                  need_project: 'Нужен проект',
                  mortgage_installment: 'Ипотека / рассрочка',
                  consultation: 'Консультация',
                };
                if (!hasLead) return null;
                return (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-blue-50/60 p-2.5">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                      Классификация лида
                    </h4>
                    <dl className="space-y-1 text-xs mb-2">
                      {cached.leadTemperature && <><DefTerm className="text-gray-500">Температура</DefTerm><DefDesc className="text-gray-800">{leadTempLabels[cached.leadTemperature] ?? cached.leadTemperature}</DefDesc></>}
                      {cached.leadStage && <><DefTerm className="text-gray-500">Этап</DefTerm><DefDesc className="text-gray-800">{leadStageLabels[cached.leadStage] ?? cached.leadStage}</DefDesc></>}
                      {cached.leadIntent && <><DefTerm className="text-gray-500">Намерение</DefTerm><DefDesc className="text-gray-800">{leadIntentLabels[cached.leadIntent] ?? cached.leadIntent}</DefDesc></>}
                    </dl>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={handleApplyLeadClassification}
                        disabled={leadClassApplyLoading}
                        className="px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {leadClassApplyLoading ? '…' : 'Применить'}
                      </button>
                      <button
                        type="button"
                        className="px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                        title="Изменить вручную в карточке клиента"
                      >
                        Изменить вручную
                      </button>
                      <button
                        type="button"
                        onClick={() => conversationId && setLeadClassDismissed((p) => ({ ...p, [conversationId]: true }))}
                        className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                      >
                        Не сохранять
                      </button>
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="mt-4 space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs text-gray-500 shrink-0">Имя</label>
                  <button
                    type="button"
                    onClick={handleAIAnalyze}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      if (!aiLoading && messages.length > 0) handleAIAnalyze();
                    }}
                    disabled={aiLoading || messages.length === 0 || (aiLoadingConfigured === false && aiConfigured === false)}
                    className="inline-flex min-h-[44px] min-w-[44px] touch-manipulation cursor-pointer items-center justify-center gap-1 rounded-full border border-dashed border-amber-300 px-3 py-2 text-[11px] font-medium text-amber-700 hover:bg-amber-50 active:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:bg-transparent"
                    style={{ touchAction: 'manipulation' }}
                    title={aiConfigured === false && !aiLoadingConfigured ? 'Подключите AI API key в разделе Интеграции' : 'AI анализ переписки: определить имя и комментарий'}
                    aria-label="AI анализ переписки"
                  >
                    <Sparkles
                      size={14}
                      className={aiLoading ? 'animate-spin shrink-0' : 'shrink-0'}
                    />
                    <span>{aiLoading ? '…' : 'AI анализ'}</span>
                  </button>
                </div>
                {aiError && (
                  <p className="mt-1.5 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700" role="alert">
                    {aiError}
                  </p>
                )}
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Имя"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Источник</label>
                <input
                  type="text"
                  value={editSource}
                  onChange={(e) => setEditSource(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="WhatsApp"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Комментарий</label>
                <textarea
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm min-h-[80px]"
                  placeholder="Комментарий"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {/* Мобильный выбор статуса: fullscreen modal со списком */}
      {embeddedInSheet && mobileStatusPickerOpen && (
        <div className="fixed inset-0 z-[1400] flex flex-col bg-white" role="dialog" aria-modal="true" aria-label="Выбор статуса сделки">
          <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
            <h2 className="text-lg font-semibold text-gray-800">Статус сделки</h2>
            <button
              type="button"
              onClick={() => setMobileStatusPickerOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
            {dealStatuses && dealStatuses.length > 0 ? (
              <ul className="space-y-1">
                <li>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!phone || !deal) return;
                      setCreatingDeal(true);
                      try {
                        await updateDoc(doc(db, COLLECTION_DEALS, deal.id), {
                          statusId: null,
                          status: null,
                          updatedAt: serverTimestamp()
                        });
                        setDeal({ ...deal, statusId: null, status: null });
                        setMobileStatusPickerOpen(false);
                      } finally {
                        setCreatingDeal(false);
                      }
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left ${
                      (deal?.statusId == null && deal?.status == null) ? 'bg-green-50 ring-1 ring-green-200' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full bg-gray-300" />
                    <span className="flex-1 font-medium text-gray-900">Без статуса</span>
                    {dealStatusCounts != null && (
                      <span className={COUNT_BADGE_CLASS}>{dealStatusCounts.none}</span>
                    )}
                  </button>
                </li>
                {dealStatuses.map((s) => {
                  const isActive = (deal?.statusId === s.id || deal?.status === s.id);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!phone) return;
                          setCreatingDeal(true);
                          try {
                            if (!deal) {
                              const newDeal = await createDealForClient(phone, companyId);
                              await updateDoc(doc(db, COLLECTION_DEALS, newDeal.id), {
                                statusId: s.id,
                                status: s.id,
                                updatedAt: serverTimestamp()
                              });
                              setDeal({ ...newDeal, statusId: s.id, status: s.id });
                            } else {
                              await updateDoc(doc(db, COLLECTION_DEALS, deal.id), {
                                statusId: s.id,
                                status: s.id,
                                updatedAt: serverTimestamp()
                              });
                              setDeal({ ...deal, statusId: s.id, status: s.id });
                            }
                            setMobileStatusPickerOpen(false);
                          } finally {
                            setCreatingDeal(false);
                          }
                        }}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left ${
                          isActive ? 'bg-green-50 ring-1 ring-green-200' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="flex-1 font-medium text-gray-900">{s.name}</span>
                        {dealStatusCounts != null && (
                          <span className={COUNT_BADGE_CLASS}>{dealStatusCounts.byId[s.id] ?? 0}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Нет статусов. Добавьте в настройках.</p>
            )}
          </div>
          <div className="shrink-0 border-t border-gray-200 px-4 py-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}>
            <button
              type="button"
              onClick={() => setMobileStatusPickerOpen(false)}
              className="w-full py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* Мобильный выбор менеджера: fullscreen modal со списком */}
      {embeddedInSheet && mobileManagerPickerOpen && (
        <div className="fixed inset-0 z-[1400] flex flex-col bg-white" role="dialog" aria-modal="true" aria-label="Выбор менеджера">
          <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
            <h2 className="text-lg font-semibold text-gray-800">Ответственный менеджер</h2>
            <button
              type="button"
              onClick={() => setMobileManagerPickerOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
            {managers.length > 0 ? (
              <ul className="space-y-1">
                <li>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!phone || !deal) return;
                      setCreatingDeal(true);
                      try {
                        await updateDoc(doc(db, COLLECTION_DEALS, deal.id), {
                          managerId: null,
                          updatedAt: serverTimestamp()
                        });
                        setDeal({ ...deal, managerId: null });
                        setMobileManagerPickerOpen(false);
                      } finally {
                        setCreatingDeal(false);
                      }
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left ${
                      !deal?.managerId ? 'bg-green-50 ring-1 ring-green-200' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-medium text-gray-900">Без менеджера</span>
                    {managerCounts != null && (
                      <span className={COUNT_BADGE_CLASS}>{managerCounts.none}</span>
                    )}
                  </button>
                </li>
                {managers.map((mg) => {
                  const isActive = deal?.managerId === mg.id;
                  return (
                    <li key={mg.id}>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!phone) return;
                          setCreatingDeal(true);
                          try {
                            if (!deal) {
                              const newDeal = await createDealForClient(phone, companyId);
                              await updateDoc(doc(db, COLLECTION_DEALS, newDeal.id), {
                                managerId: mg.id,
                                updatedAt: serverTimestamp()
                              });
                              setDeal({ ...newDeal, managerId: mg.id });
                            } else {
                              await updateDoc(doc(db, COLLECTION_DEALS, deal.id), {
                                managerId: mg.id,
                                updatedAt: serverTimestamp()
                              });
                              setDeal({ ...deal, managerId: mg.id });
                            }
                            setMobileManagerPickerOpen(false);
                          } finally {
                            setCreatingDeal(false);
                          }
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left ${
                          isActive ? 'bg-green-50 ring-1 ring-green-200' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-medium text-gray-900">{mg.name}</span>
                        {managerCounts != null && (
                          <span className={COUNT_BADGE_CLASS}>{managerCounts.byId[mg.id] ?? 0}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Нет менеджеров. Добавьте в настройках.</p>
            )}
          </div>
          <div className="shrink-0 border-t border-gray-200 px-4 py-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}>
            <button
              type="button"
              onClick={() => setMobileManagerPickerOpen(false)}
              className="w-full py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {statusContextMenu && (
        <div
          ref={statusMenuPosition.ref}
          className="fixed z-[1300] min-w-[140px] py-1 bg-white rounded-lg shadow-lg border border-gray-200"
          style={{ left: statusMenuPosition.style.left, top: statusMenuPosition.style.top }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => {
              setEditStatusName(statusContextMenu.status.name);
              setEditStatusColor(statusContextMenu.status.color);
              setEditingStatus(statusContextMenu.status);
              setStatusContextMenu(null);
            }}
          >
            Редактировать
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            onClick={async () => {
              const status = statusContextMenu.status;
              setStatusContextMenu(null);
              const dealsSnap = await getDocs(
                query(
                  collection(db, COLLECTION_DEALS),
                  where('companyId', '==', companyId),
                  where('statusId', '==', status.id)
                )
              );
              setDeletingStatus({ status, dealCount: dealsSnap.size });
            }}
          >
            Удалить
          </button>
        </div>
      )}

      {editingStatus && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-xs">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Редактировать статус</h3>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Название статуса</label>
                <input
                  type="text"
                  value={editStatusName}
                  onChange={(e) => setEditStatusName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Например: КП выслано"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Цвет статуса</label>
                <input
                  type="color"
                  value={editStatusColor}
                  onChange={(e) => setEditStatusColor(e.target.value)}
                  className="h-8 w-16 border border-gray-300 rounded"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingStatus(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!editStatusName.trim()}
                onClick={async () => {
                  if (!editStatusName.trim()) return;
                  await updateDoc(doc(db, 'dealStatuses', editingStatus.id), {
                    name: editStatusName.trim(),
                    color: editStatusColor
                  });
                  setEditingStatus(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingStatus && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">
              Удалить статус «{deletingStatus.status.name}»?
            </h3>
            {deletingStatus.dealCount > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mb-3">
                Этот статус используется в {deletingStatus.dealCount} сделках. При удалении сделки
                получат статус «Без статуса».
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingStatus(null)}
                disabled={deleteStatusLoading}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={deleteStatusLoading}
                onClick={async () => {
                  setDeleteStatusLoading(true);
                  try {
                    const { status } = deletingStatus;
                    const dealsSnap = await getDocs(
                      query(
                        collection(db, COLLECTION_DEALS),
                        where('companyId', '==', companyId),
                        where('statusId', '==', status.id)
                      )
                    );
                    const batch = writeBatch(db);
                    dealsSnap.docs.forEach((d) => {
                      batch.update(d.ref, { statusId: null, status: null, updatedAt: serverTimestamp() });
                    });
                    await batch.commit();
                    await deleteDoc(doc(db, 'dealStatuses', status.id));
                    if (deal && (deal.statusId === status.id || deal.status === status.id)) {
                      setDeal({ ...deal, statusId: null, status: null });
                    }
                    setDeletingStatus(null);
                  } finally {
                    setDeleteStatusLoading(false);
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteStatusLoading ? 'Удаление…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {managerContextMenu && (
        <div
          ref={managerMenuPosition.ref}
          className="fixed z-[1300] min-w-[140px] py-1 bg-white rounded-lg shadow-lg border border-gray-200"
          style={{ left: managerMenuPosition.style.left, top: managerMenuPosition.style.top }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => {
              setEditManagerName(managerContextMenu.manager.name);
              setEditManagerColor(managerContextMenu.manager.color);
              setEditingManager(managerContextMenu.manager);
              setManagerContextMenu(null);
            }}
          >
            Редактировать
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            onClick={async () => {
              const manager = managerContextMenu.manager;
              setManagerContextMenu(null);
              const dealsSnap = await getDocs(
                query(
                  collection(db, COLLECTION_DEALS),
                  where('companyId', '==', companyId),
                  where('managerId', '==', manager.id)
                )
              );
              setDeletingManager({ manager, dealCount: dealsSnap.size });
            }}
          >
            Удалить
          </button>
        </div>
      )}

      {editingManager && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-xs">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Редактировать менеджера</h3>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Имя менеджера</label>
                <input
                  type="text"
                  value={editManagerName}
                  onChange={(e) => setEditManagerName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Например: Маргарита"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Цвет иконки</label>
                <input
                  type="color"
                  value={editManagerColor}
                  onChange={(e) => setEditManagerColor(e.target.value)}
                  className="h-8 w-16 border border-gray-300 rounded"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingManager(null)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!editManagerName.trim()}
                onClick={async () => {
                  if (!editManagerName.trim()) return;
                  await updateDoc(doc(db, COLLECTION_MANAGERS, editingManager.id), {
                    name: editManagerName.trim(),
                    color: editManagerColor
                  });
                  setEditingManager(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingManager && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">
              Удалить менеджера «{deletingManager.manager.name}»?
            </h3>
            {deletingManager.dealCount > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mb-3">
                Этот менеджер назначен в {deletingManager.dealCount} сделках. При удалении у сделок
                будет установлен вариант «Без менеджера».
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingManager(null)}
                disabled={deleteManagerLoading}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={deleteManagerLoading}
                onClick={async () => {
                  setDeleteManagerLoading(true);
                  try {
                    const { manager } = deletingManager;
                    const dealsSnap = await getDocs(
                      query(
                        collection(db, COLLECTION_DEALS),
                        where('companyId', '==', companyId),
                        where('managerId', '==', manager.id)
                      )
                    );
                    const batch = writeBatch(db);
                    dealsSnap.docs.forEach((d) => {
                      batch.update(d.ref, { managerId: null, updatedAt: serverTimestamp() });
                    });
                    await batch.commit();
                    await deleteDoc(doc(db, COLLECTION_MANAGERS, manager.id));
                    if (deal && deal.managerId === manager.id) {
                      setDeal({ ...deal, managerId: null });
                    }
                    setDeletingManager(null);
                  } finally {
                    setDeleteManagerLoading(false);
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteManagerLoading ? 'Удаление…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showStatusModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-xs">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Новый статус сделки</h3>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Название</label>
                <input
                  type="text"
                  value={newStatusName}
                  onChange={(e) => setNewStatusName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Например: Назначена встреча"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Цвет</label>
                <input
                  type="color"
                  value={newStatusColor}
                  onChange={(e) => setNewStatusColor(e.target.value)}
                  className="h-8 w-16 border border-gray-300 rounded"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!newStatusName.trim()}
                onClick={async () => {
                  if (!companyId || !newStatusName.trim()) return;
                  const col = collection(db, 'dealStatuses');
                  await addDoc(col, {
                    name: newStatusName.trim(),
                    color: newStatusColor,
                    order: dealStatuses?.length ?? 0,
                    companyId
                  });
                  setShowStatusModal(false);
                  setNewStatusName('');
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {cityContextMenu && (
        <div
          ref={cityMenuPosition.ref}
          className="fixed z-[1300] min-w-[140px] py-1 bg-white rounded-lg shadow-lg border border-gray-200"
          style={{ left: cityMenuPosition.style.left, top: cityMenuPosition.style.top }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => {
              setRenameCityValue(cityContextMenu.cityName);
              setRenamingCity(cityContextMenu.cityName);
              setCityContextMenu(null);
            }}
          >
            Переименовать
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            onClick={async () => {
              setDeletingCity(cityContextMenu.cityName);
              setCityContextMenu(null);
            }}
          >
            Удалить
          </button>
        </div>
      )}

      {deletingCity && companyId && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">
              Удалить город «{deletingCity}»?
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              Город будет удалён из справочника. У контактов с этим городом поле «Город» будет сброшено.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingCity(null)}
                disabled={deleteCityLoading}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={deleteCityLoading}
                onClick={async () => {
                  setDeleteCityLoading(true);
                  try {
                    await removeCompanyCity(companyId, deletingCity);
                    if (client?.city?.trim() === deletingCity) {
                      setClient({ ...client, city: undefined } as WhatsAppClientCard);
                    }
                    setDeletingCity(null);
                  } finally {
                    setDeleteCityLoading(false);
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteCityLoading ? 'Удаление…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {renamingCity && companyId && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-xs">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Переименовать город</h3>
            <input
              type="text"
              value={renameCityValue}
              onChange={(e) => setRenameCityValue(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-3"
              placeholder="Новое название"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setRenamingCity(null); setRenameCityValue(''); }}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!renameCityValue.trim()}
                onClick={async () => {
                  if (!renameCityValue.trim()) return;
                  try {
                    const newName = await renameCompanyCity(companyId, renamingCity, renameCityValue.trim());
                    if (client?.city?.trim() === renamingCity) {
                      setClient({ ...client, city: newName } as WhatsAppClientCard);
                    }
                    setRenamingCity(null);
                    setRenameCityValue('');
                  } catch (e) {
                    if (import.meta.env.DEV) console.warn('Rename city error', e);
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddCityModal && onAddCity && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-xs">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Добавить город</h3>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Название города</label>
                <input
                  type="text"
                  value={newCityName}
                  onChange={(e) => setNewCityName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Например: Алматы"
                  disabled={addCityLoading}
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (addCityLoading) return;
                  setShowAddCityModal(false);
                  setNewCityName('');
                }}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                disabled={addCityLoading}
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!newCityName.trim() || addCityLoading}
                onClick={async () => {
                  const trimmed = newCityName.trim();
                  if (!trimmed || addCityLoading) return;
                  setAddCityLoading(true);
                  try {
                    const normalized = await onAddCity(trimmed);
                    if (!normalized) {
                      toast.error('Не удалось добавить город');
                      return;
                    }
                    setShowAddCityModal(false);
                    setNewCityName('');
                    toast.success('Город добавлен');
                    await saveCity(normalized);
                  } catch (err) {
                    const message = err instanceof Error ? err.message : 'Не удалось добавить город';
                    toast.error(message);
                  } finally {
                    setAddCityLoading(false);
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {addCityLoading ? 'Сохранение…' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showManagerModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-xs">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Новый менеджер</h3>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Имя</label>
                <input
                  type="text"
                  value={newManagerName}
                  onChange={(e) => setNewManagerName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Например: Маргарита"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Цвет</label>
                <input
                  type="color"
                  value={newManagerColor}
                  onChange={(e) => setNewManagerColor(e.target.value)}
                  className="h-8 w-16 border border-gray-300 rounded"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowManagerModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!newManagerName.trim()}
                onClick={async () => {
                  if (!companyId || !newManagerName.trim()) return;
                  const col = collection(db, COLLECTION_MANAGERS);
                  await addDoc(col, {
                    name: newManagerName.trim(),
                    color: newManagerColor,
                    order: managers?.length ?? 0,
                    companyId
                  });
                  setShowManagerModal(false);
                  setNewManagerName('');
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
      {voiceLauncherOpen && companyId ? (
        <UniversalVoiceCallLauncher
          open={voiceLauncherOpen}
          onClose={() => setVoiceLauncherOpen(false)}
          title="Звонок из чата"
          context={{
            source: 'chat',
            companyId,
            phone: phone ?? null,
            clientId: client?.id ?? null,
            conversationId: conversationId ?? null,
            dealId: pipelineDeal?.id ?? conversationDealId ?? null
          }}
        />
      ) : null}
    </aside>
  );
};

export default ClientInfoPanel;
