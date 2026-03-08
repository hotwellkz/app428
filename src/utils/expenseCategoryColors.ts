/** Tailwind имена цветов для badge и фона точки */
export const CATEGORY_COLOR_BADGE: Record<string, string> = {
  red: 'bg-red-100 text-red-800',
  orange: 'bg-orange-100 text-orange-800',
  amber: 'bg-amber-100 text-amber-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  lime: 'bg-lime-100 text-lime-800',
  green: 'bg-green-100 text-green-800',
  emerald: 'bg-emerald-100 text-emerald-800',
  teal: 'bg-teal-100 text-teal-800',
  cyan: 'bg-cyan-100 text-cyan-800',
  sky: 'bg-sky-100 text-sky-800',
  blue: 'bg-blue-100 text-blue-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  violet: 'bg-violet-100 text-violet-800',
  purple: 'bg-purple-100 text-purple-800',
  pink: 'bg-pink-100 text-pink-800',
  gray: 'bg-gray-100 text-gray-800'
};

/** Hex для цветной точки (mobile) */
export const CATEGORY_COLOR_DOT_HEX: Record<string, string> = {
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  yellow: '#eab308',
  lime: '#84cc16',
  green: '#22c55e',
  emerald: '#10b981',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  sky: '#0ea5e9',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  purple: '#a855f7',
  pink: '#ec4899',
  gray: '#9ca3af'
};

export function getBadgeClass(color: string | undefined): string {
  if (!color || !CATEGORY_COLOR_BADGE[color]) return CATEGORY_COLOR_BADGE.gray;
  return CATEGORY_COLOR_BADGE[color] ?? CATEGORY_COLOR_BADGE.gray;
}

export function getDotHex(color: string | undefined): string {
  if (!color || !CATEGORY_COLOR_DOT_HEX[color]) return CATEGORY_COLOR_DOT_HEX.gray;
  return CATEGORY_COLOR_DOT_HEX[color] ?? CATEGORY_COLOR_DOT_HEX.gray;
}
