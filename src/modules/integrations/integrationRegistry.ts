import { MessageSquare, Sparkles, ShoppingBag, Phone } from 'lucide-react';
import type { IntegrationRegistryItem } from './types';
import { CATEGORY_LABELS } from './types';

export const INTEGRATION_REGISTRY: IntegrationRegistryItem[] = [
  {
    id: 'wazzup',
    title: 'Wazzup',
    shortDescription: 'WhatsApp и Instagram: переписки в разделе Чаты CRM.',
    category: 'messengers',
    categoryLabel: CATEGORY_LABELS.messengers,
    Icon: MessageSquare
  },
  {
    id: 'openai',
    title: 'OpenAI',
    shortDescription: 'Ключ API для AI: чеки, переписки, смета и другие функции.',
    category: 'ai',
    categoryLabel: CATEGORY_LABELS.ai,
    Icon: Sparkles
  },
  {
    id: 'kaspi',
    title: 'Kaspi',
    shortDescription: 'Заказы магазина Kaspi.kz и синхронизация в CRM.',
    category: 'marketplaces',
    categoryLabel: CATEGORY_LABELS.marketplaces,
    Icon: ShoppingBag
  },
  {
    id: 'twilio',
    title: 'Twilio',
    shortDescription: 'Исходящая и входящая телефония (Voice) через Twilio.',
    category: 'telephony',
    categoryLabel: CATEGORY_LABELS.telephony,
    Icon: Phone
  },
  {
    id: 'telnyx',
    title: 'Telnyx',
    shortDescription: 'Альтернативный voice-провайдер: Call Control и номера.',
    category: 'telephony',
    categoryLabel: CATEGORY_LABELS.telephony,
    Icon: Phone
  },
  {
    id: 'zadarma',
    title: 'Zadarma',
    shortDescription: 'Телефония и виртуальная АТС: входящие и исходящие звонки через Zadarma.',
    category: 'telephony',
    categoryLabel: CATEGORY_LABELS.telephony,
    Icon: Phone
  }
];

export function getIntegrationById(id: string): IntegrationRegistryItem | undefined {
  return INTEGRATION_REGISTRY.find((x) => x.id === id);
}
