/**
 * Единая деривация канала AI-run (whatsappAiBotRuns хранит WhatsApp + voice bridge).
 */
import type { WhatsAppAiBotRunRecord } from '../firebase/whatsappAiBotRuns';

export type AiControlDerivedChannel = 'whatsapp' | 'voice' | 'instagram' | 'site' | 'unknown';

export function deriveAiRunChannelFromRun(
  run: WhatsAppAiBotRunRecord,
  botChannel?: string | null
): AiControlDerivedChannel {
  const ch = (run.channel || '').trim().toLowerCase();
  if (ch === 'voice') return 'voice';
  const extras = run.extras ?? {};
  if (extras.voiceCallSessionId || extras.voicePostCall || extras.voiceCallSnapshot) {
    return 'voice';
  }
  const conv = (run.conversationId || '').trim().toLowerCase();
  if (conv.startsWith('voice:')) return 'voice';

  if (ch === 'whatsapp') return 'whatsapp';
  if (ch === 'instagram') return 'instagram';
  if (ch === 'site') return 'site';

  const bc = (botChannel || '').trim().toLowerCase();
  if (bc === 'voice') return 'voice';
  if (bc === 'whatsapp') return 'whatsapp';
  if (bc === 'instagram') return 'instagram';

  return 'unknown';
}

export function channelBadgeLabel(ch: AiControlDerivedChannel): string {
  switch (ch) {
    case 'voice':
      return 'Voice';
    case 'whatsapp':
      return 'WhatsApp';
    case 'instagram':
      return 'Instagram';
    case 'site':
      return 'Сайт';
    default:
      return 'Канал ?';
  }
}
