import React from 'react';
import { X } from 'lucide-react';
import type { WhatsAppMessage } from '../../types/whatsappDb';

export interface ReplyComposerPreviewProps {
  message: WhatsAppMessage;
  onCancel: () => void;
}

function replyPreviewLabel(msg: WhatsAppMessage): string {
  if (msg.deleted) return 'Сообщение удалено';
  if (msg.attachments?.length) {
    const types: Record<string, string> = {
      image: 'Фото',
      video: 'Видео',
      audio: 'Аудио',
      file: 'Документ'
    };
    const first = msg.attachments[0];
    return types[first?.type ?? 'file'] ?? 'Медиа';
  }
  const text = (msg.text ?? '').trim();
  if (!text) return '[медиа]';
  return text.length > 60 ? text.slice(0, 60) + '…' : text;
}

const ReplyComposerPreview: React.FC<ReplyComposerPreviewProps> = ({ message, onCancel }) => {
  const directionLabel = message.direction === 'outgoing' ? 'Вы' : 'Контакт';
  const preview = replyPreviewLabel(message);

  return (
    <div className="flex-none flex items-start gap-2 px-3 py-2 bg-gray-100 border-t border-gray-200 rounded-t-lg">
      <div className="flex-1 min-w-0 border-l-4 border-green-500 pl-2 py-0.5">
        <p className="text-xs font-medium text-green-700">{directionLabel}</p>
        <p className="text-sm text-gray-700 truncate">{preview}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="flex-shrink-0 p-1 rounded hover:bg-gray-200 text-gray-500"
        aria-label="Отменить ответ"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default ReplyComposerPreview;
