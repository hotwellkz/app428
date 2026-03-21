import type { CrmAiBot } from '../../types/crmAiBot';
import { labelCrmAiBotChannel, labelCrmAiBotType } from '../../types/crmAiBot';
import type { CrmAiBotConfig } from '../../types/crmAiBotConfig';
import {
  CRM_AI_BOT_COLLECT_FIELD_OPTIONS,
  CRM_AI_BOT_LANGUAGE_OPTIONS,
  CRM_AI_BOT_NEXT_STEP_OPTIONS,
  CRM_AI_BOT_SUCCESS_CRITERIA_OPTIONS,
  CRM_AI_BOT_TONE_OPTIONS
} from '../../types/crmAiBotConfig';
import { buildCrmAiBotReplyStylePromptSection } from './crmAiBotReplyGeneration';

export type CrmAiBotPromptMeta = Pick<CrmAiBot, 'name' | 'description' | 'botType' | 'channel'>;

/** Секция для UI «предпросмотр логики» */
export interface CrmAiBotLogicPreviewCard {
  id: string;
  title: string;
  lines: string[];
}

const CRM_ACTION_LINES: { key: keyof CrmAiBotConfig['crmActions']; label: string }[] = [
  { key: 'autofillClientCard', label: 'Автозаполнение карточки клиента' },
  { key: 'autofillExtractedFields', label: 'Автозаполнение извлечённых полей' },
  { key: 'autoDetectCity', label: 'Автоопределение города' },
  { key: 'autoQualifyLead', label: 'Авто-квалификация лида' },
  { key: 'suggestCreateDeal', label: 'Рекомендация создать сделку' },
  { key: 'saveConversationSummary', label: 'Сохранение сводки разговора' },
  { key: 'saveNextStep', label: 'Сохранение следующего шага' }
];

function toneLabel(v: string): string {
  return CRM_AI_BOT_TONE_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

function langLabel(v: string): string {
  return CRM_AI_BOT_LANGUAGE_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

function successLabels(values: string[]): string[] {
  return values.map(
    (x) => CRM_AI_BOT_SUCCESS_CRITERIA_OPTIONS.find((o) => o.value === x)?.label ?? x
  );
}

function collectLabels(values: string[]): string[] {
  return values.map(
    (x) => CRM_AI_BOT_COLLECT_FIELD_OPTIONS.find((o) => o.value === x)?.label ?? x
  );
}

function nextStepLabel(v: string): string {
  return CRM_AI_BOT_NEXT_STEP_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

/**
 * Краткий человекочитаемый обзор логики бота (карточки в UI).
 */
export function buildCrmAiBotLogicPreview(meta: CrmAiBotPromptMeta, config: CrmAiBotConfig): CrmAiBotLogicPreviewCard[] {
  const cards: CrmAiBotLogicPreviewCard[] = [];

  const personaLines: string[] = [];
  if (config.persona.botDisplayName.trim()) {
    personaLines.push(`Имя в диалоге: ${config.persona.botDisplayName.trim()}`);
  } else {
    personaLines.push('Имя в диалоге: не задано');
  }
  if (config.persona.role.trim()) {
    personaLines.push(`Роль: ${config.persona.role.trim()}`);
  } else {
    personaLines.push('Роль: не задана');
  }
  personaLines.push(`Тон: ${toneLabel(config.persona.tone)}`);
  personaLines.push(`Язык по умолчанию: ${langLabel(config.persona.defaultLanguage)}`);
  personaLines.push(`Карточка CRM: «${meta.name}» (${labelCrmAiBotType(meta.botType)}, ${labelCrmAiBotChannel(meta.channel)})`);
  cards.push({ id: 'persona', title: 'Роль и стиль', lines: personaLines });

  const goalLines: string[] = [];
  goalLines.push(
    config.goal.primaryGoal.trim()
      ? `Главная цель: ${config.goal.primaryGoal.trim()}`
      : 'Главная цель: не задана'
  );
  if (config.goal.successCriteria.length) {
    goalLines.push(`Критерии успеха: ${successLabels(config.goal.successCriteria).join('; ')}`);
  } else {
    goalLines.push('Критерии успеха: не выбраны');
  }
  goalLines.push(`После успеха: ${nextStepLabel(config.goal.nextStepOnSuccess)}`);
  cards.push({ id: 'goal', title: 'Цель', lines: goalLines });

  const collectLines: string[] = [];
  if (config.collectFields.builtIn.length) {
    collectLines.push(...collectLabels(config.collectFields.builtIn).map((l) => `• ${l}`));
  } else {
    collectLines.push('Встроенные поля не отмечены');
  }
  if (config.collectFields.customFieldsText.trim()) {
    collectLines.push(`Свои поля: ${config.collectFields.customFieldsText.trim()}`);
  }
  cards.push({ id: 'collect', title: 'Сбор данных', lines: collectLines });

  const rulesLines: string[] = [];
  rulesLines.push(
    config.rules.forbidden.trim()
      ? `Запреты (фрагмент): ${config.rules.forbidden.trim().slice(0, 160)}${config.rules.forbidden.length > 160 ? '…' : ''}`
      : 'Запреты: не заполнены'
  );
  rulesLines.push(
    config.rules.mustDo.trim()
      ? `Обязанности (фрагмент): ${config.rules.mustDo.trim().slice(0, 160)}${config.rules.mustDo.length > 160 ? '…' : ''}`
      : 'Обязанности: не заполнены'
  );
  cards.push({ id: 'rules', title: 'Ограничения', lines: rulesLines });

  const planLines: string[] = [];
  if (config.dialogPlan.openingMessage.trim()) {
    planLines.push(`Старт: ${config.dialogPlan.openingMessage.trim().slice(0, 200)}${config.dialogPlan.openingMessage.length > 200 ? '…' : ''}`);
  } else {
    planLines.push('Стартовое сообщение не задано');
  }
  if (config.dialogPlan.steps.length) {
    config.dialogPlan.steps
      .slice()
      .sort((a, b) => a.order - b.order)
      .forEach((s, i) => {
        const t = s.title.trim() || `Этап ${i + 1}`;
        planLines.push(`${i + 1}. ${t}`);
      });
  } else {
    planLines.push('Этапы диалога не добавлены');
  }
  cards.push({ id: 'plan', title: 'План разговора', lines: planLines });

  const crmLines: string[] = [];
  const enabled = CRM_ACTION_LINES.filter((x) => config.crmActions[x.key]);
  if (enabled.length) {
    crmLines.push(...enabled.map((x) => `• ${x.label} (в продакшене)`));
  } else {
    crmLines.push('Ни одно CRM-действие не отмечено');
  }
  crmLines.push(
    `База знаний в тесте: ${config.knowledge.useCompanyKnowledgeBase ? 'да — сервер подмешивает фрагменты' : 'выключено'}`
  );
  crmLines.push(
    `Быстрые ответы в тесте: ${config.knowledge.useQuickReplies ? 'да — релевантные шаблоны в промпт' : 'выключено'}`
  );
  cards.push({ id: 'crm', title: 'CRM и источники', lines: crmLines });

  const rs = config.replyStyle;
  cards.push({
    id: 'replyStyle',
    title: 'Стиль ответов AI',
    lines: [
      `Человечность: ${rs.humanizationLevel}`,
      `Длина ответов: ${rs.replyLengthMode}`,
      `Разбиение: ${rs.replySplitMode} (макс. ${rs.maxReplyParts} сообщ.)`,
      `Пауза между частями: ${rs.interReplyDelayMinMs}–${rs.interReplyDelayMaxMs} мс`,
      `Ожидание серии от клиента: ${rs.clientAggregationMinMs}–${rs.clientAggregationMaxMs} мс`
    ]
  });

  return cards;
}

function block(title: string, body: string): string {
  const t = body.trim();
  return t ? `## ${title}\n${t}\n` : `## ${title}\n(не задано)\n`;
}

/**
 * Полный system message для модели из метаданных карточки и config.
 */
export function buildCrmAiBotSystemPrompt(meta: CrmAiBotPromptMeta, config: CrmAiBotConfig): string {
  const parts: string[] = [];

  parts.push(
    block(
      'Контекст карточки в CRM',
      [
        `Внутреннее название бота: ${meta.name}`,
        meta.description ? `Описание: ${meta.description}` : '',
        `Тип: ${labelCrmAiBotType(meta.botType)}`,
        `Канал (целевой): ${labelCrmAiBotChannel(meta.channel)}`
      ]
        .filter(Boolean)
        .join('\n')
    )
  );

  parts.push(
    block(
      '1. Кто ты',
      [
        config.persona.botDisplayName.trim()
          ? `Представляйся и отвечай от имени/роли: ${config.persona.botDisplayName.trim()}`
          : 'Имя для клиента не задано — представляйся нейтрально, как менеджер компании.',
        config.persona.role.trim() ? `Твоя роль:\n${config.persona.role.trim()}` : '',
        `Стиль общения: ${toneLabel(config.persona.tone)}.`,
        `Язык по умолчанию: ${langLabel(config.persona.defaultLanguage)}. Если клиент пишет на казахском — отвечай на казахском; если на русском — на русском; при смешении веди себя естественно.`
      ]
        .filter(Boolean)
        .join('\n')
    )
  );

  const successText =
    config.goal.successCriteria.length > 0
      ? successLabels(config.goal.successCriteria).join(', ')
      : 'не заданы явно';
  parts.push(
    block(
      '2. Твоя задача',
      [
        config.goal.primaryGoal.trim() ? `Главная цель:\n${config.goal.primaryGoal.trim()}` : 'Главная цель не задана — аккуратно выясняй потребность и веди к следующему шагу.',
        `Критерии успешного результата (ориентиры): ${successText}.`,
        `После успеха (логика CRM, не выполнять в чате): ${nextStepLabel(config.goal.nextStepOnSuccess)}.`
      ].join('\n')
    )
  );

  const collectBuilt =
    config.collectFields.builtIn.length > 0
      ? collectLabels(config.collectFields.builtIn).map((l) => `- ${l}`).join('\n')
      : '- (список не задан)';
  const collectCustom = config.collectFields.customFieldsText.trim()
    ? `\nДополнительно выясни/учти: ${config.collectFields.customFieldsText.trim()}`
    : '';
  parts.push(
    block(
      '3. Какие данные нужно собрать',
      `${collectBuilt}${collectCustom}`
    )
  );

  let planBody = '';
  if (config.dialogPlan.openingMessage.trim()) {
    planBody += `Стартовый заход (можно адаптировать, не копировать дословно если уже поздоровались):\n${config.dialogPlan.openingMessage.trim()}\n\n`;
  }
  const steps = config.dialogPlan.steps.slice().sort((a, b) => a.order - b.order);
  if (steps.length) {
    steps.forEach((s, i) => {
      planBody += `Этап ${i + 1}${s.title.trim() ? `: ${s.title.trim()}` : ''}\n`;
      if (s.objective.trim()) planBody += `- Цель: ${s.objective.trim()}\n`;
      if (s.collectWhat.trim()) planBody += `- Выяснить: ${s.collectWhat.trim()}\n`;
      if (s.exampleQuestion.trim()) planBody += `- Пример вопроса: ${s.exampleQuestion.trim()}\n`;
      if (s.skipIfAlreadyKnown) planBody += `- Если клиент уже ответил на это — не повторяй тот же вопрос.\n`;
      planBody += '\n';
    });
  } else {
    planBody += 'Этапы не заданы — веди диалог логично от цели и собираемых данных.\n';
  }
  parts.push(block('4. План диалога', planBody));

  parts.push(
    block(
      '5. Что обязательно делать',
      config.rules.mustDo.trim() || '(не указано)'
    )
  );
  parts.push(
    block(
      '6. Что запрещено',
      config.rules.forbidden.trim() || '(не указано)'
    )
  );
  parts.push(
    block(
      '7. Стандарты компании',
      config.rules.companyStandards.trim() || '(не указано)'
    )
  );

  const kbLines: string[] = [];
  if (config.knowledge.useCompanyKnowledgeBase) {
    kbLines.push(
      'В тестовом режиме CRM к system-промпту на сервере подмешивается компактный фрагмент AI Базы знаний компании (с лимитом объёма). Опирайся на эти факты; не спрашивай то, что уже однозначно покрыто стандартом из базы. Не выдумывай детали вне переписки, промпта и этого блока.'
    );
  } else {
    kbLines.push('База знаний для этого бота в настройках отключена — в тесте фрагменты базы не подставляются.');
  }
  if (config.knowledge.useQuickReplies) {
    kbLines.push(
      'В тесте к промпту могут подмешиваться релевантные быстрые ответы компании (шаблоны менеджеров), с лимитом объёма. Используй их для формулировок и стандартов; не копируй дословно, если это ломает естественность.'
    );
  } else {
    kbLines.push('Быстрые ответы отключены в настройках бота — шаблоны в тест не подставляются.');
  }
  if (config.knowledge.extraInstructions.trim()) {
    kbLines.push(`Доп. инструкции для этого бота:\n${config.knowledge.extraInstructions.trim()}`);
  }
  parts.push(block('8. Источники знаний (режим теста)', kbLines.join('\n')));

  const crmPlanned = CRM_ACTION_LINES.filter((x) => config.crmActions[x.key]).map((x) => `- ${x.label}`);
  parts.push(
    block(
      '9. CRM-действия (только контекст)',
      crmPlanned.length
        ? `В будущем при реальном запуске могут выполняться:\n${crmPlanned.join('\n')}\nВ тестовом чате ничего из этого не выполняется — не говори клиенту, что запись в CRM уже сделана.`
        : 'Дополнительные CRM-действия в конфиге не отмечены.'
    )
  );

  parts.push(
    block('10. Стиль ответов (естественность, WhatsApp)', buildCrmAiBotReplyStylePromptSection(config))
  );

  const hardLines = [
    'Не выдумывай цены, сроки и гарантии, если их нет в этом промпте или в сообщениях клиента.',
    'Не задавай один и тот же вопрос, если ответ уже есть в переписке.',
    'Не здоровайся заново в каждом сообщении; один раз в начале достаточно.',
    'Пиши по делу, без «воды».',
    'Если чего-то не знаешь — честно скажи и предложи передать менеджеру или уточнить.'
  ];
  if (config.replyStyle.replySplitMode === 'single') {
    hardLines.push('Формат ответа на сервере: одно сообщение клиенту (см. JSON-инструкцию).');
  } else {
    hardLines.push(
      'Формат ответа на сервере: JSON с 1–2 частями; дроби только если это естественно для живого менеджера.'
    );
  }
  parts.push(block('11. Жёсткие правила модели', hardLines.join('\n')));

  return parts.join('\n').trim();
}

/** Доп. абзац для песочницы (добавлять на сервере к system). */
export const CRM_AI_BOT_SANDBOX_SYSTEM_APPEND = `
---
РЕЖИМ: внутренний тест CRM 2wix (песочница). Ты не отправляешь сообщения во внешние каналы (WhatsApp и т.д.), не меняешь CRM и не вызываешь инструменты.
К ответу применяется JSON-формат, описанный в конце system (replyMode + parts) — тексты в parts = то, что увидит менеджер как реплики бота.
`.trim();

/** Доп. абзац для реального WhatsApp-runtime (ответ уходит клиенту или в черновик менеджеру). */
export const CRM_AI_BOT_WHATSAPP_RUNTIME_APPEND = `
---
РЕЖИМ: реальная переписка WhatsApp. Тексты для клиента клади только в JSON-поле parts (см. инструкцию формата в конце system). Без служебных пометок, без «Как модель…». Не выдумывай факты о заказе — опирайся на историю чата и блоки знаний выше.
`.trim();

/** Доп. абзац для голосового звонка (Twilio Say + Gather, без WhatsApp runtime). */
export const CRM_AI_BOT_VOICE_SYSTEM_APPEND = `
---
РЕЖИМ: телефонный разговор в реальном времени. Клиент слышит ответ через синтез речи и отвечает голосом (распознавание речи).
Правила:
- Одна реплика = одна или две короткие фразы, без длинных абзацев и списков.
- Не используй эмодзи, ссылки, форматирование markdown.
- Если ответ клиента неясен — вежливо уточни одним коротким вопросом.
- Не здоровайся заново в каждом ответе.
- Если цель разговора достигнута или клиент явно не заинтересован — завершай диалог вежло.

ФОРМАТ ОТВЕТА МОДЕЛИ: строго один JSON-объект без markdown и без текста вокруг:
{"reply":"текст для озвучки оператором","shouldEnd":false,"outcome":"unknown"}
Поля:
- reply — только то, что услышит клиент по телефону.
- shouldEnd — true, если нужно завершить звонок после этой фразы (цель достигнута, отказ, прощание).
- outcome — одно из: meeting_booked, callback, no_interest, unknown (для последующей пост-обработки CRM).
`.trim();
