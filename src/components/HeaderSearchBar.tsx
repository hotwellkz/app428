import React, { useEffect, useRef } from 'react';
import { Search, X, ArrowLeft } from 'lucide-react';

export interface HeaderSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onClose: () => void;
  isOpen: boolean;
  /** Скрыть на desktop (только mobile) */
  mobileOnly?: boolean;
  /**
   * Кнопка «назад» слева (закрывает панель). Для /whatsapp: без дублирующего X справа,
   * если не передан showTrailingClose.
   */
  leadingClose?: boolean;
  /** Крестик справа (по умолчанию: true, если leadingClose=false; иначе false) */
  showTrailingClose?: boolean;
  /** Показать очистку текста внутри поля, если value не пустой */
  showValueClear?: boolean;
}

/**
 * Раскрывающаяся строка поиска в header (как на Feed).
 * Используется в /feed, /clients и /whatsapp (моб.) для единого UX.
 */
export const HeaderSearchBar: React.FC<HeaderSearchBarProps> = ({
  value,
  onChange,
  placeholder,
  onClose,
  isOpen,
  mobileOnly = false,
  leadingClose = false,
  showTrailingClose,
  showValueClear = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const trailing = showTrailingClose ?? !leadingClose;

  useEffect(() => {
    if (!isOpen) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [isOpen]);

  const hasText = value.trim().length > 0;
  const inputRightPad = hasText && showValueClear ? 'pr-10' : 'pr-4';

  return (
    <div
      className={`transition-all duration-200 ease-out ${
        isOpen ? 'max-h-16' : 'max-h-0 overflow-hidden'
      } ${mobileOnly ? 'md:hidden' : ''}`}
      style={{
        background: '#ffffff',
        borderBottom: isOpen ? '1px solid #e5e7eb' : 'none',
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2 md:px-4">
        {leadingClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
            aria-label="Закрыть поиск"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full rounded-lg border-0 bg-gray-50 py-2.5 pl-9 text-sm focus:ring-0 ${inputRightPad}`}
            autoComplete="off"
            autoCorrect="off"
          />
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          {showValueClear && hasText && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200/80 hover:text-gray-700"
              aria-label="Очистить поиск"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {trailing && (
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600"
            aria-label="Закрыть поиск"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
};
