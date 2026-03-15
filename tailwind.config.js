/** @type {import('tailwindcss').Config} */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const designTokensFile = require('./salesforce-design-tokens-green.json');
const tokens = designTokensFile.tokens || {};
const layout = designTokensFile.layout || {};
const colors = tokens.colors || {};
const text = colors.text || {};
const typography = tokens.typography || {};
const fontFamilies = typography.fontFamilies || {};
const borderRadius = tokens.borderRadius || {};
const shadows = tokens.shadows || {};
const spacingFromLayout = {
  section: layout.sectionPaddingY || '80px',
  sectionSm: '64px',
  container: layout.containerPadding || '24px',
};

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    // Public footer and dark CTA — гарантированно в сборке для контраста
    'bg-sf-primary',
    'text-sf-text-inverse',
    'text-white',
    'text-white/95',
    'text-white/90',
    'text-white/80',
    'text-white/75',
    'border-white/30',
    'border-white/25',
    'border-white/20',
    'hover:text-white',
    'border-white/40',
    'hover:border-white/60',
    'bg-white/20',
    'bg-white/15',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Source Sans 3', 'Arial', (fontFamilies.body || '').split(',')[2] || 'sans-serif'],
      },
      colors: {
        sf: {
          primary: colors.primary,
          primaryHover: colors.primaryHover,
          primaryLight: colors.primaryLight,
          secondary: colors.secondary,
          accent: colors.accent,
          accentLight: colors.accentLight,
          background: colors.background,
          backgroundPage: colors.backgroundPage,
          backgroundSection: colors.backgroundSection,
          surface: colors.surface,
          surfaceElevated: colors.surfaceElevated,
          text: {
            primary: text.primary,
            secondary: text.secondary,
            muted: text.muted,
            inverse: text.inverse,
            link: text.link,
            linkHover: text.linkHover,
            accent: text.accent,
          },
          border: colors.border,
          borderLight: colors.borderLight,
          borderFocus: colors.borderFocus,
          cardBorder: colors.cardBorder,
          error: colors.error,
          success: colors.success,
          warning: colors.warning,
        },
      },
      borderRadius: {
        sfButton: borderRadius.button || '6px',
        sfCard: borderRadius.card || '12px',
        sfBadge: borderRadius.badge || '4px',
      },
      boxShadow: {
        sfSm: shadows.sm,
        sfMd: shadows.md,
        sfLg: shadows.lg,
        sfCard: shadows.card,
        sfCardHover: shadows.cardHover,
      },
      spacing: spacingFromLayout,
    },
  },
  plugins: [],
};
