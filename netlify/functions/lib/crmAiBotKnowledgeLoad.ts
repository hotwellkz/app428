import type { Firestore } from 'firebase-admin/firestore';
import type { Timestamp } from 'firebase-admin/firestore';

const LOG_PREFIX = '[crmAiBotKnowledgeLoad]';

export interface CrmAiBotKnowledgeMeta {
  companyKnowledgeBaseLoaded: boolean;
  quickRepliesLoaded: boolean;
  knowledgeArticlesUsed: number;
  quickRepliesUsed: number;
  truncated: boolean;
}

const MAX_KB_DOCS = 22;
const MAX_KB_CONTENT_EACH = 720;
const MAX_QR_DOCS = 45;
const MAX_QR_TEXT_EACH = 420;
const MAX_TOTAL_CHARS = 9600;
const QR_SCORE_MIN = 0.22;
const QR_TOP_WITH_SCORE = 10;
const QR_FALLBACK = 6;

function millis(t: unknown): number {
  if (t && typeof (t as Timestamp).toMillis === 'function') {
    return (t as Timestamp).toMillis();
  }
  return 0;
}

function normalize(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getWords(s: string): string[] {
  return normalize(s)
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/** Оценка релевантности быстрого ответа (как в ai-generate-reply). */
function scoreQuickReply(clientMessage: string, q: { title?: string; text?: string; keywords?: string }): number {
  const msg = normalize(clientMessage);
  const msgWords = getWords(msg);
  if (msgWords.length === 0) return 0;

  const title = normalize((q.title ?? '').trim());
  const keywordsStr = (q.keywords ?? '').trim();
  const keywords = keywordsStr
    .split(/[,;]/)
    .map((k) => normalize(k.trim()))
    .filter((k) => k.length > 0);
  const text = normalize((q.text ?? '').trim());

  let score = 0;

  if (title.length > 0) {
    if (msg.includes(title) || title.includes(msg)) score += 0.45;
    else {
      const titleWords = getWords(title);
      const matchTitle = titleWords.filter((w) => w.length > 1 && msg.includes(w)).length;
      if (matchTitle > 0) score += 0.25 * Math.min(matchTitle / Math.max(titleWords.length, 1), 1);
    }
  }

  for (const kw of keywords) {
    if (kw.length < 2) continue;
    if (msg.includes(kw) || msgWords.some((w) => w.includes(kw) || kw.includes(w))) {
      score += 0.35;
      break;
    }
  }

  if (text.length > 0) {
    const textWords = getWords(text);
    const matchText = msgWords.filter((w) => w.length > 1 && textWords.some((tw) => tw.includes(w) || w.includes(tw))).length;
    if (matchText > 0) score += 0.2 * Math.min(matchText / Math.min(msgWords.length, 5), 1);
  }

  return Math.min(score, 1);
}

/**
 * Загрузка базы знаний и быстрых ответов компании + компактный текстовый блок для system prompt.
 */
export async function buildCrmAiBotKnowledgeContext(
  db: Firestore,
  companyId: string,
  opts: { useKb: boolean; useQr: boolean; lastUserMessage: string }
): Promise<{ text: string; meta: CrmAiBotKnowledgeMeta }> {
  const meta: CrmAiBotKnowledgeMeta = {
    companyKnowledgeBaseLoaded: false,
    quickRepliesLoaded: false,
    knowledgeArticlesUsed: 0,
    quickRepliesUsed: 0,
    truncated: false
  };

  const chunks: string[] = [];
  let total = 0;

  const push = (s: string) => {
    const t = s.trim();
    if (!t) return;
    if (total + t.length > MAX_TOTAL_CHARS) {
      meta.truncated = true;
      const rest = MAX_TOTAL_CHARS - total;
      if (rest > 80) {
        chunks.push(t.slice(0, rest) + '…');
        total = MAX_TOTAL_CHARS;
      }
      return;
    }
    chunks.push(t);
    total += t.length + 2;
  };

  try {
    if (opts.useKb) {
      const snap = await db.collection('knowledgeBase').where('companyId', '==', companyId).get();
      meta.companyKnowledgeBaseLoaded = true;
      const rows = snap.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            title: String(data.title ?? '').trim(),
            category: String(data.category ?? '').trim(),
            content: String(data.content ?? '').trim(),
            updatedAt: data.updatedAt
          };
        })
        .filter((r) => r.content.length > 0)
        .sort((a, b) => millis(b.updatedAt) - millis(a.updatedAt))
        .slice(0, MAX_KB_DOCS);

      if (rows.length) {
        push('### База знаний (фрагменты, не выдумывай сверх написанного)');
        for (const r of rows) {
          const body = r.content.length > MAX_KB_CONTENT_EACH ? r.content.slice(0, MAX_KB_CONTENT_EACH) + '…' : r.content;
          const head = [r.title && `**${r.title}**`, r.category && `(${r.category})`].filter(Boolean).join(' ');
          push(head ? `${head}\n${body}` : body);
          meta.knowledgeArticlesUsed += 1;
          if (total >= MAX_TOTAL_CHARS) break;
        }
      }
    }
  } catch (e) {
    console.error(LOG_PREFIX, 'knowledgeBase load failed', e);
  }

  try {
    if (opts.useQr) {
      const snap = await db.collection('quick_replies').where('companyId', '==', companyId).get();
      meta.quickRepliesLoaded = true;
      const all = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          title: String(data.title ?? '').trim(),
          text: String(data.text ?? '').trim(),
          keywords: String(data.keywords ?? '').trim(),
          updatedAt: data.updatedAt
        };
      });

      const scored = all
        .filter((q) => q.text.length > 0 || q.title.length > 0)
        .map((q) => ({
          ...q,
          _score: scoreQuickReply(opts.lastUserMessage, q)
        }))
        .sort((a, b) => b._score - a._score);

      const strong = scored.filter((q) => q._score >= QR_SCORE_MIN).slice(0, QR_TOP_WITH_SCORE);
      const picked =
        strong.length > 0
          ? strong
          : scored.sort((a, b) => millis(b.updatedAt) - millis(a.updatedAt)).slice(0, QR_FALLBACK);

      if (picked.length) {
        push('### Быстрые ответы (шаблоны менеджеров; при высокой релевантности опирайся на формулировки)');
        for (const q of picked) {
          if (total >= MAX_TOTAL_CHARS) break;
          const scoreNote = q._score >= 0.45 ? ` [релевантность ~${Math.round(q._score * 100)}%]` : '';
          const tx = q.text.length > MAX_QR_TEXT_EACH ? q.text.slice(0, MAX_QR_TEXT_EACH) + '…' : q.text;
          const line = [q.title && `**${q.title}**${scoreNote}`, q.keywords && `Ключевые слова: ${q.keywords}`, tx]
            .filter(Boolean)
            .join('\n');
          push(line);
          meta.quickRepliesUsed += 1;
        }
      }
    }
  } catch (e) {
    console.error(LOG_PREFIX, 'quick_replies load failed', e);
  }

  const text = chunks.join('\n\n').trim();
  return { text, meta };
}
