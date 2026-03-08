import { SUPERVISOR_SALARY_ANCHORS } from './supervisorSalaryConfig';

/**
 * Рассчитывает заработную плату руководителя строительства (технадзор)
 * по якорным точкам (area → pay) с линейной интерполяцией между ними.
 * Каждый квадратный метр даёт плавное изменение ЗП.
 *
 * @param area - площадь дома, м²
 * @returns зарплата в тенге (целое число) или null при NaN
 */
export function calculateSupervisorSalary(area: number): number | null {
  const num = Number(area);
  if (Number.isNaN(num)) return null;

  const anchors = [...SUPERVISOR_SALARY_ANCHORS].sort((a, b) => a.area - b.area);
  const minAnchor = anchors[0];
  const maxAnchor = anchors[anchors.length - 1];

  if (num <= minAnchor.area) return Math.round(minAnchor.pay);
  if (num >= maxAnchor.area) return Math.round(maxAnchor.pay);

  for (let i = 0; i < anchors.length - 1; i++) {
    const a1 = anchors[i];
    const a2 = anchors[i + 1];
    if (num >= a1.area && num <= a2.area) {
      const t = (num - a1.area) / (a2.area - a1.area);
      const salary = a1.pay + t * (a2.pay - a1.pay);
      return Math.round(salary);
    }
  }

  return Math.round(maxAnchor.pay);
}
