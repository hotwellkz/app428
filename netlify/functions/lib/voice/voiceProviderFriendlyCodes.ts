/**
 * Нормализованные коды ошибок voice-провайдеров и user-facing тексты (RU).
 * Без секретов; детали — только в providerDebug / server logs.
 */

export type VoiceProviderFriendlyCode =
  | 'provider_webhook_signature_invalid'
  | 'provider_auth_error'
  | 'telnyx_invalid_call_control'
  | 'provider_connection_missing'
  | 'provider_public_key_missing'
  | 'provider_default_number_missing'
  | 'voice_number_provider_mismatch'
  | 'provider_api_error'
  | 'provider_no_numbers'
  | 'telecom_route_uncertain'
  | 'busy'
  | 'no_answer'
  | 'canceled'
  | 'failed'
  | 'provider_webhook_error'
  | 'webhook_signature_invalid'
  | 'webhook_match_failed'
  | 'invalid_number'
  | 'rejected'
  | 'provider_config_error'
  | 'unknown_provider_error';

const MESSAGES_RU: Record<string, string> = {
  provider_webhook_signature_invalid:
    'Подпись webhook Telnyx не прошла проверку. Проверьте Public Key в CRM и URL/настройки webhook в кабинете Telnyx.',
  provider_auth_error: 'Ошибка авторизации у провайдера телефонии — проверьте ключи в Интеграциях.',
  telnyx_invalid_call_control:
    'Неверный Connection ID (Call Control App) в CRM или в Telnyx не настроен webhook на ваш деплой. В Mission Control у приложения Call Control должен быть валидный HTTPS webhook URL.',
  provider_connection_missing: 'Не задан Connection / Application ID для исходящих звонков.',
  provider_public_key_missing: 'Не сохранён Public Key для проверки подписи webhook.',
  provider_default_number_missing: 'Не выбран исходящий номер по умолчанию для этого провайдера.',
  voice_number_provider_mismatch: 'Выбранный номер не соответствует исходящему провайдеру.',
  provider_api_error: 'Ошибка API провайдера телефонии. Попробуйте позже или проверьте настройки.',
  provider_no_numbers: 'В аккаунте провайдера не найдено номеров для импорта.',
  telecom_route_uncertain: 'Маршрут вызова непредсказуем (ограничения сети/страны).',
  busy: 'Абонент занят или сеть назначения недоступна.',
  no_answer: 'Нет ответа.',
  canceled: 'Вызов отменён.',
  failed: 'Вызов завершился с ошибкой.',
  provider_webhook_error: 'Ошибка обработки webhook Telnyx. Проверьте URL, ключи и логи сервера.',
  webhook_signature_invalid:
    'Подпись webhook Zadarma не прошла проверку. Проверьте Secret Key в CRM и URL уведомлений в кабинете Zadarma.',
  webhook_match_failed:
    'Событие Zadarma получено, но сессия звонка в CRM не найдена. Убедитесь, что в URL webhook указан ?companyId=… и звонок запускался из CRM.',
  invalid_number: 'Некорректный или недопустимый номер телефона для вызова.',
  rejected: 'Вызов отклонён на стороне сети или абонента.',
  provider_config_error: 'Ошибка конфигурации или ограничения на стороне провайдера (баланс, маршрут, настройки АТС).',
  unknown_provider_error: 'Провайдер вернул нестандартный исход звонка — см. логи и кабинет Zadarma.'
};

export function voiceFriendlyMessageRu(code: string | null | undefined): string {
  if (!code) return MESSAGES_RU.provider_api_error;
  return MESSAGES_RU[code] ?? MESSAGES_RU.provider_api_error;
}
