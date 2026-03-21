import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import {
  MessageSquare,
  Menu,
  Search,
  LayoutGrid,
  Clock,
  Bell,
  GitBranch,
  Users,
  MapPin
} from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAuth } from '../hooks/useAuth';
import { useCompanyId } from '../contexts/CompanyContext';
import { useMobileWhatsAppChat } from '../contexts/MobileWhatsAppChatContext';
import { useMobileSidebar } from '../contexts/MobileSidebarContext';
import {
  subscribeConversationsList,
  type SubscribeConversationsResult,
  subscribeMessages,
  sortConversationItems,
  clearUnreadCount,
  dismissAwaitingReply,
  markConversationAsUnread,
  normalizePhone,
  softDeleteMessage,
  toggleStarMessage,
  addReactionToMessage,
  getConversationAttentionState,
  deleteClientWithConversation,
  updateConversationAiBotFlags,
  setConversationAiBotLastProcessedMessageId,
  setConversationAiBotLeadContext,
  updateWhatsAppConversationAiRuntime,
  COLLECTIONS,
  type ConversationListItem,
  type AiBotLeadContext,
  type WhatsAppAiRuntimePatch
} from '../lib/firebase/whatsappDb';
import { subscribeCrmAiBots } from '../lib/firebase/crmAiBots';
import {
  addWhatsAppAiBotRunLog,
  type WhatsAppAiBotRunLogInput
} from '../lib/firebase/whatsappAiBotRuns';
import { consumeChatDraft } from '../lib/ai-control/openChatDraftBridge';
import type { CrmAiBot } from '../types/crmAiBot';
import {
  defaultWhatsAppAiRuntime,
  parseWhatsAppAiRuntime,
  type WhatsAppAiRuntime
} from '../types/whatsappAiRuntime';
import type { AiDealRecommendationSnapshot } from '../types/aiDealRecommendation';
import type { AiTaskRecommendationSnapshot } from '../types/aiTaskRecommendation';
import { API_CONFIG } from '../config/api';
import { showErrorNotification } from '../utils/notifications';
import toast from 'react-hot-toast';
import { collection, query, where, onSnapshot, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { transcribeVoiceBatch, getVoiceMessagesToTranscribe } from '../utils/transcribeVoiceBatch';
import {
  getMessageTextContentForAi,
  messageHasVoiceOrAudioAttachment
} from '../utils/whatsappAiMessageContent';
import {
  buildCrmOpenAiMessagesFromBatch,
  buildLegacyAiPayloadMessages,
  chooseCrmWhatsAppAiDebounceMs,
  chooseWhatsAppAiDebounceMs,
  getUnprocessedIncomingMessages,
  getWhatsAppMessageTime,
  incomingBatchNeedsTranscriptWait,
  isInboundBatchStale,
  mergeLastProcessedInboundWatermarks
} from '../utils/whatsappAiInboundBatch';
import { parseCrmAiBotConfig } from '../types/crmAiBotConfig';
import { db, auth } from '../lib/firebase/config';
import { getAuthToken } from '../lib/firebase/auth';
import type { WhatsAppMessage } from '../types/whatsappDb';
import type { MediaQuickReply } from '../types/mediaQuickReplies';
import ConversationList from '../components/whatsapp/ConversationList';
import ChatWindow from '../components/whatsapp/ChatWindow';
import { HeaderSearchBar } from '../components/HeaderSearchBar';
import ClientInfoPanel from '../components/whatsapp/ClientInfoPanel';
import { ResizeHandle } from '../components/whatsapp/ResizeHandle';
import ForwardDialog from '../components/whatsapp/ForwardDialog';
import DeleteClientConfirmModal from '../components/whatsapp/DeleteClientConfirmModal';
import { subscribeCompanyCities, addCompanyCity } from '../lib/firebase/companyCities';
import { supabase, CLIENTS_BUCKET } from '../lib/supabase/config';
import { MAX_ATTACHMENT_MB } from '../components/whatsapp/ChatInput';
import { compressImage, validateVideoForChat, isLargeVideo } from '../utils/mediaUtils';
import { acquireVoiceStream, createVoiceRecorder } from '../utils/voiceRecording';
import { formatVoiceListDuration, isVoiceNoteAttachment } from '../components/whatsapp/whatsappUtils';

const NEW_MESSAGE_SOUND_PATH = '/sounds/new-message.mp3';

/** Длительность локального аудио-блоба для превью в списке после отправки голосового. */
function probeBlobAudioDurationSec(blob: Blob): Promise<number | undefined> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(blob);
      const audio = document.createElement('audio');
      const finish = (v: number | undefined) => {
        URL.revokeObjectURL(url);
        resolve(v);
      };
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        const d = audio.duration;
        finish(Number.isFinite(d) && d >= 0 ? d : undefined);
      };
      audio.onerror = () => finish(undefined);
      audio.src = url;
    } catch {
      resolve(undefined);
    }
  });
}

const WHATSAPP_MEDIA_PREFIX = 'whatsapp/media';
const MAX_BYTES = MAX_ATTACHMENT_MB * 1024 * 1024;

/** Максимальный размер файла при отправке через Drag & Drop (задача: 20 МБ) */
const DROP_ZONE_MAX_MB = 20;
const DROP_ZONE_MAX_BYTES = DROP_ZONE_MAX_MB * 1024 * 1024;

const DROP_ALLOWED_EXT = new Set(
  ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'docx', 'xlsx', 'mp4']
);
const DROP_ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'video/mp4'
]);

function isDropAllowedFile(file: File): boolean {
  if (file.size > DROP_ZONE_MAX_BYTES) return false;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext && DROP_ALLOWED_EXT.has(ext)) return true;
  if (DROP_ALLOWED_MIMES.has(file.type)) return true;
  return false;
}

/** Превью последнего сообщения для списка чатов в пересылке */
function getLastMessagePreview(msg: WhatsAppMessage | null): string {
  if (!msg || msg.deleted) return '';
  const att = msg.attachments?.[0];
  if (att) {
    if (att.type === 'image') return 'Фото';
    if (att.type === 'video') return 'Видео';
    if (att.type === 'voice') {
      const d = formatVoiceListDuration(att.durationSeconds);
      return d ? `Голосовое сообщение · ${d}` : 'Голосовое сообщение';
    }
    if (isVoiceNoteAttachment(att)) {
      const d = formatVoiceListDuration(att.durationSeconds);
      return d ? `Голосовое сообщение · ${d}` : 'Голосовое сообщение';
    }
    if (att.type === 'audio') return 'Аудио';
    return 'Файл';
  }
  const text = (msg.text ?? '').trim();
  return text ? (text.length > 50 ? text.slice(0, 50) + '…' : text) : '';
}

/** Единый зелёный badge счётчика: мобильная панель (сделки / менеджеры / города). */
function MobileFilterEmeraldCountBadge({ value }: { value: number }) {
  const len = String(value).length;
  const sizeClass = len > 3 ? 'text-[8px]' : len > 2 ? 'text-[9px]' : 'text-[10px]';
  return (
    <span
      className={`pointer-events-none absolute right-0.5 top-0.5 z-[4] inline-flex min-h-[17px] max-w-[min(100%-0.25rem,4.25rem)] min-w-0 items-center justify-center rounded-md bg-emerald-600 px-1 py-0.5 font-semibold leading-none text-white shadow-sm tabular-nums ${sizeClass}`}
    >
      {value}
    </span>
  );
}

function getAttachmentType(file: File): 'image' | 'file' | 'audio' | 'voice' | 'video' {
  const name = file.name.toLowerCase();
  if (name.startsWith('voice.') || file.type === 'audio/webm' || file.type === 'audio/ogg') return 'voice';
  const t = file.type.toLowerCase();
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('audio/')) return 'audio';
  if (t.startsWith('video/')) return 'video';
  return 'file';
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

function playNewMessageSound() {
  try {
    const audio = new Audio(NEW_MESSAGE_SOUND_PATH);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch {
    // ignore
  }
}

function showNewMessageBrowserNotification() {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'granted') {
    new Notification('Новое сообщение WhatsApp');
  }
}

const SEND_API = '/.netlify/functions/send-whatsapp-message';
const CRM_WHATSAPP_RUNTIME_API = `${API_CONFIG.BASE_URL}/crm-ai-bot-whatsapp-runtime`;
const CRM_CREATE_DEAL_FROM_REC_API = `${API_CONFIG.BASE_URL}/crm-ai-create-deal-from-recommendation`;
const CRM_CREATE_TASK_FROM_REC_API = `${API_CONFIG.BASE_URL}/crm-ai-create-task-from-recommendation`;

/** Лог whatsappAiBotRuns не должен ронять runtime при PERMISSION_DENIED (если правила не задеплоены). */
function logWhatsappAiBotRunSafe(input: WhatsAppAiBotRunLogInput): void {
  void addWhatsAppAiBotRunLog(input).catch((err) => {
    if (import.meta.env.DEV) {
      console.warn('[WhatsApp] whatsappAiBotRuns: не удалось записать лог:', err);
    }
  });
}

/** Ответ Netlify: применение extraction в CRM */
type RuntimeExtractionApplyApi = {
  extractionApplied: boolean;
  extractionApplyStatus: 'applied' | 'skipped' | 'error';
  extractionApplyReason: string | null;
  appliedClientId: string | null;
  extractionAppliedFields: string[];
  extractionAppliedLabels: string[];
  extractionAppliedFieldCount: number;
  appliedAt: string | null;
  dealRecommendationForLog: string | null;
};

type CreateDealFromRecommendationApi = {
  ok?: boolean;
  error?: string;
  dealId?: string;
  dealTitle?: string;
  stageId?: string;
  stageName?: string;
  pipelineId?: string;
  pipelineName?: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  usedFallbacks?: string[];
};

function patchAiRuntimeFromExtractionApply(apply: RuntimeExtractionApplyApi): WhatsAppAiRuntimePatch {
  return {
    lastExtractionApplyStatus: apply.extractionApplyStatus,
    lastExtractionApplyReason: apply.extractionApplyReason,
    lastExtractionAppliedFields: apply.extractionAppliedFields.length ? apply.extractionAppliedFields : null,
    lastExtractionAppliedLabels: apply.extractionAppliedLabels.length ? apply.extractionAppliedLabels : null,
    lastExtractionAppliedFieldCount: apply.extractionAppliedFieldCount,
    lastExtractionAppliedClientId: apply.appliedClientId,
    lastExtractionAppliedAt: apply.appliedAt
  };
}

function mergeListItemAiRuntime(
  item: ConversationListItem,
  patch: WhatsAppAiRuntimePatch
): ConversationListItem {
  const cur = item.aiRuntime ?? defaultWhatsAppAiRuntime();
  const next: WhatsAppAiRuntime = {
    ...cur,
    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    ...(patch.botId !== undefined ? { botId: patch.botId } : {}),
    ...(patch.mode !== undefined ? { mode: patch.mode } : {}),
    ...(patch.lastStatus !== undefined ? { lastStatus: patch.lastStatus } : {}),
    ...(patch.lastReason !== undefined ? { lastReason: patch.lastReason } : {}),
    ...(patch.lastGeneratedReply !== undefined ? { lastGeneratedReply: patch.lastGeneratedReply } : {}),
    ...(patch.lastProcessedIncomingMessageId !== undefined
      ? { lastProcessedIncomingMessageId: patch.lastProcessedIncomingMessageId }
      : {}),
    ...(patch.lastExtractionJson !== undefined ? { lastExtractionJson: patch.lastExtractionJson } : {}),
    ...(patch.lastExtractionApplyStatus !== undefined
      ? { lastExtractionApplyStatus: patch.lastExtractionApplyStatus }
      : {}),
    ...(patch.lastExtractionApplyReason !== undefined
      ? { lastExtractionApplyReason: patch.lastExtractionApplyReason }
      : {}),
    ...(patch.lastExtractionAppliedFields !== undefined
      ? { lastExtractionAppliedFields: patch.lastExtractionAppliedFields }
      : {}),
    ...(patch.lastExtractionAppliedLabels !== undefined
      ? { lastExtractionAppliedLabels: patch.lastExtractionAppliedLabels }
      : {}),
    ...(patch.lastExtractionAppliedFieldCount !== undefined
      ? { lastExtractionAppliedFieldCount: patch.lastExtractionAppliedFieldCount }
      : {}),
    ...(patch.lastExtractionAppliedClientId !== undefined
      ? { lastExtractionAppliedClientId: patch.lastExtractionAppliedClientId }
      : {}),
    ...(patch.lastExtractionAppliedAt !== undefined
      ? { lastExtractionAppliedAt: patch.lastExtractionAppliedAt }
      : {}),
    ...(patch.dealRecommendation !== undefined ? { dealRecommendation: patch.dealRecommendation } : {}),
    ...(patch.dealFromAi !== undefined ? { dealFromAi: patch.dealFromAi } : {}),
    ...(patch.taskRecommendation !== undefined ? { taskRecommendation: patch.taskRecommendation } : {}),
    ...(patch.taskFromAi !== undefined ? { taskFromAi: patch.taskFromAi } : {}),
    ...(patch.lastTaskCreateStatus !== undefined ? { lastTaskCreateStatus: patch.lastTaskCreateStatus } : {}),
    ...(patch.lastTaskCreateReason !== undefined ? { lastTaskCreateReason: patch.lastTaskCreateReason } : {}),
    ...(patch.lastTaskCreateAt !== undefined ? { lastTaskCreateAt: patch.lastTaskCreateAt } : {})
  };
  return { ...item, aiRuntime: next };
}

/** Тело для Wazzup: WhatsApp — chatId = нормализованный номер; Instagram — сырой chatId + chatType. */
function wazzupSendBody(phone: string, rest: Record<string, unknown>): Record<string, unknown> {
  const ig = phone.startsWith('instagram:');
  return {
    chatId: ig ? phone.slice('instagram:'.length) : normalizePhone(phone),
    ...(ig ? { chatType: 'instagram' as const } : {}),
    ...rest
  };
}

/** Преобразует литеральные \n в переносы строк перед отправкой в WhatsApp. */
function formatMessageForWhatsApp(message: string): string {
  if (typeof message !== 'string') return '';
  return message
    .replace(/\\n/g, '\n')
    .replace(/\n\n+/g, '\n\n')
    .trim();
}

const MOBILE_BREAKPOINT = 768;
const WIDE_LAYOUT_BREAKPOINT = 1200;

/** Resizable панели (только desktop): min/max в px */
const LEFT_PANEL_MIN = 260;
const LEFT_PANEL_MAX = 500;
const LEFT_PANEL_DEFAULT = 300;
const RIGHT_PANEL_MIN = 280;
const RIGHT_PANEL_MAX = 480;
const RIGHT_PANEL_DEFAULT = 320;
const CENTER_MIN_WIDTH = 400;

const STORAGE_LEFT = 'whatsapp_chat_left_panel_width';
const STORAGE_RIGHT = 'whatsapp_chat_right_panel_width';

function readStoredWidth(key: string, defaultVal: number, min: number, max: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v == null) return defaultVal;
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) return defaultVal;
    return Math.max(min, Math.min(max, n));
  } catch {
    return defaultVal;
  }
}

function saveWidth(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}

const WhatsAppChat: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const chatIdFromUrl = searchParams.get('chatId');
  const draftFromUrl = searchParams.get('draftText');

  const isMobile = useIsMobile(MOBILE_BREAKPOINT);
  const isWideLayout = !useIsMobile(WIDE_LAYOUT_BREAKPOINT);
  const layoutContainerRef = useRef<HTMLDivElement>(null);

  const [leftPanelWidth, setLeftPanelWidth] = useState(() =>
    readStoredWidth(STORAGE_LEFT, LEFT_PANEL_DEFAULT, LEFT_PANEL_MIN, LEFT_PANEL_MAX)
  );
  const [rightPanelWidth, setRightPanelWidth] = useState(() =>
    readStoredWidth(STORAGE_RIGHT, RIGHT_PANEL_DEFAULT, RIGHT_PANEL_MIN, RIGHT_PANEL_MAX)
  );

  const leftWidthRef = useRef(leftPanelWidth);
  const rightWidthRef = useRef(rightPanelWidth);
  useEffect(() => {
    leftWidthRef.current = leftPanelWidth;
  }, [leftPanelWidth]);
  useEffect(() => {
    rightWidthRef.current = rightPanelWidth;
  }, [rightPanelWidth]);

  const handleLeftPanelResize = useCallback((deltaPx: number) => {
    const container = layoutContainerRef.current?.offsetWidth ?? 1200;
    const right = isWideLayout ? rightWidthRef.current : 0;
    const maxLeft = Math.min(LEFT_PANEL_MAX, container - right - CENTER_MIN_WIDTH);
    setLeftPanelWidth((prev) => {
      const next = Math.max(LEFT_PANEL_MIN, Math.min(maxLeft, prev + deltaPx));
      saveWidth(STORAGE_LEFT, next);
      return next;
    });
  }, [isWideLayout]);

  const handleRightPanelResize = useCallback((deltaPx: number) => {
    const container = layoutContainerRef.current?.offsetWidth ?? 1200;
    const left = leftWidthRef.current;
    const maxRight = Math.min(RIGHT_PANEL_MAX, container - left - CENTER_MIN_WIDTH);
    setRightPanelWidth((prev) => {
      const next = Math.max(RIGHT_PANEL_MIN, Math.min(maxRight, prev - deltaPx));
      saveWidth(STORAGE_RIGHT, next);
      return next;
    });
  }, []);

  const { isAdmin, user } = useAuth();
  const companyId = useCompanyId();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [indexBuilding, setIndexBuilding] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{ file: File; preview?: string } | null>(null);
  /** Файлы из быстрого ответа: отправляются по нажатию «Отправить» вместе с текстом из поля */
  const [pendingQuickReplyFiles, setPendingQuickReplyFiles] = useState<
    Array<{ id: string; url: string; name: string; type: string }> | null
  >(null);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'sending'>('idle');
  const [sendError, setSendError] = useState<string | null>(null);
  const [mediaPreparing, setMediaPreparing] = useState(false);
  type ChatFilter = 'all' | 'waiting' | 'unread';
  const [activeFilter, setActiveFilter] = useState<ChatFilter>('all');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  /** Свайп вверх — запись без удержания (как в WhatsApp) */
  const [voiceRecordingLocked, setVoiceRecordingLocked] = useState(false);
  const voiceRecordingLockedRef = useRef(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const voiceRecorderRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const voiceReleaseRef = useRef<(() => void) | null>(null);
  const voiceCancelledRef = useRef(false);

  const prevConversationsRef = useRef<ConversationListItem[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;
  const selectedItemRef = useRef<ConversationListItem | undefined>(undefined);
  /** AI-бот: ID последнего обработанного входящего (чтобы не отвечать дважды). */
  const aiBotLastProcessedMessageIdRef = useRef<string | null>(null);
  const aiBotLeadContextRef = useRef<AiBotLeadContext | null>(null);
  const aiBotApplyFactsRef = useRef<((facts: { city?: string | null; area_m2?: number | null; floors?: number | null }) => void) | null>(null);
  const aiBotProcessingRef = useRef(false);
  /** Автоворонки → WhatsApp runtime */
  const crmAiRuntimeProcessingRef = useRef(false);
  const crmAiRuntimeLastProcessedRef = useRef<string | null>(null);
  /** Актуальные сообщения для AI flush (батчинг / stale после await). */
  const whatsappMessagesForAiRef = useRef<WhatsAppMessage[]>([]);
  const legacyAiDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const legacyAiStaleGenerationRef = useRef(0);
  const crmAiDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const crmAiStaleGenerationRef = useRef(0);
  const inputTextRef = useRef('');
  inputTextRef.current = inputText;
  /**
   * Последний текст поля ввода, подставленный как «чистый» CRM AI draft (replace).
   * Если trim(value) !== baseline — считаем, что менеджер правил вручную, автозамена новым ответом не делается.
   */
  const lastAiDraftBaselineRef = useRef<string | null>(null);

  /** Имена CRM-клиентов по нормализованному телефону (для отображения в списке и в шапке чата). */
  const [crmNamesByPhone, setCrmNamesByPhone] = useState<Map<string, string>>(() => new Map());
  /** Города клиентов по нормализованному телефону (для фильтра и отображения). */
  const [cityByPhone, setCityByPhone] = useState<Map<string, string>>(() => new Map());
  /** Справочник городов компании (для блока «Город» и фильтра). */
  const [companyCitiesList, setCompanyCitiesList] = useState<string[]>([]);
  /** Поиск по имени клиента, номеру и превью сообщения */
  const [searchQuery, setSearchQuery] = useState('');
  /** Моб.: раскрытая панель поиска в шапке (как Feed), без отдельной строки в списке */
  const [mobileChatSearchOpen, setMobileChatSearchOpen] = useState(false);
  const [searchQueryDebounced, setSearchQueryDebounced] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => setSearchQueryDebounced(searchQuery), 300);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  const [searchChats, setSearchChats] = useState<ConversationListItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchActive = searchQueryDebounced.trim().length > 0;
  const searchQueryDebouncedRef = useRef('');
  searchQueryDebouncedRef.current = searchQueryDebounced.trim();

  /** Ответ GET /api/chats/search → элементы списка чатов */
  const parseChatsSearchApi = useCallback((rows: unknown[]): ConversationListItem[] => {
    return rows.map((row) => {
      const r = row as Record<string, unknown>;
      const lastMsg = r.lastMessage as Record<string, unknown> | null | undefined;
      const cl = r.client as Record<string, unknown> | null | undefined;
      return {
        id: String(r.id),
        clientId: String(r.clientId ?? ''),
        phone: String(r.phone ?? ''),
        channel: (r.channel as ConversationListItem['channel']) ?? 'whatsapp',
        client: cl
          ? {
              id: String(cl.id ?? ''),
              name: String(cl.name ?? ''),
              phone: String(cl.phone ?? ''),
              avatarUrl: (cl.avatarUrl as string | null) ?? null,
              createdAt: cl.createdAt ?? new Date().toISOString()
            }
          : null,
        lastMessage: lastMsg
          ? {
              id: String(lastMsg.id),
              conversationId: String(lastMsg.conversationId ?? r.id),
              text: String(lastMsg.text ?? ''),
              direction: (lastMsg.direction as 'incoming' | 'outgoing') ?? 'incoming',
              createdAt: (typeof lastMsg.createdAt === 'string'
                ? lastMsg.createdAt
                : new Date()) as ConversationListItem['lastMessage'] extends infer M
                ? M extends { createdAt: infer A }
                  ? A
                  : never
                : never,
              channel: (lastMsg.channel as 'whatsapp' | 'instagram') ?? 'whatsapp',
              attachments: Array.isArray(lastMsg.attachments)
                ? (lastMsg.attachments as ConversationListItem['lastMessage'] extends { attachments?: infer A } ? A : never)
                : undefined
            }
          : null,
        lastMessageAt: r.lastMessageAt as ConversationListItem['lastMessageAt'],
        lastIncomingAt: r.lastIncomingAt as ConversationListItem['lastIncomingAt'],
        lastOutgoingAt: r.lastOutgoingAt as ConversationListItem['lastOutgoingAt'],
        awaitingReplyDismissedAt: r.awaitingReplyDismissedAt as ConversationListItem['awaitingReplyDismissedAt'],
        unreadCount: Number(r.unreadCount ?? 0),
        dealId: (r.dealId as string) ?? null,
        dealStageId: (r.dealStageId as string) ?? null,
        dealStageName: (r.dealStageName as string) ?? null,
        dealStageColor: (r.dealStageColor as string) ?? null,
        dealTitle: (r.dealTitle as string) ?? null,
        dealResponsibleName: (r.dealResponsibleName as string) ?? null,
        aiRuntime: parseWhatsAppAiRuntime(r as Record<string, unknown>),
        aiBotEnabled: r.aiBotEnabled === true,
        aiBotAutoProposalEnabled: r.aiBotAutoProposalEnabled === true
      } as ConversationListItem;
    });
  }, []);

  const localSearchChats = useCallback((list: ConversationListItem[], qRaw: string): ConversationListItem[] => {
    const q = qRaw.trim().toLowerCase();
    if (!q) return [];
    return list.filter((item) => {
      const att0 = item.lastMessage?.attachments?.[0];
      const preview =
        item.lastMessage?.attachments?.length && att0
          ? att0.type === 'voice' || isVoiceNoteAttachment(att0)
            ? (() => {
                const d = formatVoiceListDuration(att0.durationSeconds);
                return d ? `Голосовое сообщение · ${d}` : 'Голосовое сообщение';
              })()
            : '[медиа]'
          : (item.lastMessage?.text ?? '').slice(0, 200);
      const name = (item.client?.name ?? '').toLowerCase();
      const phone = (item.phone ?? item.client?.phone ?? '').toLowerCase();
      const searchable = [name, phone, preview].join(' ').toLowerCase();
      return searchable.includes(q);
    });
  }, []);

  const conversationsForSearchRef = useRef(conversations);
  conversationsForSearchRef.current = conversations;

  /** Серверный поиск при VITE_CHATS_SEARCH_API=true (сборка). Иначе — только по загруженным чатам. */
  const useChatsSearchApi = import.meta.env.VITE_CHATS_SEARCH_API === 'true';

  useEffect(() => {
    if (!companyId || !searchActive) {
      setSearchChats([]);
      setSearchLoading(false);
      return;
    }
    const q = searchQueryDebounced.trim();
    if (!useChatsSearchApi) {
      setSearchLoading(true);
      const found = localSearchChats(conversationsForSearchRef.current, q);
      setSearchChats(found);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    (async () => {
      try {
        const token = await getAuthToken();
        if (!token) {
          if (cancelled) return;
          const found = localSearchChats(conversationsForSearchRef.current, q);
          setSearchChats(found);
          return;
        }
        const res = await fetch('/api/chats-search', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: q,
            companyId: companyId ?? undefined
          })
        });
        const text = await res.text();
        const isHtml = /^\s*</i.test(text) && /doctype|html/i.test(text.slice(0, 200));
        const useLocal =
          res.status === 404 ||
          res.status === 405 ||
          isHtml ||
          (res.status >= 500 && res.status < 600);

        if (useLocal) {
          if (cancelled) return;
          const found = localSearchChats(conversationsForSearchRef.current, q);
          setSearchChats(found);
          toast(
            found.length
              ? `Найдено среди загруженных: ${found.length}. Прокрутите список или включите VITE_CHATS_SEARCH_API на Netlify.`
              : 'Поиск по загруженным чатам. Прокрутите список вниз.',
            { duration: 3500, icon: 'ℹ️' }
          );
          return;
        }

        let data: { chats?: unknown[]; error?: string };
        try {
          data = JSON.parse(text) as { chats?: unknown[]; error?: string };
        } catch {
          throw new Error('Некорректный ответ сервера при поиске');
        }
        if (!res.ok) {
          throw new Error(data.error || res.statusText);
        }
        if (cancelled) return;
        setSearchChats(parseChatsSearchApi(data.chats ?? []));
      } catch (e) {
        if (!cancelled) {
          console.error('[WhatsApp] chats search', e);
          const found = localSearchChats(conversationsForSearchRef.current, q);
          setSearchChats(found);
          if (found.length === 0) {
            showErrorNotification(e instanceof Error ? e.message : 'Ошибка поиска');
          } else {
            toast('Показаны совпадения среди загруженных чатов.', { duration: 3500, icon: 'ℹ️' });
          }
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    companyId,
    searchActive,
    searchQueryDebounced,
    parseChatsSearchApi,
    localSearchChats,
    useChatsSearchApi
  ]);
  /** Режим выбора сообщений и действия над ними */
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [replyToMessage, setReplyToMessage] = useState<WhatsAppMessage | null>(null);
  const [contextMenu, setContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  const [actionsSheetMessageId, setActionsSheetMessageId] = useState<string | null>(null);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [forwardLoading, setForwardLoading] = useState(false);
  const [mobileClientSheetOpen, setMobileClientSheetOpen] = useState(false);
  /** Идёт массовая расшифровка из кнопки «Расшифровать всё» — дизейблить «Проанализировать чат» */
  const [batchTranscribeRunning, setBatchTranscribeRunning] = useState(false);
  /** Идёт подготовка к анализу (расшифровка перед «Проанализировать чат») — дизейблить «Расшифровать всё» */
  const [prepareForAnalysisRunning, setPrepareForAnalysisRunning] = useState(false);
  /** Позиция bottom sheet карточки клиента: peek = 60% экрана, open = полностью */
  const [clientSheetPosition, setClientSheetPosition] = useState<'peek' | 'open'>('peek');
  const clientSheetTouchStartY = useRef<number>(0);
  const clientSheetDragStartPosition = useRef<'peek' | 'open'>('peek');
  /** Высота области чата на мобильном (visualViewport) — чтобы шапка и инпут не пропадали при открытой клавиатуре */
  const [chatPageHeight, setChatPageHeight] = useState<number>(() =>
    typeof window !== 'undefined' ? (window.visualViewport?.height ?? window.innerHeight) : 600
  );
  const chatPageRef = useRef<HTMLDivElement>(null);
  const [knowledgeBase, setKnowledgeBase] = useState<
    Array<{ id: string; title: string; content: string; category: string }>
  >([]);
  const [quickReplies, setQuickReplies] = useState<
    Array<{
      id: string;
      title: string;
      text: string;
      keywords: string;
      category: string;
      files?: Array<{ id: string; url: string; name: string; type: string; size?: number }>;
      attachmentUrl?: string;
      attachmentType?: 'image' | 'video' | 'file' | 'audio';
      attachmentFileName?: string;
    }>
  >([]);
  const [mediaQuickReplies, setMediaQuickReplies] = useState<MediaQuickReply[]>([]);
  type SimpleDealStatus = { id: string; name: string; color: string; order: number; isDefault?: boolean };
  type SimpleManager = { id: string; name: string; color: string; order: number };
  const [dealStatuses, setDealStatuses] = useState<SimpleDealStatus[]>([]);
  const [dealStatusByPhone, setDealStatusByPhone] = useState<Map<string, string>>(() => new Map());
  const [dealStatusFilter, setDealStatusFilter] = useState<'all' | string>('all');
  const [managers, setManagers] = useState<SimpleManager[]>([]);
  const [managerByPhone, setManagerByPhone] = useState<Map<string, string>>(() => new Map());
  const [managerFilter, setManagerFilter] = useState<'all' | 'none' | string>('all');
  const [cityFilter, setCityFilter] = useState<'all' | 'none' | string>('all');
  const overlayRef = useRef(false);

  const selectionMode = selectedMessageIds.length > 0;
  overlayRef.current = selectionMode || !!contextMenu || !!reactionPickerMessageId || !!actionsSheetMessageId || forwardDialogOpen;

  // Часы в шапке (HH:MM), обновление раз в минуту
  const [clockTime, setClockTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      );
    };
    const t = setInterval(updateClock, 60000);
    return () => clearInterval(t);
  }, []);

  // Режим «Инкогнито»: просмотр без отметки о прочтении и без отправки
  const [incognitoMode, setIncognitoMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('whatsappIncognito') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (incognitoMode) {
        window.localStorage.setItem('whatsappIncognito', '1');
      } else {
        window.localStorage.removeItem('whatsappIncognito');
      }
    } catch {
      // ignore storage errors
    }
  }, [incognitoMode]);

  type ConversationMenuState = { id: string; x: number; y: number; source: 'desktop' | 'mobile' } | null;
  const [conversationMenu, setConversationMenu] = useState<ConversationMenuState>(null);
  const [deleteClientConversationId, setDeleteClientConversationId] = useState<string | null>(null);
  const [deleteClientLoading, setDeleteClientLoading] = useState(false);

  // Закрытие контекстного меню по ESC
  useEffect(() => {
    if (!conversationMenu) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConversationMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [conversationMenu]);

  const mobileChatContext = useMobileWhatsAppChat();
  const { toggle: toggleMobileSidebar } = useMobileSidebar();
  /** Чат, открытый из поиска / не на первой странице ленты. */
  const [stickySelectedChat, setStickySelectedChat] = useState<ConversationListItem | null>(null);

  // При открытии карточки клиента на mobile — начальная позиция 60% (peek)
  useEffect(() => {
    if (mobileClientSheetOpen) setClientSheetPosition('peek');
  }, [mobileClientSheetOpen]);

  // Мобильный чат: высота секции по visualViewport (при открытой клавиатуре шапка и инпут остаются на месте)
  useEffect(() => {
    if (!isMobile) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const updateHeight = () => setChatPageHeight(vv.height);
    updateHeight();
    vv.addEventListener('resize', updateHeight);
    vv.addEventListener('scroll', updateHeight);
    return () => {
      vv.removeEventListener('resize', updateHeight);
      vv.removeEventListener('scroll', updateHeight);
    };
  }, [isMobile]);

  // Синхронизация с контекстом: на mobile при открытом чате скрываем плавающие кнопки
  useEffect(() => {
    if (!mobileChatContext) return;
    const open = isMobile && !!selectedId;
    mobileChatContext.setMobileWhatsAppChatOpen(open);
    return () => mobileChatContext.setMobileWhatsAppChatOpen(false);
  }, [isMobile, selectedId, mobileChatContext]);

  // Мобильный чат: блокируем прокрутку body (убираем белую область и overscroll)
  useEffect(() => {
    if (!isMobile || !selectedId) return;
    document.body.classList.add('whatsapp-chat-mobile-open');
    return () => document.body.classList.remove('whatsapp-chat-mobile-open');
  }, [isMobile, selectedId]);

  // Mobile: кнопка «Назад» — сначала закрываем selection/меню/диалог, потом чат
  useEffect(() => {
    if (!isMobile) return;
    const handlePopState = () => {
      if (overlayRef.current) {
        setSelectedMessageIds([]);
        setContextMenu(null);
        setReactionPickerMessageId(null);
        setActionsSheetMessageId(null);
        setForwardDialogOpen(false);
        window.history.pushState({ whatsappChat: true }, '');
      } else if (selectedIdRef.current) {
        setSelectedId(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isMobile]);

  // При открытии чата на mobile добавляем history state, чтобы Back сначала закрыл чат
  useEffect(() => {
    if (isMobile && selectedId) {
      window.history.pushState({ whatsappChat: true }, '');
    }
  }, [isMobile, selectedId]);

  const setConversationsWithNotification = useCallback((newItems: ConversationListItem[]) => {
    const prev = prevConversationsRef.current;
    const selected = selectedIdRef.current;
    const prevTime = (it: ConversationListItem | undefined) => {
      const t = it?.lastMessageAt ?? it?.lastMessage?.createdAt;
      if (!t) return 0;
      if (typeof (t as { toMillis?: () => number }).toMillis === 'function') {
        return (t as { toMillis: () => number }).toMillis();
      }
      if (typeof t === 'object' && t !== null && 'seconds' in (t as object)) {
        return ((t as { seconds: number }).seconds ?? 0) * 1000;
      }
      if (t instanceof Date) return t.getTime();
      return 0;
    };
    for (const item of newItems) {
      if (item.id === selected) continue;
      if (item.lastMessage?.direction !== 'incoming') continue;
      const prevItem = prev.find((p) => p.id === item.id);
      const prevT = prevTime(prevItem);
      const newT = prevTime(item);
      if (newT > prevT && newT > 0) {
        playNewMessageSound();
        if (document.visibilityState !== 'visible') {
          showNewMessageBrowserNotification();
        }
        break;
      }
    }
    prevConversationsRef.current = newItems;
    setConversations(newItems);
    try {
      if (companyId && !selectedIdRef.current && searchQueryDebouncedRef.current === '') {
        sessionStorage.setItem(
          `whatsapp_list_${companyId}`,
          JSON.stringify({ t: Date.now(), items: newItems })
        );
      }
    } catch {
      /* ignore quota */
    }
  }, [companyId]);

  const [aiBotFlagsSaving, setAiBotFlagsSaving] = useState(false);
  const [crmAiBots, setCrmAiBots] = useState<CrmAiBot[]>([]);
  const [aiRuntimeSaving, setAiRuntimeSaving] = useState(false);
  const [creatingAiDealFromRec, setCreatingAiDealFromRec] = useState(false);
  const [creatingAiTaskFromRec, setCreatingAiTaskFromRec] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setCrmAiBots([]);
      return;
    }
    return subscribeCrmAiBots(companyId, setCrmAiBots);
  }, [companyId]);

  /** Смена флагов AI-бота: оптимистичное обновление UI, запись в Firestore, откат при ошибке. */
  const handleAiBotFlagsChange = useCallback(
    (flags: { aiBotEnabled?: boolean; aiBotAutoProposalEnabled?: boolean }) => {
      if (!selectedId) return;
      const item = selectedItemRef.current;
      const prevEnabled = item?.aiBotEnabled ?? false;
      const prevAutoProposal = item?.aiBotAutoProposalEnabled ?? false;
      const mergeFlags = (c: ConversationListItem) =>
        c.id !== selectedId
          ? c
          : {
              ...c,
              aiBotEnabled: flags.aiBotEnabled !== undefined ? flags.aiBotEnabled : c.aiBotEnabled,
              aiBotAutoProposalEnabled:
                flags.aiBotAutoProposalEnabled !== undefined ? flags.aiBotAutoProposalEnabled : c.aiBotAutoProposalEnabled
            };
      setConversations((prev) => prev.map(mergeFlags));
      setSearchChats((prev) => prev.map(mergeFlags));
      if (stickySelectedChat?.id === selectedId)
        setStickySelectedChat((prev) =>
          prev ? mergeFlags(prev) : null
        );
      setAiBotFlagsSaving(true);
      updateConversationAiBotFlags(selectedId, flags)
        .then(() => {
          toast.success(flags.aiBotEnabled ? 'AI-бот включён' : 'AI-бот выключен');
        })
        .catch((err) => {
          const revert = (c: ConversationListItem) =>
            c.id !== selectedId ? c : { ...c, aiBotEnabled: prevEnabled, aiBotAutoProposalEnabled: prevAutoProposal };
          setConversations((prev) => prev.map(revert));
          setSearchChats((prev) => prev.map(revert));
          if (stickySelectedChat?.id === selectedId)
            setStickySelectedChat((prev) => (prev ? revert(prev) : null));
          toast.error(err instanceof Error ? err.message : 'Не удалось изменить состояние AI-бота');
        })
        .finally(() => setAiBotFlagsSaving(false));
    },
    [selectedId, stickySelectedChat?.id]
  );

  const handleAiRuntimePatch = useCallback(
    (patch: WhatsAppAiRuntimePatch) => {
      if (!selectedId) return;
      const item = selectedItemRef.current;
      const prevRuntime = item?.aiRuntime ?? defaultWhatsAppAiRuntime();
      const mergeConv = (c: ConversationListItem) =>
        c.id !== selectedId ? c : mergeListItemAiRuntime(c, patch);
      setConversations((prev) => prev.map(mergeConv));
      setSearchChats((prev) => prev.map(mergeConv));
      if (stickySelectedChat?.id === selectedId) {
        setStickySelectedChat((prev) => (prev ? mergeListItemAiRuntime(prev, patch) : null));
      }
      setAiRuntimeSaving(true);
      updateWhatsAppConversationAiRuntime(
        selectedId,
        patch,
        companyId ? { ensureCompanyId: companyId } : undefined
      )
        .then(() => {
          toast.success('Настройки AI сохранены');
        })
        .catch((err) => {
          const revertPatch: WhatsAppAiRuntimePatch = {
            enabled: prevRuntime.enabled,
            botId: prevRuntime.botId,
            mode: prevRuntime.mode,
            lastStatus: prevRuntime.lastStatus,
            lastReason: prevRuntime.lastReason,
            lastGeneratedReply: prevRuntime.lastGeneratedReply,
            lastProcessedIncomingMessageId: prevRuntime.lastProcessedIncomingMessageId,
            lastExtractionJson: prevRuntime.lastExtractionJson,
            lastExtractionApplyStatus: prevRuntime.lastExtractionApplyStatus,
            lastExtractionApplyReason: prevRuntime.lastExtractionApplyReason,
            lastExtractionAppliedFields: prevRuntime.lastExtractionAppliedFields,
            lastExtractionAppliedLabels: prevRuntime.lastExtractionAppliedLabels,
            lastExtractionAppliedFieldCount: prevRuntime.lastExtractionAppliedFieldCount,
            lastExtractionAppliedClientId: prevRuntime.lastExtractionAppliedClientId,
            lastExtractionAppliedAt: prevRuntime.lastExtractionAppliedAt,
            dealRecommendation: prevRuntime.dealRecommendation,
            dealFromAi: prevRuntime.dealFromAi,
            taskRecommendation: prevRuntime.taskRecommendation,
            taskFromAi: prevRuntime.taskFromAi,
            lastTaskCreateStatus: prevRuntime.lastTaskCreateStatus,
            lastTaskCreateReason: prevRuntime.lastTaskCreateReason,
            lastTaskCreateAt: prevRuntime.lastTaskCreateAt
          };
          const revert = (c: ConversationListItem) =>
            c.id !== selectedId ? c : mergeListItemAiRuntime(c, revertPatch);
          setConversations((prev) => prev.map(revert));
          setSearchChats((prev) => prev.map(revert));
          if (stickySelectedChat?.id === selectedId) {
            setStickySelectedChat((prev) => (prev ? revert(prev) : null));
          }
          toast.error(err instanceof Error ? err.message : 'Не удалось сохранить AI');
        })
        .finally(() => setAiRuntimeSaving(false));
    },
    [selectedId, stickySelectedChat?.id, companyId]
  );

  const handleCreateDealFromAiRecommendation = useCallback(async () => {
    if (!selectedId) return;
    const dr = selectedItemRef.current?.aiRuntime?.dealRecommendation;
    if (!dr || dr.status !== 'recommended' || !dr.payloadHash) {
      toast.error('Нет активной рекомендации сделки');
      return;
    }
    setCreatingAiDealFromRec(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error('Нет авторизации');
        return;
      }
      const res = await fetch(CRM_CREATE_DEAL_FROM_REC_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId: selectedId, payloadHash: dr.payloadHash })
      });
      const body = (await res.json().catch(() => ({}))) as CreateDealFromRecommendationApi;
      if (!res.ok || !body.ok) {
        const msg =
          typeof body.error === 'string' && body.error.trim()
            ? body.error
            : `Не удалось создать сделку (HTTP ${res.status})`;
        toast.error(msg);
        return;
      }
      toast.success('Сделка создана');
      const mergeDeal = (c: ConversationListItem) => {
        if (c.id !== selectedId) return c;
        const base = c.aiRuntime ?? defaultWhatsAppAiRuntime();
        return {
          ...c,
          dealId: body.dealId ?? c.dealId,
          dealTitle: body.dealTitle ?? c.dealTitle,
          dealStageId: body.stageId ?? c.dealStageId,
          dealStageName: body.stageName ?? c.dealStageName,
          aiRuntime: {
            ...base,
            dealFromAi: {
              createdDealId: body.dealId ?? null,
              createdDealTitle: body.dealTitle ?? null,
              createdDealAt: new Date().toISOString(),
              createdFromPayloadHash: dr.payloadHash,
              finalPipelineId: body.pipelineId ?? null,
              finalPipelineName: body.pipelineName ?? null,
              finalStageId: body.stageId ?? null,
              finalStageName: body.stageName ?? null,
              finalAssigneeId: body.assigneeId ?? null,
              finalAssigneeName: body.assigneeName ?? null,
              createUsedFallbacks: Array.isArray(body.usedFallbacks) ? body.usedFallbacks : null
            }
          }
        };
      };
      setConversations((prev) => prev.map(mergeDeal));
      setSearchChats((prev) => prev.map(mergeDeal));
      if (stickySelectedChat?.id === selectedId) {
        setStickySelectedChat((prev) => (prev ? mergeDeal(prev) : null));
      }
    } finally {
      setCreatingAiDealFromRec(false);
    }
  }, [selectedId, stickySelectedChat?.id]);

  const handleCreateTaskFromAiRecommendation = useCallback(async () => {
    if (!selectedId) return;
    const tr = selectedItemRef.current?.aiRuntime?.taskRecommendation;
    if (!tr || !tr.payloadHash) {
      toast.error('Нет рекомендации следующего шага');
      return;
    }
    if (!tr.canCreateTask) {
      toast.error('Создание задачи по этой рекомендации недоступно');
      return;
    }
    setCreatingAiTaskFromRec(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error('Нет авторизации');
        return;
      }
      const res = await fetch(CRM_CREATE_TASK_FROM_REC_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId: selectedId, taskPayloadHash: tr.payloadHash })
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        code?: string;
        dealId?: string;
        taskId?: string;
        nextActionAt?: string | null;
        usedFallbacks?: string[];
        finalResponsibleUserId?: string | null;
        finalResponsibleNameSnapshot?: string | null;
      };
      if (!res.ok || !body.ok) {
        const msg =
          typeof body.error === 'string' && body.error.trim()
            ? body.error
            : body.code === 'duplicate'
              ? 'Задача по этой рекомендации уже создана'
              : `Не удалось создать задачу (HTTP ${res.status}). Сохраните рекомендацию: дождитесь ответа AI в чате или обновите страницу.`;
        toast.error(msg);
        return;
      }
      toast.success('Следующий шаг записан в сделку');
      const appliedIso = new Date().toISOString();
      const mergeTask = (c: ConversationListItem) => {
        if (c.id !== selectedId) return c;
        const base = c.aiRuntime ?? defaultWhatsAppAiRuntime();
        return {
          ...c,
          aiRuntime: {
            ...base,
            taskFromAi: {
              appliedAt: appliedIso,
              createdFromPayloadHash: tr.payloadHash,
              dealId: body.dealId ?? '',
              taskId: body.taskId ?? body.dealId ?? '',
              finalResponsibleUserId: body.finalResponsibleUserId ?? tr.suggestedResponsibleUserId ?? null,
              finalResponsibleNameSnapshot:
                body.finalResponsibleNameSnapshot ?? tr.suggestedResponsibleNameSnapshot ?? null,
              finalNextActionAt: body.nextActionAt ?? null,
              dueHintStored: base.taskRecommendation?.dueHint ?? null,
              createUsedFallbacks: Array.isArray(body.usedFallbacks) ? body.usedFallbacks : null,
              recommendedTaskType: base.taskRecommendation?.recommendedTaskType ?? null,
              aiBotId: base.taskRecommendation?.createdFromBotId ?? null,
              whatsappConversationId: selectedId
            },
            lastTaskCreateStatus: 'created',
            lastTaskCreateReason: null,
            lastTaskCreateAt: appliedIso
          }
        };
      };
      setConversations((prev) => prev.map(mergeTask));
      setSearchChats((prev) => prev.map(mergeTask));
      if (stickySelectedChat?.id === selectedId) {
        setStickySelectedChat((prev) => (prev ? mergeTask(prev) : null));
      }
      await updateWhatsAppConversationAiRuntime(
        selectedId,
        {
          taskFromAi: {
            appliedAt: appliedIso,
            createdFromPayloadHash: tr.payloadHash,
            dealId: body.dealId ?? '',
            taskId: body.taskId ?? body.dealId ?? '',
            finalResponsibleUserId: body.finalResponsibleUserId ?? tr.suggestedResponsibleUserId ?? null,
            finalResponsibleNameSnapshot:
              body.finalResponsibleNameSnapshot ?? tr.suggestedResponsibleNameSnapshot ?? null,
            finalNextActionAt: body.nextActionAt ?? null,
            dueHintStored: tr.dueHint,
            createUsedFallbacks: Array.isArray(body.usedFallbacks) ? body.usedFallbacks : null,
            recommendedTaskType: tr.recommendedTaskType,
            aiBotId: tr.createdFromBotId,
            whatsappConversationId: selectedId
          },
          lastTaskCreateStatus: 'created',
          lastTaskCreateReason: null,
          lastTaskCreateAt: appliedIso
        },
        companyId ? { ensureCompanyId: companyId } : undefined
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setCreatingAiTaskFromRec(false);
    }
  }, [selectedId, stickySelectedChat?.id, companyId]);

  /** Оптимистичное обновление: после отправки сообщения сразу поднимаем чат в списке по lastMessageAt. */
  const moveConversationToTopByActivity = useCallback((conversationId: string) => {
    setConversations((prev) => {
      const now = new Date();
      const next = prev.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              lastMessageAt: now,
              lastOutgoingAt: now,
              lastMessageSender: 'manager' as const,
              lastMessage: c.lastMessage
                ? { ...c.lastMessage, createdAt: now, direction: 'outgoing' as const }
                : {
                    id: `${c.id}:preview`,
                    conversationId: c.id,
                    text: (c.lastMessagePreview ?? '').slice(0, 200),
                    direction: 'outgoing' as const,
                    createdAt: now,
                    channel: (c.channel === 'instagram' ? 'instagram' : 'whatsapp') as 'whatsapp' | 'instagram',
                    attachments: undefined
                  }
            }
          : c
      );
      sortConversationItems(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const loadMoreConversationsRef = useRef<(() => Promise<void>) | null>(null);
  const conversationsSubRef = useRef<SubscribeConversationsResult | null>(null);
  const [conversationsLoadingMore, setConversationsLoadingMore] = useState(false);
  const [conversationsHasMore, setConversationsHasMore] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setConversations([]);
      loadMoreConversationsRef.current = null;
      conversationsSubRef.current = null;
      return;
    }
    try {
      const raw = sessionStorage.getItem(`whatsapp_list_${companyId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { t?: number; items?: ConversationListItem[] };
        if (parsed?.items?.length && Date.now() - (parsed.t ?? 0) < 45_000) {
          setConversations(parsed.items);
        }
      }
    } catch {
      /* ignore */
    }
    if (import.meta.env.DEV) {
      console.log('[WhatsApp] subscribeConversationsList start', { companyId });
    }
    const onError = (err: unknown) => {
      const msg = String(err && typeof err === 'object' && 'message' in err ? (err as Error).message : err);
      if (msg.includes('index') && msg.includes('building')) {
        setIndexBuilding(true);
      }
    };
    const sub = subscribeConversationsList(companyId, setConversationsWithNotification, onError);
    conversationsSubRef.current = sub;
    loadMoreConversationsRef.current = async () => {
      setConversationsLoadingMore(true);
      try {
        const { hasMore, appended } = await sub.loadMore();
        setConversationsHasMore(hasMore);
        if (import.meta.env.DEV) {
          console.debug('[WhatsApp] conversations loadMore', { appended, hasMore, getHasMore: sub.getHasMore() });
        }
      } finally {
        setConversationsLoadingMore(false);
      }
    };

    return () => {
      sub.unsubscribe();
      conversationsSubRef.current = null;
      loadMoreConversationsRef.current = null;
    };
  }, [companyId, setConversationsWithNotification]);

  /** Синхронизация hasMore с внутренним состоянием подписки после merge/обновлений списка. */
  useEffect(() => {
    if (!companyId || !conversationsSubRef.current) return;
    setConversationsHasMore(conversationsSubRef.current.getHasMore());
  }, [companyId, conversations.length]);

  useEffect(() => {
    if (!chatIdFromUrl) return;
    const found = conversations.some((c) => c.id === chatIdFromUrl);
    if (found) {
      setSelectedId(chatIdFromUrl);
      const bridgedDraft = consumeChatDraft(chatIdFromUrl);
      const nextDraft = bridgedDraft ?? draftFromUrl;
      if (nextDraft && nextDraft.trim()) {
        lastAiDraftBaselineRef.current = null;
        setInputText(nextDraft);
        toast.success('Черновик подставлен в поле ответа');
      }
      setSearchParams({}, { replace: true });
      return;
    }
    if (conversations.length > 0) {
      toast.error('Чат не найден или уже удалён');
      setSearchParams({}, { replace: true });
    }
  }, [chatIdFromUrl, conversations, draftFromUrl, setSearchParams]);

  useEffect(() => {
    if (!companyId) {
      setCrmNamesByPhone(new Map());
      setCityByPhone(new Map());
      return;
    }
    const q = query(
      collection(db, 'clients'),
      where('companyId', '==', companyId)
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const nameMap = new Map<string, string>();
        const cityMap = new Map<string, string>();
        snapshot.docs.forEach((d) => {
          const data = d.data();
          const phone = data.phone as string | undefined;
          const name = ((data.name as string) ?? '').trim();
          const city = (data.city as string) ?? '';
          if (!phone) return;
          const norm = normalizePhone(phone);
          if (name) {
            if (import.meta.env.DEV && nameMap.has(norm) && nameMap.get(norm) !== name) {
              console.warn('[WhatsApp] Два клиента CRM с одним номером:', norm);
            }
            nameMap.set(norm, name);
          }
          if (city.trim()) cityMap.set(norm, city.trim());
        });
        setCrmNamesByPhone(nameMap);
        setCityByPhone(cityMap);
      },
      () => {
        setCrmNamesByPhone(new Map());
        setCityByPhone(new Map());
      }
    );
    return () => unsub();
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setCompanyCitiesList([]);
      return;
    }
    return subscribeCompanyCities(companyId, setCompanyCitiesList);
  }, [companyId]);

  // Подписка на статусы сделок компании
  useEffect(() => {
    if (!companyId) {
      setDealStatuses([]);
      return;
    }
    const col = collection(db, 'dealStatuses');
    const q = query(col, where('companyId', '==', companyId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: SimpleDealStatus[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: (data.name as string) ?? d.id,
            color: (data.color as string) ?? '#6B7280',
            order: typeof data.order === 'number' ? data.order : 0,
            isDefault: !!data.isDefault
          };
        });
        list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ru'));
        setDealStatuses(list);
      },
      () => setDealStatuses([])
    );
    return () => unsub();
  }, [companyId]);

  // Подписка на менеджеров чатов
  useEffect(() => {
    if (!companyId) {
      setManagers([]);
      return;
    }
    const col = collection(db, 'chatManagers');
    const q = query(col, where('companyId', '==', companyId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: SimpleManager[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            name: (data.name as string) ?? d.id,
            color: (data.color as string) ?? '#6B7280',
            order: typeof data.order === 'number' ? data.order : 0
          };
        });
        list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ru'));
        setManagers(list);
      },
      () => setManagers([])
    );
    return () => unsub();
  }, [companyId]);

  // Подписка на сделки: карта телефон -> статус и телефон -> менеджер
  useEffect(() => {
    if (!companyId) {
      setDealStatusByPhone(new Map());
      setManagerByPhone(new Map());
      return;
    }
    const col = collection(db, 'deals');
    const q = query(col, where('companyId', '==', companyId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const statusMap = new Map<string, string>();
        const mgrMap = new Map<string, string>();
        snap.docs.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          const phone = data.clientPhone as string | undefined;
          if (!phone) return;
          const norm = normalizePhone(phone);
          const statusId =
            (data.statusId as string | undefined) || (data.status as string | undefined) || null;
          if (norm && statusId) statusMap.set(norm, statusId);
          const managerId = data.managerId as string | undefined;
          if (norm && managerId) mgrMap.set(norm, managerId);
        });
        setDealStatusByPhone(statusMap);
        setManagerByPhone(mgrMap);
      },
      () => {
        setDealStatusByPhone(new Map());
        setManagerByPhone(new Map());
      }
    );
    return () => unsub();
  }, [companyId]);

  // Подписка на базу знаний компании для AI-ответов (кэшируется в памяти)
  useEffect(() => {
    if (!companyId) {
      setKnowledgeBase([]);
      return;
    }
    const col = collection(db, 'knowledgeBase');
    const q = query(col, where('companyId', '==', companyId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: (data.title as string) ?? '',
            content: (data.content as string) ?? '',
            category: (data.category as string) ?? ''
          };
        });
        setKnowledgeBase(list);
      },
      () => setKnowledgeBase([])
    );
    return () => unsub();
  }, [companyId]);

  // Подписка на быстрые ответы (шаблоны для поля ввода)
  useEffect(() => {
    if (!companyId) {
      setQuickReplies([]);
      return;
    }
    const col = collection(db, 'quick_replies');
    const q = query(col, where('companyId', '==', companyId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const rawFiles = data.files as Array<{ id?: string; url?: string; name?: string; type?: string; size?: number }> | undefined;
          const files = rawFiles?.length
            ? rawFiles.filter((f) => f?.url).map((f) => ({
                id: (f.id ?? `f-${d.id}-${Math.random().toString(36).slice(2)}`) as string,
                url: f.url!,
                name: (f.name ?? 'Файл') as string,
                type: (f.type ?? 'file') as string,
                size: f.size
              }))
            : undefined;
          return {
            id: d.id,
            title: (data.title as string) ?? '',
            text: (data.text as string) ?? '',
            keywords: (data.keywords as string) ?? '',
            category: (data.category as string) ?? '',
            files,
            attachmentUrl: (data.attachmentUrl as string) || undefined,
            attachmentType: (data.attachmentType as 'image' | 'video' | 'file' | 'audio') || undefined,
            attachmentFileName: (data.attachmentFileName as string) || undefined
          };
        });
        setQuickReplies(list);
      },
      () => setQuickReplies([])
    );
    return () => unsub();
  }, [companyId]);

  // Подписка на медиа-шаблоны (команда / в поле ввода)
  useEffect(() => {
    if (!companyId) {
      setMediaQuickReplies([]);
      return;
    }
    const col = collection(db, 'media_quick_replies');
    const q = query(col, where('companyId', '==', companyId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: MediaQuickReply[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const rawFiles = (data.files as Array<{ url?: string; order?: number; fileName?: string }>) ?? [];
          return {
            id: d.id,
            title: (data.title as string) ?? '',
            keywords: (data.keywords as string) ?? '',
            files: rawFiles
              .filter((f) => f?.url)
              .map((f, i) => ({ url: f.url!, order: f.order ?? i, fileName: f.fileName })),
            companyId: data.companyId as string | undefined,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
          };
        });
        setMediaQuickReplies(list);
      },
      () => setMediaQuickReplies([])
    );
    return () => unsub();
  }, [companyId]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    const conversationId = selectedId;
    if (import.meta.env.DEV) {
      console.log('[WhatsApp] open chat:', { selectedId, conversationId, activeChatId: selectedId });
    }
    setIndexBuilding(false);
    if (!incognitoMode) {
      if (import.meta.env.DEV) {
        console.log('[WhatsApp] markAsRead start:', {
          conversationId,
          companyId,
          payload: { unreadCount: 0, lastReadAt: 'serverTimestamp', lastReadMessageId: null }
        });
      }
      clearUnreadCount(conversationId, undefined, companyId ?? null)
        .then(() => {
          if (import.meta.env.DEV) {
            console.log('[WhatsApp] markAsRead success:', { conversationId });
          }
        })
        .catch((err) => {
          if (import.meta.env.DEV) {
            console.warn('[WhatsApp] markAsRead failed:', { conversationId, error: err });
          }
        });
    } else if (import.meta.env.DEV) {
      console.log('[WhatsApp] incognito mode: skip markAsRead for conversation', {
        conversationId,
        companyId
      });
    }
    const onError = (err: unknown) => {
      const msg = String(err && typeof err === 'object' && 'message' in err ? (err as Error).message : err);
      if (msg.includes('index') && msg.includes('building')) {
        setIndexBuilding(true);
      }
    };
    const unsub = subscribeMessages(selectedId, setMessages, onError);
    return unsub;
  }, [selectedId, companyId, incognitoMode]);

  // Когда чат открыт и приходят новые сообщения — помечаем прочитанным в БД (чтобы badge не появлялся)
  const markReadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!selectedId || messages.length === 0 || !companyId || incognitoMode) return;
    if (markReadDebounceRef.current) clearTimeout(markReadDebounceRef.current);
    markReadDebounceRef.current = setTimeout(() => {
      markReadDebounceRef.current = null;
      const lastIncoming = [...messages].reverse().find((m) => m.direction === 'incoming');
      const lastReadMessageId = lastIncoming?.id ?? null;
      clearUnreadCount(selectedId, lastReadMessageId, companyId).catch((err) => {
        if (import.meta.env.DEV) {
          console.warn('[WhatsApp] markAsRead (on new messages) failed:', {
            selectedId,
            companyId,
            error: err
          });
        }
      });
    }, 400);
    return () => {
      if (markReadDebounceRef.current) clearTimeout(markReadDebounceRef.current);
    };
  }, [selectedId, messages, companyId, incognitoMode]);

  /** Краткое описание пересылаемого: "1 изображение, 2 сообщения" и т.п. */
  const forwardPreviewSummary = useMemo(() => {
    const toSend = messages.filter((m) => selectedMessageIds.includes(m.id) && !m.deleted);
    if (toSend.length === 0) return '';
    const parts: string[] = [];
    let images = 0;
    let videos = 0;
    let voice = 0;
    let files = 0;
    let textOnly = 0;
    for (const m of toSend) {
      const att = m.attachments?.[0];
      if (att) {
        if (att.type === 'image') images += 1;
        else if (att.type === 'video') videos += 1;
        else if (att.type === 'audio' || att.type === 'voice') voice += 1;
        else files += 1;
      } else {
        textOnly += 1;
      }
    }
    if (images) parts.push(images === 1 ? '1 изображение' : `${images} изображения`);
    if (videos) parts.push(videos === 1 ? '1 видео' : `${videos} видео`);
    if (voice) parts.push(voice === 1 ? '1 голосовое' : `${voice} голосовых`);
    if (files) parts.push(files === 1 ? '1 файл' : `${files} файла`);
    if (textOnly) parts.push(textOnly === 1 ? '1 сообщение' : `${textOnly} сообщения`);
    return parts.join(', ') || `${toSend.length} сообщений`;
  }, [messages, selectedMessageIds]);

  const [dealBadgeByConversationId, setDealBadgeByConversationId] = useState<
    Record<string, { name: string; color: string }>
  >({});

  useEffect(() => {
    let cancelled = false;
    const listSource = searchActive ? searchChats : conversations;
    const dealIds = [...new Set(listSource.map((c) => c.dealId).filter(Boolean))] as string[];
    if (dealIds.length === 0) {
      setDealBadgeByConversationId({});
      return;
    }
    (async () => {
      const byDeal = new Map<string, { name: string; color: string }>();
      for (const dealId of dealIds) {
        const d = await getDoc(doc(db, 'deals', dealId));
        if (!d.exists() || d.data().deletedAt != null) continue;
        const stageId = d.data().stageId as string;
        if (!stageId) continue;
        const st = await getDoc(doc(db, 'pipeline_stages', stageId));
        const name = st.exists() ? ((st.data().name as string) ?? '—') : '—';
        const color =
          st.exists() && st.data().color && /^#[0-9A-Fa-f]{3,8}$/i.test(String(st.data().color))
            ? String(st.data().color)
            : '#6B7280';
        byDeal.set(dealId, { name, color });
      }
      if (cancelled) return;
      const byConv: Record<string, { name: string; color: string }> = {};
      listSource.forEach((c) => {
        if (c.dealId && byDeal.has(c.dealId)) byConv[c.id] = byDeal.get(c.dealId)!;
      });
      setDealBadgeByConversationId(byConv);
    })();
    return () => {
      cancelled = true;
    };
  }, [conversations, searchChats, searchActive]);

  const chatsListForSidebar = searchActive ? searchChats : conversations;

  const listWithDisplayTitle = useMemo(() => {
    return chatsListForSidebar.map((c) => {
      /**
       * Бейдж непрочитанного: только для строки **сейчас открытого** чата принудительно 0 (и скрываем stale snapshot),
       * пока не инкогнито. Раньше держали Set «открытых в сессии» — после «Назад» на mobile он маскировал
       * реальный unread до refresh (Firestore уже обновлён, UI нет).
       */
      const effectiveUnread =
        selectedId === c.id && !incognitoMode ? 0 : (c.unreadCount ?? 0);
      const normPhone = normalizePhone(c.phone ?? c.client?.phone ?? '');
      const statusId = normPhone ? dealStatusByPhone.get(normPhone) ?? null : null;
      const managerId = normPhone ? managerByPhone.get(normPhone) ?? null : null;
      const city = normPhone ? (cityByPhone.get(normPhone) ?? null) : null;
      const displayTitle =
        crmNamesByPhone.get(normalizePhone(c.phone))?.trim() || c.phone || '—';
      const status = statusId ? (dealStatuses.find((s) => s.id === statusId) ?? null) : null;
      const legacyColor = status?.color?.trim() || null;
      const legacyName = status?.name?.trim() || null;
      const fromDeal = dealBadgeByConversationId[c.id];
      const dealStatusColor = fromDeal?.color ?? legacyColor;
      const dealStatusName = fromDeal?.name ?? legacyName;
      const manager = managerId ? (managers.find((m) => m.id === managerId) ?? null) : null;
      const managerColor = manager?.color?.trim() || null;
      const managerName = manager?.name?.trim() || null;
      return {
        ...c,
        unreadCount: effectiveUnread,
        displayTitle,
        dealStatusId: statusId,
        dealStatusColor: dealStatusColor || undefined,
        dealStatusName: dealStatusName || undefined,
        managerId: managerId ?? undefined,
        managerColor: managerColor || undefined,
        managerName: managerName || undefined,
        city: city ?? undefined
      };
    });
  }, [
    chatsListForSidebar,
    selectedId,
    incognitoMode,
    crmNamesByPhone,
    cityByPhone,
    dealStatusByPhone,
    dealStatuses,
    managerByPhone,
    managers,
    dealBadgeByConversationId
  ]);

  const selectConversation = useCallback(
    (id: string) => {
      const fromUi =
        listWithDisplayTitle.find((c) => c.id === id) ||
        searchChats.find((c) => c.id === id) ||
        conversations.find((c) => c.id === id);
      if (fromUi) setStickySelectedChat(fromUi);
      setSelectedId(id);
    },
    [listWithDisplayTitle, searchChats, conversations]
  );

  const selectedItem: ConversationListItem | undefined =
    conversations.find((c) => c.id === selectedId) ||
    searchChats.find((c) => c.id === selectedId) ||
    (stickySelectedChat?.id === selectedId ? stickySelectedChat : undefined);
  selectedItemRef.current = selectedItem;

  const legacyAiBotActive = useMemo(() => {
    if (!selectedItem?.aiBotEnabled) return false;
    const rt = selectedItem.aiRuntime;
    if (rt?.enabled && rt.botId && rt.mode !== 'off') return false;
    return true;
  }, [selectedItem?.aiBotEnabled, selectedItem?.aiRuntime]);

  const crmAiRuntimeActive = useMemo(() => {
    const rt = selectedItem?.aiRuntime;
    if (!rt?.enabled || !rt.botId || rt.mode === 'off') return false;
    if (selectedItem?.channel === 'instagram') return false;
    return true;
  }, [selectedItem?.aiRuntime, selectedItem?.channel]);

  whatsappMessagesForAiRef.current = messages;

  /** CRM runtime: синхронизация lastProcessed из Firestore при смене чата */
  useEffect(() => {
    const rt = selectedItem?.aiRuntime;
    if (!selectedId || !rt?.enabled || !rt.botId || rt.mode === 'off') {
      crmAiRuntimeLastProcessedRef.current = null;
      return;
    }
    let cancelled = false;
    getDoc(doc(db, COLLECTIONS.CONVERSATIONS, selectedId)).then((snap) => {
      if (cancelled || !snap.exists()) return;
      const data = snap.data() as {
        aiRuntime?: { lastProcessedIncomingMessageId?: string | null };
      };
      crmAiRuntimeLastProcessedRef.current = data.aiRuntime?.lastProcessedIncomingMessageId ?? null;
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, selectedItem?.aiRuntime?.enabled, selectedItem?.aiRuntime?.botId, selectedItem?.aiRuntime?.mode]);

  /** AI-бот (legacy): при открытии чата с включённым AI загружаем lastProcessed из Firestore. */
  useEffect(() => {
    if (!selectedId || !legacyAiBotActive) {
      aiBotLastProcessedMessageIdRef.current = null;
      return;
    }
    let cancelled = false;
    getDoc(doc(db, COLLECTIONS.CONVERSATIONS, selectedId)).then((snap) => {
      if (cancelled || !snap.exists()) return;
      const data = snap.data() as {
        aiBotLastMessageIdProcessed?: string | null;
        aiBotLeadContext?: AiBotLeadContext | null;
      };
      aiBotLastProcessedMessageIdRef.current = data.aiBotLastMessageIdProcessed ?? null;
      aiBotLeadContextRef.current = data.aiBotLeadContext ?? null;
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, legacyAiBotActive]);

  /** Пока идёт legacy AI flush, любое обновление сообщений инвалидирует текущую генерацию (stale). */
  useEffect(() => {
    if (!selectedId || !legacyAiBotActive) return;
    if (aiBotProcessingRef.current) {
      legacyAiStaleGenerationRef.current += 1;
    }
  }, [messages, selectedId, legacyAiBotActive]);

  const executeLegacyAiFlush = useCallback(async () => {
    if (!legacyAiBotActive) return;
    if (!selectedId || !selectedItem?.phone || selectedItem.phone === '…' || !companyId || incognitoMode) return;
    if (aiBotProcessingRef.current) return;

    const msgs = whatsappMessagesForAiRef.current;
    const lastProc = aiBotLastProcessedMessageIdRef.current;
    const unprocessed = getUnprocessedIncomingMessages(msgs, lastProc, getWhatsAppMessageTime);
    if (unprocessed.length === 0) return;

    const anchorLastId = unprocessed[unprocessed.length - 1].id;
    const anchorCount = unprocessed.length;
    const startGen = legacyAiStaleGenerationRef.current;

    aiBotProcessingRef.current = true;
    try {
      const phone = selectedItem.phone;
      const voiceItems = getVoiceMessagesToTranscribe(msgs);
      let mergedUpdates: Record<string, string> = {};
      if (voiceItems.length > 0) {
        const result = await transcribeVoiceBatch(voiceItems, getAuthToken);
        mergedUpdates = result.updates ?? {};
      }
      if (incomingBatchNeedsTranscriptWait(unprocessed, mergedUpdates)) {
        if (import.meta.env.DEV) {
          console.log('[WhatsApp][ai-chat-bot-reply] flush: ждём расшифровку голосов в батче');
        }
        return;
      }

      const payloadMessages = buildLegacyAiPayloadMessages(
        msgs,
        lastProc,
        mergedUpdates,
        getWhatsAppMessageTime,
        20
      );
      if (payloadMessages.length === 0) return;

      const token = await getAuthToken();
      if (!token) return;

      if (legacyAiStaleGenerationRef.current !== startGen) return;
      if (
        isInboundBatchStale(
          whatsappMessagesForAiRef.current,
          aiBotLastProcessedMessageIdRef.current,
          anchorLastId,
          anchorCount,
          getWhatsAppMessageTime
        )
      ) {
        if (import.meta.env.DEV) console.log('[WhatsApp][ai-chat-bot-reply] stale после transcribe, пропуск');
        return;
      }

      const leadCtx = aiBotLeadContextRef.current;
      const clientContext = {
        city: selectedItem?.client?.city ?? leadCtx?.city ?? null,
        area_m2: leadCtx?.area_m2 ?? null,
        floors: leadCtx?.floors ?? null,
        roofType: leadCtx?.roofType ?? null,
        stage: leadCtx?.stage ?? null
      };
      if (import.meta.env.DEV) {
        const lastClient = payloadMessages.filter((m) => m.role === 'client').pop();
        console.log('[WhatsApp] AI bot batched request', {
          clientContext,
          lastClientTextPreview: lastClient?.text?.slice(0, 120),
          batchedIncomingCount: anchorCount
        });
      }
      const res = await fetch('/.netlify/functions/ai-chat-bot-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: payloadMessages,
          clientContext,
          knowledgeBase:
            knowledgeBase.length > 0
              ? knowledgeBase.map((k) => ({ title: k.title, content: k.content, category: k.category ?? null }))
              : undefined,
          quickReplies:
            quickReplies.length > 0
              ? quickReplies.map((q) => ({ title: q.title, text: q.text, keywords: q.keywords, category: q.category }))
              : undefined
        })
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
        extractedFacts?: AiBotLeadContext | null;
      };
      if (!res.ok || data.error) {
        if (import.meta.env.DEV) console.warn('[WhatsApp] AI bot reply failed', res.status, data);
        return;
      }
      const reply = typeof data.reply === 'string' ? data.reply.trim() : '';
      if (!reply) return;

      if (legacyAiStaleGenerationRef.current !== startGen) return;
      if (
        isInboundBatchStale(
          whatsappMessagesForAiRef.current,
          aiBotLastProcessedMessageIdRef.current,
          anchorLastId,
          anchorCount,
          getWhatsAppMessageTime
        )
      ) {
        if (import.meta.env.DEV) console.log('[WhatsApp][ai-chat-bot-reply] stale перед отправкой, ответ отброшен');
        return;
      }

      if (data.extractedFacts && typeof data.extractedFacts === 'object') {
        aiBotLeadContextRef.current = data.extractedFacts;
        setConversationAiBotLeadContext(selectedId, data.extractedFacts).catch(() => {});
        aiBotApplyFactsRef.current?.(data.extractedFacts);
        if (import.meta.env.DEV) {
          console.log('[WhatsApp] AI bot extractedFacts applied', data.extractedFacts);
        }
      }

      const sendRes = await fetch(SEND_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wazzupSendBody(phone, { text: formatMessageForWhatsApp(reply), companyId }))
      });
      if (!sendRes.ok) {
        if (import.meta.env.DEV) console.warn('[WhatsApp] AI bot send failed', sendRes.status);
        return;
      }
      aiBotLastProcessedMessageIdRef.current = anchorLastId;
      await setConversationAiBotLastProcessedMessageId(selectedId, anchorLastId);
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[WhatsApp] AI bot pipeline error', e);
    } finally {
      aiBotProcessingRef.current = false;
      const lp = aiBotLastProcessedMessageIdRef.current;
      const pending = getUnprocessedIncomingMessages(
        whatsappMessagesForAiRef.current,
        lp,
        getWhatsAppMessageTime
      );
      if (pending.length > 0 && legacyAiStaleGenerationRef.current !== startGen) {
        window.setTimeout(() => void executeLegacyAiFlush(), 200);
      }
    }
  }, [companyId, incognitoMode, knowledgeBase, legacyAiBotActive, quickReplies, selectedId, selectedItem]);

  /** Legacy AI: debounce + батч входящих в одном чате (6 с текст / 10 с при voice). */
  useEffect(() => {
    if (
      !selectedId ||
      !legacyAiBotActive ||
      !selectedItem?.phone ||
      selectedItem.phone === '…' ||
      !companyId ||
      incognitoMode
    ) {
      if (legacyAiDebounceTimerRef.current) {
        clearTimeout(legacyAiDebounceTimerRef.current);
        legacyAiDebounceTimerRef.current = null;
      }
      return;
    }
    const lastProc = aiBotLastProcessedMessageIdRef.current;
    const unprocessed = getUnprocessedIncomingMessages(messages, lastProc, getWhatsAppMessageTime);
    if (unprocessed.length === 0) {
      if (legacyAiDebounceTimerRef.current) {
        clearTimeout(legacyAiDebounceTimerRef.current);
        legacyAiDebounceTimerRef.current = null;
      }
      return;
    }
    if (legacyAiDebounceTimerRef.current) {
      clearTimeout(legacyAiDebounceTimerRef.current);
    }
    const delay = chooseWhatsAppAiDebounceMs(unprocessed);
    legacyAiDebounceTimerRef.current = setTimeout(() => {
      legacyAiDebounceTimerRef.current = null;
      void executeLegacyAiFlush();
    }, delay);
    return () => {
      if (legacyAiDebounceTimerRef.current) {
        clearTimeout(legacyAiDebounceTimerRef.current);
        legacyAiDebounceTimerRef.current = null;
      }
    };
  }, [
    messages,
    selectedId,
    legacyAiBotActive,
    selectedItem?.phone,
    companyId,
    incognitoMode,
    executeLegacyAiFlush
  ]);

  /** Пока идёт CRM AI flush, обновление сообщений инвалидирует текущую генерацию. */
  useEffect(() => {
    if (!selectedId || !crmAiRuntimeActive) return;
    if (crmAiRuntimeProcessingRef.current) {
      crmAiStaleGenerationRef.current += 1;
    }
  }, [messages, selectedId, crmAiRuntimeActive]);

  const handleComposerInputChange = useCallback((value: string) => {
    setInputText(value);
    const b = lastAiDraftBaselineRef.current;
    if (b !== null && value.trim() !== b) {
      lastAiDraftBaselineRef.current = null;
    }
  }, []);

  /** Та же логика, что кнопка «Подставить в поле ответа» в карточке клиента. */
  const insertAiReplyIntoComposer = useCallback((text: string, mode: 'replace' | 'append') => {
    if (mode === 'append') {
      setInputText((prev) => (prev ? `${prev}\n${text}` : text));
      lastAiDraftBaselineRef.current = null;
      return;
    }
    setInputText(text);
    lastAiDraftBaselineRef.current = text.trim();
  }, []);

  /**
   * Автоподстановка черновика CRM AI в поле ввода (только режим draft).
   * Пустое поле или поле ровно с предыдущим AI-черновиком — обновляем; иначе не трогаем.
   */
  const trySafeAutofillCrmAiDraft = useCallback((replyCombined: string): boolean => {
    const trimmed = replyCombined.trim();
    if (!trimmed) return false;
    const cur = inputTextRef.current.trim();
    const baseline = lastAiDraftBaselineRef.current;
    if (cur === '') {
      setInputText(replyCombined);
      lastAiDraftBaselineRef.current = trimmed;
      return true;
    }
    if (baseline !== null && cur === baseline) {
      setInputText(replyCombined);
      lastAiDraftBaselineRef.current = trimmed;
      return true;
    }
    return false;
  }, []);

  const executeCrmAiFlush = useCallback(async () => {
    if (!crmAiRuntimeActive) return;
    if (!selectedId || !selectedItem?.phone || selectedItem.phone === '…' || !companyId || incognitoMode) return;
    const rt = selectedItem.aiRuntime;
    if (!rt?.botId || rt.mode === 'off') return;
    if (crmAiRuntimeProcessingRef.current) return;

    const msgs = whatsappMessagesForAiRef.current;
    const watermarkAtStart = mergeLastProcessedInboundWatermarks(
      msgs,
      crmAiRuntimeLastProcessedRef.current,
      rt.lastProcessedIncomingMessageId ?? null,
      getWhatsAppMessageTime
    );
    const unprocessed = getUnprocessedIncomingMessages(msgs, watermarkAtStart, getWhatsAppMessageTime);
    if (unprocessed.length === 0) return;

    const botId = rt.botId;
    const mode = rt.mode as 'draft' | 'auto';
    const flushConversationId = selectedId;
    const messageIdToProcess = unprocessed[unprocessed.length - 1].id;
    const anchorLastId = messageIdToProcess;
    const anchorCount = unprocessed.length;
    const startGen = crmAiStaleGenerationRef.current;

    crmAiRuntimeProcessingRef.current = true;
    const startedAt = new Date();
    const rtCompany = { ensureCompanyId: companyId };

    const finishSkip = async (reason: string) => {
      await updateWhatsAppConversationAiRuntime(
        selectedId,
        {
          lastRunAt: serverTimestamp(),
          lastStatus: 'skipped',
          lastReason: reason,
          lastProcessedIncomingMessageId: messageIdToProcess
        },
        rtCompany
      );
      crmAiRuntimeLastProcessedRef.current = messageIdToProcess;
      logWhatsappAiBotRunSafe({
        companyId,
        conversationId: selectedId,
        botId,
        mode,
        triggerMessageId: messageIdToProcess,
        startedAt,
        finishedAt: new Date(),
        status: 'skipped',
        reason,
        generatedReply: null,
        extractedSummary: null,
        channel: selectedItem?.channel ?? 'whatsapp',
        runtimeMode: mode,
        clientIdSnapshot: selectedItem?.clientId ?? null,
        phoneSnapshot: selectedItem?.phone ?? null
      });
    };

    try {
      const botMeta = crmAiBots.find((b) => b.id === botId);
        if (!botMeta || botMeta.status === 'archived') {
          await finishSkip(!botMeta ? 'Бот не найден или нет доступа' : 'Бот в архиве');
          return;
        }
        if (botMeta.status === 'paused') {
          await finishSkip('Бот на паузе');
          return;
        }

      const phone = selectedItem.phone!;
      const voiceItems = getVoiceMessagesToTranscribe(msgs);
      let mergedUpdates: Record<string, string> = {};
      if (voiceItems.length > 0) {
        const result = await transcribeVoiceBatch(voiceItems, getAuthToken);
        mergedUpdates = result.updates ?? {};
      }
      if (incomingBatchNeedsTranscriptWait(unprocessed, mergedUpdates)) {
        if (import.meta.env.DEV) {
          console.log('[WhatsApp][crm-ai-bot-whatsapp-runtime] flush: ждём расшифровку голосов в батче');
        }
        return;
      }

      const openaiMessages = buildCrmOpenAiMessagesFromBatch(
        msgs,
        watermarkAtStart,
        mergedUpdates,
        getWhatsAppMessageTime,
        40
      );
      if (openaiMessages.length === 0) {
        await finishSkip('Нет текста для модели');
        return;
      }
      if (import.meta.env.DEV) {
        console.log('[WhatsApp][crm-ai-bot-whatsapp-runtime] batched flush', {
          triggerMessageId: messageIdToProcess,
          batchedIncomingCount: anchorCount
        });
      }

      const token = await getAuthToken();
      if (!token) {
        await finishSkip('Нет авторизации');
        return;
      }

      if (crmAiStaleGenerationRef.current !== startGen) return;
      if (
        isInboundBatchStale(
          whatsappMessagesForAiRef.current,
          watermarkAtStart,
          anchorLastId,
          anchorCount,
          getWhatsAppMessageTime
        )
      ) {
        if (import.meta.env.DEV) console.log('[WhatsApp][crm-ai-bot-whatsapp-runtime] stale перед API, пропуск');
        return;
      }

      const res = await fetch(CRM_WHATSAPP_RUNTIME_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            botId,
            conversationId: selectedId,
            triggerMessageId: messageIdToProcess,
            messages: openaiMessages
          })
        });
        const data = (await res.json().catch(() => ({}))) as {
          answer?: string;
          answerParts?: unknown;
          replyMode?: string;
          error?: string;
          extracted?: Record<string, unknown> | null;
          extractionApply?: RuntimeExtractionApplyApi;
          dealRecommendation?: AiDealRecommendationSnapshot | null;
          taskRecommendation?: AiTaskRecommendationSnapshot | null;
        };
        if (!res.ok || data.error) {
          const errText = typeof data.error === 'string' ? data.error : `HTTP ${res.status}`;
          await updateWhatsAppConversationAiRuntime(
            selectedId,
            {
              lastRunAt: serverTimestamp(),
              lastStatus: 'error',
              lastReason: errText,
              lastGeneratedReply: null,
              lastProcessedIncomingMessageId: messageIdToProcess
            },
            rtCompany
          );
          logWhatsappAiBotRunSafe({
            companyId,
            conversationId: selectedId,
            botId,
            mode,
            triggerMessageId: messageIdToProcess,
            startedAt,
            finishedAt: new Date(),
            status: 'error',
            reason: errText,
            generatedReply: null,
            extractedSummary: null
          });
          toast.error(`AI (автоворонка): ${errText}`);
          crmAiRuntimeLastProcessedRef.current = messageIdToProcess;
          return;
        }
        const reply = typeof data.answer === 'string' ? data.answer.trim() : '';
        const partsFromApi = Array.isArray(data.answerParts)
          ? data.answerParts.map((x) => String(x).trim()).filter(Boolean)
          : [];
        const sendParts = partsFromApi.length ? partsFromApi : reply ? [reply] : [];
        const replyCombined = sendParts.length ? sendParts.join('\n\n') : reply;
        if (!replyCombined.trim()) {
          await finishSkip('Пустой ответ модели');
          return;
        }

        if (crmAiStaleGenerationRef.current !== startGen) return;
        if (
          isInboundBatchStale(
            whatsappMessagesForAiRef.current,
            watermarkAtStart,
            anchorLastId,
            anchorCount,
            getWhatsAppMessageTime
          )
        ) {
          if (import.meta.env.DEV) {
            console.log('[WhatsApp][crm-ai-bot-whatsapp-runtime] stale после ответа модели, ответ не публикуем');
          }
          return;
        }

        const extracted = data.extracted;
        const extractedSummary =
          extracted && typeof extracted === 'object'
            ? JSON.stringify({
                summaryComment: extracted.summaryComment,
                city: extracted.city
              }).slice(0, 8000)
            : null;
        const extractionJson = extracted ? JSON.stringify(extracted).slice(0, 12000) : null;
        const applyApi = data.extractionApply;
        const applyPatch: WhatsAppAiRuntimePatch =
          applyApi != null
            ? patchAiRuntimeFromExtractionApply(applyApi)
            : {
                lastExtractionApplyStatus: 'skipped',
                lastExtractionApplyReason: 'Нет блока extractionApply в ответе',
                lastExtractionAppliedFields: null,
                lastExtractionAppliedLabels: null,
                lastExtractionAppliedFieldCount: null,
                lastExtractionAppliedClientId: null,
                lastExtractionAppliedAt: null
              };

        const runLogApply =
          applyApi != null
            ? {
                extractionApplied: applyApi.extractionApplied,
                extractionApplyStatus: applyApi.extractionApplyStatus,
                extractionApplyReason: applyApi.extractionApplyReason,
                extractionAppliedFields: applyApi.extractionAppliedFields.length
                  ? applyApi.extractionAppliedFields
                  : null,
                extractionAppliedLabels: applyApi.extractionAppliedLabels.length
                  ? applyApi.extractionAppliedLabels
                  : null,
                extractionAppliedFieldCount: applyApi.extractionAppliedFieldCount,
                appliedClientId: applyApi.appliedClientId,
                extractionAppliedAt: applyApi.appliedAt,
                dealRecommendationForLog: applyApi.dealRecommendationForLog
              }
            : {};

        const dealRecPatch: WhatsAppAiRuntimePatch =
          data.dealRecommendation != null
            ? { dealRecommendation: data.dealRecommendation }
            : {};

        const runLogDeal =
          data.dealRecommendation != null
            ? {
                dealRecommendationStatus: data.dealRecommendation.status,
                dealRecommendationReason: data.dealRecommendation.reason,
                dealDraftTitle: data.dealRecommendation.draftTitle,
                dealRoutingPipelineId: data.dealRecommendation.routing?.recommendedPipelineId ?? null,
                dealRoutingPipelineName: data.dealRecommendation.routing?.recommendedPipelineName ?? null,
                dealRoutingStageId: data.dealRecommendation.routing?.recommendedStageId ?? null,
                dealRoutingStageName: data.dealRecommendation.routing?.recommendedStageName ?? null,
                dealRoutingAssigneeId: data.dealRecommendation.routing?.recommendedAssigneeId ?? null,
                dealRoutingAssigneeName: data.dealRecommendation.routing?.recommendedAssigneeName ?? null,
                dealRoutingReason:
                  (data.dealRecommendation.routing?.routingReason?.length ?? 0) > 0
                    ? data.dealRecommendation.routing!.routingReason
                    : null,
                dealRoutingWarnings:
                  (data.dealRecommendation.routing?.routingWarnings?.length ?? 0) > 0
                    ? data.dealRecommendation.routing!.routingWarnings
                    : null,
                dealRoutingConfidence: data.dealRecommendation.routing?.routingConfidence ?? null
              }
            : {};

        const taskRecPatch: WhatsAppAiRuntimePatch =
          data.taskRecommendation != null ? { taskRecommendation: data.taskRecommendation } : {};

        const runLogTask =
          data.taskRecommendation != null
            ? {
                taskRecommendationStatus: data.taskRecommendation.status,
                taskRecommendationTitle: data.taskRecommendation.recommendedTaskTitle,
                taskRecommendationType: data.taskRecommendation.recommendedTaskType,
                taskRecommendationPriority: data.taskRecommendation.recommendedPriority,
                taskRecommendationDueHint: data.taskRecommendation.dueHint,
                taskPayloadHash: data.taskRecommendation.payloadHash
              }
            : {};

        const toSnapshotJson = (v: unknown, max = 12000): string | null => {
          if (v == null) return null;
          try {
            return JSON.stringify(v).slice(0, max);
          } catch {
            return null;
          }
        };
        const runLogSnapshots = {
          channel: selectedItem?.channel ?? 'whatsapp',
          runtimeMode: mode,
          answerSnapshot: replyCombined,
          summarySnapshot: extractedSummary,
          extractedSnapshotJson: extractionJson,
          extractionApplySnapshotJson: toSnapshotJson(data.extractionApply, 12000),
          dealRecommendationSnapshotJson: toSnapshotJson(data.dealRecommendation, 12000),
          taskRecommendationSnapshotJson: toSnapshotJson(data.taskRecommendation, 12000),
          resultFlagsSnapshotJson: toSnapshotJson(
            {
              mode,
              hadReply: !!replyCombined,
              extractionApplyStatus: data.extractionApply?.extractionApplyStatus ?? null,
              dealRecommendationStatus: data.dealRecommendation?.status ?? null,
              taskRecommendationStatus: data.taskRecommendation?.status ?? null
            },
            4000
          ),
          clientIdSnapshot:
            typeof data.extractionApply?.appliedClientId === 'string' && data.extractionApply.appliedClientId.trim()
              ? data.extractionApply.appliedClientId.trim()
              : selectedItem?.clientId ?? null,
          phoneSnapshot: selectedItem?.phone ?? null
        };

        if (mode === 'draft') {
          await updateWhatsAppConversationAiRuntime(
            selectedId,
            {
              lastRunAt: serverTimestamp(),
              lastStatus: 'success',
              lastReason: null,
              lastGeneratedReply: replyCombined,
              lastProcessedIncomingMessageId: messageIdToProcess,
              lastExtractionJson: extractionJson,
              ...applyPatch,
              ...dealRecPatch,
              ...taskRecPatch
            },
            rtCompany
          );
          crmAiRuntimeLastProcessedRef.current = messageIdToProcess;
          logWhatsappAiBotRunSafe({
            companyId,
            conversationId: selectedId,
            botId,
            mode,
            triggerMessageId: messageIdToProcess,
            startedAt,
            finishedAt: new Date(),
            status: 'success',
            reason: null,
            generatedReply: replyCombined,
            extractedSummary,
            ...runLogSnapshots,
            ...runLogApply,
            ...runLogDeal,
            ...runLogTask
          });
          const stillThisChat = selectedIdRef.current === flushConversationId;
          const autofillDone = stillThisChat && trySafeAutofillCrmAiDraft(replyCombined);
          toast.success(
            autofillDone
              ? 'Черновик ответа подставлен в поле ввода'
              : 'Черновик ответа готов (карточка клиента)'
          );
          return;
        }

        const replyStyleCfg = parseCrmAiBotConfig(botMeta.config).replyStyle;
        const sendWazzupText = (t: string) =>
          fetch(SEND_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(wazzupSendBody(phone, { text: formatMessageForWhatsApp(t), companyId }))
          });

        const useMultiPart =
          sendParts.length >= 2 &&
          replyStyleCfg.maxReplyParts >= 2 &&
          replyStyleCfg.replySplitMode !== 'single';

        let sendFailReason: string | null = null;
        let partialMultiNote: string | null = null;

        if (!useMultiPart) {
          const sendRes = await sendWazzupText(sendParts[0]);
          if (!sendRes.ok) sendFailReason = 'Не удалось отправить ответ в чат';
        } else {
          const send0 = await sendWazzupText(sendParts[0]);
          if (!send0.ok) {
            sendFailReason = 'Не удалось отправить ответ в чат';
          } else {
            const dLo = Math.min(replyStyleCfg.interReplyDelayMinMs, replyStyleCfg.interReplyDelayMaxMs);
            const dHi = Math.max(dLo, replyStyleCfg.interReplyDelayMaxMs);
            const pauseMs = dLo + Math.floor(Math.random() * (dHi - dLo + 1));
            await new Promise((r) => setTimeout(r, pauseMs));

            const genStale = crmAiStaleGenerationRef.current !== startGen;
            const batchStale = isInboundBatchStale(
              whatsappMessagesForAiRef.current,
              watermarkAtStart,
              anchorLastId,
              anchorCount,
              getWhatsAppMessageTime
            );
            if (genStale || batchStale) {
              partialMultiNote =
                'Отправлена только первая часть ответа (новые сообщения клиента или смена контекста).';
            } else {
              const send1 = await sendWazzupText(sendParts[1]);
              if (!send1.ok) sendFailReason = 'Не удалось отправить вторую часть ответа в чат';
            }
          }
        }

        if (sendFailReason) {
          await updateWhatsAppConversationAiRuntime(
            selectedId,
            {
              lastRunAt: serverTimestamp(),
              lastStatus: 'error',
              lastReason: sendFailReason,
              lastGeneratedReply: replyCombined,
              lastProcessedIncomingMessageId: messageIdToProcess,
              lastExtractionJson: extractionJson,
              ...applyPatch,
              ...dealRecPatch,
              ...taskRecPatch
            },
            rtCompany
          );
          logWhatsappAiBotRunSafe({
            companyId,
            conversationId: selectedId,
            botId,
            mode,
            triggerMessageId: messageIdToProcess,
            startedAt,
            finishedAt: new Date(),
            status: 'error',
            reason: 'send_failed',
            generatedReply: replyCombined,
            extractedSummary,
            ...runLogSnapshots,
            ...runLogApply,
            ...runLogDeal,
            ...runLogTask
          });
          toast.error(`AI: ${sendFailReason}`);
          crmAiRuntimeLastProcessedRef.current = messageIdToProcess;
          return;
        }

        await updateWhatsAppConversationAiRuntime(
          selectedId,
          {
            lastRunAt: serverTimestamp(),
            lastStatus: 'success',
            lastReason: partialMultiNote,
            lastGeneratedReply: replyCombined,
            lastProcessedIncomingMessageId: messageIdToProcess,
            lastExtractionJson: extractionJson,
            ...applyPatch,
            ...dealRecPatch,
            ...taskRecPatch
          },
          rtCompany
        );
        crmAiRuntimeLastProcessedRef.current = messageIdToProcess;
        logWhatsappAiBotRunSafe({
          companyId,
          conversationId: selectedId,
          botId,
          mode,
          triggerMessageId: messageIdToProcess,
          startedAt,
          finishedAt: new Date(),
          status: 'success',
          reason: partialMultiNote,
          generatedReply: replyCombined,
          extractedSummary,
          ...runLogSnapshots,
          ...runLogApply,
          ...runLogDeal,
          ...runLogTask
        });
        if (partialMultiNote && import.meta.env.DEV) {
          console.log('[WhatsApp][crm-ai-bot-whatsapp-runtime]', partialMultiNote);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'runtime error';
        await updateWhatsAppConversationAiRuntime(
          selectedId,
          {
            lastRunAt: serverTimestamp(),
            lastStatus: 'error',
            lastReason: msg,
            lastGeneratedReply: null,
            lastProcessedIncomingMessageId: messageIdToProcess
          },
          rtCompany
        ).catch(() => {});
        logWhatsappAiBotRunSafe({
          companyId,
          conversationId: selectedId,
          botId,
          mode,
          triggerMessageId: messageIdToProcess,
          startedAt,
          finishedAt: new Date(),
          status: 'error',
          reason: msg,
          generatedReply: null,
          extractedSummary: null,
          channel: selectedItem?.channel ?? 'whatsapp',
          runtimeMode: mode,
          clientIdSnapshot: selectedItem?.clientId ?? null,
          phoneSnapshot: selectedItem?.phone ?? null
        });
        toast.error(`AI (автоворонка): ${msg}`);
        crmAiRuntimeLastProcessedRef.current = messageIdToProcess;
    } finally {
      crmAiRuntimeProcessingRef.current = false;
      const item = selectedItem;
      const rtFin = item?.aiRuntime;
      if (item && rtFin?.botId && rtFin.mode !== 'off') {
        const wm = mergeLastProcessedInboundWatermarks(
          whatsappMessagesForAiRef.current,
          crmAiRuntimeLastProcessedRef.current,
          rtFin.lastProcessedIncomingMessageId ?? null,
          getWhatsAppMessageTime
        );
        const pending = getUnprocessedIncomingMessages(
          whatsappMessagesForAiRef.current,
          wm,
          getWhatsAppMessageTime
        );
        if (pending.length > 0 && crmAiStaleGenerationRef.current !== startGen) {
          window.setTimeout(() => void executeCrmAiFlush(), 200);
        }
      }
    }
  }, [
    companyId,
    crmAiBots,
    crmAiRuntimeActive,
    incognitoMode,
    selectedId,
    selectedItem,
    trySafeAutofillCrmAiDraft
  ]);

  /** CRM AI: агрегация серии входящих (настройка бота, 2–4 с по умолчанию) / 10 с при voice. */
  useEffect(() => {
    if (
      !selectedId ||
      !crmAiRuntimeActive ||
      !selectedItem?.phone ||
      selectedItem.phone === '…' ||
      !companyId ||
      incognitoMode
    ) {
      if (crmAiDebounceTimerRef.current) {
        clearTimeout(crmAiDebounceTimerRef.current);
        crmAiDebounceTimerRef.current = null;
      }
      return;
    }
    const rt = selectedItem.aiRuntime;
    if (!rt?.botId || rt.mode === 'off') return;

    const msgs = messages;
    const watermark = mergeLastProcessedInboundWatermarks(
      msgs,
      crmAiRuntimeLastProcessedRef.current,
      rt.lastProcessedIncomingMessageId ?? null,
      getWhatsAppMessageTime
    );
    const unprocessed = getUnprocessedIncomingMessages(msgs, watermark, getWhatsAppMessageTime);
    if (unprocessed.length === 0) {
      if (crmAiDebounceTimerRef.current) {
        clearTimeout(crmAiDebounceTimerRef.current);
        crmAiDebounceTimerRef.current = null;
      }
      return;
    }
    if (crmAiDebounceTimerRef.current) {
      clearTimeout(crmAiDebounceTimerRef.current);
    }
    const botForDelay = crmAiBots.find((b) => b.id === rt.botId);
    const replyStyleForDelay = parseCrmAiBotConfig(botForDelay?.config ?? {}).replyStyle;
    const delay = chooseCrmWhatsAppAiDebounceMs(unprocessed, replyStyleForDelay);
    crmAiDebounceTimerRef.current = setTimeout(() => {
      crmAiDebounceTimerRef.current = null;
      void executeCrmAiFlush();
    }, delay);
    return () => {
      if (crmAiDebounceTimerRef.current) {
        clearTimeout(crmAiDebounceTimerRef.current);
        crmAiDebounceTimerRef.current = null;
      }
    };
  }, [
    messages,
    selectedId,
    companyId,
    incognitoMode,
    crmAiRuntimeActive,
    crmAiBots,
    selectedItem?.phone,
    selectedItem?.aiRuntime?.botId,
    selectedItem?.aiRuntime?.mode,
    selectedItem?.aiRuntime?.lastProcessedIncomingMessageId,
    executeCrmAiFlush
  ]);

  const handleFileSelect = useCallback(async (file: File) => {
    setSendError(null);
    if (file.size > MAX_BYTES) {
      setSendError(`Файл слишком большой. Максимум ${MAX_ATTACHMENT_MB} МБ.`);
      return;
    }
    if (file.type.startsWith('video/')) {
      setMediaPreparing(true);
      try {
        const v = await validateVideoForChat(file, MAX_BYTES);
        if (!v.ok) {
          setSendError(v.error);
          return;
        }
        if (isLargeVideo(file)) {
          setSendError(null);
        }
      } finally {
        setMediaPreparing(false);
      }
      setPendingAttachment({ file, preview: undefined });
      return;
    }
    if (file.type.startsWith('image/')) {
      setMediaPreparing(true);
      try {
        const compressed = await compressImage(file);
        const preview = URL.createObjectURL(compressed);
        setPendingAttachment({ file: compressed, preview });
      } catch (e) {
        console.error(e);
        const preview = URL.createObjectURL(file);
        setPendingAttachment({ file, preview });
      } finally {
        setMediaPreparing(false);
      }
      return;
    }
    setPendingAttachment({ file, preview: undefined });
  }, []);

  const handleClearAttachment = useCallback(() => {
    setSendError(null);
    setPendingAttachment((prev) => {
      if (prev?.preview) URL.revokeObjectURL(prev.preview);
      return null;
    });
  }, []);

  const handleFilesDrop = useCallback(
    async (files: File[]) => {
      if (incognitoMode || !selectedId || !companyId || sending || uploadState !== 'idle') return;
      const phone = selectedItem?.phone ?? selectedItem?.client?.phone;
      if (!phone || phone === '…') return;
      const valid = Array.from(files).filter(isDropAllowedFile);
      const rejected = Array.from(files).filter((f) => !isDropAllowedFile(f));
      if (rejected.length > 0) {
        const first = rejected[0];
        const msg =
          first.size > DROP_ZONE_MAX_BYTES
            ? `Файл «${first.name}» превышает ${DROP_ZONE_MAX_MB} МБ.`
            : `Тип файла не поддерживается: ${first.name}. Разрешены: jpg, png, webp, pdf, docx, xlsx, mp4.`;
        setSendError(msg);
      }
      if (valid.length === 0) return;
      setSendError(null);
      setMediaPreparing(true);
      const prepared: File[] = [];
      try {
        for (const file of valid) {
          if (file.type.startsWith('image/')) {
            try {
              prepared.push(await compressImage(file));
            } catch {
              prepared.push(file);
            }
          } else {
            prepared.push(file);
          }
        }
      } finally {
        setMediaPreparing(false);
      }
      setUploadState('uploading');
      try {
        for (let i = 0; i < prepared.length; i++) {
          if (i > 0) await new Promise((r) => setTimeout(r, 300));
          const file = prepared[i];
          const path = `${companyId}/${WHATSAPP_MEDIA_PREFIX}/${selectedId}/${Date.now()}_${sanitizeFileName(file.name)}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from(CLIENTS_BUCKET)
            .upload(path, file, { upsert: false });
          if (uploadError) {
            setSendError(`Ошибка загрузки: ${file.name}. Попробуйте ещё раз.`);
            break;
          }
          const { data: urlData } = supabase.storage.from(CLIENTS_BUCKET).getPublicUrl(uploadData.path);
          setUploadState('sending');
          const res = await fetch(SEND_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              wazzupSendBody(phone, {
                contentUri: urlData.publicUrl,
                attachmentType: getAttachmentType(file),
                fileName: file.name,
                companyId
              })
            )
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            const d = data as { error?: string; detail?: unknown };
            setSendError(d?.error ? String(d.error) : `Не удалось отправить: ${file.name}`);
            break;
          }
        }
      } finally {
        setUploadState('idle');
      }
    },
    [
      incognitoMode,
      selectedId,
      companyId,
      sending,
      uploadState,
      selectedItem?.phone,
      selectedItem?.client?.phone
    ]
  );

  /** Сразу отправить фото/видео с камеры (тот же pipeline, что и вложение + отправить) */
  const sendCameraMediaNow = useCallback(
    async (file: File) => {
      if (incognitoMode) return;
      const phone = selectedItem?.phone ?? selectedItem?.client?.phone;
      if (!phone || phone === '…' || !companyId || !selectedId || uploadState !== 'idle') return;

      setSendError(null);
      let uploadFile: File = file;
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (isImage) {
        setMediaPreparing(true);
        setUploadState('uploading');
        try {
          uploadFile = await compressImage(file);
          if (uploadFile.size > MAX_BYTES) {
            setSendError(`Файл слишком большой. Максимум ${MAX_ATTACHMENT_MB} МБ.`);
            setUploadState('idle');
            return;
          }
        } catch (err) {
          console.error('Image compress error:', err);
          setSendError('Не удалось обработать фото.');
          setUploadState('idle');
          return;
        } finally {
          setMediaPreparing(false);
        }
      } else if (isVideo) {
        setMediaPreparing(true);
        try {
          const v = await validateVideoForChat(file, MAX_BYTES);
          if (!v.ok) {
            setSendError(v.error);
            return;
          }
        } finally {
          setMediaPreparing(false);
        }
      } else {
        setSendError('Выберите фото или видео.');
        return;
      }

      const caption = inputText.trim();
      setUploadState('uploading');
      try {
        const path = `${companyId}/${WHATSAPP_MEDIA_PREFIX}/${selectedId}/${Date.now()}_${sanitizeFileName(uploadFile.name)}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(CLIENTS_BUCKET)
          .upload(path, uploadFile, { upsert: false });
        if (uploadError) {
          setSendError('Ошибка загрузки файла. Попробуйте ещё раз.');
          return;
        }
        const { data: urlData } = supabase.storage.from(CLIENTS_BUCKET).getPublicUrl(uploadData.path);
        setUploadState('sending');
        const res = await fetch(SEND_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            wazzupSendBody(phone, {
              contentUri: urlData.publicUrl,
              attachmentType: getAttachmentType(uploadFile),
              fileName: uploadFile.name,
              text: caption ? formatMessageForWhatsApp(caption) : undefined,
              repliedToMessageId: replyToMessage?.id ?? undefined,
              companyId: companyId ?? undefined
            })
          )
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          lastAiDraftBaselineRef.current = null;
          setInputText('');
          setSendError(null);
          setReplyToMessage(null);
        } else {
          const d = data as { error?: string };
          setSendError(d?.error ?? 'Не удалось отправить.');
        }
      } finally {
        setUploadState('idle');
      }
    },
    [
      incognitoMode,
      selectedItem,
      companyId,
      selectedId,
      uploadState,
      inputText,
      replyToMessage
    ]
  );

  const handleCameraCapture = useCallback(
    (file: File) => {
      void sendCameraMediaNow(file);
    },
    [sendCameraMediaNow]
  );

  const sendVoiceBlobRef = useRef<(blob: Blob) => void>(() => {});

  const lockVoiceRecording = useCallback(() => {
    voiceRecordingLockedRef.current = true;
    setVoiceRecordingLocked(true);
  }, []);

  const startVoiceRecording = useCallback(async () => {
    setSendError(null);
    voiceCancelledRef.current = false;
    voiceRecordingLockedRef.current = false;
    setVoiceRecordingLocked(false);
    try {
      const { stream, release } = await acquireVoiceStream();
      streamRef.current = stream;
      voiceReleaseRef.current = release;
      const recorder = await createVoiceRecorder(
        stream,
        (blob) => {
          voiceReleaseRef.current = null;
          if (voiceCancelledRef.current) return;
          sendVoiceBlobRef.current(blob);
        },
        release
      );
      if (!recorder) {
        release();
        voiceReleaseRef.current = null;
        setSendError('Запись голоса не поддерживается.');
        return;
      }
      voiceRecorderRef.current = recorder;
      recorder.start();
      setRecordingStartedAt(Date.now());
      setIsRecordingVoice(true);
    } catch (err) {
      console.error('Voice recording error:', err);
      setSendError('Нет доступа к микрофону.');
    }
  }, []);

  const stopVoiceRecording = useCallback(() => {
    const rec = voiceRecorderRef.current;
    if (rec) rec.stop();
    voiceRecorderRef.current = null;
    setRecordingStartedAt(null);
    setIsRecordingVoice(false);
    voiceRecordingLockedRef.current = false;
    setVoiceRecordingLocked(false);
  }, []);

  const cancelVoiceRecording = useCallback(() => {
    voiceCancelledRef.current = true;
    stopVoiceRecording();
  }, [stopVoiceRecording]);

  const sendVoiceBlob = useCallback(
    async (blob: Blob) => {
      const phone = selectedItem?.phone ?? selectedItem?.client?.phone;
      if (!phone || phone === '…' || !companyId || !selectedId) {
        setSendError('Выберите чат для отправки голосового.');
        return;
      }
      const isOgg = blob.type.includes('ogg');
      const fileName = isOgg ? 'voice.ogg' : 'voice.webm';
      const file = new File([blob], fileName, { type: blob.type });
      const durationSeconds = await probeBlobAudioDurationSec(blob);
      setUploadState('uploading');
      try {
        const path = `${companyId}/${WHATSAPP_MEDIA_PREFIX}/${selectedId}/${Date.now()}_${fileName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(CLIENTS_BUCKET)
          .upload(path, file, { upsert: false });
        if (uploadError) {
          setSendError('Ошибка загрузки голосового.');
          return;
        }
        const { data: urlData } = supabase.storage.from(CLIENTS_BUCKET).getPublicUrl(uploadData.path);
        setUploadState('sending');
        const res = await fetch(SEND_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            wazzupSendBody(phone, {
              contentUri: urlData.publicUrl,
              attachmentType: 'voice',
              fileName,
              ...(durationSeconds != null ? { durationSeconds } : {}),
              repliedToMessageId: replyToMessage?.id ?? undefined,
              companyId
            })
          )
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setSendError(null);
          setReplyToMessage(null);
        } else {
          const d = data as { error?: string };
          setSendError(d?.error ?? 'Не удалось отправить голосовое.');
        }
      } finally {
        setUploadState('idle');
      }
    },
    [selectedItem, companyId, selectedId, replyToMessage]
  );

  useEffect(() => {
    sendVoiceBlobRef.current = sendVoiceBlob;
  }, [sendVoiceBlob]);

  useEffect(() => () => {
    if (pendingAttachment?.preview) URL.revokeObjectURL(pendingAttachment.preview);
  }, [pendingAttachment]);

  useEffect(() => {
    setPendingQuickReplyFiles(null);
  }, [selectedId]);

  useEffect(() => {
    lastAiDraftBaselineRef.current = null;
  }, [selectedId]);

  const handleSend = async () => {
    if (incognitoMode) {
      // В режиме инкогнито отправка отключена (просмотр-only).
      return;
    }
    const phone = selectedItem?.phone ?? selectedItem?.client?.phone;
    if (!phone || phone === '…' || sending || uploadState !== 'idle') return;

    const caption = inputText.trim();
    const hasAttachment = !!pendingAttachment;

    if (hasAttachment && companyId && selectedId) {
      let uploadFile = pendingAttachment!.file;
      if (uploadFile.type.startsWith('image/')) {
        setMediaPreparing(true);
        try {
          uploadFile = await compressImage(uploadFile);
        } catch {
          /* */
        } finally {
          setMediaPreparing(false);
        }
      }
      setUploadState('uploading');
      try {
        const path = `${companyId}/${WHATSAPP_MEDIA_PREFIX}/${selectedId}/${Date.now()}_${sanitizeFileName(uploadFile.name)}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(CLIENTS_BUCKET)
          .upload(path, uploadFile, { upsert: false });

        if (uploadError) {
          setSendError('Ошибка загрузки файла. Попробуйте ещё раз.');
          setUploadState('idle');
          return;
        }
        const { data: urlData } = supabase.storage.from(CLIENTS_BUCKET).getPublicUrl(uploadData.path);
        const contentUri = urlData.publicUrl;

        setUploadState('sending');
        const res = await fetch(SEND_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            wazzupSendBody(phone, {
              contentUri,
              attachmentType: getAttachmentType(uploadFile),
              fileName: uploadFile.name,
              text: caption ? formatMessageForWhatsApp(caption) : undefined,
              repliedToMessageId: replyToMessage?.id ?? undefined,
              companyId: companyId ?? undefined
            })
          )
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          lastAiDraftBaselineRef.current = null;
          setInputText('');
          setSendError(null);
          setReplyToMessage(null);
          setPendingAttachment((p) => {
            if (p?.preview) URL.revokeObjectURL(p.preview);
            return null;
          });
          if (selectedId) moveConversationToTopByActivity(selectedId);
        } else {
          const d = data as { error?: string; status?: number; detail?: any };
          let message = 'Сообщение не отправлено: проверьте номер, текст или вложение.';
          if (d?.error === 'Wazzup API error') {
            const detail = d.detail as any;
            let providerMsg = '';
            if (detail && typeof detail === 'object') {
              const firstData =
                Array.isArray((detail as any).data) && (detail as any).data.length > 0
                  ? (detail as any).data[0]
                  : null;
              const code = firstData?.code || (detail as any).error;
              const desc = firstData?.description || (detail as any).description;
              if (code && desc) providerMsg = `${code}: ${desc}`;
              else providerMsg = desc || code || (detail as any).message || (detail as any).raw || '';
            }
            if (providerMsg) {
              message = `Wazzup: ${providerMsg}`;
            }
          } else if (d?.error) {
            message = d.error;
          }
          setSendError(message);
        }
      } finally {
        setUploadState('idle');
      }
      return;
    }

    const hasQueuedFiles = (pendingQuickReplyFiles?.length ?? 0) > 0;
    if (!caption && !hasQueuedFiles) return;

    const replyId = replyToMessage?.id;
    const filesToSend = pendingQuickReplyFiles ?? [];
    setSending(true);
    lastAiDraftBaselineRef.current = null;
    setInputText('');
    setPendingQuickReplyFiles(null);
    try {
      if (caption) {
        setUploadState('sending');
        const res = await fetch(SEND_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            wazzupSendBody(phone, {
              text: formatMessageForWhatsApp(caption),
              repliedToMessageId: replyId ?? undefined,
              companyId: companyId ?? undefined
            })
          )
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const d = data as { error?: string; status?: number; detail?: any };
          let message = 'Сообщение не отправлено: проверьте номер, текст или вложение.';
          if (d?.error === 'Wazzup API error') {
            const detail = d.detail as any;
            let providerMsg = '';
            if (detail && typeof detail === 'object') {
              const firstData =
                Array.isArray((detail as any).data) && (detail as any).data.length > 0
                  ? (detail as any).data[0]
                  : null;
              const code = firstData?.code || (detail as any).error;
              const desc = firstData?.description || (detail as any).description;
              if (code && desc) providerMsg = `${code}: ${desc}`;
              else providerMsg = desc || code || (detail as any).message || (detail as any).raw || '';
            }
            if (providerMsg) {
              message = `Wazzup: ${providerMsg}`;
            }
          } else if (d?.error) {
            message = d.error;
          }
          setInputText(caption);
          setSendError(message);
          setSending(false);
          return;
        }
        setSendError(null);
        setReplyToMessage(null);
        if (selectedId) moveConversationToTopByActivity(selectedId);
      }

      for (let i = 0; i < filesToSend.length; i++) {
        setUploadState('sending');
        await new Promise((r) => setTimeout(r, i === 0 ? 300 : QUICK_REPLY_FILES_DELAY_MS));
        const res = await fetch(SEND_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            wazzupSendBody(phone, {
              contentUri: filesToSend[i].url,
              attachmentType: filesToSend[i].type as 'image' | 'video' | 'file' | 'audio',
              fileName: filesToSend[i].name,
              companyId: companyId ?? undefined
            })
          )
        });
        if (!res.ok) {
          setSendError('Не удалось отправить один из файлов шаблона.');
          setSending(false);
          return;
        }
        if (selectedId) moveConversationToTopByActivity(selectedId);
      }
    } finally {
      setUploadState('idle');
      setSending(false);
    }
  };

  const handleSendProposalImage = useCallback(
    async (blob: Blob, caption: string) => {
      if (incognitoMode) return;
      const item = listWithDisplayTitle.find((c) => c.id === selectedId);
      const phone = item?.phone ?? (item as { client?: { phone?: string } })?.client?.phone;
      if (!phone || phone === '…' || !companyId || !selectedId) {
        showErrorNotification('Выберите диалог для отправки КП');
        return;
      }
      const file = new File([blob], 'kp.jpg', { type: 'image/jpeg' });
      setUploadState('uploading');
      try {
        const path = `${companyId}/${WHATSAPP_MEDIA_PREFIX}/${selectedId}/${Date.now()}_kp.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(CLIENTS_BUCKET)
          .upload(path, file, { upsert: false });
        if (uploadError) {
          setSendError('Ошибка загрузки файла.');
          return;
        }
        const { data: urlData } = supabase.storage.from(CLIENTS_BUCKET).getPublicUrl(uploadData.path);
        const contentUri = urlData.publicUrl;
        setUploadState('sending');

        // 1) Отправляем только изображение (без caption), чтобы текст гарантированно отображался отдельным сообщением
        const resImage = await fetch(SEND_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            wazzupSendBody(phone, {
              contentUri,
              attachmentType: 'image',
              fileName: 'kp.jpg',
              companyId: companyId ?? undefined
            })
          )
        });
        const dataImage = (await resImage.json().catch(() => ({}))) as { error?: string };
        if (!resImage.ok) {
          setSendError(dataImage?.error ?? 'Не удалось отправить КП.');
          return;
        }
        setSendError(null);
        if (selectedId) moveConversationToTopByActivity(selectedId);

        // Небольшая задержка, чтобы WhatsApp корректно показывал порядок сообщений
        await new Promise((r) => setTimeout(r, 300));

        // 2) Отправляем текст отдельным сообщением
        const textToSend = (caption || '').trim() || 'Ваше коммерческое предложение по дому из SIP-панелей.\n\nЕсли будут вопросы — напишите 👍';
        const resText = await fetch(SEND_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            wazzupSendBody(phone, {
              text: formatMessageForWhatsApp(textToSend),
              companyId: companyId ?? undefined
            })
          )
        });
        if (!resText.ok) {
          const dataText = (await resText.json().catch(() => ({}))) as { error?: string };
          setSendError(dataText?.error ?? 'КП отправлено, но не удалось отправить подпись.');
        }
      } finally {
        setUploadState('idle');
      }
    },
    [companyId, selectedId, listWithDisplayTitle, incognitoMode, moveConversationToTopByActivity]
  );

  const closeSelectionAndOverlays = useCallback(() => {
    setSelectedMessageIds([]);
    setContextMenu(null);
    setReactionPickerMessageId(null);
    setActionsSheetMessageId(null);
  }, []);

  const handleLongPressMessage = useCallback(
    (messageId: string) => {
      setSelectedMessageIds((prev) => (prev.includes(messageId) ? prev : [...prev, messageId]));
      if (isMobile) setReactionPickerMessageId(messageId);
    },
    [isMobile]
  );

  const handleContextMenuMessage = useCallback((e: React.MouseEvent, messageId: string) => {
    e.preventDefault();
    setContextMenu({ messageId, x: e.clientX, y: e.clientY });
  }, []);

  const handleReplyToMessage = useCallback((messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (msg) setReplyToMessage(msg);
    closeSelectionAndOverlays();
  }, [messages, closeSelectionAndOverlays]);

  const handleForwardMessages = useCallback((messageIds: string[]) => {
    setSelectedMessageIds(messageIds);
    setForwardDialogOpen(true);
  }, []);

  const handleDeleteMessages = useCallback(async (messageIds: string[]) => {
    for (const id of messageIds) {
      try {
        await softDeleteMessage(id);
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[WhatsApp] softDeleteMessage failed:', id, err);
      }
    }
    closeSelectionAndOverlays();
  }, [closeSelectionAndOverlays]);

  const handleStarMessages = useCallback(
    async (messageIds: string[]) => {
      const list = messages.filter((m) => messageIds.includes(m.id));
      const nextStarred = !list.some((m) => m.starred);
      for (const msg of list) {
        try {
          await toggleStarMessage(msg.id, nextStarred);
        } catch (err) {
          if (import.meta.env.DEV) console.warn('[WhatsApp] toggleStarMessage failed:', msg.id, err);
        }
      }
      closeSelectionAndOverlays();
    },
    [messages, closeSelectionAndOverlays]
  );

  const handleCopyMessage = useCallback(
    (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      const text = msg?.deleted ? '' : (msg?.text ?? '').trim();
      if (text && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          if (isMobile && typeof document !== 'undefined') {
            const toast = document.createElement('div');
            toast.textContent = 'Скопировано';
            toast.className =
              'fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-gray-800 text-white text-sm rounded-lg z-[1300]';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 1500);
          }
        });
      }
      closeSelectionAndOverlays();
    },
    [messages, isMobile, closeSelectionAndOverlays]
  );

  const handleReactionSelect = useCallback(
    async (messageId: string, emoji: string) => {
      try {
        await addReactionToMessage(messageId, emoji, 'crm-user');
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[WhatsApp] addReactionToMessage failed:', messageId, err);
      }
      setReactionPickerMessageId(null);
    },
    []
  );

  const QUICK_REPLY_FILES_DELAY_MS = 400;

  /** При выборе шаблона с файлами — ставим файлы в очередь; отправка по кнопке «Отправить» */
  const handleQuickReplySelect = useCallback(
    (item: {
      text: string;
      files?: Array<{ id: string; url: string; name: string; type: string; size?: number }>;
      attachmentUrl?: string;
      attachmentType?: 'image' | 'video' | 'file' | 'audio';
      attachmentFileName?: string;
    }) => {
      const fileList = (item.files?.length
        ? item.files
        : item.attachmentUrl
          ? [
              {
                url: item.attachmentUrl,
                type: item.attachmentType || 'file',
                name: item.attachmentFileName ?? 'Файл',
                id: 'legacy'
              }
            ]
          : []) as Array<{ id: string; url: string; name: string; type: string }>;
      setPendingQuickReplyFiles(fileList.length > 0 ? fileList : null);
    },
    []
  );

  const MEDIA_SEND_DELAY_MS = 400;

  const handleMediaQuickReplySelect = useCallback(
    async (reply: MediaQuickReply) => {
      if (!selectedId || !companyId) return;
      const conv = conversations.find((c) => c.id === selectedId);
      const phone = conv?.phone ?? conv?.client?.phone;
      if (!phone || phone === '…') return;
      const files = [...(reply.files ?? [])].sort((a, b) => a.order - b.order);
      if (files.length === 0) return;
      setSending(true);
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const res = await fetch(SEND_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              wazzupSendBody(phone, {
                contentUri: file.url,
                attachmentType: 'image' as const,
                fileName: file.fileName ?? undefined,
                companyId
              })
            )
          });
          if (!res.ok) throw new Error('Send failed');
          if (i < files.length - 1) {
            await new Promise((r) => setTimeout(r, MEDIA_SEND_DELAY_MS));
          }
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('[WhatsApp] media quick reply send failed', err);
        showErrorNotification('Не удалось отправить изображения');
      } finally {
        setSending(false);
      }
    },
    [selectedId, companyId, conversations]
  );

  const handleSelectionMore = useCallback(() => {
    if (selectedMessageIds[0]) setActionsSheetMessageId(selectedMessageIds[0]);
  }, [selectedMessageIds]);

  const handleForwardConfirm = useCallback(
    async (targetConversationIds: string[]) => {
      if (!selectedId || !companyId) return;
      const toSend = messages.filter((m) => selectedMessageIds.includes(m.id));
      if (toSend.length === 0) return;
      const convMap = new Map(conversations.map((c) => [c.id, c]));
      setForwardLoading(true);
      try {
        for (const convId of targetConversationIds) {
          const conv = convMap.get(convId);
          const targetPhone = conv?.phone;
          if (!targetPhone) continue;
          for (const msg of toSend) {
            const payload: Record<string, unknown> = {
              forwarded: true,
              companyId: companyId ?? undefined
            };
            if (msg.deleted) continue;
            if (msg.attachments?.length && msg.attachments[0].url) {
              payload.contentUri = msg.attachments[0].url;
              payload.attachmentType = msg.attachments[0].type;
              payload.fileName = msg.attachments[0].fileName;
              payload.text = msg.text ? formatMessageForWhatsApp(msg.text) : undefined;
            } else {
              payload.text = formatMessageForWhatsApp(msg.text || '[медиа]');
            }
            const res = await fetch(SEND_API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(wazzupSendBody(targetPhone, payload))
            });
            if (res.ok) moveConversationToTopByActivity(convId);
          }
        }
        setForwardDialogOpen(false);
        closeSelectionAndOverlays();
      } finally {
        setForwardLoading(false);
      }
    },
    [selectedId, companyId, messages, selectedMessageIds, conversations, closeSelectionAndOverlays, moveConversationToTopByActivity]
  );

  const showListOnly = isMobile && !selectedId;
  const showChatOnly = isMobile && selectedId && selectedItem;
  // Открытие чата по conversation id: если в списке ещё нет item, показываем чат с placeholder (история подгрузится)
  const displayItem: ConversationListItem | null =
    selectedItem ??
    (selectedId
      ? ({
          id: selectedId,
          clientId: '',
          phone: '…',
          client: null,
          lastMessage: null,
          unreadCount: 0
        } as ConversationListItem)
      : null);

  /** Моб. composer: те же патчи CRM AI, что в карточке клиента */
  const mobileCrmAiComposer = useMemo(() => {
    if (!isMobile || !selectedId) return null;
    return {
      aiRuntime: selectedItem?.aiRuntime ?? defaultWhatsAppAiRuntime(),
      crmAiBots,
      onAiRuntimePatch: handleAiRuntimePatch,
      aiRuntimeSaving
    };
  }, [isMobile, selectedId, selectedItem?.aiRuntime, crmAiBots, handleAiRuntimePatch, aiRuntimeSaving]);

  const isMobileChatView = isMobile && !!selectedId;

  useEffect(() => {
    if (isMobile && selectedId) setMobileChatSearchOpen(false);
  }, [isMobile, selectedId]);

  useEffect(() => {
    if (!isMobile || !mobileChatSearchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileChatSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile, mobileChatSearchOpen]);

  const { waitingCount, unreadCount } = useMemo(() => {
    let waiting = 0;
    let unread = 0;
    for (const item of listWithDisplayTitle) {
      const att = getConversationAttentionState(item);
      if (att === 'unread') unread += 1;
      else if (att === 'need_reply') waiting += 1;
    }
    return { waitingCount: waiting, unreadCount: unread };
  }, [listWithDisplayTitle]);

  const filteredList = useMemo(() => {
    let base = listWithDisplayTitle;

    if (dealStatusFilter !== 'all') {
      base = base.filter((item) => {
        const sid = (item as { dealStatusId?: string | null }).dealStatusId;
        if (dealStatusFilter === 'none') return sid == null || sid === '';
        return sid === dealStatusFilter;
      });
    }
    if (managerFilter !== 'all') {
      base = base.filter((item) => {
        const mid = (item as { managerId?: string }).managerId;
        if (managerFilter === 'none') return !mid;
        return mid === managerFilter;
      });
    }
    if (cityFilter !== 'all') {
      base = base.filter((item) => {
        const c = (item as { city?: string | null }).city;
        if (cityFilter === 'none') return c == null || c === '';
        return (c ?? '').trim() === cityFilter;
      });
    }

    const withState = base.map((item) => ({
      item,
      attention: getConversationAttentionState(item)
    }));

    let filtered = withState;
    if (activeFilter === 'unread') {
      filtered = withState.filter((x) => x.attention === 'unread');
    } else if (activeFilter === 'waiting') {
      filtered = withState.filter((x) => x.attention === 'need_reply');
    }

    let result = filtered.map((x) => x.item);

    if (activeFilter === 'waiting') {
      const getTimeFromDateLike = (t: unknown): number => {
        if (!t) return 0;
        if (typeof (t as { toMillis?: () => number }).toMillis === 'function') {
          return (t as { toMillis: () => number }).toMillis();
        }
        if (typeof t === 'object' && t !== null && 'seconds' in (t as object)) {
          return ((t as { seconds: number }).seconds ?? 0) * 1000;
        }
        if (t instanceof Date) return t.getTime();
        return 0;
      };
      result = [...result].sort((a, b) => {
        const aTime = getTimeFromDateLike(a.lastIncomingAt ?? a.lastMessageAt ?? null);
        const bTime = getTimeFromDateLike(b.lastIncomingAt ?? b.lastMessageAt ?? null);
        // Чем дольше чат ждёт ответа, тем выше: более раннее входящее сообщение выше
        return aTime - bTime;
      });
    }

    return result;
  }, [listWithDisplayTitle, activeFilter, dealStatusFilter, managerFilter, cityFilter]);

  const dealStatusCounts = useMemo(() => {
    const list = listWithDisplayTitle;
    const total = list.length;
    let none = 0;
    const byId: Record<string, number> = {};
    for (const item of list) {
      const id = (item as { dealStatusId?: string | null }).dealStatusId ?? null;
      if (id == null || id === '') {
        none += 1;
      } else {
        byId[id] = (byId[id] ?? 0) + 1;
      }
    }
    return { all: total, none, byId };
  }, [listWithDisplayTitle]);

  const managerCounts = useMemo(() => {
    const list = listWithDisplayTitle;
    const total = list.length;
    let none = 0;
    const byId: Record<string, number> = {};
    for (const item of list) {
      const id = (item as { managerId?: string | null }).managerId ?? null;
      if (id == null || id === '') {
        none += 1;
      } else {
        byId[id] = (byId[id] ?? 0) + 1;
      }
    }
    return { all: total, none, byId };
  }, [listWithDisplayTitle]);

  const cityCounts = useMemo(() => {
    const list = listWithDisplayTitle;
    let none = 0;
    const byCity: Record<string, number> = {};
    for (const item of list) {
      const c = ((item as { city?: string | null }).city ?? '').trim();
      if (!c) none += 1;
      else byCity[c] = (byCity[c] ?? 0) + 1;
    }
    return { none, byCity };
  }, [listWithDisplayTitle]);

  const citiesForFilter = useMemo(() => {
    const set = new Set<string>(companyCitiesList);
    listWithDisplayTitle.forEach((item) => {
      const c = ((item as { city?: string | null }).city ?? '').trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [companyCitiesList, listWithDisplayTitle]);

  const handleAddCity = useCallback(
    async (name: string): Promise<string> => {
      if (!companyId) return '';
      return addCompanyCity(companyId, name);
    },
    [companyId]
  );

  /** Счётчики для badge в мобильной панели при не-дефолтном select (чаты в текущем списке). */
  const mobileDealFilterBadgeCount =
    dealStatusFilter === 'all'
      ? null
      : dealStatusFilter === 'none'
        ? dealStatusCounts.none
        : dealStatusCounts.byId[dealStatusFilter] ?? 0;
  const mobileManagerFilterBadgeCount =
    managerFilter === 'all'
      ? null
      : managerFilter === 'none'
        ? managerCounts.none
        : managerCounts.byId[managerFilter] ?? 0;
  const mobileCityFilterBadgeCount =
    cityFilter === 'all'
      ? null
      : cityFilter === 'none'
        ? cityCounts.none
        : cityCounts.byCity[cityFilter] ?? 0;

  return (
    <div
      className={`flex flex-col h-full min-w-0 bg-gray-50 overflow-x-hidden ${isMobileChatView ? 'overflow-hidden' : ''}`}
    >
      {/* Заголовок: на мобильном в чате не показываем (есть свой header в ChatWindow). Бургер в шапке на мобильном. */}
      {(!isMobile || !selectedId) && (
        <div className="whatsapp-header sticky top-0 z-50 flex-none border-b border-gray-200 bg-white">
          {isMobile && (
            <HeaderSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Имя, телефон, текст сообщения…"
              onClose={() => setMobileChatSearchOpen(false)}
              isOpen={mobileChatSearchOpen}
              leadingClose
              showValueClear
            />
          )}
          <div className="flex flex-1 items-center justify-between gap-2 px-3 py-2.5 md:px-4 md:py-3">
            {isMobile && (
              <button
                type="button"
                className="header-menu flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-xl text-gray-700 hover:bg-gray-100"
                onClick={toggleMobileSidebar}
                aria-label="Открыть меню"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <div className="header-title flex min-w-0 flex-1 items-center gap-2 md:flex-initial">
              <MessageSquare className="h-5 w-5 shrink-0 text-green-600" />
              <h1 className="truncate text-lg font-semibold text-gray-800">Чаты</h1>
            </div>
            <div className="header-right flex shrink-0 items-center gap-1.5 md:gap-2.5">
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setMobileChatSearchOpen((o) => !o)}
                  className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gray-700 hover:bg-gray-100"
                  aria-label="Поиск по чатам"
                  aria-expanded={mobileChatSearchOpen}
                >
                  <Search className="h-5 w-5" />
                  {searchQuery.trim().length > 0 && !mobileChatSearchOpen && (
                    <span
                      className="absolute right-1 top-1 h-2 w-2 rounded-full bg-green-500 ring-2 ring-white"
                      aria-hidden
                    />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIncognitoMode((v) => !v)}
                className="incognito-toggle inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-gray-50 px-2 py-1 text-xs transition-colors hover:bg-gray-100 md:gap-2 md:text-sm
                  data-[active=true]:border-amber-400 data-[active=true]:bg-amber-50"
                data-active={incognitoMode ? 'true' : 'false'}
              >
                <span
                  className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                    incognitoMode ? 'bg-amber-400' : 'bg-gray-300'
                  }`}
                  aria-hidden="true"
                >
                  <span
                    className={`h-3 w-3 rounded-full bg-white shadow transition-transform ${
                      incognitoMode ? 'translate-x-3' : 'translate-x-0'
                    }`}
                  />
                </span>
                <span className={incognitoMode ? 'text-amber-700 font-medium' : 'text-gray-600'}>
                  Инкогнито
                </span>
              </button>
              <div id="crm-clock" className="header-time crm-clock shrink-0" aria-live="polite">
                {clockTime}
              </div>
            </div>
          </div>
          {incognitoMode && (
            <p className="mt-2 hidden px-3 pb-2 text-[11px] text-amber-800 md:block md:px-4 md:pb-3 md:text-xs">
              <span className="inline-flex rounded border border-amber-100 bg-amber-50 px-2 py-1">
                Просмотр без отметки о прочтении и без отправки сообщений.
              </span>
            </p>
          )}
        </div>
      )}

      {indexBuilding && (
        <div className="flex-none px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-2">
          <p className="text-sm text-amber-800">
            Индекс Firestore ещё строится. Подождите 1–2 минуты и обновите страницу.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-200 text-amber-900 hover:bg-amber-300"
          >
            Обновить
          </button>
        </div>
      )}

      {/* Desktop ≥1200: три колонки. 768–1200: список + чат. <768: список ИЛИ чат */}
      <div
        ref={layoutContainerRef}
        className="flex-1 flex min-h-0 min-w-0 relative overflow-hidden"
      >
        {/* Левая колонка: список диалогов (desktop — resizable) */}
        <aside
          className={`
            flex flex-col overflow-hidden bg-white border-r border-gray-200
            ${isMobile ? 'w-full h-full absolute inset-0' : 'flex-shrink-0'}
            ${showChatOnly ? 'hidden' : ''}
          `}
          style={
            !isMobile
              ? { width: leftPanelWidth, minWidth: LEFT_PANEL_MIN, maxWidth: LEFT_PANEL_MAX }
              : undefined
          }
        >
          <div className="flex-none border-b border-gray-100 bg-gray-50/80">
            <div className="hidden md:flex items-center gap-2 px-3 py-2">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по всем чатам (имя, телефон, текст)…"
                className="flex-1 min-w-0 py-2 px-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400"
                aria-label="Поиск по чатам"
              />
            </div>
            {searchActive && searchLoading && (
              <p className="px-3 pb-1.5 text-[11px] text-gray-500 md:pt-0 pt-1">Поиск по базе…</p>
            )}
            {/* Мобильная панель: сетка на всю ширину, без рамок/стрелок; select поверх иконки; бейджи внутри ячейки */}
            <div
              className={`md:hidden grid w-full min-w-0 gap-x-0.5 px-2 pb-2 pt-1.5 ${
                dealStatuses.length > 0 ? 'grid-cols-6' : 'grid-cols-5'
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                title="Все чаты"
                aria-label="Показать все чаты"
                aria-pressed={activeFilter === 'all'}
                className={`filter-label relative z-0 flex h-11 min-h-[44px] w-full min-w-0 items-center justify-center rounded-xl transition-colors active:scale-[0.98] ${
                  activeFilter === 'all'
                    ? 'bg-emerald-500/[0.14] text-emerald-700'
                    : 'text-gray-500 active:bg-gray-100/90'
                }`}
              >
                <LayoutGrid className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
                {activeFilter === 'all' && (
                  <span
                    className="pointer-events-none absolute bottom-1 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-emerald-500/80"
                    aria-hidden
                  />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('waiting')}
                title={waitingCount > 0 ? `Ждут ответа: ${waitingCount}` : 'Ждут ответа'}
                aria-label={`Фильтр «Ждут ответа»${waitingCount > 0 ? `, ${waitingCount} чатов` : ''}`}
                aria-pressed={activeFilter === 'waiting'}
                className={`filter-label relative z-0 flex h-11 min-h-[44px] w-full min-w-0 items-center justify-center rounded-xl transition-colors active:scale-[0.98] ${
                  activeFilter === 'waiting'
                    ? 'bg-emerald-500/[0.14] text-amber-600'
                    : 'text-amber-600/90 active:bg-gray-100/90'
                }`}
              >
                <Clock className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
                {waitingCount > 0 && (
                  <span
                    className={`pointer-events-none absolute right-1 top-1 z-[3] inline-flex max-w-[calc(100%-0.35rem)] items-center justify-center rounded-md bg-amber-500 px-1 py-0.5 font-semibold leading-none text-white shadow-sm tabular-nums ${
                      String(waitingCount).length > 3 ? 'text-[8px]' : String(waitingCount).length > 2 ? 'text-[9px]' : 'text-[10px]'
                    }`}
                  >
                    {waitingCount}
                  </span>
                )}
                {activeFilter === 'waiting' && (
                  <span
                    className="pointer-events-none absolute bottom-1 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-emerald-500/80"
                    aria-hidden
                  />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('unread')}
                title={unreadCount > 0 ? `Непрочитанные: ${unreadCount}` : 'Непрочитанные'}
                aria-label={`Фильтр непрочитанных${unreadCount > 0 ? `, ${unreadCount} чатов` : ''}`}
                aria-pressed={activeFilter === 'unread'}
                className={`filter-label relative z-0 flex h-11 min-h-[44px] w-full min-w-0 items-center justify-center rounded-xl transition-colors active:scale-[0.98] ${
                  activeFilter === 'unread'
                    ? 'bg-emerald-500/[0.14] text-red-600'
                    : 'text-red-500 active:bg-gray-100/90'
                }`}
              >
                <Bell className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
                {unreadCount > 0 && (
                  <span
                    className={`pointer-events-none absolute right-1 top-1 z-[3] inline-flex max-w-[calc(100%-0.35rem)] items-center justify-center rounded-md bg-red-500 px-1 py-0.5 font-semibold leading-none text-white shadow-sm tabular-nums ${
                      String(unreadCount).length > 3 ? 'text-[8px]' : String(unreadCount).length > 2 ? 'text-[9px]' : 'text-[10px]'
                    }`}
                  >
                    {unreadCount}
                  </span>
                )}
                {activeFilter === 'unread' && (
                  <span
                    className="pointer-events-none absolute bottom-1 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-emerald-500/80"
                    aria-hidden
                  />
                )}
              </button>
              {dealStatuses.length > 0 && (
                <div
                  className={`relative z-0 flex h-11 min-h-[44px] w-full min-w-0 items-center justify-center rounded-xl transition-colors ${
                    dealStatusFilter !== 'all' ? 'bg-emerald-500/[0.14]' : ''
                  }`}
                  title={
                    dealStatusFilter === 'all'
                      ? 'Фильтр по сделке и статусу'
                      : `Фильтр по сделке, выбрано чатов: ${mobileDealFilterBadgeCount ?? 0}`
                  }
                >
                  <select
                    value={dealStatusFilter}
                    onChange={(e) =>
                      setDealStatusFilter(e.target.value === 'all' ? 'all' : e.target.value)
                    }
                    aria-label="Фильтр по сделке и статусу воронки"
                    className="absolute inset-0 z-[2] h-full w-full cursor-pointer opacity-0 text-base"
                  >
                    <option value="all">Все сделки ({dealStatusCounts.all})</option>
                    <option value="none">Без статуса ({dealStatusCounts.none})</option>
                    {dealStatuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({dealStatusCounts.byId[s.id] ?? 0})
                      </option>
                    ))}
                  </select>
                  <GitBranch
                    className="pointer-events-none h-5 w-5 shrink-0 text-emerald-600"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  {dealStatusFilter === 'all' && dealStatusCounts.all > 0 && (
                    <MobileFilterEmeraldCountBadge value={dealStatusCounts.all} />
                  )}
                  {dealStatusFilter !== 'all' && mobileDealFilterBadgeCount !== null && (
                    <>
                      <span
                        className="pointer-events-none absolute bottom-1 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-emerald-500/90"
                        aria-hidden
                      />
                      <MobileFilterEmeraldCountBadge value={mobileDealFilterBadgeCount} />
                    </>
                  )}
                </div>
              )}
              <div
                className={`relative z-0 flex h-11 min-h-[44px] w-full min-w-0 items-center justify-center rounded-xl transition-colors ${
                  managerFilter !== 'all' ? 'bg-emerald-500/[0.14]' : ''
                }`}
                title={
                  managerFilter === 'all'
                    ? 'Фильтр по менеджеру'
                    : `Фильтр по менеджеру, чатов: ${mobileManagerFilterBadgeCount ?? 0}`
                }
              >
                <select
                  value={managerFilter}
                  onChange={(e) => {
                    const v = e.target.value;
                    setManagerFilter(v === 'all' ? 'all' : v === 'none' ? 'none' : v);
                  }}
                  aria-label="Фильтр по ответственному менеджеру"
                  className="absolute inset-0 z-[2] h-full w-full cursor-pointer opacity-0 text-base"
                >
                  <option value="all">Все менеджеры</option>
                  <option value="none">Без менеджера</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <Users className="pointer-events-none h-5 w-5 shrink-0 text-gray-600" strokeWidth={1.75} aria-hidden />
                {managerFilter !== 'all' && mobileManagerFilterBadgeCount !== null && (
                  <>
                    <span
                      className="pointer-events-none absolute bottom-1 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-emerald-500/90"
                      aria-hidden
                    />
                    <MobileFilterEmeraldCountBadge value={mobileManagerFilterBadgeCount} />
                  </>
                )}
              </div>
              <div
                className={`relative z-0 flex h-11 min-h-[44px] w-full min-w-0 items-center justify-center rounded-xl transition-colors ${
                  cityFilter !== 'all' ? 'bg-emerald-500/[0.14]' : ''
                }`}
                title={
                  cityFilter === 'all'
                    ? 'Фильтр по городу'
                    : `Фильтр по городу, чатов: ${mobileCityFilterBadgeCount ?? 0}`
                }
              >
                <select
                  value={cityFilter}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCityFilter(v === 'all' ? 'all' : v === 'none' ? 'none' : v);
                  }}
                  aria-label="Фильтр по городу клиента"
                  className="absolute inset-0 z-[2] h-full w-full cursor-pointer opacity-0 text-base"
                >
                  <option value="all">Все города</option>
                  <option value="none">Без города ({cityCounts.none})</option>
                  {citiesForFilter.map((city) => (
                    <option key={city} value={city}>
                      {city} ({cityCounts.byCity[city] ?? 0})
                    </option>
                  ))}
                </select>
                <MapPin className="pointer-events-none h-5 w-5 shrink-0 text-sky-600" strokeWidth={1.75} aria-hidden />
                {cityFilter !== 'all' && mobileCityFilterBadgeCount !== null && (
                  <>
                    <span
                      className="pointer-events-none absolute bottom-1 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-emerald-500/90"
                      aria-hidden
                    />
                    <MobileFilterEmeraldCountBadge value={mobileCityFilterBadgeCount} />
                  </>
                )}
              </div>
            </div>

            {/* Desktop: прежняя вёрстка (несколько строк) */}
            <div className="hidden md:block">
              <div className="flex flex-nowrap items-center gap-2.5 px-3 pb-2 text-xs overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`filter-label inline-flex items-center justify-center min-h-[32px] py-1.5 px-3 rounded-2xl border whitespace-nowrap transition-colors ${
                    activeFilter === 'all'
                      ? 'bg-green-100 border-green-200 text-green-800 font-medium'
                      : 'bg-transparent border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Все
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('waiting')}
                  className={`filter-label inline-flex items-center gap-1.5 min-h-[32px] py-1.5 px-3 rounded-2xl border whitespace-nowrap transition-colors ${
                    activeFilter === 'waiting'
                      ? 'bg-green-100 border-green-200 text-green-800 font-medium'
                      : 'bg-transparent border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span
                    className="inline-flex h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: '#FF9F2F' }}
                  />
                  <span>Ждут</span>
                  {waitingCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full bg-gray-200 text-[10px] font-medium text-gray-700 ml-0.5">
                      {waitingCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('unread')}
                  className={`filter-label inline-flex items-center gap-1.5 min-h-[32px] py-1.5 px-3 rounded-2xl border whitespace-nowrap transition-colors ${
                    activeFilter === 'unread'
                      ? 'bg-green-100 border-green-200 text-green-800 font-medium'
                      : 'bg-transparent border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span
                    className="inline-flex h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: '#FF4D4F' }}
                  />
                  <span>Непр.</span>
                  {unreadCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full bg-gray-200 text-[10px] font-medium text-gray-700 ml-0.5">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </div>
              {dealStatuses.length > 0 && (
                <div className="px-3 pb-2">
                  <select
                    value={dealStatusFilter}
                    onChange={(e) =>
                      setDealStatusFilter(e.target.value === 'all' ? 'all' : e.target.value)
                    }
                    className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
                  >
                    <option value="all">Все сделки ({dealStatusCounts.all})</option>
                    <option value="none">Без статуса ({dealStatusCounts.none})</option>
                    {dealStatuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({dealStatusCounts.byId[s.id] ?? 0})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="px-3 pb-2">
                <select
                  value={managerFilter}
                  onChange={(e) => {
                    const v = e.target.value;
                    setManagerFilter(v === 'all' ? 'all' : v === 'none' ? 'none' : v);
                  }}
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="all">Все менеджеры</option>
                  <option value="none">Без менеджера</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="px-3 pb-2">
                <select
                  value={cityFilter}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCityFilter(v === 'all' ? 'all' : v === 'none' ? 'none' : v);
                  }}
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="all">Все города</option>
                  <option value="none">Без города ({cityCounts.none})</option>
                  {citiesForFilter.map((city) => (
                    <option key={city} value={city}>
                      {city} ({cityCounts.byCity[city] ?? 0})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <ConversationList
            items={filteredList}
            selectedId={selectedId}
            onSelect={selectConversation}
            loadingMore={searchActive ? false : conversationsLoadingMore}
            hasMore={searchActive ? false : conversationsHasMore}
            onLoadMore={searchActive ? undefined : () => loadMoreConversationsRef.current?.()}
            showPaginationHints={!searchActive}
            onConversationContextMenu={(id, x, y, source) => {
              if (import.meta.env.DEV) {
                console.log('[WhatsApp] conversation context menu open', { conversationId: id, x, y, source });
              }
              setConversationMenu({ id, x, y, source });
            }}
          />
        </aside>

        {/* Разделитель: левая панель ↔ центр (только desktop) */}
        {!isMobile && (
          <ResizeHandle
            direction="left"
            onResize={handleLeftPanelResize}
          />
        )}

        {/* Центр: чат. На mobile — высота по visualViewport, overflow hidden, только .chat-messages скроллится */}
        <section
          ref={isMobile ? chatPageRef : undefined}
          className={`
            flex flex-col min-w-0 bg-[#e5ddd5]
            ${isMobile ? 'w-full absolute inset-x-0 top-0 bottom-0 min-h-0 overflow-hidden' : 'flex-1 h-full'}
            ${showListOnly ? 'hidden' : ''}
          `}
          style={isMobile ? { height: chatPageHeight } : undefined}
        >
          {!displayItem ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 p-4">
              Выберите диалог
            </div>
          ) : (
            <div className={isMobile ? 'chat-layout chat-page flex flex-col flex-1 min-h-0 overflow-hidden' : 'flex flex-col flex-1 min-h-0'}>
            <ChatWindow
              selectedItem={displayItem}
              displayTitle={displayItem ? (crmNamesByPhone.get(normalizePhone(displayItem.phone))?.trim() || displayItem.phone || null) : null}
              messages={messages}
              inputText={inputText}
              onInputChange={handleComposerInputChange}
              onSend={handleSend}
              sending={sending}
              onBack={isMobile ? () => setSelectedId(null) : undefined}
              isMobile={isMobile}
              mobileCrmAiComposer={mobileCrmAiComposer}
              pendingAttachment={pendingAttachment}
              onFileSelect={handleFileSelect}
              onClearAttachment={handleClearAttachment}
              uploadState={uploadState}
              sendError={sendError}
              mediaPreparing={mediaPreparing}
              onDismissError={() => setSendError(null)}
              onStartVoice={startVoiceRecording}
              onStopVoice={stopVoiceRecording}
              isRecordingVoice={isRecordingVoice}
              recordingStartedAt={recordingStartedAt}
              onVoiceRecordCancel={cancelVoiceRecording}
              voiceRecordingLocked={voiceRecordingLocked}
              onVoiceLock={lockVoiceRecording}
              onCameraCapture={handleCameraCapture}
              showCameraButton={isMobile}
              selectedMessageIds={selectedMessageIds}
              onToggleSelectMessage={(id) =>
                setSelectedMessageIds((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                )
              }
              onLongPressMessage={handleLongPressMessage}
              onContextMenuMessage={handleContextMenuMessage}
              onCloseSelection={closeSelectionAndOverlays}
              onReplyToMessage={handleReplyToMessage}
              onForwardMessages={handleForwardMessages}
              onDeleteMessages={handleDeleteMessages}
              onStarMessages={handleStarMessages}
              onCopyMessage={handleCopyMessage}
              onSelectionMore={handleSelectionMore}
              onReactionSelect={handleReactionSelect}
              replyToMessage={replyToMessage}
              onCancelReply={() => setReplyToMessage(null)}
              contextMenu={contextMenu}
              onCloseContextMenu={() => setContextMenu(null)}
              reactionPickerMessageId={reactionPickerMessageId}
              actionsSheetMessageId={actionsSheetMessageId}
              incognitoMode={incognitoMode}
              onToggleIncognito={isMobile ? () => setIncognitoMode((v) => !v) : undefined}
              onOpenClientInfo={isMobile ? () => setMobileClientSheetOpen(true) : undefined}
              knowledgeBase={knowledgeBase}
              quickReplies={quickReplies}
              onQuickReplySelect={handleQuickReplySelect}
              mediaQuickReplies={mediaQuickReplies}
              onMediaQuickReplySelect={incognitoMode ? undefined : handleMediaQuickReplySelect}
              onSendProposalImage={incognitoMode ? undefined : handleSendProposalImage}
              showAiDebug={isAdmin}
              onFilesDrop={incognitoMode ? undefined : handleFilesDrop}
              disableTranscribeAllButton={prepareForAnalysisRunning}
              onBatchTranscribeRunningChange={setBatchTranscribeRunning}
            />
            </div>
          )}
        </section>

        {/* Разделитель и правая колонка: карточка клиента (только при ширине ≥ 1200px, resizable) */}
        {isWideLayout && (
          <>
            <ResizeHandle
              direction="right"
              onResize={handleRightPanelResize}
            />
            <div
              className="flex flex-col min-h-0 flex-shrink-0"
              style={{
                width: rightPanelWidth,
                minWidth: RIGHT_PANEL_MIN,
                maxWidth: RIGHT_PANEL_MAX,
              }}
            >
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <ClientInfoPanel
                  phone={selectedItem?.phone && selectedItem.phone !== '…' ? selectedItem.phone : null}
                  conversationId={selectedId}
                  conversationDealId={selectedItem?.dealId ?? null}
                  messages={messages}
                  dealStatuses={dealStatuses}
                  managers={managers.map((m) => ({ id: m.id, name: m.name, color: m.color }))}
                  dealStatusCounts={dealStatusCounts}
                  managerCounts={managerCounts}
                  cities={citiesForFilter}
                  cityCounts={cityCounts}
                  onAddCity={handleAddCity}
                  fillWidth
                  getCurrentInputValue={() => inputText}
                  onInsertNextMessage={insertAiReplyIntoComposer}
                  isTranscribeBatchRunning={batchTranscribeRunning}
                  onPrepareForAnalysisStart={() => setPrepareForAnalysisRunning(true)}
                  onPrepareForAnalysisEnd={() => setPrepareForAnalysisRunning(false)}
                  aiBotEnabled={selectedItem?.aiBotEnabled ?? false}
                  aiBotAutoProposalEnabled={selectedItem?.aiBotAutoProposalEnabled ?? false}
                  onAiBotFlagsChange={selectedId ? handleAiBotFlagsChange : undefined}
                  aiBotFlagsSaving={aiBotFlagsSaving}
                  registerAiBotApplyFacts={(fn) => {
                    aiBotApplyFactsRef.current = fn ?? null;
                  }}
                  conversationChannel={selectedItem?.channel ?? 'whatsapp'}
                  aiRuntime={selectedItem?.aiRuntime ?? defaultWhatsAppAiRuntime()}
                  crmAiBots={crmAiBots}
                  onAiRuntimePatch={selectedId ? handleAiRuntimePatch : undefined}
                  aiRuntimeSaving={aiRuntimeSaving}
                  onCreateDealFromAiRecommendation={selectedId ? handleCreateDealFromAiRecommendation : undefined}
                  creatingAiDealFromRec={creatingAiDealFromRec}
                  onCreateTaskFromAiRecommendation={selectedId ? handleCreateTaskFromAiRecommendation : undefined}
                  creatingAiTaskFromRec={creatingAiTaskFromRec}
                  kaspiOrderNumber={selectedItem?.kaspiOrderNumber ?? null}
                  kaspiOrderAmount={selectedItem?.kaspiOrderAmount ?? null}
                  kaspiOrderStatus={selectedItem?.kaspiOrderStatus ?? null}
                  kaspiOrderCustomerName={selectedItem?.kaspiOrderCustomerName ?? null}
                  kaspiOrderAddress={selectedItem?.kaspiOrderAddress ?? null}
                  kaspiOrderUrl={selectedItem?.kaspiOrderUrl ?? null}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <ForwardDialog
        open={forwardDialogOpen}
        targets={listWithDisplayTitle.map((c) => ({
          id: c.id,
          phone: c.phone ?? '',
          displayTitle: c.displayTitle ?? c.phone ?? '—',
          lastMessagePreview: getLastMessagePreview(c.lastMessage) || undefined,
          dealStatusName: c.dealStatusName ?? undefined,
          avatarUrl: c.client?.avatarUrl ?? undefined
        }))}
        excludeConversationId={selectedId}
        selectedCount={selectedMessageIds.length}
        forwardPreviewSummary={forwardPreviewSummary}
        onClose={() => setForwardDialogOpen(false)}
        onForward={handleForwardConfirm}
        loading={forwardLoading}
        isMobile={isMobile}
      />
      {/* Mobile: bottom sheet в document.body — вне overflow-hidden/layout; без transform на корне (ломает inner scroll на iOS). */}
      {typeof document !== 'undefined' &&
        isMobile &&
        mobileClientSheetOpen &&
        selectedItem &&
        createPortal(
          <div
            className="fixed inset-0 z-[1100] flex flex-col justify-end"
            role="dialog"
            aria-modal="true"
            aria-label="Карточка клиента"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/40 transition-opacity"
              onClick={() => setMobileClientSheetOpen(false)}
              aria-label="Закрыть карточку клиента"
            />
            <div
              id="clientSheet"
              className={[
                'bottom-sheet relative flex min-h-0 w-full max-w-[100vw] flex-col rounded-t-2xl bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.1)]',
                'transition-[height] duration-300 ease-out',
                clientSheetPosition === 'open'
                  ? 'h-[min(90dvh,calc(100dvh-env(safe-area-inset-bottom,0px)))] max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-bottom,0px)))]'
                  : 'h-[min(54dvh,calc(100dvh-env(safe-area-inset-bottom,0px)-48px))] max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-bottom,0px)))]'
              ].join(' ')}
            >
              <div className="sheet-header flex shrink-0 flex-col">
                <button
                  type="button"
                  className="sheet-handle h-1.5 w-10 shrink-0 rounded-full bg-gray-300 mx-auto mt-2.5 mb-1 cursor-grab touch-none border-0 p-0"
                  aria-label={clientSheetPosition === 'open' ? 'Свернуть' : 'Развернуть'}
                  onClick={() => setClientSheetPosition((p) => (p === 'open' ? 'peek' : 'open'))}
                  onTouchStart={(e) => {
                    clientSheetTouchStartY.current = e.touches[0].clientY;
                    clientSheetDragStartPosition.current = clientSheetPosition;
                  }}
                  onTouchMove={(e) => {
                    const currentY = e.touches[0].clientY;
                    const deltaY = currentY - clientSheetTouchStartY.current;
                    if (deltaY > 120) setMobileClientSheetOpen(false);
                    else if (deltaY < -80 && clientSheetDragStartPosition.current === 'peek')
                      setClientSheetPosition('open');
                    else if (deltaY > 80 && clientSheetDragStartPosition.current === 'open')
                      setClientSheetPosition('peek');
                  }}
                />
              </div>
              <div
                className="sheet-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 [touch-action:pan-y]"
                style={{
                  paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                <ClientInfoPanel
                  phone={
                    selectedItem.phone && selectedItem.phone !== '…'
                      ? selectedItem.phone
                      : selectedItem.client?.phone ?? null
                  }
                  conversationId={selectedId}
                  conversationDealId={selectedItem.dealId ?? null}
                  messages={messages}
                  dealStatuses={dealStatuses}
                  managers={managers.map((m) => ({ id: m.id, name: m.name, color: m.color }))}
                  dealStatusCounts={dealStatusCounts}
                  managerCounts={managerCounts}
                  cities={citiesForFilter}
                  cityCounts={cityCounts}
                  onAddCity={handleAddCity}
                  embeddedInSheet
                  getCurrentInputValue={() => inputText}
                  onInsertNextMessage={insertAiReplyIntoComposer}
                  aiBotEnabled={selectedItem?.aiBotEnabled ?? false}
                  aiBotAutoProposalEnabled={selectedItem?.aiBotAutoProposalEnabled ?? false}
                  onAiBotFlagsChange={selectedId ? handleAiBotFlagsChange : undefined}
                  aiBotFlagsSaving={aiBotFlagsSaving}
                  isTranscribeBatchRunning={batchTranscribeRunning}
                  onPrepareForAnalysisStart={() => setPrepareForAnalysisRunning(true)}
                  onPrepareForAnalysisEnd={() => setPrepareForAnalysisRunning(false)}
                  registerAiBotApplyFacts={(fn) => {
                    aiBotApplyFactsRef.current = fn ?? null;
                  }}
                  conversationChannel={selectedItem.channel ?? 'whatsapp'}
                  aiRuntime={selectedItem.aiRuntime ?? defaultWhatsAppAiRuntime()}
                  crmAiBots={crmAiBots}
                  onAiRuntimePatch={selectedId ? handleAiRuntimePatch : undefined}
                  aiRuntimeSaving={aiRuntimeSaving}
                  onCreateDealFromAiRecommendation={selectedId ? handleCreateDealFromAiRecommendation : undefined}
                  creatingAiDealFromRec={creatingAiDealFromRec}
                  onCreateTaskFromAiRecommendation={selectedId ? handleCreateTaskFromAiRecommendation : undefined}
                  creatingAiTaskFromRec={creatingAiTaskFromRec}
                  kaspiOrderNumber={selectedItem.kaspiOrderNumber ?? null}
                  kaspiOrderAmount={selectedItem.kaspiOrderAmount ?? null}
                  kaspiOrderStatus={selectedItem.kaspiOrderStatus ?? null}
                  kaspiOrderCustomerName={selectedItem.kaspiOrderCustomerName ?? null}
                  kaspiOrderAddress={selectedItem.kaspiOrderAddress ?? null}
                  kaspiOrderUrl={selectedItem.kaspiOrderUrl ?? null}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
      {conversationMenu && (() => {
        const conv = listWithDisplayTitle.find((c) => c.id === conversationMenu.id) ?? null;
        const attention = conv ? getConversationAttentionState(conv) : 'normal';
        const isNeedReply = attention === 'need_reply';
        const canMarkUnread =
          !!conv && (conv.unreadCount ?? 0) === 0 && !!(conv.lastMessage && conv.lastMessage.direction === 'incoming');

        const handleDismiss = async () => {
          if (!conv || !isNeedReply) {
            setConversationMenu(null);
            return;
          }
          if (import.meta.env.DEV) {
            console.log('[WhatsApp] reset awaiting reply click', { conversationId: conv.id });
          }
          const originalDismissed = conv.awaitingReplyDismissedAt;
          // optimistic UI
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conv.id ? { ...c, awaitingReplyDismissedAt: new Date() } : c
            )
          );
          try {
            if (import.meta.env.DEV) {
              console.log('[WhatsApp] reset awaiting reply start', { conversationId: conv.id });
            }
            await dismissAwaitingReply(conv.id);
            if (import.meta.env.DEV) {
              console.log('[WhatsApp] reset awaiting reply success', { conversationId: conv.id });
            }
          } catch (error) {
            if (import.meta.env.DEV) {
              console.error('[WhatsApp] reset awaiting reply failed', error);
            }
            // revert optimistic change
            setConversations((prev) =>
              prev.map((c) =>
                c.id === conv.id ? { ...c, awaitingReplyDismissedAt: originalDismissed } : c
              )
            );
            showErrorNotification('Не удалось сбросить статус "Ждёт ответа"');
          } finally {
            setConversationMenu(null);
          }
        };

        const handleMarkUnread = async () => {
          if (!conv || !canMarkUnread) {
            setConversationMenu(null);
            return;
          }
          if (import.meta.env.DEV) {
            console.log('[WhatsApp] mark unread click', { conversationId: conv.id });
          }
          const originalUnread = conv.unreadCount ?? 0;
          // optimistic UI
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conv.id ? { ...c, unreadCount: Math.max(1, originalUnread) } : c
            )
          );
          try {
            if (import.meta.env.DEV) {
              console.log('[WhatsApp] mark unread start', { conversationId: conv.id });
            }
            await markConversationAsUnread(conv.id);
            if (import.meta.env.DEV) {
              console.log('[WhatsApp] mark unread success', { conversationId: conv.id });
            }
          } catch (error) {
            if (import.meta.env.DEV) {
              console.error('[WhatsApp] mark unread failed', error);
            }
            // revert optimistic change
            setConversations((prev) =>
              prev.map((c) =>
                c.id === conv.id ? { ...c, unreadCount: originalUnread } : c
              )
            );
            showErrorNotification('Не удалось вернуть чат в непрочитанные');
          } finally {
            setConversationMenu(null);
          }
        };

        if (conversationMenu.source === 'mobile' && isMobile) {
          // Mobile: bottom sheet
          return (
            <div
              className="fixed inset-0 z-[1300] flex flex-col justify-end bg-black/40"
              onClick={() => setConversationMenu(null)}
            >
              <div
                className="bg-white rounded-t-2xl shadow-xl p-3 space-y-1"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-2" />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(conv?.id ?? null);
                    setConversationMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-800 hover:bg-gray-100"
                >
                  Открыть чат
                </button>
                {isNeedReply && (
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-amber-700 hover:bg-amber-50"
                  >
                    Сбросить статус «Ждёт ответа»
                  </button>
                )}
                {canMarkUnread && (
                  <button
                    type="button"
                    onClick={handleMarkUnread}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-blue-700 hover:bg-blue-50"
                  >
                    Пометить как непрочитанное
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (conv) setDeleteClientConversationId(conv.id);
                    setConversationMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
                >
                  🗑 Удалить клиента
                </button>
                <button
                  type="button"
                  onClick={() => setConversationMenu(null)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
                >
                  Отмена
                </button>
              </div>
            </div>
          );
        }

        // Desktop: контекстное меню у курсора
        const menuX = conversationMenu.x;
        const menuY = conversationMenu.y;
        return (
          <div
            className="fixed inset-0 z-[1300]"
            onClick={() => setConversationMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setConversationMenu(null);
            }}
          >
            <div
              className="absolute min-w-[220px] rounded-md bg-white shadow-lg border border-gray-200 py-1 text-sm text-gray-800"
              style={{ top: menuY, left: menuX }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedId(conv?.id ?? null);
                  setConversationMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-gray-100"
              >
                Открыть чат
              </button>
              {isNeedReply && (
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full text-left px-3 py-1.5 hover:bg-amber-50 text-amber-700"
                >
                  Сбросить статус «Ждёт ответа»
                </button>
              )}
              {canMarkUnread && (
                <button
                  type="button"
                  onClick={handleMarkUnread}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-blue-700"
                >
                  Пометить как непрочитанное
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (conv) setDeleteClientConversationId(conv.id);
                  setConversationMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600"
              >
                🗑 Удалить клиента
              </button>
            </div>
          </div>
        );
      })()}

      <DeleteClientConfirmModal
        open={deleteClientConversationId !== null}
        onClose={() => setDeleteClientConversationId(null)}
        onConfirm={async () => {
          if (!deleteClientConversationId) return;
          const convId = deleteClientConversationId;
          setDeleteClientLoading(true);
          try {
            const deletedBy = user?.email ?? user?.uid ?? 'unknown';
            await deleteClientWithConversation(convId, deletedBy);
            setDeleteClientConversationId(null);
            if (selectedId === convId) {
              const remaining = listWithDisplayTitle.filter((c) => c.id !== convId);
              setSelectedId(remaining[0]?.id ?? null);
            }
          } catch (err) {
            if (import.meta.env.DEV) console.error('[WhatsApp] deleteClientWithConversation failed', err);
            showErrorNotification('Не удалось удалить клиента');
          } finally {
            setDeleteClientLoading(false);
          }
        }}
        loading={deleteClientLoading}
      />
    </div>
  );
};

export default WhatsAppChat;
