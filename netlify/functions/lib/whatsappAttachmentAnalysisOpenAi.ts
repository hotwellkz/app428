/**
 * OpenAI: структурированный анализ вложений чата (image vision / текст PDF).
 * Ключ API передаётся только с сервера.
 */
import type { ChatAttachmentStructuredAnalysis } from '../../src/types/whatsappDb';

const MODEL = 'gpt-4o-mini';

const SYSTEM_IMAGE = `Ты анализируешь вложение клиента строительной/modular-home компании (РФ/СНГ, русский язык).
Верни ОДИН JSON-объект (без markdown), поля:
- attachmentKind: всегда "image"
- summaryShort: string, до 280 символов, русский, по делу
- summaryFull: string, до 1200 символов
- detectedObjects: string[] — что видно (дом, план, скрин, фасад и т.д.)
- appearsToBeHouseProject: boolean
- appearsToContainFloorplan: boolean
- appearsToContainDimensions: boolean
- detectedDimensionsText: string[] — подписи размеров если читаются, иначе []
- estimatedFloors: "1" | "2" | "unknown"
- estimatedStyle: "modern" | "classic" | "modular" | "barnhouse" | "unknown"
- userIntentFromAttachment: string[] — значения из: wants_similar_house, wants_estimate, wants_review, wants_dimensions_check, wants_feasibility_check
- warnings: string[] — из: low_quality_image, unreadable_text, no_dimensions_detected

Не выдумывай точные размеры: если нечитаемо — warnings содержит unreadable_text или no_dimensions_detected.`;

const SYSTEM_PDF_TEXT = `Ты анализируешь извлечённый текст из PDF, который прислал клиент (домостроение, планировки).
Верни ОДИН JSON-объект (без markdown), поля:
- attachmentKind: всегда "pdf"
- summaryShort, summaryFull, detectedObjects — как для изображения, но по тексту
- appearsToBeHouseProject, appearsToContainFloorplan, appearsToContainDimensions: boolean
- detectedDimensionsText: string[] — числа и размеры из текста
- estimatedFloors, estimatedStyle — как выше
- userIntentFromAttachment — как выше
- warnings: может включать partial_pdf, unreadable_text, no_dimensions_detected

Если текста мало или это не про дом — честно укажи в summaryShort.`;

function safeString(v: unknown, max: number): string {
  const s = typeof v === 'string' ? v : v == null ? '' : String(v);
  return s.trim().slice(0, max);
}

function safeBool(v: unknown): boolean {
  return v === true;
}

function safeStringArray(v: unknown, maxItems = 24): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => safeString(x, 200)).filter(Boolean).slice(0, maxItems);
}

function safeIntentArray(v: unknown): ChatAttachmentStructuredAnalysis['userIntentFromAttachment'] {
  const allowed = new Set([
    'wants_similar_house',
    'wants_estimate',
    'wants_review',
    'wants_dimensions_check',
    'wants_feasibility_check'
  ]);
  if (!Array.isArray(v)) return [];
  const out: NonNullable<ChatAttachmentStructuredAnalysis['userIntentFromAttachment']> = [];
  for (const x of v) {
    const s = safeString(x, 80);
    if (allowed.has(s)) out.push(s as NonNullable<ChatAttachmentStructuredAnalysis['userIntentFromAttachment']>[number]);
  }
  return out;
}

function safeWarnings(v: unknown): ChatAttachmentStructuredAnalysis['warnings'] {
  const allowed = new Set([
    'low_quality_image',
    'unreadable_text',
    'partial_pdf',
    'scanned_pdf',
    'no_dimensions_detected'
  ]);
  if (!Array.isArray(v)) return [];
  const out: NonNullable<ChatAttachmentStructuredAnalysis['warnings']> = [];
  for (const x of v) {
    const s = safeString(x, 80);
    if (allowed.has(s)) out.push(s as NonNullable<ChatAttachmentStructuredAnalysis['warnings']>[number]);
  }
  return out;
}

function parseFloors(v: unknown): '1' | '2' | 'unknown' {
  if (v === '1' || v === '2' || v === 'unknown') return v;
  return 'unknown';
}

function parseStyle(v: unknown): ChatAttachmentStructuredAnalysis['estimatedStyle'] {
  if (v === 'modern' || v === 'classic' || v === 'modular' || v === 'barnhouse' || v === 'unknown') return v;
  return 'unknown';
}

export function normalizeStructuredFromModel(
  raw: Record<string, unknown>,
  kind: 'image' | 'pdf' | 'file'
): ChatAttachmentStructuredAnalysis {
  return {
    attachmentKind: kind,
    summaryShort: safeString(raw.summaryShort ?? raw.summary_short, 500),
    summaryFull: safeString(raw.summaryFull ?? raw.summary_full, 2000),
    detectedObjects: safeStringArray(raw.detectedObjects ?? raw.detected_objects),
    appearsToBeHouseProject: safeBool(raw.appearsToBeHouseProject ?? raw.appears_to_be_house_project),
    appearsToContainFloorplan: safeBool(raw.appearsToContainFloorplan ?? raw.appears_to_contain_floorplan),
    appearsToContainDimensions: safeBool(raw.appearsToContainDimensions ?? raw.appears_to_contain_dimensions),
    detectedDimensionsText: safeStringArray(raw.detectedDimensionsText ?? raw.detected_dimensions_text),
    estimatedFloors: parseFloors(raw.estimatedFloors ?? raw.estimated_floors),
    estimatedStyle: parseStyle(raw.estimatedStyle ?? raw.estimated_style),
    userIntentFromAttachment: safeIntentArray(raw.userIntentFromAttachment ?? raw.user_intent_from_attachment),
    warnings: safeWarnings(raw.warnings)
  };
}

async function openAiJsonCompletion(
  apiKey: string,
  messages: Array<{ role: string; content: unknown }>
): Promise<Record<string, unknown>> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.25,
      max_tokens: 1400
    })
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(`OpenAI ${response.status}: ${t.slice(0, 400)}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = String(data.choices?.[0]?.message?.content ?? '').trim();
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  const jsonSlice = start >= 0 && end > start ? content.slice(start, end + 1) : content;
  return JSON.parse(jsonSlice) as Record<string, unknown>;
}

export async function openAiAnalyzeImageBase64(
  apiKey: string,
  base64: string,
  mimeType: string
): Promise<{ structured: ChatAttachmentStructuredAnalysis; summaryShort: string; summaryFull: string }> {
  const mime = mimeType || 'image/jpeg';
  const dataUrl = `data:${mime};base64,${base64}`;
  const raw = await openAiJsonCompletion(apiKey, [
    { role: 'system', content: SYSTEM_IMAGE },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Проанализируй вложение клиента для менеджера CRM.' },
        {
          type: 'image_url',
          image_url: { url: dataUrl, detail: 'low' }
        }
      ]
    }
  ]);
  const structured = normalizeStructuredFromModel(raw, 'image');
  const summaryShort = structured.summaryShort || safeString(raw.summaryShort, 280);
  const summaryFull = structured.summaryFull || summaryShort;
  return { structured, summaryShort, summaryFull };
}

export async function openAiAnalyzePdfText(
  apiKey: string,
  pdfText: string,
  meta: { numPages: number; truncated: boolean }
): Promise<{ structured: ChatAttachmentStructuredAnalysis; summaryShort: string; summaryFull: string }> {
  const header = `Страниц в PDF (по метаданным): ${meta.numPages}. Текст обрезан для анализа: ${meta.truncated ? 'да' : 'нет'}.`;
  const raw = await openAiJsonCompletion(apiKey, [
    { role: 'system', content: SYSTEM_PDF_TEXT },
    {
      role: 'user',
      content: `${header}\n\n---\n${pdfText.slice(0, 48000)}`
    }
  ]);
  let structured = normalizeStructuredFromModel(raw, 'pdf');
  structured = {
    ...structured,
    pdfPagesAnalyzed: Math.min(meta.numPages, 8),
    pdfTextChars: pdfText.length,
    partialPdf: meta.truncated || meta.numPages > 8
  };
  if (structured.partialPdf) {
    const w = new Set(structured.warnings ?? []);
    w.add('partial_pdf');
    structured = { ...structured, warnings: [...w] };
  }
  const summaryShort = structured.summaryShort || safeString(raw.summaryShort, 280);
  const summaryFull = structured.summaryFull || summaryShort;
  return { structured, summaryShort, summaryFull };
}

export function buildScannedPdfFallback(fileName?: string): {
  structured: ChatAttachmentStructuredAnalysis;
  summaryShort: string;
  summaryFull: string;
} {
  const name = fileName?.trim() || 'PDF';
  const summaryShort = `Файл «${name}»: текст из PDF не извлечён (вероятно скан). Попросите чёткие фото страниц или размеры текстом.`;
  const structured: ChatAttachmentStructuredAnalysis = {
    attachmentKind: 'pdf',
    summaryShort,
    summaryFull:
      'Текстовый слой PDF отсутствует или слишком короткий. Для предварительной оценки нужны размеры, этажность, регион и комплектация, либо более чёткие изображения планов.',
    appearsToBeHouseProject: false,
    appearsToContainFloorplan: false,
    appearsToContainDimensions: false,
    detectedDimensionsText: [],
    estimatedFloors: 'unknown',
    estimatedStyle: 'unknown',
    userIntentFromAttachment: [],
    warnings: ['scanned_pdf', 'no_dimensions_detected']
  };
  return { structured, summaryShort, summaryFull: structured.summaryFull ?? summaryShort };
}
