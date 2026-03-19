import type { AiRunWorkflowStatus } from '../../types/aiControl';
import type { WhatsAppAiRunWorkflowRecord } from '../firebase/whatsappAiRunWorkflow';

export interface DerivedAiRunWorkflow {
  status: AiRunWorkflowStatus | null;
  statusLabel: string;
  assigneeName: string | null;
  lastComment: string | null;
  updatedBy: string | null;
  updatedAtMs: number | null;
  isNewProblem: boolean;
}

function toMs(v: unknown): number | null {
  if (!v) return null;
  if (typeof v === 'object' && v && 'toMillis' in (v as { toMillis?: unknown })) {
    const fn = (v as { toMillis?: () => number }).toMillis;
    if (typeof fn === 'function') return fn();
  }
  if (v instanceof Date) return v.getTime();
  return null;
}

function statusLabel(status: AiRunWorkflowStatus | null): string {
  if (status === 'new') return 'Новый';
  if (status === 'in_progress') return 'В работе';
  if (status === 'resolved') return 'Решён';
  if (status === 'ignored') return 'Игнор';
  if (status === 'escalated') return 'Эскалация';
  return '—';
}

export function deriveAiRunWorkflow(
  requiresAttention: boolean,
  workflow: WhatsAppAiRunWorkflowRecord | null | undefined
): DerivedAiRunWorkflow {
  const status = workflow?.status ?? (requiresAttention ? 'new' : null);
  return {
    status,
    statusLabel: statusLabel(status),
    assigneeName: workflow?.assigneeName ?? null,
    lastComment: workflow?.lastComment ?? null,
    updatedBy: workflow?.updatedBy ?? null,
    updatedAtMs: toMs(workflow?.updatedAt ?? null),
    isNewProblem: requiresAttention && status === 'new'
  };
}
