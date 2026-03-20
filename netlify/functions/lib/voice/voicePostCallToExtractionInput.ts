import type { AdminVoiceTurnRow } from './voiceFirestoreAdmin';

/**
 * Преобразует финальные реплики voiceTurns в формат, ожидаемый runCrmAiBotExtraction (user=клиент, assistant=бот).
 */
export function voiceTurnsToExtractionTranscript(
  rows: AdminVoiceTurnRow[]
): { role: 'user' | 'assistant'; content: string }[] {
  const sorted = [...rows].sort((a, b) => a.turnIndex - b.turnIndex);
  const out: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const t of sorted) {
    const text = String(t.text ?? '').trim();
    if (!text) continue;
    if (t.speaker === 'client') {
      out.push({ role: 'user', content: text });
    } else if (t.speaker === 'bot') {
      out.push({ role: 'assistant', content: text });
    }
    /** system — пропускаем (не смешиваем с транспортом) */
  }
  return out;
}
