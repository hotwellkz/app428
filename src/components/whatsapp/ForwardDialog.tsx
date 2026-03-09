import React, { useState } from 'react';

export interface ForwardTargetItem {
  id: string;
  phone: string;
  displayTitle: string;
}

export interface ForwardDialogProps {
  open: boolean;
  targets: ForwardTargetItem[];
  /** Текущий открытый чат — исключить из списка */
  excludeConversationId?: string | null;
  selectedCount: number;
  onClose: () => void;
  onForward: (targetIds: string[]) => void;
  loading?: boolean;
}

const ForwardDialog: React.FC<ForwardDialogProps> = ({
  open,
  targets,
  excludeConversationId,
  selectedCount,
  onClose,
  onForward,
  loading = false,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const list = excludeConversationId
    ? targets.filter((t) => t.id !== excludeConversationId)
    : targets;

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
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-end md:items-center justify-center bg-black/50">
      <div
        className="bg-white w-full max-w-md max-h-[80vh] flex flex-col rounded-t-2xl md:rounded-2xl shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="forward-dialog-title"
      >
        <div className="flex-none flex items-center justify-between px-4 py-3 border-b">
          <h2 id="forward-dialog-title" className="text-lg font-semibold text-gray-900">
            Переслать в чат
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <p className="flex-none px-4 py-1 text-sm text-gray-500">
          Выбрано сообщений: {selectedCount}. Выберите чат(ы):
        </p>
        <div className="flex-1 overflow-y-auto min-h-0">
          {list.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">Нет других чатов для пересылки</p>
          ) : (
            <ul className="py-2">
              {list.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => toggle(t.id)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 ${
                      selectedIds.has(t.id) ? 'bg-green-50' : ''
                    }`}
                  >
                    <span
                      className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedIds.has(t.id) ? 'bg-green-500 border-green-500' : 'border-gray-300'
                      }`}
                    >
                      {selectedIds.has(t.id) && (
                        <span className="text-white text-xs">✓</span>
                      )}
                    </span>
                    <span className="font-medium text-gray-900 truncate">{t.displayTitle}</span>
                    <span className="text-xs text-gray-400 truncate">{t.phone}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex-none flex gap-2 p-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleForward}
            disabled={selectedIds.size === 0 || loading}
            className="flex-1 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? 'Отправка…' : `Переслать (${selectedIds.size})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForwardDialog;
