/**
 * Design tokens для публичной части сайта 2wix.ru.
 * Значения приведены в соответствие с salesforce-design-tokens-green.json:
 * цвета, шрифты (Source Sans 3), отступы, скругления, тени.
 * Внутренняя CRM эти токены не использует.
 */

export const publicTokens = {
  /** Цвета фона — по salesforce-design-tokens-green */
  bg: {
    page: 'bg-sf-background',
    subtle: 'bg-sf-backgroundPage',
    muted: 'bg-sf-backgroundSection',
    dark: 'bg-sf-primary',
    darkSection: 'bg-sf-primary',
  },

  /** Цвета текста — по tokens.colors.text */
  text: {
    primary: 'text-sf-text-primary',
    secondary: 'text-sf-text-secondary',
    muted: 'text-sf-text-muted',
    inverse: 'text-sf-text-inverse',
    inverseMuted: 'text-white/80',
    link: 'text-sf-text-link hover:text-sf-text-linkHover',
  },

  /**
   * Текст и ссылки для секций с тёмным фоном (footer, нижний CTA).
   * Использовать только на bg-sf-primary. Явные классы для контраста.
   */
  onDark: {
    heading: 'text-white',
    body: 'text-white/95',
    muted: 'text-white/90',
    link: 'text-white/95 hover:text-white transition-colors',
    copyright: 'text-white/90',
    border: 'border-white/30',
  },

  /** Типографика — font from JSON (Source Sans 3), sizes: 48px hero, 32px h2, 18px h3, 17px body, 14px sm */
  typography: {
    h1: 'font-sans text-5xl md:text-6xl font-bold text-sf-text-primary leading-[1.1] tracking-tight',
    h2: 'font-sans text-3xl md:text-4xl font-bold text-sf-text-primary',
    h3: 'font-sans text-lg font-semibold text-sf-text-primary',
    body: 'font-sans text-[17px] text-sf-text-secondary leading-[1.65]',
    bodySm: 'font-sans text-sm text-sf-text-secondary leading-relaxed',
    caption: 'font-sans text-sf-text-muted text-sm',
  },

  /** Отступы секций — layout.sectionPaddingY 80px, scale */
  section: {
    py: 'py-section md:py-20',
    pyLg: 'py-20 md:py-[80px]',
    pySm: 'py-sectionSm md:py-16',
  },

  /** Контейнер — layout.contentMaxWidth 1200px, containerPadding 24px */
  container: {
    base: 'max-w-[1200px] mx-auto px-container sm:px-6 lg:px-8',
    narrow: 'max-w-4xl mx-auto px-container sm:px-6 lg:px-8',
    wide: 'max-w-[1200px] mx-auto px-container sm:px-6 lg:px-8',
  },

  /** Скругления — borderRadius.button 6px, card 12px */
  radius: {
    sm: 'rounded-sfButton',
    md: 'rounded-sfCard',
    lg: 'rounded-[16px]',
    full: 'rounded-full',
  },

  /** Тени — shadows.card, cardHover */
  shadow: {
    sm: 'shadow-sfSm',
    md: 'shadow-sfMd',
    lg: 'shadow-sfLg',
    xl: 'shadow-xl',
    card: 'shadow-sfCard hover:shadow-sfCardHover transition-shadow duration-200',
  },

  /** Границы — border, borderLight, cardBorder */
  border: {
    default: 'border border-sf-border',
    accent: 'border-2 border-sf-borderFocus',
    subtle: 'border border-sf-borderLight',
  },

  /** Кнопки — components.navbar.topBar.ctaButton: #2D8653, 14px, 600, padding 10px 20px, radius 6px */
  button: {
    primary: 'font-sans inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-sfButton font-semibold text-[14px] text-sf-text-inverse bg-sf-primary hover:bg-sf-primaryHover shadow-sfMd transition-all duration-200',
    primaryLg: 'font-sans inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-sfButton font-semibold text-[15px] text-sf-primary bg-white hover:bg-sf-surfaceElevated shadow-sfCard transition-all duration-200',
    secondary: 'font-sans inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-sfButton font-semibold text-[14px] text-sf-primary bg-white border border-sf-primary hover:border-sf-primaryHover hover:bg-sf-primaryLight transition-all duration-200',
    secondaryLg: 'font-sans inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-sfButton font-semibold text-sf-text-inverse border-2 border-sf-border hover:border-sf-borderLight transition-all duration-200',
    ghost: 'font-sans inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-sfButton font-medium text-sf-text-muted hover:text-sf-text-primary transition-colors duration-200',
    ctaDark: 'font-sans inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-sfButton font-semibold text-[15px] text-sf-primary bg-white hover:bg-sf-surfaceElevated shadow-sfCardHover transition-all duration-200',
  },

  /** Карточки — components.cards.standard: bg white, border #C8E6D4, radius 12px, shadow card/cardHover */
  card: {
    base: 'font-sans rounded-sfCard border border-sf-cardBorder bg-sf-surface p-6 shadow-sfCard hover:shadow-sfCardHover transition-shadow duration-200',
    muted: 'font-sans rounded-sfCard border border-sf-borderLight bg-sf-backgroundSection p-6',
    accent: 'font-sans rounded-sfCard border border-sf-cardBorder bg-sf-primaryLight px-5 py-4',
    feature: 'font-sans rounded-sfCard border border-sf-cardBorder bg-sf-surface p-6 shadow-sfCard hover:shadow-sfCardHover transition-shadow duration-200',
  },

  /** Сетки — layout.grid.gap 24px, rowGap 32px */
  grid: {
    features: 'grid sm:grid-cols-2 lg:grid-cols-4 gap-6',
    features2: 'grid md:grid-cols-2 lg:grid-cols-3 gap-6',
    cards2: 'grid md:grid-cols-2 gap-6',
    list: 'space-y-4',
  },

  /** Layout wrapper — backgroundPage #F4FAF7 или white по JSON */
  layout: {
    wrapper: 'min-h-screen font-sans bg-sf-background text-sf-text-primary antialiased',
  },

  /** Hero — backgroundSection, gradient из JSON */
  hero: {
    gradient: 'bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background',
    blob: 'bg-sf-accentLight rounded-full blur-3xl',
  },

  /** Иконки в блоках — primaryLight bg, primary или accent color */
  icon: {
    box: 'w-12 h-12 rounded-sfCard bg-sf-primaryLight text-sf-accent flex items-center justify-center',
    boxSm: 'w-11 h-11 rounded-sfCard bg-sf-primaryLight text-sf-accent flex items-center justify-center',
  },
} as const;

export type PublicTokens = typeof publicTokens;
