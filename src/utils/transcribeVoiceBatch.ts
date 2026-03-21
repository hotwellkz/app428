/**
 * Пакетная расшифровка голосовых сообщений через ai-transcribe-voice.
 * Используется и для кнопки «Расшифровать всё», и для предподготовки перед «Проанализировать чат».
 */

const TRANSCRIBE_ENDPOINTS = ['/.netlify/functions/ai-transcribe-voice', '/api/ai/transcribe-voice'] as const;

export interface TranscribeVoiceBatchItem {
  messageId: string;
  audioUrl: string;
}

export interface TranscribeVoiceBatchResult {
  done: number;
  errors: number;
  /** messageId -> текст расшифровки (только успешные) */
  updates: Record<string, string>;
}

export type PrepareForAnalysisStatus = 'none' | 'done' | 'partial' | 'failed';

export interface PrepareForAnalysisResult {
  status: PrepareForAnalysisStatus;
  updates: Record<string, string>;
  done: number;
  errors: number;
  total: number;
}

/**
 * Последовательно расшифровать список голосовых.
 * @param items — сообщения к расшифровке (messageId + audioUrl)
 * @param getToken — функция получения токена авторизации
 * @param onProgress — опциональный callback (current, total) для отображения прогресса
 */
export async function transcribeVoiceBatch(
  items: TranscribeVoiceBatchItem[],
  getToken: () => Promise<string | null>,
  onProgress?: (current: number, total: number) => void
): Promise<TranscribeVoiceBatchResult> {
  const updates: Record<string, string> = {};
  let done = 0;
  let errors = 0;
  const total = items.length;

  if (total === 0) {
    return { done: 0, errors: 0, updates };
  }

  const token = await getToken();
  if (!token) {
    return { done: 0, errors: total, updates };
  }

  for (let i = 0; i < items.length; i++) {
    const { messageId, audioUrl } = items[i];
    onProgress?.(i + 1, total);
    try {
      let res: Response | null = null;
      for (const url of TRANSCRIBE_ENDPOINTS) {
        try {
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ audioUrl, messageId }),
          });
          const raw = await r.text();
          if (raw.trimStart().startsWith('<') || raw.includes('<!DOCTYPE')) continue;
          res = r;
          if (r.ok) break;
        } catch {
          continue;
        }
      }
      if (!res || !res.ok) {
        errors += 1;
        continue;
      }
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (data.error) {
        errors += 1;
        continue;
      }
      const txt = (data.text ?? '').trim();
      if (txt) {
        done += 1;
        updates[messageId] = txt;
      }
    } catch {
      errors += 1;
    }
  }

  return { done, errors, updates };
}

/**
 * По списку сообщений собрать элементы, требующие расшифровки (голосовые без готового transcript).
 * Учитывает type === 'audio' и type === 'voice'.
 *
 * Важно: для голосовых поле `text` в БД часто пустое или плейсхолдер — его НЕ считаем заменой расшифровки,
 * иначе пакетная расшифровка не вызывается и AI не получает смысл сообщения.
 */
export function getVoiceMessagesToTranscribe(
  messages: Array<{ id: string; transcription?: string | null; text?: string; deleted?: boolean; attachments?: Array<{ type: string; url?: string }> }>
): TranscribeVoiceBatchItem[] {
  const list: TranscribeVoiceBatchItem[] = [];
  for (const m of messages) {
    if (m.deleted) continue;
    const audioAtt = m.attachments?.find((a) => a.type === 'audio' || a.type === 'voice');
    if (!audioAtt?.url) continue;
    const hasTranscript = (m.transcription ?? '').trim().length > 0;
    if (hasTranscript) continue;
    list.push({ messageId: m.id, audioUrl: audioAtt.url });
  }
  return list;
}
