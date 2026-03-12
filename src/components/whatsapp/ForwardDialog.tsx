import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import Avatar from './Avatar';

export interface ForwardTargetItem {
  id: string;
  phone: string;
  displayTitle: string;
  /** Превью последнего сообщения для списка */
  lastMessagePreview?: string | null;
  /** Название сделки для поиска */
  dealStatusName?: string | null;
  /** URL аватара клиента */
  avatarUrl?: string | null;
}

export interface ForwardDialogProps {
  open: boolean;
  targets: ForwardTargetItem[];
  /** Текущий открытый чат — исключить из списка */
  excludeConversationId?: string | null;
  /** Количество пересылаемых сообщений */
  selectedCount: number;
  /** Текст превью: "1 изображение, 2 сообщения" и т.п. */
  forwardPreviewSummary?: string;
  onClose: () => void;
  onForward: (targetIds: string[]) => void;
  loading?: boolean;
  isMobile?: boolean;
}

function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const ForwardDialog: React.FC<ForwardDialogProps> = ({
  open,
  targets,
  excludeConversationId,
  selectedCount,
  forwardPreviewSummary,
  onClose,
  onForward,
  loading = false,
  isMobile = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const list = useMemo(() => {
    let base = excludeConversationId
      ? targets.filter((t) => t.id !== excludeConversationId)
      : [...targets];
    if (!searchQuery.trim()) return base;
    const q = normalizeSearch(searchQuery);
    return base.filter((t) => {
      const title = normalizeSearch(t.displayTitle ?? '');
      const phone = normalizeSearch((t.phone ?? '').replace(/\D/g, ''));
      const deal = normalizeSearch((t.dealStatusName ?? ''));
      return title.includes(q) || phone.includes(q) || deal.includes(q);
    });
  }, [targets, excludeConversationId, searchQuery]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleForward = () => {
    onForward([...selectedIds]);
    setSelectedIds(new Set());
    setSearchQuery('');
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    setSearchQuery('');
    onClose();
  };

  if (!open) return null;

  const containerClass = isMobile
    ? 'fixed inset-0 z-[1200] flex flex-col bg-white'
    : 'fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4';

  const panelClass = isMobile
    ? 'flex-1 flex flex-col min-h-0 overflow-hidden'
    : 'bg-white w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl shadow-xl overflow-hidden';

  return (
    <div className={containerClass} role="dialog" aria-modal="true" aria-labelledby="forward-dialog-title">
      {!isMobile && <div className="absolute inset-0" onClick={handleClose} aria-hidden />}
      <div className={panelClass} style={isMobile ? undefined : { position: 'relative' }}>
        {/* Шапка: заголовок + закрыть */}
        <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 id="forward-dialog-title" className="text-lg font-semibold text-gray-900">
            Переслать в чат
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Поиск */}
        <div className="flex-none px-3 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск чата или номера"
              className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 placeholder-gray-500 outline-none"
              aria-label="Поиск чата или номера"
            />
          </div>
        </div>

        {/* Превью пересылаемого */}
        {forwardPreviewSummary && (
          <div className="flex-none px-4 py-2 bg-gray-50 border-b border-gray-100">
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-800">Пересылается:</span>{' '}
              {forwardPreviewSummary}
            </p>
          </div>
        )}

        {/* Выбрано чатов */}
        {selectedIds.size > 0 && (
          <div className="flex-none px-4 py-1.5 text-sm text-emerald-700 font-medium">
            Выбрано чатов: {selectedIds.size}
          </div>
        )}

        {/* Список: Недавние чаты */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <p className="px-4 pt-2 pb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
            Недавние чаты
          </p>
          {list.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">
              {searchQuery.trim() ? 'Ничего не найдено' : 'Нет других чатов для пересылки'}
            </p>
          ) : (
            <ul className="py-1 pb-4">
              {list.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => toggle(t.id)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 active:bg-gray-100 ${
                      selectedIds.has(t.id) ? 'bg-emerald-50' : ''
                    }`}
                  >
                    <span
                      className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedIds.has(t.id) ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 bg-white'
                      }`}
                    >
                      {selectedIds.has(t.id) && <span className="text-white text-xs font-bold">✓</span>}
                    </span>
                    <Avatar name={t.displayTitle} phone={t.phone} avatarUrl={t.avatarUrl} size={40} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{t.displayTitle}</p>
                      <p className="text-xs text-gray-500 truncate">{t.phone}</p>
                      {t.lastMessagePreview && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{t.lastMessagePreview}</p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Кнопка переслать */}
        <div
          className="flex-none flex gap-2 p-4 border-t border-gray-200 bg-white"
          style={isMobile ? { paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' } : undefined}
        >
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleForward}
            disabled={selectedIds.size === 0 || loading}
            className="flex-1 py-2.5 rounded-xl bg-[#25D366] text-white font-medium hover:bg-[#20bd5a] disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? 'Отправка…' : `Переслать (${selectedCount})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForwardDialog;
