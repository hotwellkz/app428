import type { CrmAiBotExtractionResult } from '../../../src/types/crmAiBotExtraction';
import type { AiDealRoutingSnapshot } from '../../../src/types/aiDealRecommendation';
import { getDb } from './firebaseAdmin';

interface PipelineRow {
  id: string;
  name: string;
  sortOrder: number;
}

interface StageRow {
  id: string;
  name: string;
  sortOrder: number;
}

interface ManagerRow {
  id: string;
  name: string;
}

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

function rankValue(v: AiDealRoutingSnapshot['routingConfidence']): number {
  if (v === 'high') return 3;
  if (v === 'medium') return 2;
  return 1;
}

function warmOrHot(text: string | null | undefined): boolean {
  if (!text) return false;
  return /горяч|warm|hot|тёпл|тепл|высок|high|qualified/i.test(text);
}

function chooseStageByHeuristic(stages: StageRow[], extraction: CrmAiBotExtractionResult): {
  stage: StageRow | null;
  reason: string;
  confidence: AiDealRoutingSnapshot['routingConfidence'];
} {
  if (!stages.length) {
    return { stage: null, reason: 'В выбранной воронке нет этапов', confidence: 'low' };
  }
  const normalized = stages.map((s) => ({ ...s, n: s.name.toLowerCase() }));

  const wantsCalcOrCp =
    extraction.wantsCommercialOffer === true ||
    containsAny(
      `${extraction.nextStep ?? ''} ${extraction.summaryComment ?? ''}`.toLowerCase(),
      ['кп', 'коммерч', 'расч', 'смет', 'calculation', 'quote']
    );
  const wantsConsult =
    extraction.wantsConsultation === true ||
    containsAny(
      `${extraction.nextStep ?? ''} ${extraction.summaryComment ?? ''}`.toLowerCase(),
      ['консультац', 'встреч', 'звон', 'call', 'consult']
    );
  const qualified =
    warmOrHot(extraction.leadTemperature) ||
    warmOrHot(extraction.interestLevel) ||
    extraction.wantsCommercialOffer === true;

  const tryFind = (keys: string[]): StageRow | null => {
    const f = normalized.find((s) => containsAny(s.n, keys));
    return f ?? null;
  };

  if (wantsCalcOrCp) {
    const st = tryFind(['кп', 'расч', 'смет', 'предлож', 'quote', 'calculation']);
    if (st) return { stage: st, reason: 'Клиент запрашивает расчёт/КП', confidence: 'high' };
  }
  if (wantsConsult) {
    const st = tryFind(['конс', 'встреч', 'созвон', 'звон', 'call']);
    if (st) return { stage: st, reason: 'Запрос консультации/встречи', confidence: 'medium' };
  }
  if (qualified) {
    const st = tryFind(['квалиф', 'тепл', 'связ', 'лид']);
    if (st) return { stage: st, reason: 'Клиент квалифицирован по extraction', confidence: 'medium' };
  }
  return {
    stage: stages[0],
    reason: 'Fallback: первый этап воронки',
    confidence: 'low'
  };
}

export async function buildAiDealRoutingSnapshot(params: {
  companyId: string;
  clientData: Record<string, unknown>;
  extraction: CrmAiBotExtractionResult;
}): Promise<AiDealRoutingSnapshot> {
  const { companyId, clientData, extraction } = params;
  const db = getDb();

  const reasons: string[] = [];
  const warnings: string[] = [];
  let conf: AiDealRoutingSnapshot['routingConfidence'] = 'low';

  const pipelinesSnap = await db
    .collection('pipelines')
    .where('companyId', '==', companyId)
    .where('isActive', '==', true)
    .orderBy('sortOrder', 'asc')
    .get()
    .catch(() => null);
  const pipelines: PipelineRow[] = (pipelinesSnap?.docs ?? []).map((d) => {
    const v = d.data();
    return {
      id: d.id,
      name: String(v.name ?? 'Воронка'),
      sortOrder: Number(v.sortOrder ?? 0)
    };
  });
  if (!pipelines.length) {
    warnings.push('Нет активных воронок компании');
    return {
      recommendedPipelineId: null,
      recommendedPipelineName: null,
      recommendedStageId: null,
      recommendedStageName: null,
      recommendedAssigneeId: null,
      recommendedAssigneeName: null,
      routingReason: ['Воронка/этап не определены'],
      routingConfidence: 'low',
      routingWarnings: warnings
    };
  }

  let selectedPipeline = pipelines[0];
  reasons.push('Использована основная/первая активная воронка');
  if (pipelines.length > 1) {
    const preferred = pipelines.find((p) => /основ|продаж|sales|лид/i.test(p.name.toLowerCase()));
    if (preferred) {
      selectedPipeline = preferred;
      reasons.push('Выбрана воронка по названию (основная/продажи)');
      conf = 'medium';
    } else {
      warnings.push('Несколько воронок: явное совпадение не найдено, выбран fallback');
    }
  }

  const stagesSnap = await db
    .collection('pipeline_stages')
    .where('companyId', '==', companyId)
    .where('pipelineId', '==', selectedPipeline.id)
    .where('isActive', '==', true)
    .orderBy('sortOrder', 'asc')
    .get()
    .catch(() => null);
  const stages: StageRow[] = (stagesSnap?.docs ?? []).map((d) => {
    const v = d.data();
    return { id: d.id, name: String(v.name ?? 'Этап'), sortOrder: Number(v.sortOrder ?? 0) };
  });
  const stageChoice = chooseStageByHeuristic(stages, extraction);
  if (stageChoice.stage) reasons.push(stageChoice.reason);
  conf = rankValue(stageChoice.confidence) > rankValue(conf) ? stageChoice.confidence : conf;
  if (!stageChoice.stage) warnings.push('Этап не определён');
  if (stageChoice.reason.toLowerCase().includes('fallback')) warnings.push(stageChoice.reason);

  let assigneeId: string | null = null;
  let assigneeName: string | null = null;
  const clientManagerIdRaw = clientData.managerId;
  const clientManagerId =
    typeof clientManagerIdRaw === 'string' && clientManagerIdRaw.trim() ? clientManagerIdRaw.trim() : null;

  const managersSnap = await db
    .collection('chatManagers')
    .where('companyId', '==', companyId)
    .orderBy('name', 'asc')
    .get()
    .catch(() => null);
  const managers: ManagerRow[] = (managersSnap?.docs ?? []).map((d) => {
    const v = d.data();
    return { id: d.id, name: String(v.name ?? 'Менеджер') };
  });

  if (clientManagerId) {
    const m = managers.find((x) => x.id === clientManagerId) ?? null;
    if (m) {
      assigneeId = m.id;
      assigneeName = m.name;
      reasons.push('Ответственный взят из карточки клиента');
      conf = rankValue('high') > rankValue(conf) ? 'high' : conf;
    } else {
      warnings.push('managerId клиента не найден среди активных менеджеров');
    }
  }

  if (!assigneeId && managers.length > 0) {
    assigneeId = managers[0].id;
    assigneeName = managers[0].name;
    reasons.push('Fallback: выбран первый активный менеджер');
    warnings.push('Ответственный назначен по fallback');
  }
  if (!assigneeId) {
    warnings.push('Ответственный не определён: сделка будет без менеджера');
  }

  return {
    recommendedPipelineId: selectedPipeline.id,
    recommendedPipelineName: selectedPipeline.name,
    recommendedStageId: stageChoice.stage?.id ?? null,
    recommendedStageName: stageChoice.stage?.name ?? null,
    recommendedAssigneeId: assigneeId,
    recommendedAssigneeName: assigneeName,
    routingReason: reasons,
    routingConfidence: conf,
    routingWarnings: warnings
  };
}

