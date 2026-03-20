/**
 * Нормализация ошибок Twilio REST (исходящий звонок) → коды для UI и логов.
 * Без секретов; только code/status/message из RestException.
 */

export type TwilioVoiceFriendlyCode =
  | 'twilio_trial_to_unverified'
  | 'twilio_geo_permission_blocked'
  | 'twilio_invalid_from'
  | 'twilio_invalid_to'
  | 'twilio_auth_error'
  | 'twilio_insufficient_balance'
  | 'twilio_provider_unknown';

export type TwilioVoiceFriendlyMapping = {
  friendlyCode: TwilioVoiceFriendlyCode;
  userMessageRu: string;
  hintRu: string | null;
  twilioCode: number | null;
  twilioStatus: number | null;
  rawMessage: string;
};

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
  return null;
}

/**
 * Разбор тела ошибки Twilio Node helper (RestException) или произвольного throw.
 */
export function mapTwilioVoiceCreateError(e: unknown): TwilioVoiceFriendlyMapping {
  const m = e && typeof e === 'object' ? (e as Record<string, unknown>) : {};
  const code = num(m.code);
  const status = num(m.status);
  const message = String(m.message ?? e ?? 'Неизвестная ошибка Twilio');
  const lower = message.toLowerCase();

  const base = (fc: TwilioVoiceFriendlyCode, user: string, hint: string | null): TwilioVoiceFriendlyMapping => ({
    friendlyCode: fc,
    userMessageRu: user,
    hintRu: hint,
    twilioCode: code,
    twilioStatus: status,
    rawMessage: message
  });

  // Авторизация / ключи
  if (
    code === 20003 ||
    code === 20006 ||
    status === 401 ||
    lower.includes('authenticate') ||
    lower.includes('authentication') ||
    lower.includes('invalid username') ||
    lower.includes('invalid auth token')
  ) {
    return base(
      'twilio_auth_error',
      'Ошибка авторизации Twilio',
      'Проверьте Account SID и Auth Token в интеграции CRM и что аккаунт Twilio активен.'
    );
  }

  // Баланс / биллинг
  if (
    lower.includes('insufficient') && (lower.includes('fund') || lower.includes('balance') || lower.includes('credit')) ||
    lower.includes('account balance') ||
    code === 20008
  ) {
    return base(
      'twilio_insufficient_balance',
      'Провайдер отклонил звонок (баланс или ограничения аккаунта)',
      'Проверьте баланс и лимиты в Twilio Console.'
    );
  }

  // Trial + не верифицированный номер
  if (
    code === 21215 ||
    code === 21608 ||
    (lower.includes('unverified') && (lower.includes('trial') || lower.includes('verify your'))) ||
    (lower.includes('trial') && lower.includes('verified'))
  ) {
    return base(
      'twilio_trial_to_unverified',
      'Twilio trial: номер клиента не верифицирован',
      'На trial-аккаунте Twilio можно звонить только на верифицированные номера. Либо верифицируйте номер в Twilio Console, либо upgrade account.'
    );
  }

  // Географические права / международный исходящий
  if (
    code === 21408 ||
    code === 32203 ||
    code === 32209 ||
    code === 13609 ||
    lower.includes('geo permission') ||
    lower.includes('geographic permission') ||
    lower.includes('voice geographic') ||
    lower.includes('international permissions') ||
    (lower.includes('permission') && lower.includes('country')) ||
    (lower.includes('not enabled') && lower.includes('region'))
  ) {
    return base(
      'twilio_geo_permission_blocked',
      'В Twilio не включён дозвон в страну клиента',
      'Включите Voice Geographic Permissions для страны клиента в Twilio Console (Voice → Settings → Geo Permissions).'
    );
  }

  // Неверный From
  if (
    code === 21212 ||
    code === 21606 ||
    (lower.includes('from') && (lower.includes('invalid') || lower.includes('not a valid phone'))) ||
    lower.includes('caller id') && lower.includes('invalid')
  ) {
    return base(
      'twilio_invalid_from',
      'Неверный номер для исходящего звонка (From)',
      'Проверьте, что выбранный номер в CRM совпадает с номером в Twilio и разрешён для Voice.'
    );
  }

  // Неверный To
  if (
    code === 21211 ||
    code === 21213 ||
    code === 20404 ||
    (lower.includes('to') && lower.includes('invalid') && lower.includes('phone'))
  ) {
    return base(
      'twilio_invalid_to',
      'Неверный номер клиента (To)',
      'Укажите номер в формате E.164, например +77001234567.'
    );
  }

  return base(
    'twilio_provider_unknown',
    'Провайдер отклонил звонок',
    message.length > 0 && message.length < 280 ? message : null
  );
}
