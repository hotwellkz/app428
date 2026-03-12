import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { MessageSquare, Search } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAuth } from '../hooks/useAuth';
import { useCompanyId } from '../contexts/CompanyContext';
import { useMobileWhatsAppChat } from '../contexts/MobileWhatsAppChatContext';
import {
  subscribeConversationsList,
  subscribeMessages,
  clearUnreadCount,
  dismissAwaitingReply,
  markConversationAsUnread,
  normalizePhone,
  softDeleteMessage,
  toggleStarMessage,
  addReactionToMessage,
  getConversationAttentionState,
  deleteClientWithConversation,
  type ConversationListItem
} from '../lib/firebase/whatsappDb';
import { showErrorNotification } from '../utils/notifications';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import type { WhatsAppMessage } from '../types/whatsappDb';
import type { MediaQuickReply } from '../types/mediaQuickReplies';
import ConversationList from '../components/whatsapp/ConversationList';
import ChatWindow from '../components/whatsapp/ChatWindow';
import ClientInfoPanel from '../components/whatsapp/ClientInfoPanel';
import ForwardDialog from '../components/whatsapp/ForwardDialog';
import DeleteClientConfirmModal from '../components/whatsapp/DeleteClientConfirmModal';
import { supabase, CLIENTS_BUCKET } from '../lib/supabase/config';
import { MAX_ATTACHMENT_MB } from '../components/whatsapp/ChatInput';
import { compressImage, validateVideoFile } from '../utils/mediaUtils';
import { createVoiceRecorder } from '../utils/voiceRecording';

const NEW_MESSAGE_SOUND_PATH = '/sounds/new-message.mp3';

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
    if (att.type === 'audio') return 'Аудио';
    return 'Файл';
  }
  const text = (msg.text ?? '').trim();
  return text ? (text.length > 50 ? text.slice(0, 50) + '…' : text) : '';
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

/** Преобразует литеральные \n в переносы строк перед отправкой в WhatsApp. */
function formatMessageForWhatsApp(message: string): string {
  if (typeof message !== 'string') return '';
  return message
    .replace(/\\n/g, '\n')
    .replace(/\n\n+/g, '\n\n')
    .trim();
}

const MOBILE_BREAKPOINT = 768;

const WhatsAppChat: React.FC = () => {
  const isMobile = useIsMobile(MOBILE_BREAKPOINT);
  const { isAdmin, user } = useAuth();
  const companyId = useCompanyId();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [indexBuilding, setIndexBuilding] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{ file: File; preview?: string } | null>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'sending'>('idle');
  const [sendError, setSendError] = useState<string | null>(null);
  type ChatFilter = 'all' | 'waiting' | 'unread';
  const [activeFilter, setActiveFilter] = useState<ChatFilter>('all');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const voiceRecorderRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const voiceCancelledRef = useRef(false);

  const prevConversationsRef = useRef<ConversationListItem[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  /** Чаты, открытые в этой сессии: в списке для них всегда показываем unreadCount=0 (защита от stale snapshot). */
  const [locallyReadChatIds, setLocallyReadChatIds] = useState<Set<string>>(() => new Set());
  /** Имена CRM-клиентов по нормализованному телефону (для отображения в списке и в шапке чата). */
  const [crmNamesByPhone, setCrmNamesByPhone] = useState<Map<string, string>>(() => new Map());
  /** Поиск по имени клиента, номеру и превью сообщения */
  const [searchQuery, setSearchQuery] = useState('');
  /** Режим выбора сообщений и действия над ними */
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [replyToMessage, setReplyToMessage] = useState<WhatsAppMessage | null>(null);
  const [contextMenu, setContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  const [actionsSheetMessageId, setActionsSheetMessageId] = useState<string | null>(null);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [forwardLoading, setForwardLoading] = useState(false);
  const [mobileClientSheetOpen, setMobileClientSheetOpen] = useState(false);
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
  const selectedItem = conversations.find((c) => c.id === selectedId);

  // Синхронизация с контекстом: на mobile при открытом чате скрываем плавающие кнопки
  useEffect(() => {
    if (!mobileChatContext) return;
    const open = isMobile && !!selectedId;
    mobileChatContext.setMobileWhatsAppChatOpen(open);
    return () => mobileChatContext.setMobileWhatsAppChatOpen(false);
  }, [isMobile, selectedId, mobileChatContext]);

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
    for (const item of newItems) {
      if (item.id === selected) continue;
      if (item.lastMessage?.direction !== 'incoming') continue;
      const prevItem = prev.find((p) => p.id === item.id);
      const prevLastId = prevItem?.lastMessage?.id;
      const newLastId = item.lastMessage?.id;
      if (newLastId && newLastId !== prevLastId) {
        playNewMessageSound();
        if (document.visibilityState !== 'visible') {
          showNewMessageBrowserNotification();
        }
        break;
      }
    }
    prevConversationsRef.current = newItems;
    setConversations(newItems);
  }, []);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!companyId) {
      setConversations([]);
      return;
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
    const unsub = subscribeConversationsList(companyId, setConversationsWithNotification, onError);
    return unsub;
  }, [companyId, setConversationsWithNotification]);

  useEffect(() => {
    if (!companyId) {
      setCrmNamesByPhone(new Map());
      return;
    }
    const q = query(
      collection(db, 'clients'),
      where('companyId', '==', companyId)
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const map = new Map<string, string>();
        snapshot.docs.forEach((d) => {
          const data = d.data();
          const phone = data.phone as string | undefined;
          const name = ((data.name as string) ?? '').trim();
          if (!phone) return;
          const norm = normalizePhone(phone);
          if (name) {
            if (import.meta.env.DEV && map.has(norm) && map.get(norm) !== name) {
              console.warn('[WhatsApp] Два клиента CRM с одним номером:', norm);
            }
            map.set(norm, name);
          }
        });
        setCrmNamesByPhone(map);
      },
      () => setCrmNamesByPhone(new Map())
    );
    return () => unsub();
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
      setLocallyReadChatIds((prev) => new Set(prev).add(conversationId));
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

  const listWithDisplayTitle = useMemo(() => {
    return conversations.map((c) => {
      const effectiveUnread = locallyReadChatIds.has(c.id) ? 0 : (c.unreadCount ?? 0);
      const normPhone = normalizePhone(c.phone ?? c.client?.phone ?? '');
      const statusId = normPhone ? dealStatusByPhone.get(normPhone) ?? null : null;
      const managerId = normPhone ? managerByPhone.get(normPhone) ?? null : null;
      const displayTitle =
        crmNamesByPhone.get(normalizePhone(c.phone))?.trim() || c.phone || '—';
      const status = statusId ? (dealStatuses.find((s) => s.id === statusId) ?? null) : null;
      const dealStatusColor = status?.color?.trim() || null;
      const dealStatusName = status?.name?.trim() || null;
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
        managerName: managerName || undefined
      };
    });
  }, [conversations, locallyReadChatIds, crmNamesByPhone, dealStatusByPhone, dealStatuses, managerByPhone, managers]);

  const handleFileSelect = useCallback((file: File) => {
    setSendError(null);
    if (file.size > MAX_BYTES) {
      setSendError(`Файл слишком большой. Максимум ${MAX_ATTACHMENT_MB} МБ.`);
      return;
    }
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    setPendingAttachment({ file, preview });
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
      const chatId = normalizePhone(phone);
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
      setUploadState('uploading');
      try {
        for (let i = 0; i < valid.length; i++) {
          if (i > 0) await new Promise((r) => setTimeout(r, 300));
          const file = valid[i];
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
            body: JSON.stringify({
              chatId,
              contentUri: urlData.publicUrl,
              attachmentType: getAttachmentType(file),
              fileName: file.name,
              companyId
            })
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

  const handleCameraCapture = useCallback(
    async (file: File) => {
      setSendError(null);
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (isImage) {
        setUploadState('uploading');
        try {
          const compressed = await compressImage(file);
          if (compressed.size > MAX_BYTES) {
            setSendError(`Файл слишком большой. Максимум ${MAX_ATTACHMENT_MB} МБ.`);
            setUploadState('idle');
            return;
          }
          const preview = URL.createObjectURL(compressed);
          setPendingAttachment({ file: compressed, preview });
        } catch (err) {
          console.error('Image compress error:', err);
          setSendError('Не удалось обработать фото.');
        } finally {
          setUploadState('idle');
        }
        return;
      }
      if (isVideo) {
        const validation = validateVideoFile(file, MAX_BYTES);
        if (!validation.ok) {
          setSendError(validation.error ?? 'Видео не подходит.');
          return;
        }
        setPendingAttachment({ file });
        return;
      }
      setSendError('Выберите фото или видео.');
    },
    []
  );

  const sendVoiceBlobRef = useRef<(blob: Blob) => void>(() => {});

  const startVoiceRecording = useCallback(async () => {
    setSendError(null);
    voiceCancelledRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = await createVoiceRecorder(stream, (blob) => {
        if (voiceCancelledRef.current) return;
        sendVoiceBlobRef.current(blob);
      });
      if (!recorder) {
        stream.getTracks().forEach((t) => t.stop());
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
          body: JSON.stringify({
            chatId: phone,
            contentUri: urlData.publicUrl,
            attachmentType: 'voice',
            fileName,
            repliedToMessageId: replyToMessage?.id ?? undefined,
            companyId
          })
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
      setUploadState('uploading');
      try {
        const path = `${companyId}/${WHATSAPP_MEDIA_PREFIX}/${selectedId}/${Date.now()}_${sanitizeFileName(pendingAttachment!.file.name)}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(CLIENTS_BUCKET)
          .upload(path, pendingAttachment!.file, { upsert: false });

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
          body: JSON.stringify({
            chatId: phone,
            contentUri,
            attachmentType: getAttachmentType(pendingAttachment!.file),
            fileName: pendingAttachment!.file.name,
            text: caption ? formatMessageForWhatsApp(caption) : undefined,
            repliedToMessageId: replyToMessage?.id ?? undefined,
            companyId: companyId ?? undefined
          })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setInputText('');
          setSendError(null);
          setReplyToMessage(null);
          setPendingAttachment((p) => {
            if (p?.preview) URL.revokeObjectURL(p.preview);
            return null;
          });
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

    if (!caption) return;
    setSending(true);
    setInputText('');
    const replyId = replyToMessage?.id;
    try {
      const res = await fetch(SEND_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: phone,
          text: formatMessageForWhatsApp(caption),
          repliedToMessageId: replyId ?? undefined,
          companyId: companyId ?? undefined
        })
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
      } else {
        setSendError(null);
        setReplyToMessage(null);
      }
    } finally {
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
          body: JSON.stringify({
            chatId: phone,
            contentUri,
            attachmentType: 'image',
            fileName: 'kp.jpg',
            companyId: companyId ?? undefined
          })
        });
        const dataImage = (await resImage.json().catch(() => ({}))) as { error?: string };
        if (!resImage.ok) {
          setSendError(dataImage?.error ?? 'Не удалось отправить КП.');
          return;
        }
        setSendError(null);

        // Небольшая задержка, чтобы WhatsApp корректно показывал порядок сообщений
        await new Promise((r) => setTimeout(r, 300));

        // 2) Отправляем текст отдельным сообщением
        const textToSend = (caption || '').trim() || 'Ваше коммерческое предложение по дому из SIP-панелей.\n\nЕсли будут вопросы — напишите 👍';
        const resText = await fetch(SEND_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: phone,
            text: formatMessageForWhatsApp(textToSend),
            companyId: companyId ?? undefined
          })
        });
        if (!resText.ok) {
          const dataText = (await resText.json().catch(() => ({}))) as { error?: string };
          setSendError(dataText?.error ?? 'КП отправлено, но не удалось отправить подпись.');
        }
      } finally {
        setUploadState('idle');
      }
    },
    [companyId, selectedId, listWithDisplayTitle, incognitoMode]
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

  const handleQuickReplySelect = useCallback(
    async (item: {
      text: string;
      files?: Array<{ id: string; url: string; name: string; type: string; size?: number }>;
      attachmentUrl?: string;
      attachmentType?: 'image' | 'video' | 'file' | 'audio';
      attachmentFileName?: string;
    }) => {
      if (!selectedId || !companyId) return;
      const conv = conversations.find((c) => c.id === selectedId);
      const phone = conv?.phone ?? conv?.client?.phone;
      if (!phone || phone === '…') return;
      const chatId = normalizePhone(phone);
      const fileList = (item.files?.length ? item.files : item.attachmentUrl
        ? [{ url: item.attachmentUrl, type: item.attachmentType || 'file', name: item.attachmentFileName ?? 'Файл', id: 'legacy' }]
        : []) as Array<{ id: string; url: string; name: string; type: string }>;
      setSending(true);
      try {
        const textPayload = formatMessageForWhatsApp(item.text || '');
        await fetch(SEND_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, text: textPayload, companyId })
        });
        for (let i = 0; i < fileList.length; i++) {
          await new Promise((r) => setTimeout(r, i === 0 ? 300 : QUICK_REPLY_FILES_DELAY_MS));
          await fetch(SEND_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId,
              contentUri: fileList[i].url,
              attachmentType: fileList[i].type as 'image' | 'video' | 'file' | 'audio',
              fileName: fileList[i].name,
              companyId
            })
          });
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('[WhatsApp] quick reply send failed', err);
        showErrorNotification('Не удалось отправить шаблон');
      } finally {
        setSending(false);
      }
    },
    [selectedId, companyId, conversations]
  );

  const MEDIA_SEND_DELAY_MS = 400;

  const handleMediaQuickReplySelect = useCallback(
    async (reply: MediaQuickReply) => {
      if (!selectedId || !companyId) return;
      const conv = conversations.find((c) => c.id === selectedId);
      const phone = conv?.phone ?? conv?.client?.phone;
      if (!phone || phone === '…') return;
      const chatId = normalizePhone(phone);
      const files = [...(reply.files ?? [])].sort((a, b) => a.order - b.order);
      if (files.length === 0) return;
      setSending(true);
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const res = await fetch(SEND_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId,
              contentUri: file.url,
              attachmentType: 'image' as const,
              fileName: file.fileName ?? undefined,
              companyId
            })
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
              chatId: targetPhone,
              forwarded: true
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
            await fetch(SEND_API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          }
        }
        setForwardDialogOpen(false);
        closeSelectionAndOverlays();
      } finally {
        setForwardLoading(false);
      }
    },
    [selectedId, companyId, messages, selectedMessageIds, conversations, closeSelectionAndOverlays]
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

  const isMobileChatView = isMobile && !!selectedId;

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
    const q = searchQuery.trim().toLowerCase();

    let base = listWithDisplayTitle;
    if (q) {
      base = base.filter((item) => {
        const preview = item.lastMessage?.attachments?.length
          ? '[медиа]'
          : (item.lastMessage?.text ?? '').slice(0, 200);
        const searchable = [item.displayTitle ?? '', item.phone ?? '', preview].join(' ').toLowerCase();
        return searchable.includes(q);
      });
    }

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
  }, [listWithDisplayTitle, searchQuery, activeFilter, dealStatusFilter, managerFilter]);

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

  return (
    <div
      className={`flex flex-col h-full bg-gray-50 ${isMobileChatView ? 'overflow-hidden' : ''}`}
    >
      {/* Заголовок: на мобильном в чате не показываем (есть свой header в ChatWindow) */}
      {(!isMobile || !selectedId) && (
        <div className="flex-none px-4 py-3 border-b bg-white">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-600" />
              WhatsApp
            </h1>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIncognitoMode((v) => !v)}
                className="inline-flex items-center gap-2 text-xs md:text-sm px-2 py-1 rounded-full border transition-colors
                  border-gray-300 bg-gray-50 hover:bg-gray-100
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
              <div id="crm-clock" className="crm-clock" aria-live="polite">
                {clockTime}
              </div>
            </div>
          </div>
          {incognitoMode && (
            <p className="mt-2 text-[11px] md:text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1 inline-flex items-center gap-1">
              Просмотр без отметки о прочтении и без отправки сообщений.
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

      {/* Desktop: три колонки (300px | flex | 320px). Mobile: один экран — список ИЛИ чат */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Левая колонка: список диалогов (desktop 300px) */}
        <aside
          className={`
            flex flex-col overflow-hidden bg-white border-r border-gray-200
            ${isMobile ? 'w-full h-full absolute inset-0' : 'w-[300px] flex-shrink-0'}
            ${showChatOnly ? 'hidden' : ''}
          `}
          style={!isMobile ? { minWidth: 300 } : undefined}
        >
          <div className="flex-none border-b border-gray-100 bg-gray-50/80">
            <div className="flex items-center gap-2 px-3 py-2">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по имени или номеру..."
                className="flex-1 min-w-0 py-2 px-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400"
                aria-label="Поиск по имени или номеру"
              />
            </div>
            <div className="flex flex-nowrap items-center gap-2.5 px-3 pb-2 text-[11px] md:text-xs overflow-x-auto">
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
                <span className="inline-flex h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#FF9F2F' }} />
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
                <span className="inline-flex h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#FF4D4F' }} />
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
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[11px] md:text-xs"
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
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[11px] md:text-xs"
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
          </div>
          <ConversationList
            items={filteredList}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onConversationContextMenu={(id, x, y, source) => {
              if (import.meta.env.DEV) {
                console.log('[WhatsApp] conversation context menu open', { conversationId: id, x, y, source });
              }
              setConversationMenu({ id, x, y, source });
            }}
          />
        </aside>

        {/* Центр: чат. На mobile — полноэкранная колонка с flex, composer внизу в потоке */}
        <section
          className={`
            flex flex-col min-w-0 bg-[#e5ddd5]
            ${isMobile ? 'w-full h-full absolute inset-0 min-h-0' : 'flex-1'}
            ${showListOnly ? 'hidden' : ''}
          `}
        >
          {!displayItem ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 p-4">
              Выберите диалог
            </div>
          ) : (
            <ChatWindow
              selectedItem={displayItem}
              displayTitle={displayItem ? (crmNamesByPhone.get(normalizePhone(displayItem.phone))?.trim() || displayItem.phone || null) : null}
              messages={messages}
              inputText={inputText}
              onInputChange={setInputText}
              onSend={handleSend}
              sending={sending}
              onBack={isMobile ? () => setSelectedId(null) : undefined}
              isMobile={isMobile}
              pendingAttachment={pendingAttachment}
              onFileSelect={handleFileSelect}
              onClearAttachment={handleClearAttachment}
              uploadState={uploadState}
              sendError={sendError}
              onDismissError={() => setSendError(null)}
              onStartVoice={startVoiceRecording}
              onStopVoice={stopVoiceRecording}
              isRecordingVoice={isRecordingVoice}
              recordingStartedAt={recordingStartedAt}
              onVoiceRecordCancel={cancelVoiceRecording}
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
              onOpenClientInfo={isMobile ? () => setMobileClientSheetOpen(true) : undefined}
              knowledgeBase={knowledgeBase}
              quickReplies={quickReplies}
              onQuickReplySelect={handleQuickReplySelect}
              mediaQuickReplies={mediaQuickReplies}
              onMediaQuickReplySelect={incognitoMode ? undefined : handleMediaQuickReplySelect}
              onSendProposalImage={incognitoMode ? undefined : handleSendProposalImage}
              showAiDebug={isAdmin}
              onFilesDrop={incognitoMode ? undefined : handleFilesDrop}
            />
          )}
        </section>

        {/* Правая колонка: карточка клиента (только desktop, 320px) */}
        {!isMobile && (
          <ClientInfoPanel
            phone={selectedItem?.phone && selectedItem.phone !== '…' ? selectedItem.phone : null}
            messages={messages}
            dealStatuses={dealStatuses}
            managers={managers.map((m) => ({ id: m.id, name: m.name, color: m.color }))}
            dealStatusCounts={dealStatusCounts}
            managerCounts={managerCounts}
          />
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
      {/* Mobile: bottom sheet с карточкой клиента */}
      {isMobile && mobileClientSheetOpen && selectedItem && (
        <div
          className="fixed inset-0 z-[1100] flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Карточка клиента"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileClientSheetOpen(false)}
            aria-label="Закрыть карточку клиента"
          />
          <div
            className="relative bg-white rounded-t-2xl shadow-xl max-h-[80vh] pb-[env(safe-area-inset-bottom)] pt-2"
            style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-3" aria-hidden />
            <div className="px-3 pb-3 overflow-y-auto">
              <ClientInfoPanel
                phone={
                  selectedItem.phone && selectedItem.phone !== '…'
                    ? selectedItem.phone
                    : selectedItem.client?.phone ?? null
                }
                messages={messages}
                dealStatuses={dealStatuses}
                managers={managers.map((m) => ({ id: m.id, name: m.name, color: m.color }))}
                dealStatusCounts={dealStatusCounts}
                managerCounts={managerCounts}
              />
            </div>
          </div>
        </div>
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
