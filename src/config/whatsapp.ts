export const WHATSAPP_CONTACT_NUMBER = '77477434343';

const BASE_URL = 'https://wa.me';

/** Построить URL для открытия WhatsApp с готовым текстом. */
export function buildWhatsAppUrl(message: string, phone: string = WHATSAPP_CONTACT_NUMBER): string {
  const normalizedPhone = phone.replace(/\D/g, '');
  const text = encodeURIComponent(message.trim());
  return `${BASE_URL}/${normalizedPhone}${text ? `?text=${text}` : ''}`;
}

/** Дефолтные сообщения по публичным маршрутам. */
export function getDefaultWhatsAppMessage(pathname: string): string {
  switch (pathname) {
    case '/crm-dlya-kaspi':
      return 'Здравствуйте! Интересует CRM для Kaspi-магазина. Хочу получить консультацию по подключению.';
    case '/whatsapp-crm':
    case '/whatsapp-i-chaty':
    case '/whatsapp-dlya-otdela-prodazh':
      return 'Здравствуйте! Хочу узнать подробнее о CRM с WhatsApp-интеграцией 2wix.';
    case '/crm-dlya-stroitelnoi-kompanii':
      return 'Здравствуйте! Интересует CRM для строительной компании. Хочу получить консультацию.';
    case '/crm-dlya-biznesa':
    case '/crm-dlya-malogo-biznesa':
    case '/crm-dlya-prodazh':
    case '/crm-dlya-komandy':
    case '/crm-dlya-proizvodstva':
    case '/crm-dlya-uslug':
      return 'Здравствуйте! Хочу узнать подробнее о CRM-системе 2wix для бизнеса в Казахстане.';
    default:
      return 'Здравствуйте! Хочу узнать подробнее о CRM-системе 2wix.';
  }
}

