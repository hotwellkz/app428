/**
 * Нормализация ошибок Twilio REST (исходящий звонок) → коды для UI и логов.
 * Без секретов; только code/status/message из RestException.
 *
 * Важно: 21215 в Twilio = Geo / dialing permissions, НЕ trial — не смешивать с trial.
 */

export type TwilioVoiceFriendlyCode =
  | 'twilio_auth_error'
  | 'twilio_insufficient_balance'
  | 'twilio_geo_permission_blocked'
  | 'twilio_trial_to_unverified'
  | 'twilio_unverified_callee'
  | 'twilio_invalid_from'
  | 'twilio_invalid_to'
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

/** Явное упоминание trial-аккаунта в тексте Twilio (не путать с «verified» в других контекстах). */
function messageImpliesTrialAccount(lower: string): boolean {
  return (
    /\btrial account\b/.test(lower) ||
    /\btrial accounts\b/.test(lower) ||
    (lower.includes('trial') && lower.includes('upgrade your account')) ||
    (lower.includes('using a trial') && lower.includes('verify'))
  );
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

  // Авторизация / неверный SID или Auth Token
  if (
    code === 20003 ||
    code === 20006 ||
    code === 20403 ||
    status === 401 ||
    lower.includes('authenticate') ||
    lower.includes('authentication') ||
    lower.includes('invalid username') ||
    lower.includes('invalid auth token') ||
    (lower.includes('accountsid') && lower.includes('not found'))
  ) {
    return base(
      'twilio_auth_error',
      'Неверный Twilio Account SID или Auth Token',
      'Проверьте учётные данные в настройках Voice интеграции компании. Если в Netlify заданы TWILIO_* — убедитесь, что в CRM сохранён тот же аккаунт, что и в Twilio Console.'
    );
  }

  // Баланс / биллинг
  if (
    (lower.includes('insufficient') &&
      (lower.includes('fund') || lower.includes('balance') || lower.includes('credit'))) ||
    lower.includes('account balance') ||
    code === 20008
  ) {
    return base(
      'twilio_insufficient_balance',
      'Недостаточно средств или лимит Twilio',
      'Проверьте баланс и лимиты в Twilio Console → Billing.'
    );
  }

  // 21215 — официально: Geo / dialing geographic permissions (НЕ trial)
  if (
    code === 21215 ||
    code === 21408 ||
    code === 32203 ||
    code === 32209 ||
    code === 13609 ||
    lower.includes('geo permission') ||
    lower.includes('geographic permission') ||
    lower.includes('voice geographic') ||
    lower.includes('international permissions') ||
    (lower.includes('permission') && lower.includes('country') && lower.includes('not')) ||
    (lower.includes('dialing') && lower.includes('not') && lower.includes('permit'))
  ) {
    return base(
      'twilio_geo_permission_blocked',
      'Номер назначения запрещён или не разрешён для исходящих (гео / права Twilio)',
      'Включите Voice Geographic Permissions для страны номера клиента в Twilio Console (Voice → Settings → Geo Permissions).'
    );
  }

  // Trial + unverified — только если Twilio явно пишет про trial
  if (code === 21608 && messageImpliesTrialAccount(lower)) {
    return base(
      'twilio_trial_to_unverified',
      'Twilio trial: можно звонить только на верифицированные номера',
      'На trial-аккаунте Twilio звонки разрешены только на верифицированные номера, либо upgrade аккаунта. Если аккаунт уже Full — проверьте, что в CRM сохранён правильный Account SID (не старый trial / субаккаунт).'
    );
  }

  // 21608 без явного trial в тексте — честная формулировка без «trial»
  if (code === 21608) {
    return base(
      'twilio_unverified_callee',
      'Номер назначения не разрешён для звонка с этого Twilio-аккаунта',
      'Twilio отклонил вызов: номер не верифицирован или не разрешён для данного аккаунта. Проверьте Verified Caller IDs / номер в Console и что в CRM указан нужный Account SID.'
    );
  }

  // Неверный From
  if (
    code === 21212 ||
    code === 21606 ||
    (lower.includes('from') && (lower.includes('invalid') || lower.includes('not a valid phone'))) ||
    (lower.includes('caller id') && lower.includes('invalid'))
  ) {
    return base(
      'twilio_invalid_from',
      'Неверный номер исходящего звонка (From / Caller ID)',
      'Проверьте, что номер в CRM совпадает с номером в Twilio и включена возможность Voice.'
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
    'Twilio отклонил вызов',
    message.length > 0 && message.length < 280 ? message : null
  );
}
