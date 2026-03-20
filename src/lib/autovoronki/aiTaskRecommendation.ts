import type { CrmAiBotExtractionResult } from '../../types/crmAiBotExtraction';
import type { AiDealRecommendationSnapshot } from '../../types/aiDealRecommendation';
import type {
  AiRecommendedDueMode,
  AiRecommendedTaskPriority,
  AiRecommendedTaskType,
  AiTaskRecommendationSnapshot
} from '../../types/aiTaskRecommendation';

/** Детерминированный хэш рекомендации задачи (как у сделки — FNV-подобный). */
export function computeTaskRecommendationPayloadHash(parts: {
  recommendedTaskTitle: string;
  recommendedTaskType: string;
  dealId: string;
  conversationId: string;
  botId: string;
  triggerMessageId: string;
}): string {
  const raw = `${parts.recommendedTaskTitle}|${parts.recommendedTaskType}|${parts.dealId}|${parts.conversationId}|${parts.botId}|${parts.triggerMessageId}`;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = (h >>> 0).toString(16).padStart(8, '0');
  let h2 = 5381;
  for (let i = 0; i < raw.length; i++) h2 = (h2 * 33) ^ raw.charCodeAt(i);
  const b = (h2 >>> 0).toString(16).padStart(8, '0');
  return `tsk_${a}_${b}`;
}

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function joinText(ex: CrmAiBotExtractionResult): string {
  return [
    ex.nextStep,
    ex.timeline,
    ex.summaryComment,
    ex.interestLevel,
    ex.leadTemperature
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Эвристика срока из текста extraction (без выдуманных дат). */
export function inferDueFromExtraction(ex: CrmAiBotExtractionResult): {
  mode: AiRecommendedDueMode;
  dueAtIso: string | null;
  hint: string | null;
  confidence: 'high' | 'medium' | 'low';
} {
  const blob = joinText(ex);
  const hintParts: string[] = [];
  if (ex.timeline?.trim()) hintParts.push(ex.timeline.trim());
  if (ex.nextStep?.trim()) hintParts.push(ex.nextStep.trim());
  const hint = hintParts.length ? hintParts.join(' · ').slice(0, 400) : null;

  const now = new Date();
  const setDay = (d: Date) => {
    d.setHours(18, 0, 0, 0);
    return d.toISOString();
  };

  if (/после ответ|когда ответит|жд[ёе]м ответ|после сообщен/i.test(blob)) {
    return { mode: 'after_client_reply', dueAtIso: null, hint: hint ?? 'После ответа клиента', confidence: 'medium' };
  }
  if (/сегодня|до вечера|в течение дня/i.test(blob)) {
    const e = new Date(now);
    e.setHours(20, 0, 0, 0);
    if (e.getTime() <= now.getTime()) e.setDate(e.getDate() + 1);
    return { mode: 'today', dueAtIso: e.toISOString(), hint, confidence: 'low' };
  }
  if (/завтра/i.test(blob)) {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    return { mode: 'tomorrow', dueAtIso: setDay(t), hint, confidence: 'medium' };
  }
  if (/после обеда|во второй половине дня/i.test(blob)) {
    const t = new Date(now);
    t.setDate(t.getDate() + (now.getHours() >= 14 ? 1 : 0));
    t.setHours(15, 0, 0, 0);
    return {
      mode: 'scheduled_datetime',
      dueAtIso: t.getTime() > now.getTime() ? t.toISOString() : null,
      hint: hint ?? 'После обеда',
      confidence: 'low'
    };
  }
  if (/понедельник|вторник|среду|четверг|пятницу|следующ(ей|ую) недел/i.test(blob)) {
    return { mode: 'manual', dueAtIso: null, hint: hint ?? 'Уточните дату в календаре', confidence: 'low' };
  }
  if (/срочно|asap|немедленно|сейчас же/i.test(blob)) {
    return { mode: 'asap', dueAtIso: null, hint: hint ?? 'Как можно раньше', confidence: 'medium' };
  }
  if (/вечером|утром|в \d{1,2}[.:]\d{2}/i.test(blob)) {
    return { mode: 'manual', dueAtIso: null, hint, confidence: 'low' };
  }

  return { mode: 'manual', dueAtIso: null, hint, confidence: 'low' };
}

function mapPriority(ex: CrmAiBotExtractionResult, taskType: AiRecommendedTaskType): AiRecommendedTaskPriority {
  const t = norm(ex.leadTemperature) + norm(ex.interestLevel);
  if (/горяч|hot|urgent|срочн/i.test(t)) return 'urgent';
  if (/высок|warm|тёпл|тепл/i.test(t)) return 'high';
  if (taskType === 'send_quote' || taskType === 'prepare_estimate') return 'high';
  if (taskType === 'manual_review') return 'low';
  return 'normal';
}

export interface BuildAiTaskRecommendationInput {
  extraction: CrmAiBotExtractionResult;
  dealRecommendation: AiDealRecommendationSnapshot | null;
  conversationId: string;
  botId: string;
  botName: string;
  triggerMessageId: string | null;
  channel?: string | null;
  /** Если сделка уже есть — подставляем ответственного сделки */
  dealContext: {
    dealId: string;
    responsibleUserId: string | null;
    responsibleNameSnapshot: string | null;
  } | null;
}

/**
 * Практичная эвристика следующего шага менеджера (без второго вызова LLM на этом этапе).
 */
export function buildAiTaskRecommendationSnapshot(input: BuildAiTaskRecommendationInput): AiTaskRecommendationSnapshot {
  const nowIso = new Date().toISOString();
  const ex = input.extraction;
  const warnings: string[] = [];
  const reasons: string[] = [];

  if (input.channel && input.channel !== 'whatsapp' && input.channel !== 'voice') {
    return {
      status: 'skipped',
      reason: 'Рекомендация задачи только для каналов WhatsApp и голосового звонка',
      recommendedTaskTitle: '—',
      recommendedTaskDescription: '',
      recommendedTaskType: 'manual_review',
      recommendedPriority: 'low',
      recommendedDueMode: 'manual',
      recommendedDueAt: null,
      dueHint: null,
      reasons: [],
      warnings: [],
      confidence: 'low',
      payloadHash: computeTaskRecommendationPayloadHash({
        recommendedTaskTitle: 'skip',
        recommendedTaskType: 'manual_review',
        dealId: '',
        conversationId: input.conversationId,
        botId: input.botId,
        triggerMessageId: input.triggerMessageId ?? ''
      }),
      dealId: null,
      suggestedResponsibleUserId: null,
      suggestedResponsibleNameSnapshot: null,
      canCreateTask: false,
      createdFromBotId: input.botId,
      createdFromConversationId: input.conversationId,
      createdAt: nowIso,
      triggerMessageId: input.triggerMessageId
    };
  }

  const missing = ex.missingFields ?? [];
  const blob = joinText(ex);
  const hasDeal = !!input.dealContext?.dealId;

  const routing = input.dealRecommendation?.routing;
  const suggestedUid =
    input.dealContext?.responsibleUserId?.trim() ||
    routing?.recommendedAssigneeId?.trim() ||
    null;
  const suggestedName =
    input.dealContext?.responsibleNameSnapshot?.trim() ||
    routing?.recommendedAssigneeName?.trim() ||
    null;

  let taskType: AiRecommendedTaskType = 'follow_up';
  let title = 'Связаться с клиентом';
  let description = '';

  if (missing.length >= 3 || (missing.includes('areaM2') && missing.includes('city'))) {
    taskType = 'clarify_parameters';
    title = 'Уточнить параметры проекта';
    reasons.push('В extraction отмечено несколько недостающих полей');
  } else if (ex.wantsCommercialOffer === true || /кп|коммерческ|предложен|расч[ёе]т|смет/i.test(blob)) {
    taskType = ex.wantsCommercialOffer ? 'prepare_estimate' : 'send_quote';
    title = taskType === 'prepare_estimate' ? 'Подготовить расчёт / смету' : 'Подготовить и отправить КП';
    reasons.push('Клиент запрашивает расчёт или коммерческое предложение');
  } else if (ex.wantsConsultation === true || /консультац|встреч|звонок|перезвон/i.test(blob)) {
    taskType = /встреч|консультац/i.test(blob) ? 'schedule_meeting' : 'call_back';
    title = taskType === 'schedule_meeting' ? 'Назначить консультацию / встречу' : 'Связаться с клиентом по телефону';
    reasons.push('В диалоге запрос на связь или консультацию');
  } else if (missing.length > 0) {
    taskType = 'clarify_parameters';
    title = 'Уточнить недостающие данные по проекту';
    reasons.push(`Недостаёт данных: ${missing.slice(0, 5).join(', ')}`);
  } else if (/тёпл|тепл|warm|горяч|заинтересован/i.test(blob)) {
    taskType = 'follow_up';
    title = 'Связаться с клиентом (лид активен)';
    reasons.push('По температуре лида нужен контакт менеджера');
  } else if (!ex.summaryComment?.trim() && !ex.nextStep?.trim() && missing.length === 0) {
    taskType = 'manual_review';
    title = 'Проверить переписку вручную';
    reasons.push('Мало сигналов из extraction — нужен просмотр диалога');
    warnings.push('Низкая определённость следующего шага');
  } else {
    taskType = 'follow_up';
    title = 'Связаться с клиентом';
    if (ex.nextStep?.trim()) reasons.push(`Следующий шаг из диалога: ${ex.nextStep.trim().slice(0, 120)}`);
    else reasons.push('Поддержать диалог по контексту переписки');
  }

  const due = inferDueFromExtraction(ex);
  const priority = mapPriority(ex, taskType);

  const descLines: string[] = [];
  const sourceLabel =
    input.channel === 'voice'
      ? `Голосовой звонок · AI «${input.botName}»`
      : `WhatsApp · AI «${input.botName}»`;
  descLines.push(`Источник: ${sourceLabel}`);
  if (ex.summaryComment?.trim()) descLines.push(`Сводка: ${ex.summaryComment.trim().slice(0, 500)}`);
  if (ex.nextStep?.trim()) descLines.push(`Ожидаемый шаг клиента: ${ex.nextStep.trim().slice(0, 300)}`);
  description = descLines.join('\n').slice(0, 4000);

  let status: AiTaskRecommendationSnapshot['status'] = 'recommended';
  let confidence: 'high' | 'medium' | 'low' = 'medium';

  if (taskType === 'manual_review') {
    status = 'manual_review';
    confidence = 'low';
  }
  if (!hasDeal) {
    warnings.push('Сделка ещё не создана — кнопка «Создать задачу» станет доступна после сделки');
    confidence = confidence === 'high' ? 'medium' : confidence;
  }
  if (ex.missingFields?.length && taskType !== 'clarify_parameters') {
    confidence = 'medium';
  }

  const insufficient = !ex.summaryComment?.trim() && !ex.nextStep?.trim() && missing.length === 0 && taskType === 'manual_review';
  if (insufficient) {
    status = 'insufficient_data';
    reasons.push('Недостаточно данных из последнего прогона модели');
  }

  let canCreateTask = hasDeal && status !== 'insufficient_data' && status !== 'skipped';
  if (status === 'manual_review') {
    canCreateTask = false;
    warnings.push('Режим ручной проверки: создайте задачу вручную в карточке сделки');
  }

  const payloadHash = computeTaskRecommendationPayloadHash({
    recommendedTaskTitle: title,
    recommendedTaskType: taskType,
    dealId: input.dealContext?.dealId ?? '',
    conversationId: input.conversationId,
    botId: input.botId,
    triggerMessageId: input.triggerMessageId ?? ''
  });

  return {
    status,
    reason: null,
    recommendedTaskTitle: title.slice(0, 200),
    recommendedTaskDescription: description,
    recommendedTaskType: taskType,
    recommendedPriority: priority,
    recommendedDueMode: due.mode,
    recommendedDueAt: due.dueAtIso,
    dueHint: due.hint,
    reasons,
    warnings,
    confidence,
    payloadHash,
    dealId: input.dealContext?.dealId ?? null,
    suggestedResponsibleUserId: suggestedUid,
    suggestedResponsibleNameSnapshot: suggestedName,
    canCreateTask,
    createdFromBotId: input.botId,
    createdFromConversationId: input.conversationId,
    createdAt: nowIso,
    triggerMessageId: input.triggerMessageId
  };
}
