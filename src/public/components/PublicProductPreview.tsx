import React from 'react';
import {
  Users,
  MessageSquare,
  GitBranch,
  Zap,
  BarChart3,
  Wallet,
  Package,
  Shield,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';
export interface ProductPreviewModule {
  icon: LucideIcon;
  label: string;
}

const DEFAULT_MODULES: ProductPreviewModule[] = [
  { icon: Users, label: 'Клиенты' },
  { icon: MessageSquare, label: 'WhatsApp' },
  { icon: GitBranch, label: 'Сделки' },
  { icon: Zap, label: 'Шаблоны' },
  { icon: BarChart3, label: 'Аналитика' },
  { icon: Wallet, label: 'Финансы' },
  { icon: Package, label: 'Склад' },
  { icon: Shield, label: 'Роли' },
];

export interface PublicProductPreviewProps {
  /** Модули для отображения (по умолчанию — полный набор возможностей 2wix) */
  modules?: ProductPreviewModule[];
  /** Компактный вариант для узких блоков */
  compact?: boolean;
  className?: string;
}

/**
 * Визуальный превью продукта 2wix: mockup дашборда с ключевыми модулями.
 * Используется под Hero на странице «Возможности» и при необходимости на других публичных страницах.
 * Передаёт сообщение: «одна система — клиенты, WhatsApp, сделки, аналитика, финансы, процессы».
 */
export const PublicProductPreview: React.FC<PublicProductPreviewProps> = ({
  modules = DEFAULT_MODULES,
  compact = false,
  className = '',
}) => {
  return (
    <div
      className={`rounded-sfCard border border-sf-border bg-sf-surface shadow-xl overflow-hidden ${className}`}
      style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)' }}
    >
      {/* Верхняя панель — как у приложения */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-sf-borderLight bg-sf-backgroundSection/60">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-200" aria-hidden />
          <span className="w-3 h-3 rounded-full bg-amber-200" aria-hidden />
          <span className="w-3 h-3 rounded-full bg-emerald-200" aria-hidden />
        </div>
        <div className="flex-1 flex justify-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-sf-text-primary">
            <LayoutDashboard className="w-4 h-4 text-sf-accent" />
            2wix CRM
          </span>
        </div>
        <div className="w-[52px]" aria-hidden />
      </div>

      {/* Сетка модулей — дашборд-виджетов */}
      <div
        className={`p-4 sm:p-5 md:p-6 bg-gradient-to-br from-sf-backgroundSection/50 to-sf-background ${
          compact ? 'grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3' : 'grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4'
        }`}
      >
        {modules.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="rounded-lg border border-sf-borderLight bg-sf-surface/95 backdrop-blur-sm p-3 sm:p-4 shadow-sm hover:shadow-md hover:border-sf-cardBorder transition-all duration-200 flex flex-col items-center justify-center text-center min-h-[72px] sm:min-h-[80px]"
          >
            <div className={`rounded-lg bg-sf-primaryLight text-sf-accent flex items-center justify-center mb-2 ${compact ? 'w-8 h-8' : 'w-9 h-9 sm:w-10 sm:h-10'}`}>
              <Icon className={compact ? 'w-4 h-4' : 'w-4 h-4 sm:w-5 sm:h-5'} />
            </div>
            <span className={`font-medium text-sf-text-primary ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Нижняя полоска — «единая система» */}
      <div className="px-4 py-2.5 border-t border-sf-borderLight bg-sf-backgroundSection/40 text-center">
        <span className="text-xs text-sf-text-muted font-medium">Клиенты · WhatsApp · Сделки · Аналитика · Финансы — в одной системе</span>
      </div>
    </div>
  );
};
