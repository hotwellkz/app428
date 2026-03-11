/**
 * Форматирование и парсинг цен для формы калькулятора.
 * Экспорт одним объектом, чтобы при минификации не было обращений
 * к отдельным переменным до инициализации (temporal dead zone / "uf").
 */
function formatPriceForForm(value: string | number): string {
  const stringValue = String(value || '');
  return stringValue
    .replace(/\D/g, '')
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function unformatPriceFromForm(value: string): number {
  return Number(value.replace(/\s/g, '') || 0);
}

export const calculatorFormatters = {
  formatPriceForForm,
  unformatPriceFromForm
};
