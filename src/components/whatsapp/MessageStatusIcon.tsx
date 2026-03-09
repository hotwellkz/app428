import React from 'react';
import { Clock, Check, CheckCheck, AlertCircle } from 'lucide-react';
import { mapProviderStatusToUiStatus } from './whatsappUtils';
import type { WhatsAppMessage } from '../../types/whatsappDb';

const MessageStatusIcon: React.FC<{ msg: WhatsAppMessage }> = ({ msg }) => {
  if (msg.direction !== 'outgoing') return null;
  const status = mapProviderStatusToUiStatus(msg.status);
  const title =
    status === 'pending'
      ? 'Отправляется'
      : status === 'sent'
        ? 'Отправлено'
        : status === 'delivered'
          ? 'Доставлено'
          : status === 'read'
            ? 'Прочитано'
            : status === 'failed'
              ? msg.errorMessage || 'Ошибка'
              : '';
  const className = 'w-3.5 h-3.5 flex-shrink-0 ml-1 inline-block';
  if (status === 'pending')
    return <Clock className={`${className} text-gray-400`} title={title} aria-hidden />;
  if (status === 'failed')
    return <AlertCircle className={`${className} text-red-500`} title={title} aria-hidden />;
  if (status === 'read')
    return <CheckCheck className={`${className} text-blue-600`} title={title} aria-hidden />;
  if (status === 'delivered')
    return <CheckCheck className={`${className} text-gray-500`} title={title} aria-hidden />;
  return <Check className={`${className} text-gray-500`} title={title} aria-hidden />;
};

export default MessageStatusIcon;
