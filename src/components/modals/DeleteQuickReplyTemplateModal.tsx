import React, { useEffect, useCallback, useRef } from 'react';

export interface DeleteQuickReplyTemplateModalProps {
  open: boolean;
  templateTitle: string;
  deleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Подтверждение удаления текстового шаблона быстрого ответа (без browser confirm).
 */
export function DeleteQuickReplyTemplateModal({
  open,
  templateTitle,
  deleting = false,
  onCancel,
  onConfirm
}: DeleteQuickReplyTemplateModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !deleting) onCancel();
    },
    [open, deleting, onCancel]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleEscape);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, handleEscape]);

  if (!open) return null;

  const titleSafe = templateTitle.trim() || 'Без названия';
  const heading = `Удалить шаблон «${titleSafe}»?`;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !deleting) onCancel();
      }}
    >
      <div className="absolute inset-0 bg-black/50" style={{ animation: 'deleteModalFade 0.2s ease-out forwards', opacity: 0 }} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-template-modal-title"
        className="relative w-full max-w-[min(100%,420px)] rounded-2xl bg-white shadow-xl border border-gray-100"
        style={{
          opacity: 0,
          animation: 'deleteModalIn 0.2s ease-out forwards'
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes deleteModalFade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes deleteModalIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
        `}</style>
        <div className="p-5 sm:p-6">
          <h2 id="delete-template-modal-title" className="text-lg font-semibold text-gray-900 pr-2">
            Удалить шаблон?
          </h2>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            Вы уверены, что хотите удалить этот шаблон?
            <br />
            <span className="text-gray-500">Это действие нельзя отменить.</span>
          </p>
          <p className="mt-3 text-sm font-medium text-gray-800 rounded-lg bg-gray-50 px-3 py-2 border border-gray-100">
            {heading}
          </p>
          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
            <button
              type="button"
              className="w-full sm:w-auto rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 min-h-[44px]"
              onClick={onCancel}
              disabled={deleting}
            >
              Отмена
            </button>
            <button
              type="button"
              className="w-full sm:w-auto rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 min-h-[44px]"
              onClick={onConfirm}
              disabled={deleting}
            >
              {deleting ? 'Удаление…' : 'Удалить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
