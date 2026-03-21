/**
 * Вложенная конфигурация бота (Firestore: crmAiBots.config).
 * Используется конфигуратором и будущим runtime AI.
 */

export type CrmAiBotPersonaTone = 'business' | 'friendly' | 'confident' | 'expert' | 'concise';

export type CrmAiBotDefaultLanguage = 'ru' | 'kz' | 'auto';

/** Этап плана диалога */
export interface CrmAiBotDialogStep {
  id: string;
  title: string;
  objective: string;
  collectWhat: string;
  exampleQuestion: string;
  skipIfAlreadyKnown: boolean;
  order: number;
}

export type CrmAiHumanizationLevel = 'low' | 'medium' | 'high';
export type CrmAiReplyLengthMode = 'short' | 'adaptive' | 'detailed';
export type CrmAiReplySplitMode = 'single' | 'auto' | 'prefer_multi';

/** «Человечность» и разбиение ответов (WhatsApp / автоворонка) */
export interface CrmAiBotReplyStyle {
  humanizationLevel: CrmAiHumanizationLevel;
  replyLengthMode: CrmAiReplyLengthMode;
  replySplitMode: CrmAiReplySplitMode;
  /** 1 или 2 (MVP: максимум 2 части) */
  maxReplyParts: number;
  interReplyDelayMinMs: number;
  interReplyDelayMaxMs: number;
  /** Окно тишины после последнего входящего перед генерацией ответа */
  clientAggregationMinMs: number;
  clientAggregationMaxMs: number;
  allowShortLeadIn: boolean;
  varySentenceLength: boolean;
  avoidTemplateRepetition: boolean;
  allowSoftConversationalBridges: boolean;
}

export function defaultCrmAiBotReplyStyle(): CrmAiBotReplyStyle {
  return {
    humanizationLevel: 'medium',
    replyLengthMode: 'adaptive',
    replySplitMode: 'auto',
    maxReplyParts: 2,
    interReplyDelayMinMs: 800,
    interReplyDelayMaxMs: 2500,
    clientAggregationMinMs: 2000,
    clientAggregationMaxMs: 4000,
    allowShortLeadIn: true,
    varySentenceLength: true,
    avoidTemplateRepetition: true,
    allowSoftConversationalBridges: true
  };
}

export interface CrmAiBotConfig {
  persona: {
    botDisplayName: string;
    role: string;
    tone: string;
    defaultLanguage: CrmAiBotDefaultLanguage;
  };
  goal: {
    primaryGoal: string;
    successCriteria: string[];
    nextStepOnSuccess: string;
  };
  collectFields: {
    builtIn: string[];
    customFieldsText: string;
  };
  dialogPlan: {
    openingMessage: string;
    steps: CrmAiBotDialogStep[];
  };
  rules: {
    mustDo: string;
    forbidden: string;
    companyStandards: string;
  };
  knowledge: {
    useCompanyKnowledgeBase: boolean;
    useQuickReplies: boolean;
    extraInstructions: string;
  };
  crmActions: {
    autofillClientCard: boolean;
    autofillExtractedFields: boolean;
    autoDetectCity: boolean;
    autoQualifyLead: boolean;
    suggestCreateDeal: boolean;
    saveConversationSummary: boolean;
    saveNextStep: boolean;
  };
  /** Стиль ответов AI (естественность, длина, разбиение на сообщения) */
  replyStyle: CrmAiBotReplyStyle;
}

export const CRM_AI_BOT_TONE_OPTIONS: { value: CrmAiBotPersonaTone; label: string }[] = [
  { value: 'business', label: 'Деловой' },
  { value: 'friendly', label: 'Дружелюбный' },
  { value: 'confident', label: 'Уверенный' },
  { value: 'expert', label: 'Экспертный' },
  { value: 'concise', label: 'Короткий и конкретный' }
];

export const CRM_AI_BOT_LANGUAGE_OPTIONS: { value: CrmAiBotDefaultLanguage; label: string }[] = [
  { value: 'ru', label: 'Русский' },
  { value: 'kz', label: 'Казахский' },
  { value: 'auto', label: 'Автоопределение ru/kz' }
];

export const CRM_AI_BOT_SUCCESS_CRITERIA_OPTIONS: { value: string; label: string }[] = [
  { value: 'area_received', label: 'Получена площадь дома' },
  { value: 'city_received', label: 'Получен город' },
  { value: 'floors_received', label: 'Получена этажность' },
  { value: 'project_wishes', label: 'Получены пожелания по проекту' },
  { value: 'client_requested_calc', label: 'Клиент запросил расчёт' },
  { value: 'client_requested_proposal', label: 'Клиент запросил коммерческое предложение' },
  { value: 'agreed_call', label: 'Клиент согласился на звонок' },
  { value: 'agreed_meeting', label: 'Клиент согласился на встречу' },
  { value: 'lead_qualified', label: 'Лид квалифицирован' },
  { value: 'other', label: 'Другое' }
];

export const CRM_AI_BOT_NEXT_STEP_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'Ничего пока не делать' },
  { value: 'mark_qualified', label: 'Пометить как квалифицированный лид' },
  { value: 'prepare_calc', label: 'Подготовить расчёт' },
  { value: 'handoff_manager', label: 'Передать менеджеру' },
  { value: 'suggest_deal', label: 'Рекомендовать создание сделки' },
  { value: 'mark_cp_requested', label: 'Отметить «КП запросил»' },
  { value: 'other', label: 'Другое' }
];

export const CRM_AI_BOT_COLLECT_FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: 'client_name', label: 'Имя клиента' },
  { value: 'city', label: 'Город' },
  { value: 'house_area', label: 'Площадь дома' },
  { value: 'floors', label: 'Этажность' },
  { value: 'house_type', label: 'Тип дома / назначение' },
  { value: 'roof_type', label: 'Тип кровли' },
  { value: 'ceiling_height', label: 'Высота потолков' },
  { value: 'budget', label: 'Бюджет' },
  { value: 'needs_calc', label: 'Нужен ли расчёт' },
  { value: 'needs_meeting', label: 'Нужна ли встреча' },
  { value: 'needs_consultation', label: 'Нужна ли консультация' },
  { value: 'needs_installment', label: 'Нужна ли рассрочка' },
  { value: 'comments', label: 'Комментарии / пожелания клиента' }
];

const VALID_TONES = new Set(CRM_AI_BOT_TONE_OPTIONS.map((o) => o.value));
const VALID_LANGS = new Set(CRM_AI_BOT_LANGUAGE_OPTIONS.map((o) => o.value));

export function defaultCrmAiBotConfig(): CrmAiBotConfig {
  return {
    persona: {
      botDisplayName: '',
      role: '',
      tone: 'business',
      defaultLanguage: 'ru'
    },
    goal: {
      primaryGoal: '',
      successCriteria: [],
      nextStepOnSuccess: 'none'
    },
    collectFields: {
      builtIn: [],
      customFieldsText: ''
    },
    dialogPlan: {
      openingMessage: '',
      steps: []
    },
    rules: {
      mustDo: '',
      forbidden: '',
      companyStandards: ''
    },
    knowledge: {
      useCompanyKnowledgeBase: true,
      useQuickReplies: true,
      extraInstructions: ''
    },
    crmActions: {
      autofillClientCard: false,
      autofillExtractedFields: false,
      autoDetectCity: false,
      autoQualifyLead: false,
      suggestCreateDeal: false,
      saveConversationSummary: false,
      saveNextStep: false
    },
    replyStyle: defaultCrmAiBotReplyStyle()
  };
}

function parseStep(raw: unknown, index: number): CrmAiBotDialogStep {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const id = typeof o.id === 'string' && o.id ? o.id : `st_${index}_${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    title: typeof o.title === 'string' ? o.title : '',
    objective: typeof o.objective === 'string' ? o.objective : '',
    collectWhat: typeof o.collectWhat === 'string' ? o.collectWhat : '',
    exampleQuestion: typeof o.exampleQuestion === 'string' ? o.exampleQuestion : '',
    skipIfAlreadyKnown: o.skipIfAlreadyKnown === true,
    order: typeof o.order === 'number' && !Number.isNaN(o.order) ? o.order : index
  };
}

/** Нормализация config из Firestore (частичные / старые документы). */
export function parseCrmAiBotConfig(raw: unknown): CrmAiBotConfig {
  const base = defaultCrmAiBotConfig();
  if (!raw || typeof raw !== 'object') return base;
  const c = raw as Record<string, unknown>;

  const persona = (c.persona && typeof c.persona === 'object' ? c.persona : {}) as Record<string, unknown>;
  const tone = typeof persona.tone === 'string' && VALID_TONES.has(persona.tone as CrmAiBotPersonaTone) ? persona.tone : base.persona.tone;
  const lang =
    typeof persona.defaultLanguage === 'string' && VALID_LANGS.has(persona.defaultLanguage as CrmAiBotDefaultLanguage)
      ? (persona.defaultLanguage as CrmAiBotDefaultLanguage)
      : base.persona.defaultLanguage;

  const goal = (c.goal && typeof c.goal === 'object' ? c.goal : {}) as Record<string, unknown>;
  const successRaw = goal.successCriteria;
  const successCriteria = Array.isArray(successRaw)
    ? successRaw.filter((x): x is string => typeof x === 'string')
    : base.goal.successCriteria;
  const nextStep =
    typeof goal.nextStepOnSuccess === 'string' ? goal.nextStepOnSuccess : base.goal.nextStepOnSuccess;

  const collect = (c.collectFields && typeof c.collectFields === 'object' ? c.collectFields : {}) as Record<string, unknown>;
  const builtInRaw = collect.builtIn;
  const builtIn = Array.isArray(builtInRaw)
    ? builtInRaw.filter((x): x is string => typeof x === 'string')
    : base.collectFields.builtIn;

  const dialog = (c.dialogPlan && typeof c.dialogPlan === 'object' ? c.dialogPlan : {}) as Record<string, unknown>;
  const stepsRaw = dialog.steps;
  let steps: CrmAiBotDialogStep[] = [];
  if (Array.isArray(stepsRaw)) {
    steps = stepsRaw.map((s, i) => parseStep(s, i));
    steps.sort((a, b) => a.order - b.order);
    steps = steps.map((s, i) => ({ ...s, order: i }));
  }

  const rules = (c.rules && typeof c.rules === 'object' ? c.rules : {}) as Record<string, unknown>;
  const knowledge = (c.knowledge && typeof c.knowledge === 'object' ? c.knowledge : {}) as Record<string, unknown>;
  const crm = (c.crmActions && typeof c.crmActions === 'object' ? c.crmActions : {}) as Record<string, unknown>;
  const rsRaw = c.replyStyle && typeof c.replyStyle === 'object' ? (c.replyStyle as Record<string, unknown>) : {};
  const rsDef = defaultCrmAiBotReplyStyle();
  const hl = rsRaw.humanizationLevel;
  const humanizationLevel: CrmAiHumanizationLevel =
    hl === 'low' || hl === 'medium' || hl === 'high' ? hl : rsDef.humanizationLevel;
  const rlm = rsRaw.replyLengthMode;
  const replyLengthMode: CrmAiReplyLengthMode =
    rlm === 'short' || rlm === 'adaptive' || rlm === 'detailed' ? rlm : rsDef.replyLengthMode;
  const rsm = rsRaw.replySplitMode;
  const replySplitMode: CrmAiReplySplitMode =
    rsm === 'single' || rsm === 'auto' || rsm === 'prefer_multi' ? rsm : rsDef.replySplitMode;
  const maxReplyPartsRaw = rsRaw.maxReplyParts;
  const maxReplyParts =
    typeof maxReplyPartsRaw === 'number' && maxReplyPartsRaw >= 1 && maxReplyPartsRaw <= 2
      ? Math.floor(maxReplyPartsRaw)
      : rsDef.maxReplyParts;
  const clampDelay = (v: unknown, def: number, min: number, max: number) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return def;
    return Math.min(max, Math.max(min, Math.round(v)));
  };
  const interReplyDelayMinMs = clampDelay(rsRaw.interReplyDelayMinMs, rsDef.interReplyDelayMinMs, 200, 60_000);
  let interReplyDelayMaxMs = clampDelay(rsRaw.interReplyDelayMaxMs, rsDef.interReplyDelayMaxMs, 200, 60_000);
  if (interReplyDelayMaxMs < interReplyDelayMinMs) interReplyDelayMaxMs = interReplyDelayMinMs;
  let clientAggregationMinMs = clampDelay(
    rsRaw.clientAggregationMinMs,
    rsDef.clientAggregationMinMs,
    500,
    30_000
  );
  let clientAggregationMaxMs = clampDelay(
    rsRaw.clientAggregationMaxMs,
    rsDef.clientAggregationMaxMs,
    500,
    30_000
  );
  if (clientAggregationMaxMs < clientAggregationMinMs) clientAggregationMaxMs = clientAggregationMinMs;

  return {
    persona: {
      botDisplayName: typeof persona.botDisplayName === 'string' ? persona.botDisplayName : base.persona.botDisplayName,
      role: typeof persona.role === 'string' ? persona.role : base.persona.role,
      tone,
      defaultLanguage: lang
    },
    goal: {
      primaryGoal: typeof goal.primaryGoal === 'string' ? goal.primaryGoal : base.goal.primaryGoal,
      successCriteria,
      nextStepOnSuccess: nextStep
    },
    collectFields: {
      builtIn,
      customFieldsText:
        typeof collect.customFieldsText === 'string' ? collect.customFieldsText : base.collectFields.customFieldsText
    },
    dialogPlan: {
      openingMessage:
        typeof dialog.openingMessage === 'string' ? dialog.openingMessage : base.dialogPlan.openingMessage,
      steps
    },
    rules: {
      mustDo: typeof rules.mustDo === 'string' ? rules.mustDo : base.rules.mustDo,
      forbidden: typeof rules.forbidden === 'string' ? rules.forbidden : base.rules.forbidden,
      companyStandards:
        typeof rules.companyStandards === 'string' ? rules.companyStandards : base.rules.companyStandards
    },
    knowledge: {
      useCompanyKnowledgeBase:
        knowledge.useCompanyKnowledgeBase === false ? false : knowledge.useCompanyKnowledgeBase === true ? true : base.knowledge.useCompanyKnowledgeBase,
      useQuickReplies:
        knowledge.useQuickReplies === false ? false : knowledge.useQuickReplies === true ? true : base.knowledge.useQuickReplies,
      extraInstructions:
        typeof knowledge.extraInstructions === 'string'
          ? knowledge.extraInstructions
          : base.knowledge.extraInstructions
    },
    crmActions: {
      autofillClientCard: crm.autofillClientCard === true,
      autofillExtractedFields: crm.autofillExtractedFields === true,
      autoDetectCity: crm.autoDetectCity === true,
      autoQualifyLead: crm.autoQualifyLead === true,
      suggestCreateDeal: crm.suggestCreateDeal === true,
      saveConversationSummary: crm.saveConversationSummary === true,
      saveNextStep: crm.saveNextStep === true
    },
    replyStyle: {
      humanizationLevel,
      replyLengthMode,
      replySplitMode,
      maxReplyParts,
      interReplyDelayMinMs,
      interReplyDelayMaxMs,
      clientAggregationMinMs,
      clientAggregationMaxMs,
      allowShortLeadIn: rsRaw.allowShortLeadIn === false ? false : rsDef.allowShortLeadIn,
      varySentenceLength: rsRaw.varySentenceLength === false ? false : rsDef.varySentenceLength,
      avoidTemplateRepetition: rsRaw.avoidTemplateRepetition === false ? false : rsDef.avoidTemplateRepetition,
      allowSoftConversationalBridges:
        rsRaw.allowSoftConversationalBridges === false ? false : rsDef.allowSoftConversationalBridges
    }
  };
}

export function newDialogStepId(): string {
  return `st_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyDialogStep(order: number): CrmAiBotDialogStep {
  return {
    id: newDialogStepId(),
    title: '',
    objective: '',
    collectWhat: '',
    exampleQuestion: '',
    skipIfAlreadyKnown: true,
    order
  };
}
