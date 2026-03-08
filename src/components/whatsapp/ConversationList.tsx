import React from 'react';
import { formatLastMessageTime } from './whatsappUtils';
import type { ConversationListItem } from '../../lib/firebase/whatsappDb';

interface ConversationListProps {
  items: ConversationListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const ConversationList: React.FC<ConversationListProps> = ({ items, selectedId, onSelect }) => {
  return (
    <div className="flex-1 overflow-y-auto">
      {items.length === 0 && (
        <div className="p-4 text-sm text-gray-500 text-center md:p-4">
          Нет диалогов
        </div>
      )}
      {items.map((item) => {
        const hasUnread = (item.unreadCount ?? 0) > 0;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`w-full text-left border-b border-gray-100 hover:bg-gray-50 transition-colors px-3 py-2.5 md:px-4 md:py-3 ${
              selectedId === item.id ? 'bg-green-50 border-l-4 border-l-green-500 md:border-l-4' : ''
            } ${hasUnread ? 'bg-gray-100/80' : ''}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`truncate text-sm md:text-base ${hasUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'}`}>
                {item.client?.phone ?? item.clientId ?? '—'}
              </span>
              {(item.unreadCount ?? 0) > 0 && (
                <span
                  className="flex-shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-[10px] bg-red-500 text-white text-xs font-medium"
                >
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </span>
              )}
            </div>
            {item.lastMessage && (
              <div className="flex justify-between items-center gap-2 mt-0.5">
                <span className={`truncate flex-1 text-xs md:text-sm ${hasUnread ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
                  {item.lastMessage.text}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {formatLastMessageTime(item.lastMessage.createdAt)}
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ConversationList;
