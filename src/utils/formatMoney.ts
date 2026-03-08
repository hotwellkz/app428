/**
 * Форматирование денежных значений: целые тенге, разделители тысяч.
 * Для финансов используем Math.floor (вниз).
 */
export const formatMoney = (value: number): string => {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0
  }).format(Math.floor(value)) + ' ₸';
};
