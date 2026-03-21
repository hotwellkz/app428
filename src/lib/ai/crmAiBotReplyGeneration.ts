/**
 * Генерация ответа автоворонки: «человечность», JSON-формат (1–2 части), парсинг.
 */
import type { CrmAiBotConfig, CrmAiBotReplyStyle } from '../../types/crmAiBotConfig';

export function pickCrmClientAggregationDebounceMs(style: CrmAiBotReplyStyle): number {
  const lo = Math.min(style.clientAggregationMinMs, style.clientAggregationMaxMs);
  const hi = Math.max(style.clientAggregationMinMs, style.clientAggregationMaxMs);
  const min = Math.max(800, lo);
  const max = Math.min(15_000, Math.max(min, hi));
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function crmAiReplyStyleTemperature(style: CrmAiBotReplyStyle): number {
  switch (style.humanizationLevel) {
    case 'low':
      return 0.35;
    case 'high':
      return 0.72;
    default:
      return 0.55;
  }
}

export function crmAiReplyStyleMaxTokens(style: CrmAiBotReplyStyle): number {
  switch (style.replyLengthMode) {
    case 'short':
      return 640;
    case 'detailed':
      return 1400;
    default:
      return 1024;
  }
}

/** Секция промпта: естественный менеджер HotWell, без JSON */
export function buildCrmAiBotReplyStylePromptSection(config: CrmAiBotConfig): string {
  const s = config.replyStyle;
  const hum =
    s.humanizationLevel === 'low'
      ? 'Стиль: более сдержанный и деловой, минимум вводных фраз.'
      : s.humanizationLevel === 'high'
        ? 'Стиль: живой менеджер HotWell.kz — естественно и по-человечески, но без фамильярности и «воды».'
        : 'Стиль: естественный менеджер HotWell.kz — дружелюбно и по делу.';

  const len =
    s.replyLengthMode === 'short'
      ? 'Длина: в среднем короче; не раздувай ответ без нужды.'
      : s.replyLengthMode === 'detailed'
        ? 'Длина: можно подробнее, если клиент дал развёрнутый запрос; без простыней и повторов.'
        : 'Длина: подстраивай под вопрос клиента — короткий вопрос → короче, комплексный → полнее.';

  const split =
    s.replySplitMode === 'single'
      ? 'Всегда один логический ответ (в JSON будет одна часть).'
      : s.replySplitMode === 'prefer_multi'
        ? 'Если ответ получается длинным, чаще уместно разделить на 2 короткие реплики (только если звучит естественно).'
        : 'Иногда один ответ, иногда два коротких подряд — только если так пишет живой менеджер; не дроби без причины.';

  const flags: string[] = [];
  if (s.allowShortLeadIn) {
    flags.push(
      'Допускаются короткие вводные в начале, если уместно: «Да, можем.», «Понял вас.», «Смотрите.» — не в каждом сообщении и не одно и то же подряд.'
    );
  }
  if (s.varySentenceLength) {
    flags.push('Чередуй длину фраз; не делай все ответы одной «ширины».');
  }
  if (s.avoidTemplateRepetition) {
    flags.push('Не повторяй одни и те же заходы и CTA в соседних ответах; варьируй формулировки.');
  }
  if (s.allowSoftConversationalBridges) {
    flags.push('Мягкие связки между мыслями допустимы, без канцелярита и без лишних эмодзи.');
  }

  return [
    hum,
    len,
    split,
    'Клиент мог прислать несколько сообщений подряд — воспринимай последний блок пользователя в истории как единый запрос.',
    'Голосовые и текст расшифровки = обычный смысл клиента.',
    ...flags,
    'Не выдумывай факты; не имитируй опечатки; сленг только уместный; без 3+ сообщений подряд от тебя.'
  ]
    .filter(Boolean)
    .join('\n');
}

/** Инструкция JSON-ответа для chat completions (response_format json_object) */
export function buildCrmAiBotJsonReplyInstruction(config: CrmAiBotConfig): string {
  const s = config.replyStyle;
  const maxP = Math.min(2, Math.max(1, s.maxReplyParts));

  let splitRule = '';
  if (s.replySplitMode === 'single') {
    splitRule =
      'Обязательно replyMode: "single", ровно одна непустая строка в parts. Никогда не используй multi.';
  } else if (s.replySplitMode === 'auto') {
    splitRule = `replyMode: "single" или "multi". Если multi — ровно 2 части, каждая короткая/средняя, естественное разделение (подтверждение + основной ответ или два смысловых блока). Если сомневаешься — single. Максимум ${maxP} частей.`;
  } else {
    splitRule = `Чаще выбирай multi, если ответ не короткий и деление звучит естественно; иначе single. Максимум ${maxP} частей в parts.`;
  }

  return `
ФОРМАТ ОТВЕТА МОДЕЛИ: один JSON-объект (без markdown), поля:
- replyMode: строка "single" | "multi"
- parts: массив из 1..${maxP} непустых строк — тексты сообщений клиенту в WhatsApp, по порядку отправки

Правила:
${splitRule}
- Пустые строки в parts запрещены.
- Не дублируй тот же смысл во второй части.
- Тексты только для клиента: без служебных пометок, без «Как модель», без JSON внутри строк.

Примеры допустимого multi: ["Да, можем.", "По площади 100 м² ориентир такой: … уточните город и комплектацию — посчитаем точнее."]`.trim();
}

export type ParsedCrmAiReply = {
  replyMode: 'single' | 'multi';
  parts: string[];
  /** Склейка для логов / extraction */
  combinedText: string;
};

export function parseCrmAiBotModelReplyJson(raw: string, style: CrmAiBotReplyStyle): ParsedCrmAiReply {
  const fallbackText = raw.trim();
  const asSingle = (t: string): ParsedCrmAiReply => ({
    replyMode: 'single',
    parts: t ? [t] : [],
    combinedText: t
  });

  let obj: { replyMode?: unknown; parts?: unknown };
  try {
    const t = raw.trim();
    const i = t.indexOf('{');
    const slice = i >= 0 ? t.slice(i) : t;
    obj = JSON.parse(slice) as { replyMode?: unknown; parts?: unknown };
  } catch {
    return asSingle(fallbackText);
  }

  const partsRaw = Array.isArray(obj.parts) ? obj.parts : [];
  let parts = partsRaw.map((p) => String(p).trim()).filter((p) => p.length > 0);
  const maxP = Math.min(2, Math.max(1, style.maxReplyParts));

  if (style.replySplitMode === 'single') {
    const one = parts.length ? parts.join('\n\n') : fallbackText;
    return { replyMode: 'single', parts: one ? [one] : [], combinedText: one };
  }

  if (parts.length === 0) {
    return asSingle(fallbackText);
  }

  if (parts.length === 1) {
    return { replyMode: 'single', parts, combinedText: parts[0] };
  }

  parts = parts.slice(0, maxP);
  if (parts.length === 1) {
    return { replyMode: 'single', parts, combinedText: parts[0] };
  }

  const mode = obj.replyMode === 'multi' ? 'multi' : 'single';
  if (mode === 'single') {
    const joined = parts.join('\n\n');
    return { replyMode: 'single', parts: [joined], combinedText: joined };
  }

  return { replyMode: 'multi', parts, combinedText: parts.join('\n\n') };
}
