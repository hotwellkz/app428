/**
 * Генерация реплики бота для голосового канала (отдельно от WhatsApp runtime).
 */
import { getDb, getOpenAIApiKeyForCompany } from '../firebaseAdmin';
import {
  buildCrmAiBotSystemPrompt,
  CRM_AI_BOT_VOICE_SYSTEM_APPEND,
  type CrmAiBotPromptMeta
} from '../../../../src/lib/ai/crmAiBotPrompt';
import { parseCrmAiBotConfig, type CrmAiBotConfig } from '../../../../src/types/crmAiBotConfig';
import { buildCrmAiBotKnowledgeContext } from '../crmAiBotKnowledgeLoad';
import type { VoiceOutcome } from '../../../../src/types/voice';

const CRM_AI_BOTS = 'crmAiBots';
const LOG_PREFIX = '[generateVoiceReply]';

const OUTCOMES: VoiceOutcome[] = ['meeting_booked', 'callback', 'no_interest', 'unknown'];

function log(...args: unknown[]) {
  console.log(LOG_PREFIX, ...args);
}

function lastUserContent(msgs: { role: 'user' | 'assistant'; content: string }[]): string {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'user') return msgs[i].content;
  }
  return '';
}

function parseOutcome(s: string): VoiceOutcome {
  const t = s.trim() as VoiceOutcome;
  return OUTCOMES.includes(t) ? t : 'unknown';
}

export type VoiceBotGenerationOk = {
  reply: string;
  shouldEnd: boolean;
  outcome: VoiceOutcome;
};

export type VoiceBotGenerationResult = VoiceBotGenerationOk | { error: string };

/**
 * Загрузка ключа OpenAI по companyId (сервер, без Bearer).
 */
export async function resolveOpenAiKeyForVoice(companyId: string): Promise<string | null> {
  return getOpenAIApiKeyForCompany(companyId);
}

export async function generateVoiceBotReply(params: {
  companyId: string;
  botId: string;
  apiKey: string;
  /** История: user = клиент, assistant = бот */
  messages: { role: 'user' | 'assistant'; content: string }[];
}): Promise<VoiceBotGenerationResult> {
  const db = getDb();
  const botSnap = await db.collection(CRM_AI_BOTS).doc(params.botId).get();
  if (!botSnap.exists) {
    return { error: 'Бот не найден' };
  }
  const botData = botSnap.data()!;
  const botCompany = String(botData.companyId ?? '');
  if (botCompany !== params.companyId) {
    return { error: 'Бот не принадлежит компании' };
  }

  const status = String(botData.status ?? 'draft');
  if (status === 'archived' || status === 'paused') {
    return { error: 'Бот недоступен (пауза или архив)' };
  }

  const botMeta: CrmAiBotPromptMeta = {
    name: String(botData.name ?? 'Бот').trim().slice(0, 200),
    description:
      typeof botData.description === 'string' ? botData.description.trim().slice(0, 2000) : null,
    botType: String(botData.botType ?? 'other'),
    channel: String(botData.channel ?? 'voice')
  };

  const config: CrmAiBotConfig = parseCrmAiBotConfig(botData.config);
  const systemBase = buildCrmAiBotSystemPrompt(botMeta, config);

  let knowledgeAppend = '';
  const useKb = config.knowledge.useCompanyKnowledgeBase === true;
  const useQr = config.knowledge.useQuickReplies === true;
  if (useKb || useQr) {
    const lastUser = lastUserContent(params.messages);
    const { text } = await buildCrmAiBotKnowledgeContext(db, params.companyId, {
      useKb,
      useQr,
      lastUserMessage: lastUser || 'телефонный звонок'
    });
    if (text.trim()) {
      knowledgeAppend = `

---
ФАКТЫ И ШАБЛОНЫ КОМПАНИИ

${text}
`;
    }
  }

  const systemContent = `${systemBase}${knowledgeAppend}\n\n${CRM_AI_BOT_VOICE_SYSTEM_APPEND}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemContent }, ...params.messages],
        temperature: 0.45,
        max_tokens: 400,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const t = await response.text();
      log('OpenAI error', response.status, t.slice(0, 300));
      return { error: 'Модель не ответила' };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const raw = String(data.choices?.[0]?.message?.content ?? '').trim();
    if (!raw) {
      return { error: 'Пустой ответ модели' };
    }

    let parsed: { reply?: string; shouldEnd?: boolean; outcome?: string };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      log('JSON parse failed, fallback plain text');
      return {
        reply: raw.slice(0, 500),
        shouldEnd: false,
        outcome: 'unknown'
      };
    }

    const reply = String(parsed.reply ?? '').trim();
    if (!reply) {
      return { error: 'Пустое поле reply в JSON' };
    }

    return {
      reply: reply.slice(0, 1200),
      shouldEnd: Boolean(parsed.shouldEnd),
      outcome: parseOutcome(String(parsed.outcome ?? 'unknown'))
    };
  } catch (e) {
    log(e);
    return { error: 'Ошибка запроса к модели' };
  }
}
