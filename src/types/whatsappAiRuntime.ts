import type { Timestamp } from 'firebase/firestore';

/** Режим ответа AI из модуля «Автоворонки» в WhatsApp-чате */
export type WhatsAppAiRuntimeMode = 'off' | 'draft' | 'auto';

export type WhatsAppAiRuntimeLastStatus = 'idle' | 'success' | 'error' | 'skipped';

/**
 * Состояние runtime AI в документе whatsappConversations (поле aiRuntime).
 * Старые документы без aiRuntime нормализуются через parseWhatsAppAiRuntime.
 */
export interface WhatsAppAiRuntime {
  enabled: boolean;
  botId: string | null;
  mode: WhatsAppAiRuntimeMode;
  lastRunAt: Date | Timestamp | null;
  lastStatus: WhatsAppAiRuntimeLastStatus | null;
  lastReason: string | null;
  lastGeneratedReply: string | null;
  /** Дедуп: id входящего сообщения, по которому уже отработали */
  lastProcessedIncomingMessageId: string | null;
  /** JSON последнего extraction (отладка / будущий apply) */
  lastExtractionJson: string | null;
}

export function defaultWhatsAppAiRuntime(): WhatsAppAiRuntime {
  return {
    enabled: false,
    botId: null,
    mode: 'off',
    lastRunAt: null,
    lastStatus: null,
    lastReason: null,
    lastGeneratedReply: null,
    lastProcessedIncomingMessageId: null,
    lastExtractionJson: null
  };
}

function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/** Разбор поля aiRuntime из документа Firestore (или пустой объект). */
export function parseWhatsAppAiRuntime(data: Record<string, unknown>): WhatsAppAiRuntime {
  const base = defaultWhatsAppAiRuntime();
  const raw = data.aiRuntime;
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  const mode =
    o.mode === 'draft' || o.mode === 'auto' || o.mode === 'off' ? o.mode : base.mode;
  let lastStatus: WhatsAppAiRuntimeLastStatus | null = base.lastStatus;
  if (
    o.lastStatus === 'idle' ||
    o.lastStatus === 'success' ||
    o.lastStatus === 'error' ||
    o.lastStatus === 'skipped'
  ) {
    lastStatus = o.lastStatus;
  } else if (o.lastStatus != null && String(o.lastStatus).length > 0) {
    lastStatus = null;
  }

  return {
    enabled: o.enabled === true,
    botId: strOrNull(o.botId),
    mode,
    lastRunAt: (o.lastRunAt as WhatsAppAiRuntime['lastRunAt']) ?? null,
    lastStatus,
    lastReason: strOrNull(o.lastReason),
    lastGeneratedReply: strOrNull(o.lastGeneratedReply),
    lastProcessedIncomingMessageId: strOrNull(o.lastProcessedIncomingMessageId),
    lastExtractionJson: strOrNull(o.lastExtractionJson)
  };
}
