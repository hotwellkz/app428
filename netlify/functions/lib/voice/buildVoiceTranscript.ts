import type { AdminVoiceTurnRow } from './voiceFirestoreAdmin';

export type VoiceTranscriptTurn = {
  index: number;
  speaker: 'bot' | 'client' | 'system' | string;
  text: string;
};

export type BuiltVoiceTranscript = {
  turns: VoiceTranscriptTurn[];
  /** Построчно: «Бот: …» / «Клиент: …» */
  lines: string[];
  fullText: string;
  userTurnCount: number;
  botTurnCount: number;
};

const LABEL: Record<string, string> = {
  bot: 'Бот',
  client: 'Клиент',
  system: 'Система'
};

export function buildVoiceTranscriptFromTurns(rows: AdminVoiceTurnRow[]): BuiltVoiceTranscript {
  const sorted = [...rows].sort((a, b) => a.turnIndex - b.turnIndex);
  const turns: VoiceTranscriptTurn[] = sorted.map((t) => ({
    index: t.turnIndex,
    speaker: t.speaker,
    text: (t.text ?? '').trim()
  }));
  const lines = turns
    .filter((t) => t.text.length > 0)
    .map((t) => {
      const lab = LABEL[t.speaker] ?? t.speaker;
      return `${lab}: ${t.text}`;
    });
  const fullText = lines.join('\n');
  let userTurnCount = 0;
  let botTurnCount = 0;
  for (const t of turns) {
    if (t.speaker === 'client') userTurnCount += 1;
    if (t.speaker === 'bot') botTurnCount += 1;
  }
  return { turns, lines, fullText, userTurnCount, botTurnCount };
}
