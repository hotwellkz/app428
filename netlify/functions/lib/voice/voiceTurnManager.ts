/**
 * P0 voice loop: Twilio Say + Gather, запись turns, вызов AI, завершение.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../firebaseAdmin';
import { parseCrmAiBotConfig } from '../../../../src/types/crmAiBotConfig';
import type { VoiceOutcome } from '../../../../src/types/voice';
import { generateVoiceBotReply, resolveOpenAiKeyForVoice } from './generateVoiceReply';
import {
  adminAppendVoiceTurn,
  adminFindVoiceSessionByProviderCallId,
  adminGetVoiceCallSession,
  adminListVoiceTurnsOrdered,
  adminUpdateVoiceCallSession,
  type AdminVoiceTurnRow
} from './voiceFirestoreAdmin';
import { buildVoiceTwilioGatherActionUrl, type VoiceProviderRuntimeConfig } from './providerConfig';

const CRM_AI_BOTS = 'crmAiBots';
const LOG = '[voiceTurnManager]';

/** Максимум реплик бота (включая приветствие). */
export const VOICE_MAX_BOT_UTTERANCES = 10;
/** Пустых подряд Gather без распознанной речи. */
export const VOICE_MAX_EMPTY_GATHER = 2;
const GATHER_TIMEOUT_SEC = 8;

const TERMINAL: string[] = ['completed', 'failed', 'busy', 'no_answer', 'canceled'];

type VoiceLoopMeta = {
  conversationState?: string;
  twimlBootstrapped?: boolean;
  emptyGatherStreak?: number;
  endReason?: string | null;
};

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapResponse(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
}

function readVoiceLoop(session: Record<string, unknown>): VoiceLoopMeta {
  const m = session.metadata as Record<string, unknown> | undefined;
  const vl = (m?.voiceLoop as Record<string, unknown> | undefined) ?? {};
  return {
    conversationState: typeof vl.conversationState === 'string' ? vl.conversationState : undefined,
    twimlBootstrapped: Boolean(vl.twimlBootstrapped),
    emptyGatherStreak: typeof vl.emptyGatherStreak === 'number' ? vl.emptyGatherStreak : undefined,
    endReason: vl.endReason != null ? String(vl.endReason) : null
  };
}

function buildMergedMetadata(
  session: Record<string, unknown>,
  voiceLoopPatch: Partial<VoiceLoopMeta> & Record<string, unknown>
): Record<string, unknown> {
  const meta = { ...((session.metadata as Record<string, unknown>) ?? {}) };
  const prev = { ...(meta.voiceLoop as Record<string, unknown> | undefined) };
  meta.voiceLoop = { ...prev, ...voiceLoopPatch, lastTurnAtMs: Date.now() };
  return meta;
}

function nextTurnIndex(turns: AdminVoiceTurnRow[]): number {
  if (!turns.length) return 0;
  return Math.max(...turns.map((t) => t.turnIndex)) + 1;
}

function turnsToMessages(turns: AdminVoiceTurnRow[]): { role: 'user' | 'assistant'; content: string }[] {
  const out: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const t of turns) {
    if (t.speaker === 'client') out.push({ role: 'user', content: t.text });
    else if (t.speaker === 'bot') out.push({ role: 'assistant', content: t.text });
  }
  return out;
}

function countBotTurns(turns: AdminVoiceTurnRow[]): number {
  return turns.filter((t) => t.speaker === 'bot').length;
}

function sayThenGather(gatherUrl: string, text: string): string {
  const safe = xmlEscape(text);
  const action = xmlEscape(gatherUrl);
  const inner = `<Say language="ru-RU" voice="Polly.Tatyana">${safe}</Say><Gather input="speech" action="${action}" method="POST" timeout="${GATHER_TIMEOUT_SEC}" speechTimeout="auto" language="ru-RU" speechModel="phone_call" enhanced="true"></Gather>`;
  return wrapResponse(inner);
}

function sayThenHangup(text: string): string {
  const safe = xmlEscape(text);
  return wrapResponse(`<Say language="ru-RU" voice="Polly.Tatyana">${safe}</Say><Hangup/>`);
}

function hangupSilent(): string {
  return wrapResponse('<Hangup/>');
}

function botPausedTwiml(): string {
  const t = xmlEscape('К сожалению, ассистент временно недоступен. До свидания.');
  return wrapResponse(`<Say language="ru-RU" voice="Polly.Tatyana">${t}</Say><Hangup/>`);
}

async function resolveOpeningUtterance(companyId: string, botId: string, apiKey: string): Promise<string> {
  const db = getDb();
  const snap = await db.collection(CRM_AI_BOTS).doc(botId).get();
  if (!snap.exists) {
    return 'Здравствуйте! Слушаю вас.';
  }
  const config = parseCrmAiBotConfig(snap.data()?.config);
  const om = config.dialogPlan.openingMessage?.trim();
  if (om) {
    return om.slice(0, 800);
  }
  const gen = await generateVoiceBotReply({
    companyId,
    botId,
    apiKey,
    messages: [
      {
        role: 'user',
        content:
          '[Абонент только что ответил на звонок. Сгенерируй одну короткую первую реплику: приветствие и заход к цели сценария. Только JSON по правилам system.]'
      }
    ]
  });
  if ('error' in gen) {
    return 'Здравствуйте! Удобно говорить?';
  }
  return gen.reply;
}

async function assertBotActive(companyId: string, botId: string): Promise<boolean> {
  const db = getDb();
  const snap = await db.collection(CRM_AI_BOTS).doc(botId).get();
  if (!snap.exists) return false;
  const d = snap.data()!;
  if (String(d.companyId ?? '') !== companyId) return false;
  const st = String(d.status ?? 'draft');
  return st !== 'paused' && st !== 'archived';
}

async function finalizeVoiceConversation(
  companyId: string,
  callId: string,
  session: Record<string, unknown>,
  outcome: VoiceOutcome,
  endReason: string
): Promise<void> {
  const latest = (await adminGetVoiceCallSession(companyId, callId)) ?? session;
  const meta = buildMergedMetadata(latest, {
    conversationState: 'completed',
    endReason
  });
  await adminUpdateVoiceCallSession(companyId, callId, {
    status: 'completed',
    outcome,
    endReason,
    endedAt: FieldValue.serverTimestamp(),
    postCallStatus: 'pending',
    metadata: meta
  });
}

export async function runVoiceTwimlEntry(params: {
  callSid: string;
  config: VoiceProviderRuntimeConfig;
}): Promise<string> {
  const session = await adminFindVoiceSessionByProviderCallId(params.callSid);
  if (!session?.id) {
    console.warn(LOG, 'session not found for CallSid', params.callSid);
    return hangupSilent();
  }

  const callId = session.id;
  const companyId = String(session.companyId ?? '');
  const botId = String(session.botId ?? '');
  const status = String(session.status ?? '');

  if (!companyId || !botId) {
    return hangupSilent();
  }

  if (TERMINAL.includes(status)) {
    return hangupSilent();
  }

  const loop = readVoiceLoop(session);
  if (loop.conversationState === 'completed') {
    return hangupSilent();
  }

  const apiKey = await resolveOpenAiKeyForVoice(companyId);
  if (!apiKey) {
    console.warn(LOG, 'no OpenAI key', companyId);
    return sayThenHangup('Не настроен искусственный интеллект для компании. До свидания.');
  }

  const active = await assertBotActive(companyId, botId);
  if (!active) {
    return botPausedTwiml();
  }

  const gatherUrl = buildVoiceTwilioGatherActionUrl(params.config);
  if (!gatherUrl.startsWith('http')) {
    return sayThenHangup('Техническая ошибка конфигурации. До свидания.');
  }

  let turns = await adminListVoiceTurnsOrdered(companyId, callId, 80);

  if (loop.twimlBootstrapped && countBotTurns(turns) > 0) {
    const firstBot = turns.find((t) => t.speaker === 'bot');
    if (firstBot?.text) {
      return sayThenGather(gatherUrl, firstBot.text);
    }
  }

  const opening = await resolveOpeningUtterance(companyId, botId, apiKey);
  const t0 = nextTurnIndex(turns);
  await adminAppendVoiceTurn(companyId, callId, {
    turnIndex: t0,
    speaker: 'bot',
    text: opening,
    sttModel: 'twilio_gather',
    ttsVoiceId: 'Polly.Tatyana'
  });

  const meta = buildMergedMetadata(session, {
    twimlBootstrapped: true,
    conversationState: 'active',
    emptyGatherStreak: 0
  });

  await adminUpdateVoiceCallSession(companyId, callId, {
    status: 'in_progress',
    metadata: meta
  });

  return sayThenGather(gatherUrl, opening);
}

export async function runVoiceGatherAction(params: {
  callSid: string;
  speechResult: string;
  confidenceStr?: string | undefined;
  config: VoiceProviderRuntimeConfig;
}): Promise<string> {
  const session = await adminFindVoiceSessionByProviderCallId(params.callSid);
  if (!session?.id) {
    return hangupSilent();
  }

  const callId = session.id;
  const companyId = String(session.companyId ?? '');
  const botId = String(session.botId ?? '');
  const status = String(session.status ?? '');

  if (!companyId || !botId) {
    return hangupSilent();
  }

  if (TERMINAL.includes(status)) {
    return hangupSilent();
  }

  const loop = readVoiceLoop(session);
  if (loop.conversationState === 'completed') {
    return hangupSilent();
  }

  const gatherUrl = buildVoiceTwilioGatherActionUrl(params.config);
  if (!gatherUrl.startsWith('http')) {
    await finalizeVoiceConversation(companyId, callId, session, 'unknown', 'gather_url_invalid');
    return sayThenHangup('Ошибка конфигурации. До свидания.');
  }

  const apiKey = await resolveOpenAiKeyForVoice(companyId);
  if (!apiKey) {
    await finalizeVoiceConversation(companyId, callId, session, 'unknown', 'no_openai_key');
    return sayThenHangup('Сервис недоступен. До свидания.');
  }

  const active = await assertBotActive(companyId, botId);
  if (!active) {
    await finalizeVoiceConversation(companyId, callId, session, 'unknown', 'bot_inactive');
    return botPausedTwiml();
  }

  let turns = await adminListVoiceTurnsOrdered(companyId, callId, 80);
  const speech = params.speechResult.trim();

  if (!speech) {
    const streak = (loop.emptyGatherStreak ?? 0) + 1;
    const meta = buildMergedMetadata(session, { emptyGatherStreak: streak });
    await adminUpdateVoiceCallSession(companyId, callId, { metadata: meta });

    if (streak >= VOICE_MAX_EMPTY_GATHER) {
      await finalizeVoiceConversation(companyId, callId, session, 'unknown', 'no_speech_repeated');
      const t = 'Не удалось вас услышать. Перезвоните позже, если нужно. До свидания.';
      return sayThenHangup(t);
    }

    const retry = 'Извините, не расслышал. Скажите коротко, пожалуйста.';
    return sayThenGather(gatherUrl, retry);
  }

  const metaClear = buildMergedMetadata(session, { emptyGatherStreak: 0 });
  await adminUpdateVoiceCallSession(companyId, callId, { metadata: metaClear });

  let conf: number | null = null;
  if (params.confidenceStr != null && params.confidenceStr !== '') {
    const n = Number(params.confidenceStr);
    if (Number.isFinite(n)) conf = n;
  }

  const idxClient = nextTurnIndex(turns);
  await adminAppendVoiceTurn(companyId, callId, {
    turnIndex: idxClient,
    speaker: 'client',
    text: speech.slice(0, 4000),
    rawText: speech,
    sttModel: 'twilio_gather',
    confidence: conf
  });

  turns = await adminListVoiceTurnsOrdered(companyId, callId, 80);
  const botCountAfterClient = countBotTurns(turns);
  if (botCountAfterClient >= VOICE_MAX_BOT_UTTERANCES) {
    const latest = (await adminFindVoiceSessionByProviderCallId(params.callSid)) ?? session;
    await finalizeVoiceConversation(companyId, callId, latest, 'unknown', 'max_bot_utterances_after_client');
    return sayThenHangup('Спасибо, на этом пока всё. До свидания!');
  }

  const messages = turnsToMessages(turns);
  const gen = await generateVoiceBotReply({ companyId, botId, apiKey, messages });
  if ('error' in gen) {
    console.warn(LOG, 'AI error', gen.error);
    const latestAi = (await adminFindVoiceSessionByProviderCallId(params.callSid)) ?? session;
    await finalizeVoiceConversation(companyId, callId, latestAi, 'unknown', `ai_error:${gen.error}`);
    return sayThenHangup('Извините, сбой при обработке. Перезвоните позже. До свидания.');
  }

  const idxBot = nextTurnIndex(turns);
  await adminAppendVoiceTurn(companyId, callId, {
    turnIndex: idxBot,
    speaker: 'bot',
    text: gen.reply,
    sttModel: 'gpt-4o-mini',
    ttsVoiceId: 'Polly.Tatyana'
  });

  const freshSession = (await adminFindVoiceSessionByProviderCallId(params.callSid)) ?? session;
  const metaAfter = buildMergedMetadata(freshSession, { conversationState: 'active' });
  await adminUpdateVoiceCallSession(companyId, callId, { metadata: metaAfter });

  const totalBot = botCountAfterClient + 1;
  if (gen.shouldEnd || totalBot >= VOICE_MAX_BOT_UTTERANCES) {
    const latest = (await adminFindVoiceSessionByProviderCallId(params.callSid)) ?? freshSession;
    await finalizeVoiceConversation(
      companyId,
      callId,
      latest,
      gen.outcome,
      gen.shouldEnd ? 'ai_should_end' : 'max_bot_utterances'
    );
    return sayThenHangup(gen.reply);
  }

  return sayThenGather(gatherUrl, gen.reply);
}
