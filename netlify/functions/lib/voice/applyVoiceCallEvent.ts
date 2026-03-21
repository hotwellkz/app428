import type { VoiceCallStatus, VoiceNormalizedWebhookEvent } from '../../../../src/types/voice';

const TERMINAL: VoiceCallStatus[] = ['completed', 'failed', 'busy', 'no_answer', 'canceled'];

export function isVoiceCallTerminalStatus(s: VoiceCallStatus): boolean {
  return TERMINAL.includes(s);
}

export type VoiceSessionStatePatch = {
  status?: VoiceCallStatus;
  connectedAtMs?: number;
  endedAtMs?: number;
  durationSec?: number | null;
  endReason?: string | null;
};

export type ApplyVoiceNormalizedEventResult = {
  fromStatus: VoiceCallStatus;
  toStatus: VoiceCallStatus;
  patch: VoiceSessionStatePatch;
  /** Есть ли смысл обновлять документ сессии */
  sessionChanged: boolean;
};

/**
 * Чистая state machine: текущий статус + нормализованное событие → patch.
 * Не пишет в Firestore.
 */
export function applyNormalizedVoiceEvent(
  currentStatus: VoiceCallStatus,
  ev: VoiceNormalizedWebhookEvent
): ApplyVoiceNormalizedEventResult {
  const fromStatus = currentStatus;
  const occurredMs = Date.parse(ev.occurredAt);
  const safeOccurredMs = Number.isFinite(occurredMs) ? occurredMs : Date.now();

  const noop = (): ApplyVoiceNormalizedEventResult => ({
    fromStatus,
    toStatus: currentStatus,
    patch: {},
    sessionChanged: false
  });

  if (isVoiceCallTerminalStatus(currentStatus) && ev.type !== 'provider.unknown' && ev.type !== 'enqueue') {
    return noop();
  }

  switch (ev.type) {
    case 'enqueue':
      return noop();

    case 'provider.accepted': {
      if (currentStatus !== 'queued') return noop();
      return {
        fromStatus,
        toStatus: 'dialing',
        patch: { status: 'dialing' },
        sessionChanged: true
      };
    }

    case 'provider.ringing': {
      if (currentStatus !== 'queued' && currentStatus !== 'dialing') return noop();
      return {
        fromStatus,
        toStatus: 'ringing',
        patch: { status: 'ringing' },
        sessionChanged: true
      };
    }

    case 'provider.answered': {
      if (currentStatus !== 'ringing' && currentStatus !== 'dialing') return noop();
      return {
        fromStatus,
        toStatus: 'in_progress',
        patch: {
          status: 'in_progress',
          connectedAtMs: safeOccurredMs
        },
        sessionChanged: true
      };
    }

    case 'provider.completed': {
      if (currentStatus === 'completed') return noop();
      return {
        fromStatus,
        toStatus: 'completed',
        patch: {
          status: 'completed',
          endedAtMs: safeOccurredMs,
          durationSec: ev.durationSec ?? null,
          endReason: ev.cause ?? 'completed'
        },
        sessionChanged: true
      };
    }

    case 'provider.failed': {
      if (isVoiceCallTerminalStatus(currentStatus)) return noop();
      return {
        fromStatus,
        toStatus: 'failed',
        patch: {
          status: 'failed',
          endedAtMs: safeOccurredMs,
          endReason: ev.cause ?? 'provider_failed'
        },
        sessionChanged: true
      };
    }

    case 'provider.busy': {
      if (currentStatus !== 'ringing' && currentStatus !== 'dialing' && currentStatus !== 'queued') return noop();
      return {
        fromStatus,
        toStatus: 'busy',
        patch: {
          status: 'busy',
          endedAtMs: safeOccurredMs,
          endReason: ev.cause ?? 'busy'
        },
        sessionChanged: true
      };
    }

    case 'provider.no_answer': {
      if (currentStatus !== 'ringing' && currentStatus !== 'dialing' && currentStatus !== 'queued') return noop();
      return {
        fromStatus,
        toStatus: 'no_answer',
        patch: {
          status: 'no_answer',
          endedAtMs: safeOccurredMs,
          endReason: ev.cause ?? 'no_answer'
        },
        sessionChanged: true
      };
    }

    case 'user.cancel': {
      if (isVoiceCallTerminalStatus(currentStatus)) return noop();
      return {
        fromStatus,
        toStatus: 'canceled',
        patch: {
          status: 'canceled',
          endedAtMs: safeOccurredMs,
          endReason: ev.cause ?? 'user_cancel'
        },
        sessionChanged: true
      };
    }

    case 'provider.unknown':
    default:
      return noop();
  }
}
