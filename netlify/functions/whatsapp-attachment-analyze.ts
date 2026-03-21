import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { createRequire } from 'module';
import { Timestamp, type DocumentReference } from 'firebase-admin/firestore';
import {
  getDb,
  getOpenAIApiKeyForCompany,
  DEFAULT_COMPANY_ID,
  fireWhatsappAttachmentAnalysisJob,
  type MessageAttachmentRow
} from './lib/firebaseAdmin';
import {
  openAiAnalyzeImageBase64,
  openAiAnalyzePdfText,
  buildScannedPdfFallback
} from './lib/whatsappAttachmentAnalysisOpenAi';

const LOG_PREFIX = '[whatsapp-attachment-analyze]';
const MESSAGES = 'whatsappMessages';
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_RUN = 4;
const MIN_PDF_TEXT_LEN = 120;

function log(...args: unknown[]) {
  console.log(LOG_PREFIX, ...args);
}

function shouldAnalyzeAttachment(row: MessageAttachmentRow): boolean {
  if (row.type === 'video' || row.type === 'audio') return false;
  if (row.type === 'image') return true;
  if (row.type === 'file') {
    const mime = (row.mimeType ?? '').toLowerCase();
    const path = row.url.split('?')[0].toLowerCase();
    const name = (row.fileName ?? '').toLowerCase();
    if (mime.includes('pdf') || path.endsWith('.pdf') || name.endsWith('.pdf')) return true;
    if (mime.startsWith('image/')) return true;
    return false;
  }
  return false;
}

async function downloadBinary(url: string): Promise<{ buffer: Buffer; mime: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(28000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const declared = Number(res.headers.get('content-length') || '0');
  if (declared > MAX_BYTES) throw new Error('file_too_large');
  const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream';
  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);
  if (buf.length > MAX_BYTES) throw new Error('file_too_large');
  return { buffer: buf, mime };
}

async function extractPdfText(buf: Buffer): Promise<{ text: string; numpages: number }> {
  const require = createRequire(import.meta.url);
  const pdfParse = require('pdf-parse') as (b: Buffer) => Promise<{ text?: string; numpages?: number }>;
  const data = await pdfParse(buf);
  return { text: (data.text ?? '').trim(), numpages: Number(data.numpages ?? 0) || 0 };
}

function isPdfRow(row: MessageAttachmentRow, downloadedMime: string): boolean {
  const mime = (downloadedMime || row.mimeType || '').toLowerCase();
  const path = row.url.split('?')[0].toLowerCase();
  const name = (row.fileName ?? '').toLowerCase();
  return mime.includes('pdf') || path.endsWith('.pdf') || name.endsWith('.pdf');
}

function isImageRow(row: MessageAttachmentRow, downloadedMime: string): boolean {
  if (row.type === 'image') return true;
  const mime = downloadedMime.toLowerCase();
  if (mime.startsWith('image/')) return true;
  const path = row.url.split('?')[0].toLowerCase();
  return /\.(png|jpe?g|gif|webp|heic)(\?|$)/i.test(path);
}

async function patchAttachments(messageRef: DocumentReference, next: MessageAttachmentRow[]): Promise<void> {
  await messageRef.update({ attachments: next });
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const secret = (process.env.WHATSAPP_ATTACHMENT_ANALYSIS_SECRET ?? '').trim();
  const hdr =
    event.headers['x-internal-secret'] ??
    event.headers['X-Internal-Secret'] ??
    event.headers['X-INTERNAL-SECRET'] ??
    '';
  if (!secret || String(hdr) !== secret) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  let body: { messageId?: string; companyId?: string };
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as typeof body) ?? {};
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const messageId = typeof body.messageId === 'string' ? body.messageId.trim() : '';
  const companyId = typeof body.companyId === 'string' ? body.companyId.trim() : '';
  if (!messageId || !companyId) {
    return { statusCode: 400, body: 'messageId and companyId required' };
  }

  const db = getDb();
  const ref = db.collection(MESSAGES).doc(messageId);
  const snap = await ref.get();
  if (!snap.exists) {
    return { statusCode: 404, body: 'Message not found' };
  }

  const msg = snap.data() as Record<string, unknown>;
  const msgCompany = String(msg.companyId ?? DEFAULT_COMPANY_ID);
  if (msgCompany !== companyId) {
    return { statusCode: 403, body: 'company mismatch' };
  }

  const attachments = Array.isArray(msg.attachments) ? ([...msg.attachments] as MessageAttachmentRow[]) : [];
  if (attachments.length === 0) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, skipped: true }) };
  }

  const apiKey = await getOpenAIApiKeyForCompany(companyId);
  if (!apiKey) {
    log('no OpenAI key for company', companyId);
    const failed = attachments.map((a) => {
      if (!shouldAnalyzeAttachment(a)) return a;
      if (a.analysisStatus !== 'pending' && a.analysisStatus !== 'processing') return a;
      return {
        ...a,
        analysisStatus: 'failed' as const,
        analysisError: 'OpenAI не настроен для компании',
        analysisAt: Timestamp.now(),
        analysisProvider: 'openai'
      };
    });
    await patchAttachments(ref, failed);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, noKey: true }) };
  }

  let processed = 0;
  let next = [...attachments];

  for (let i = 0; i < next.length && processed < MAX_ATTACHMENTS_PER_RUN; i++) {
    const row = next[i];
    if (!shouldAnalyzeAttachment(row)) continue;
    if (row.analysisStatus === 'ready' || row.analysisStatus === 'skipped' || row.analysisStatus === 'failed') {
      continue;
    }
    if (row.analysisStatus !== 'pending' && row.analysisStatus !== 'processing') continue;

    const now = Timestamp.now();
    next[i] = { ...row, analysisStatus: 'processing', analysisProvider: 'openai' };
    await patchAttachments(ref, next);

    try {
      const { buffer, mime } = await downloadBinary(row.url);
      let patch: Partial<MessageAttachmentRow>;

      if (isPdfRow(row, mime)) {
        const { text, numpages } = await extractPdfText(buffer);
        const truncated = text.length > 45000;
        const textForModel = truncated ? text.slice(0, 45000) : text;
        if (textForModel.length >= MIN_PDF_TEXT_LEN) {
          const { structured, summaryShort, summaryFull } = await openAiAnalyzePdfText(apiKey, textForModel, {
            numPages: numpages,
            truncated: truncated || numpages > 8
          });
          patch = {
            analysisStatus: 'ready',
            analysisSummaryShort: summaryShort,
            analysisSummaryFull: summaryFull,
            analysisStructured: structured,
            analysisProvider: 'openai',
            analysisAt: now,
            analysisError: null
          };
        } else {
          const fb = buildScannedPdfFallback(row.fileName ?? undefined);
          patch = {
            analysisStatus: 'ready',
            analysisSummaryShort: fb.summaryShort,
            analysisSummaryFull: fb.summaryFull,
            analysisStructured: fb.structured,
            analysisProvider: 'openai',
            analysisAt: now,
            analysisError: null
          };
        }
      } else if (isImageRow(row, mime)) {
        const imageMime = mime.startsWith('image/') ? mime : row.mimeType || 'image/jpeg';
        const b64 = buffer.toString('base64');
        const { structured, summaryShort, summaryFull } = await openAiAnalyzeImageBase64(apiKey, b64, imageMime);
        patch = {
          analysisStatus: 'ready',
          analysisSummaryShort: summaryShort,
          analysisSummaryFull: summaryFull,
          analysisStructured: structured,
          analysisProvider: 'openai',
          analysisAt: now,
          analysisError: null
        };
      } else {
        patch = {
          analysisStatus: 'skipped',
          analysisSummaryShort: 'Тип файла не поддерживается автоанализом в CRM.',
          analysisSummaryFull: null,
          analysisStructured: {
            attachmentKind: 'file',
            summaryShort: 'Неподдерживаемый тип вложения',
            warnings: ['unreadable_text']
          },
          analysisProvider: 'openai',
          analysisAt: now,
          analysisError: null
        };
      }

      next[i] = { ...next[i], ...patch };
      await patchAttachments(ref, next);
      processed++;
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      log('attachment failed index=', i, err);
      next[i] = {
        ...next[i],
        analysisStatus: 'failed',
        analysisError: err.slice(0, 500),
        analysisAt: Timestamp.now(),
        analysisProvider: 'openai'
      };
      await patchAttachments(ref, next);
      processed++;
    }
  }

  const morePending = next.some((a) => shouldAnalyzeAttachment(a) && a.analysisStatus === 'pending');
  if (processed > 0 && morePending) {
    fireWhatsappAttachmentAnalysisJob(messageId, companyId);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, processed })
  };
};
