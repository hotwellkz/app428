import React from 'react';
import { Search, X } from 'lucide-react';

export interface HeaderSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onClose: () => void;
  isOpen: boolean;
  /** Скрыть на desktop (только mobile) */
  mobileOnly?: boolean;
}

/**
 * Раскрывающаяся строка поиска в header (как на Feed).
 * Используется в /feed и /clients для единого UX.
 */
export const HeaderSearchBar: React.FC<HeaderSearchBarProps> = ({
  value,
  onChange,
  placeholder,
  onClose,
  isOpen,
  mobileOnly = false,
}) => (
  <div
    className={`transition-all duration-200 ${isOpen ? 'max-h-14' : 'max-h-0 overflow-hidden'} ${mobileOnly ? 'md:hidden' : ''}`}
    style={{ background: '#ffffff', borderBottom: isOpen ? '1px solid #e5e7eb' : 'none' }}
  >
    <div className="px-3 py-2 flex items-center gap-2 md:px-4">
      <div className="relative flex-1 min-w-0">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-4 py-2 text-sm border-0 focus:ring-0 bg-gray-50 rounded-lg"
          autoFocus={isOpen}
        />
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      <button
        type="button"
        onClick={onClose}
        className="p-2 text-gray-400 hover:text-gray-600 flex-shrink-0"
        aria-label="Закрыть поиск"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  </div>
);
