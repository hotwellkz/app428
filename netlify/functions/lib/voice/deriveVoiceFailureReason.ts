/**
 * Классификация исхода исходящего voice (Twilio) для CRM — без смены провайдера.
 */

export type VoiceFailureReasonCode =
  | 'config_invalid_status_callback'
  | 'callback_endpoint_warning'
  | 'provider_auth_error'
  | 'invalid_from_number'
  | 'invalid_to_number'
  | 'geo_or_route_restriction'
  | 'carrier_rejected_or_busy'
  | 'no_answer'
  | 'telecom_route_uncertain'
  | 'unknown_provider_failure';

export type VoiceFailureReasonResult = {
  code: VoiceFailureReasonCode;
  /** Короткое сообщение для UI/логов */
  messageRu: string;
};

function hasGeoHint(msg: string | null): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return m.includes('geo') || m.includes('permission') || m.includes('country') || m.includes('21215');
}

/** SIP busy / decline часто при busy на стороне сети */
function sipImpliesBusy(sip: number | null): boolean {
  if (sip == null) return false;
  return sip === 486 || sip === 600 || sip === 603;
}

/**
 * @param crmStatus — статус сессии CRM после применения события
 * @param twilioCallStatus — CallStatus из callback (snake-case hyphen)
 */
export function deriveVoiceFailureReason(params: {
  crmStatus: string;
  twilioCallStatus: string | null;
  sipResponseCode: number | null;
  twilioErrorCode: number | null;
  twilioErrorMessage: string | null;
  twilioWarningCode: number | null;
  twilioWarningMessage: string | null;
  toE164: string | null;
  durationSec?: number | null;
  hadInProgress?: boolean;
}): VoiceFailureReasonResult | null {
  const {
    crmStatus,
    twilioCallStatus,
    sipResponseCode,
    twilioErrorCode,
    twilioErrorMessage,
    twilioWarningCode,
    twilioWarningMessage,
    toE164,
    durationSec,
    hadInProgress
  } = params;

  const err = (twilioErrorMessage ?? '').toLowerCase();
  const warn = (twilioWarningMessage ?? '').toLowerCase();

  if (twilioWarningCode === 15003 || warn.includes('15003') || warn.includes('http 404')) {
    return {
      code: 'callback_endpoint_warning',
      messageRu: 'Twilio: предупреждение по status callback (URL/ответ). Проверьте webhook и деплой.'
    };
  }
  if (twilioErrorCode === 21626 || err.includes('21626') || err.includes('statuscallbackevent')) {
    return {
      code: 'config_invalid_status_callback',
      messageRu: 'Twilio: неверная конфигурация StatusCallbackEvent (21626).'
    };
  }

  if (
    twilioErrorCode === 20003 ||
    twilioErrorCode === 20006 ||
    twilioErrorCode === 20403 ||
    err.includes('authenticate') ||
    err.includes('auth token')
  ) {
    return { code: 'provider_auth_error', messageRu: 'Twilio: ошибка авторизации (SID/Token).' };
  }

  if (twilioErrorCode === 21212 || twilioErrorCode === 21606 || (err.includes('from') && err.includes('invalid'))) {
    return { code: 'invalid_from_number', messageRu: 'Twilio: неверный номер From / Caller ID.' };
  }
  if (twilioErrorCode === 21211 || twilioErrorCode === 21213 || (err.includes('to') && err.includes('invalid'))) {
    return { code: 'invalid_to_number', messageRu: 'Twilio: неверный номер назначения (To).' };
  }

  if (hasGeoHint(twilioErrorMessage) || twilioErrorCode === 21215 || twilioErrorCode === 21408) {
    return {
      code: 'geo_or_route_restriction',
      messageRu: 'Twilio: ограничение гео / маршрута (проверьте Geo Permissions и страну номера).'
    };
  }

  const to = (toE164 ?? '').trim();
  const noTwilioErr =
    twilioErrorCode == null && !(twilioErrorMessage && twilioErrorMessage.trim());

  /** KZ/RU +7: создаётся OK, busy/no-answer без кода Twilio — часто маршрут/оператор. */
  if (
    noTwilioErr &&
    /^\+7\d{10,}$/.test(to) &&
    (durationSec ?? 0) === 0 &&
    !hadInProgress &&
    (crmStatus === 'busy' ||
      crmStatus === 'no_answer' ||
      crmStatus === 'failed' ||
      twilioCallStatus === 'busy' ||
      twilioCallStatus === 'no-answer' ||
      twilioCallStatus === 'failed')
  ) {
    return {
      code: 'telecom_route_uncertain',
      messageRu:
        'Провайдер принял вызов, но сеть назначения не подтвердила дозвон. Возможна проблема маршрута/оператора.'
    };
  }

  if (crmStatus === 'no_answer' || twilioCallStatus === 'no-answer') {
    return { code: 'no_answer', messageRu: 'Twilio: нет ответа (no-answer).' };
  }

  if (crmStatus === 'busy' || twilioCallStatus === 'busy' || sipImpliesBusy(sipResponseCode)) {
    return {
      code: 'carrier_rejected_or_busy',
      messageRu: 'Twilio: занято / отказ сети назначения (busy или SIP decline).'
    };
  }

  if (crmStatus === 'failed' || twilioCallStatus === 'failed') {
    if ((sipResponseCode ?? 0) >= 500) {
      return {
        code: 'carrier_rejected_or_busy',
        messageRu: 'Twilio: ошибка на стороне оператора (SIP 5xx).'
      };
    }
    return { code: 'unknown_provider_failure', messageRu: 'Twilio: звонок завершился с ошибкой (failed).' };
  }

  return null;
}
