/**
 * Постобработка распознанного голосом текста: слова-команды знаков препинания
 * заменяются на реальные символы (точка → ., запятая → , и т.д.).
 * Используется для голосовой диктовки в поле сообщения (Чаты).
 *
 * Ограничение: любое отдельное слово из списка (например «точка») заменяется на символ.
 * Если пользователь имел в виду слово по смыслу (например «пятая точка»), оно тоже
 * будет заменено; для сценария диктовки сообщений это приемлемо.
 */

/** Пары: фраза в нижнем регистре → символ. Более длинные фразы должны идти раньше. */
const PUNCTUATION_ENTRIES: [string, string][] = [
  ['точка с запятой', ';'],
  ['восклицательный знак', '!'],
  ['вопросительный знак', '?'],
  ['знак восклицания', '!'],
  ['знак вопроса', '?'],
  ['открывающая скобка', '('],
  ['закрывающая скобка', ')'],
  ['скобка открывается', '('],
  ['скобка закрывается', ')'],
  ['кавычки открываются', '«'],
  ['кавычки закрываются', '»'],
  ['новая строка', '\n'],
  ['точка', '.'],
  ['запятая', ','],
  ['двоеточие', ':'],
  ['тире', '—'],
  ['дефис', '-'],
];

const PHRASE_TO_SYMBOL = new Map<string, string>(
  PUNCTUATION_ENTRIES.map(([k, v]) => [k.toLowerCase(), v])
);

/**
 * Заменяет слова-команды пунктуации на символы.
 * Текст разбивается на токены (по пробелам), затем ищутся фразы из словаря
 * (одно или несколько подряд идущих слов). Совпадения заменяются на символ.
 * Склейка через пробел; нормализация пробелов — в normalizeSpaces.
 */
function replacePunctuationWords(text: string): string {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return text;

  const phrases = Array.from(PHRASE_TO_SYMBOL.keys()).sort(
    (a, b) => b.split(/\s+/).length - a.split(/\s+/).length
  );

  const out: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    let replaced = false;
    for (const phrase of phrases) {
      const phraseTokens = phrase.split(/\s+/);
      if (i + phraseTokens.length > tokens.length) continue;
      const slice = tokens.slice(i, i + phraseTokens.length);
      const candidate = slice.map((t) => t.toLowerCase()).join(' ');
      if (candidate === phrase) {
        out.push(PHRASE_TO_SYMBOL.get(phrase)!);
        i += phraseTokens.length;
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      out.push(tokens[i]);
      i += 1;
    }
  }

  return out.join(' ');
}

/**
 * Нормализует пробелы: убирает лишние перед знаками препинания, двойные пробелы.
 */
function normalizeSpaces(text: string): string {
  return text
    .replace(/\s+([.,;:!?)\]»])/g, '$1')
    .replace(/([(\[«])\s+/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\s+\n/g, '\n')
    .trim();
}

/**
 * Обрабатывает распознанный голосом текст перед вставкой в поле ввода:
 * заменяет слова-команды пунктуации на символы и нормализует пробелы.
 */
export function processDictationText(raw: string): string {
  if (!raw || typeof raw !== 'string') return raw;
  const withPunctuation = replacePunctuationWords(raw);
  return normalizeSpaces(withPunctuation);
}
