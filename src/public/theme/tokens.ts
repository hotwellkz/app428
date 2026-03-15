/**
 * Design tokens для публичной части сайта 2wix.ru.
 * Единый источник правды: меняйте здесь — меняется весь public site.
 * Внутренняя CRM эти токены не использует.
 */

export const publicTokens = {
  /** Цвета фона */
  bg: {
    page: 'bg-white',
    subtle: 'bg-slate-50/80',
    muted: 'bg-slate-50/50',
    dark: 'bg-slate-900',
    darkSection: 'bg-slate-900',
  },

  /** Цвета текста */
  text: {
    primary: 'text-slate-900',
    secondary: 'text-slate-600',
    muted: 'text-slate-500',
    inverse: 'text-white',
    inverseMuted: 'text-slate-300',
    link: 'text-emerald-600 hover:text-emerald-700',
  },

  /** Типографика */
  typography: {
    h1: 'text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-tight',
    h2: 'text-3xl md:text-4xl font-bold text-slate-900',
    h3: 'text-lg font-semibold text-slate-900',
    body: 'text-lg text-slate-600 leading-relaxed',
    bodySm: 'text-sm text-slate-600 leading-relaxed',
    caption: 'text-slate-500 text-sm',
  },

  /** Отступы секций */
  section: {
    py: 'py-16 md:py-24',
    pyLg: 'py-20 md:py-28',
    pySm: 'py-12 md:py-16',
  },

  /** Контейнер */
  container: {
    base: 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8',
    narrow: 'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8',
    wide: 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8',
  },

  /** Скругления */
  radius: {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    full: 'rounded-full',
  },

  /** Тени */
  shadow: {
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
    card: 'shadow-lg hover:shadow-xl transition-shadow',
  },

  /** Границы */
  border: {
    default: 'border border-slate-200',
    accent: 'border-2 border-emerald-500',
    subtle: 'border border-slate-200/60',
  },

  /** Кнопки */
  button: {
    primary: 'inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-lg transition-all',
    primaryLg: 'inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-slate-900 bg-white hover:bg-slate-100 shadow-xl transition-all',
    secondary: 'inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all',
    secondaryLg: 'inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-white border-2 border-slate-500 hover:border-slate-400 transition-all',
    ghost: 'inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium text-slate-600 hover:text-slate-900 transition-colors',
    ctaDark: 'inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-slate-900 bg-white hover:bg-slate-100 shadow-xl transition-all',
  },

  /** Карточки */
  card: {
    base: 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow',
    muted: 'rounded-2xl border border-slate-200 bg-slate-50/50 p-6',
    accent: 'rounded-2xl border border-emerald-200 bg-emerald-50/50 px-5 py-4',
    feature: 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow',
  },

  /** Сетки */
  grid: {
    features: 'grid sm:grid-cols-2 lg:grid-cols-4 gap-6',
    features2: 'grid md:grid-cols-2 lg:grid-cols-3 gap-6',
    cards2: 'grid md:grid-cols-2 gap-6',
    list: 'space-y-4',
  },

  /** Layout wrapper для всей публичной страницы */
  layout: {
    wrapper: 'min-h-screen bg-white text-slate-900 antialiased',
  },

  /** Hero / декоративный фон */
  hero: {
    gradient: 'bg-gradient-to-b from-slate-50 via-white to-white',
    blob: 'bg-emerald-100/40 rounded-full blur-3xl',
  },

  /** Иконки в блоках */
  icon: {
    box: 'w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center',
    boxSm: 'w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center',
  },
} as const;

export type PublicTokens = typeof publicTokens;
