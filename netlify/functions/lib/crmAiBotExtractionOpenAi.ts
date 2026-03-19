import { parseCrmAiBotExtractionResult, type CrmAiBotExtractionResult } from '../../../src/types/crmAiBotExtraction';

const LOG_PREFIX = '[crmAiBotExtraction]';

const EXTRACTOR_SYSTEM = `Ты строгий аналитик CRM. Твоя задача — извлечь из диалога (клиент = user, бот = assistant) только факты, которые ЯВНО следуют из реплик. НЕ выдумывай и НЕ додумывай цифры, имена и параметры.
Если клиент сказал расплывчато — запиши это как короткую формулировку в строковом поле, не превращай в точное число без оснований.
Языки только ru или kz (поле detectedLanguage). Если не уверен — unknown.
missingFields: список коротких пунктов на русском — каких ключевых данных для менеджера всё ещё не хватает (если реально не хватает; если диалог пустой — перечисли базовые вещи по контексту конфигурации нельзя — только по фактам из диалога).
nextStep: одна короткая прикладная рекомендация для менеджера (например: «уточнить площадь и город»).
summaryComment: 1–3 предложения для карточки CRM, по делу.
Числовые поля как строки (areaM2, budget и т.д.) — только если клиент явно сказал или можно безопасно процитировать.
Булевы поля: true/false/null только при явных сигналах в тексте.

Ответь ОДНИМ JSON-объектом со всеми ключами:
clientName, city, areaM2, floors, projectType, houseFormat, wallType, roofType, ceilingHeight, budget, timeline, financing, landStatus, interestLevel, nextStep, summaryComment, missingFields (массив строк), detectedLanguage ("ru"|"kz"|"unknown"), preferredContactMode, wantsCommercialOffer, wantsConsultation, hasOwnProject, leadTemperature

Используй null для неизвестного, массивы — пустой [] если нечего добавить.`;

export interface ExtractionOpenAiResult {
  ok: true;
  extracted: CrmAiBotExtractionResult;
  raw: string;
  usage?: unknown;
}

export interface ExtractionOpenAiError {
  ok: false;
  error: string;
}

export async function runCrmAiBotExtraction(
  apiKey: string,
  transcript: { role: 'user' | 'assistant'; content: string }[]
): Promise<ExtractionOpenAiResult | ExtractionOpenAiError> {
  const dialogText = transcript
    .map((m) => `${m.role === 'user' ? 'Клиент' : 'Бот'}: ${m.content}`)
    .join('\n');

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: EXTRACTOR_SYSTEM },
          {
            role: 'user',
            content: `Проанализируй диалог и верни только JSON.\n\nДиалог:\n${dialogText}`
          }
        ],
        temperature: 0.1,
        max_tokens: 1200,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const t = await response.text();
      console.error(LOG_PREFIX, 'OpenAI error', response.status, t.slice(0, 400));
      return { ok: false, error: 'Модель не вернула извлечение' };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
      usage?: unknown;
    };
    const raw = String(data.choices?.[0]?.message?.content ?? '').trim();
    if (!raw) {
      return { ok: false, error: 'Пустой ответ извлечения' };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      console.error(LOG_PREFIX, 'JSON parse failed', raw.slice(0, 200));
      return { ok: false, error: 'Некорректный JSON извлечения' };
    }

    const extracted = parseCrmAiBotExtractionResult(parsedJson);
    return { ok: true, extracted, raw, usage: data.usage ?? undefined };
  } catch (e) {
    console.error(LOG_PREFIX, e);
    return { ok: false, error: 'Ошибка запроса извлечения' };
  }
}
