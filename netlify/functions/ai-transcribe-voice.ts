import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { getDb } from './lib/firebaseAdmin';
import { getAIApiKeyFromRequest } from './lib/aiAuth';

const LOG_PREFIX = '[ai-transcribe-voice]';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

function withCors(res: HandlerResponse): HandlerResponse {
  return { ...res, headers: { ...CORS_HEADERS, ...res.headers } };
}

function log(...args: unknown[]) {
  console.log(LOG_PREFIX, ...args);
}

interface TranscribeBody {
  audioUrl?: string;
  messageId?: string;
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return withCors({ statusCode: 204, headers: {}, body: '' });
  }

  if (event.httpMethod !== 'POST') {
    return withCors({
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    });
  }

  const auth = await getAIApiKeyFromRequest(event);
  if (!auth.ok) {
    log('AI key not available:', auth.error);
    return withCors({
      statusCode: auth.statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: auth.error })
    });
  }
  const apiKey = auth.apiKey;

  let body: TranscribeBody;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as TranscribeBody) ?? {};
  } catch (e) {
    log('Invalid JSON body:', e);
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON' })
    });
  }

  const audioUrl = (body.audioUrl ?? '').toString();
  const messageId = (body.messageId ?? '').toString() || undefined;
  if (!audioUrl) {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'audioUrl is required' })
    });
  }

  // Если есть messageId — сначала проверяем, не сохранена ли уже расшифровка
  if (messageId) {
    try {
      const db = getDb();
      const ref = db.collection('whatsappMessages').doc(messageId);
      const snap = await ref.get();
      if (snap.exists) {
        const data = snap.data() as { transcription?: string } | undefined;
        if (data?.transcription && data.transcription.trim().length > 0) {
          if (process.env.NODE_ENV !== 'production') {
            log('Return cached transcription', { messageId });
          }
          return withCors({
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: data.transcription })
          });
        }
      }
    } catch (e) {
      log('Failed to read existing transcription (will continue):', e);
    }
  }

  try {
    // Скачиваем аудио
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      const text = await audioRes.text().catch(() => '');
      log('Failed to download audio:', audioUrl, audioRes.status, text);
      return withCors({
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to download audio' })
      });
    }
    const arrayBuffer = await audioRes.arrayBuffer();
    const audioBlob = new Blob([arrayBuffer], { type: audioRes.headers.get('content-type') ?? 'audio/webm' });

    const form = new FormData();
    form.append('file', audioBlob, 'voice-message.webm');
    form.append('model', 'whisper-1');
    form.append('language', 'ru');

    const openaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: form
    });

    if (!openaiRes.ok) {
      const text = await openaiRes.text().catch(() => '');
      log('OpenAI transcription error:', openaiRes.status, text);
      return withCors({
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'OpenAI transcription error', status: openaiRes.status })
      });
    }

    const data = (await openaiRes.json()) as { text?: string };
    const text = (data.text ?? '').trim();

    if (messageId && text) {
      try {
        const db = getDb();
        await db.collection('whatsappMessages').doc(messageId).update({ transcription: text });
      } catch (e) {
        log('Failed to save transcription to Firestore:', e);
      }
    }

    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
  } catch (e) {
    log('Transcription failed:', e);
    return withCors({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to transcribe audio', detail: String(e) })
    });
  }
};

