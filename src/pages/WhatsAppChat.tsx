import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
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

const NEW_MESSAGE_SOUND_PATH = '/sounds/new-message.mp3';

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
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [indexBuilding, setIndexBuilding] = useState(false);

  const prevConversationsRef = useRef<ConversationListItem[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const selectedItem = conversations.find((c) => c.id === selectedId);

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
    clearUnreadCount(selectedId).catch(() => {});
    const onError = (err: unknown) => {
      const msg = String(err && typeof err === 'object' && 'message' in err ? (err as Error).message : err);
      if (msg.includes('index') && msg.includes('building')) {
        setIndexBuilding(true);
      }
    };
    const unsub = subscribeMessages(selectedId, setMessages, onError);
    return unsub;
  }, [selectedId]);

  const handleSend = async () => {
    const text = inputText.trim();
    const phone = selectedItem?.phone ?? selectedItem?.client?.phone;
    if (!text || !phone || phone === '…' || sending) return;
    setSending(true);
    setInputText('');
    try {
      const res = await fetch(SEND_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: phone, text })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInputText(text);
        console.error('Send error:', data);
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

  return (
    <div className="flex flex-col h-full bg-gray-50">
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
            items={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>

        {/* Центр: чат */}
        <section
          className={`
            flex flex-col min-w-0 bg-[#e5ddd5]
            ${isMobile ? 'w-full h-full absolute inset-0' : 'flex-1'}
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
