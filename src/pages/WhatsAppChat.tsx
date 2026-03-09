import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import { useCompanyId } from '../contexts/CompanyContext';
import { useMobileWhatsAppChat } from '../contexts/MobileWhatsAppChatContext';
import {
  subscribeConversationsList,
  subscribeMessages,
  clearUnreadCount,
  type ConversationListItem
} from '../lib/firebase/whatsappDb';
import type { WhatsAppMessage } from '../types/whatsappDb';
import ConversationList from '../components/whatsapp/ConversationList';
import ChatWindow from '../components/whatsapp/ChatWindow';
import ClientInfoPanel from '../components/whatsapp/ClientInfoPanel';
import { supabase, CLIENTS_BUCKET } from '../lib/supabase/config';
import { MAX_ATTACHMENT_MB } from '../components/whatsapp/ChatInput';
import { compressImage, validateVideoFile } from '../utils/mediaUtils';

const NEW_MESSAGE_SOUND_PATH = '/sounds/new-message.mp3';

const WHATSAPP_MEDIA_PREFIX = 'whatsapp/media';
const MAX_BYTES = MAX_ATTACHMENT_MB * 1024 * 1024;

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

const MOBILE_BREAKPOINT = 768;

const WhatsAppChat: React.FC = () => {
  const isMobile = useIsMobile(MOBILE_BREAKPOINT);
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
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const prevConversationsRef = useRef<ConversationListItem[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const mobileChatContext = useMobileWhatsAppChat();
  const selectedItem = conversations.find((c) => c.id === selectedId);

  // Синхронизация с контекстом: на mobile при открытом чате скрываем плавающие кнопки
  useEffect(() => {
    if (!mobileChatContext) return;
    const open = isMobile && !!selectedId;
    mobileChatContext.setMobileWhatsAppChatOpen(open);
    return () => mobileChatContext.setMobileWhatsAppChatOpen(false);
  }, [isMobile, selectedId, mobileChatContext]);

  // Mobile: кнопка «Назад» браузера закрывает чат и возвращает к списку
  useEffect(() => {
    if (!isMobile) return;
    const handlePopState = () => {
      if (selectedIdRef.current) setSelectedId(null);
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
    const onError = (err: unknown) => {
      const msg = String(err && typeof err === 'object' && 'message' in err ? (err as Error).message : err);
      if (msg.includes('index') && msg.includes('building')) {
        setIndexBuilding(true);
      }
    };
    const unsub = subscribeConversationsList(setConversationsWithNotification, onError);
    return unsub;
  }, [setConversationsWithNotification]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    setIndexBuilding(false);
    clearUnreadCount(selectedId).catch((err) => {
      if (import.meta.env.DEV) {
        console.warn('[WhatsApp] clearUnreadCount failed:', err);
      }
    });
    const onError = (err: unknown) => {
      const msg = String(err && typeof err === 'object' && 'message' in err ? (err as Error).message : err);
      if (msg.includes('index') && msg.includes('building')) {
        setIndexBuilding(true);
      }
    };
    const unsub = subscribeMessages(selectedId, setMessages, onError);
    return unsub;
  }, [selectedId]);

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

  const startVoiceRecording = useCallback(async () => {
    setSendError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mime });
        const file = new File([blob], 'voice.webm', { type: blob.type });
        handleFileSelect(file);
      };
      recorder.start(200);
      setIsRecordingVoice(true);
    } catch (err) {
      console.error('Voice recording error:', err);
      setSendError('Нет доступа к микрофону.');
    }
  }, [handleFileSelect]);

  const stopVoiceRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    mediaRecorderRef.current = null;
    setIsRecordingVoice(false);
  }, []);

  useEffect(() => () => {
    if (pendingAttachment?.preview) URL.revokeObjectURL(pendingAttachment.preview);
  }, [pendingAttachment]);

  const handleSend = async () => {
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
            text: caption || undefined
          })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setInputText('');
          setSendError(null);
          setPendingAttachment((p) => {
            if (p?.preview) URL.revokeObjectURL(p.preview);
            return null;
          });
        } else {
          setSendError((data as { error?: string })?.error || 'Ошибка отправки. Попробуйте ещё раз.');
        }
      } finally {
        setUploadState('idle');
      }
      return;
    }

    if (!caption) return;
    setSending(true);
    setInputText('');
    try {
      const res = await fetch(SEND_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: phone, text: caption })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInputText(caption);
        setSendError((data as { error?: string })?.error || 'Ошибка отправки.');
      } else {
        setSendError(null);
      }
    } finally {
      setSending(false);
    }
  };

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

  return (
    <div
      className={`flex flex-col h-full bg-gray-50 ${isMobileChatView ? 'overflow-hidden' : ''}`}
    >
      {/* Заголовок: на мобильном в чате не показываем (есть свой header в ChatWindow) */}
      {(!isMobile || !selectedId) && (
        <div className="flex-none px-4 py-3 border-b bg-white">
          <h1 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-600" />
            WhatsApp
          </h1>
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
          <ConversationList
            items={conversations.map((c) =>
              c.id === selectedId ? { ...c, unreadCount: 0 } : c
            )}
            selectedId={selectedId}
            onSelect={setSelectedId}
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
              onCameraCapture={handleCameraCapture}
              showCameraButton={isMobile}
            />
          )}
        </section>

        {/* Правая колонка: карточка клиента (только desktop, 320px) */}
        {!isMobile && (
          <ClientInfoPanel phone={selectedItem?.phone && selectedItem.phone !== '…' ? selectedItem.phone : null} />
        )}
      </div>
    </div>
  );
};

export default WhatsAppChat;
