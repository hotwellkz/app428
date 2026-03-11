/**
 * Форматирование и парсинг цен для формы калькулятора.
 * Вынесено в отдельный модуль, чтобы при минификации не возникала
 * ошибка "Cannot access 'uf' before initialization" (temporal dead zone).
 */
export function formatPriceForForm(value: string | number): string {
  const stringValue = String(value || '');
  return stringValue
    .replace(/\D/g, '')
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function unformatPriceFromForm(value: string): number {
  return Number(value.replace(/\s/g, '') || 0);
}
