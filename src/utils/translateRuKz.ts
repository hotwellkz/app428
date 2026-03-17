/**
 * Определение языка текста для пары RU/KZ.
 * Казахский: наличие специфичных букв (ә, ғ, қ, ң, ө, ұ, ү, һ, і и т.д.).
 * Русский: кириллица без казахских букв.
 */
const KZ_SPECIFIC =
  /[әғқңөұүһіІӘҒҚҢӨҰҮҺ]/u;

export type RuKzLang = 'ru' | 'kz' | 'unknown';

export function detectRuKzLang(text: string): RuKzLang {
  const t = (text ?? '').trim();
  if (!t) return 'unknown';
  const cyrillicOrSpace = /[\s\u0400-\u04FF]/;
  const hasCyrillic = [...t].some((c) => cyrillicOrSpace.test(c));
  if (!hasCyrillic) return 'unknown';
  if (KZ_SPECIFIC.test(t)) return 'kz';
  return 'ru';
}

/** Целевой язык перевода: если исходный kz → ru, если ru → kz. */
export function getTargetLangForTranslate(source: RuKzLang): 'ru' | 'kz' | null {
  if (source === 'kz') return 'ru';
  if (source === 'ru') return 'kz';
  return null;
}

const TRANSLATE_ENDPOINT = '/.netlify/functions/ai-translate-ru-kz';

export interface TranslateResult {
  translated: string;
  targetLang: 'ru' | 'kz';
}

export async function translateRuKz(
  text: string,
  targetLang: 'ru' | 'kz',
  token: string
): Promise<TranslateResult> {
  const res = await fetch(TRANSLATE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text: text.trim(), targetLang }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    translated?: string;
    targetLang?: 'ru' | 'kz';
    error?: string;
  };
  if (!res.ok) {
    throw new Error((data?.error as string) || 'Ошибка перевода');
  }
  return {
    translated: (data.translated ?? '').trim(),
    targetLang: data.targetLang ?? targetLang,
  };
}
