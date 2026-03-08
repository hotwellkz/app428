import React, { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { formatMessageTime } from './whatsappUtils';
import ChatInput from './ChatInput';
import type { WhatsAppMessage } from '../../types/whatsappDb';
import type { ConversationListItem } from '../../lib/firebase/whatsappDb';

interface ChatWindowProps {
  selectedItem: ConversationListItem;
  messages: WhatsAppMessage[];
  inputText: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  onBack?: () => void;
  /** На мобильных — фиксированный инпут и скролл по calc(100vh - header - input) */
  isMobile?: boolean;
}

const CHAT_HEADER_HEIGHT = 56;
const CHAT_INPUT_HEIGHT = 60;

const ChatWindow: React.FC<ChatWindowProps> = ({
  selectedItem,
  messages,
  inputText,
  onInputChange,
  onSend,
  sending,
  onBack,
  isMobile = false,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const phone = selectedItem.phone ?? selectedItem.client?.phone ?? selectedItem.clientId ?? '—';

  const messagesHeight = isMobile
    ? `calc(100vh - ${CHAT_HEADER_HEIGHT}px - ${CHAT_INPUT_HEIGHT}px)`
    : undefined;

  return (
    <>
      {/* Header: на мобильных — кнопка Назад + номер */}
      <div
        className="flex-none flex items-center gap-2 px-3 py-2 bg-white border-b min-h-[52px] md:min-h-0 md:px-4 md:py-2"
        style={isMobile ? { minHeight: CHAT_HEADER_HEIGHT } : undefined}
      >
        {isMobile && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex-shrink-0 p-2 -ml-1 rounded-lg hover:bg-gray-100 flex items-center gap-1 text-gray-700"
            aria-label="Назад к списку"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Назад</span>
          </button>
        )}
        <p className="font-medium text-gray-800 truncate flex-1 min-w-0 text-sm md:text-base">
          {isMobile && onBack ? phone : phone}
        </p>
      </div>

      {/* Сообщения: правый отступ чтобы не перекрывались плавающими кнопками (StickyNavigation) */}
      <div
        className={`flex-1 overflow-y-auto bg-[#e5ddd5] space-y-2 p-2 pb-4 md:p-4 ${isMobile ? 'pb-[72px] pr-[72px] md:pr-[88px]' : 'pr-[88px]'}`}
        style={messagesHeight ? { height: messagesHeight, flex: 'none' } : undefined}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`rounded-lg px-3 py-2 shadow-sm max-w-[80%] md:max-w-[60%] ${
                msg.direction === 'outgoing'
                  ? 'bg-[#dcf8c6] text-gray-900'
                  : 'bg-white text-gray-900'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
              <p className="text-xs text-gray-500 mt-1">
                {formatMessageTime(msg.createdAt)}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        value={inputText}
        onChange={onInputChange}
        onSend={onSend}
        disabled={!selectedItem?.phone || selectedItem.phone === '…'}
        sending={sending}
        fixedBottom={isMobile}
      />
    </>
  );
};

export default ChatWindow;
