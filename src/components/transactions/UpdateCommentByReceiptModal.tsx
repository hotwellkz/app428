import React, { useState, useEffect } from 'react';
import { X, Receipt, Loader, Eye } from 'lucide-react';
import { updateTransactionDescription } from '../../lib/firebase/transactions';
import { AttachmentViewerModal } from '../AttachmentViewerModal';
import { getAuthToken } from '../../lib/firebase/auth';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';

interface Attachment {
  name: string;
  url: string;
  type: string;
  size?: number;
  path?: string;
}

interface UpdateCommentByReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string;
  currentDescription: string;
  attachment: Attachment;
  onSuccess?: () => void;
}

const canUseForReceipt = (type: string) =>
  type.startsWith('image/') || type === 'application/pdf';

export const UpdateCommentByReceiptModal: React.FC<UpdateCommentByReceiptModalProps> = ({
  isOpen,
  onClose,
  transactionId,
  currentDescription,
  attachment,
  onSuccess
}) => {
  const [step, setStep] = useState<'fetch' | 'preview' | 'saving'>('fetch');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState<string>('');
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [receiptPreviewError, setReceiptPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep('fetch');
    setError(null);
    setNewComment('');
    setShowReceiptPreview(false);
    setReceiptPreviewError(null);
    setLoading(true);

    if (!canUseForReceipt(attachment.type)) {
      setError('Прикреплённый файл не подходит для распознавания (нужно изображение или PDF)');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getAuthToken();
        const res = await fetch('/.netlify/functions/ai-receipt-parse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ imageUrl: attachment.url })
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError((data?.error as string) ?? 'Не удалось распознать чек');
          setStep('fetch');
          return;
        }
        const text =
          (data.structuredComment && String(data.structuredComment).trim()) ||
          (typeof data.comment === 'string' ? data.comment : '') ||
          'По чеку';
        setNewComment(text);
        setError(null);
        setStep('preview');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Ошибка при распознавании чека');
          setStep('fetch');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, attachment.url, attachment.type]);

  const textToSave = newComment.trim();

  const handleReplace = async () => {
    if (!textToSave) return;
    setLoading(true);
    setStep('saving');
    setError(null);
    try {
      await updateTransactionDescription(transactionId, textToSave);
      showSuccessNotification('Комментарий заменён по чеку');
      onSuccess?.();
      onClose();
    } catch (err) {
      showErrorNotification(err instanceof Error ? err.message : 'Не удалось обновить комментарий');
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setLoading(false);
      setStep('preview');
    }
  };

  const handleAppend = async () => {
    if (!textToSave) return;
    setLoading(true);
    setStep('saving');
    setError(null);
    try {
      const oldTrimmed = (currentDescription ?? '').trim();
      const finalDescription = oldTrimmed
        ? `${oldTrimmed}\n\n---\n\n${textToSave}`
        : textToSave;
      await updateTransactionDescription(transactionId, finalDescription);
      showSuccessNotification('Комментарий дополнен по чеку');
      onSuccess?.();
      onClose();
    } catch (err) {
      showErrorNotification(err instanceof Error ? err.message : 'Не удалось обновить комментарий');
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setLoading(false);
      setStep('preview');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Обновить комментарий по чеку
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">
              {error}
            </div>
          )}

          {loading && step === 'fetch' && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader className="w-10 h-10 text-emerald-500 animate-spin" />
              <p className="text-sm text-gray-600">Распознаём чек...</p>
            </div>
          )}

          {step === 'preview' && (
            <>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Текущий комментарий
                </p>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap min-h-[60px]">
                  {currentDescription || '— пусто —'}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Новый комментарий по чеку
                </p>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Текст распознанного чека (можно редактировать)"
                  rows={6}
                  className="w-full p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-gray-800 placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 resize-y min-h-[100px]"
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setReceiptPreviewError(null);
                    if (attachment?.url) {
                      setShowReceiptPreview(true);
                    } else {
                      setReceiptPreviewError('Файл чека недоступен');
                    }
                  }}
                  className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 rounded"
                >
                  <Eye className="w-4 h-4 flex-shrink-0" />
                  Посмотреть чек
                </button>
                {receiptPreviewError && (
                  <p className="mt-1 text-xs text-red-600">{receiptPreviewError}</p>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Сумма и остальные данные транзакции не изменятся.
              </p>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-3 justify-end p-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          >
            Отмена
          </button>
          {step === 'preview' && (
            <>
              <button
                type="button"
                onClick={handleAppend}
                disabled={loading || !textToSave}
                className="px-4 py-2 border border-emerald-600 text-emerald-700 rounded-lg hover:bg-emerald-50 font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {loading && step === 'saving' ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  'Добавить к комментарию'
                )}
              </button>
              <button
                type="button"
                onClick={handleReplace}
                disabled={loading || !textToSave}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {loading && step === 'saving' ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  'Заменить комментарий'
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {showReceiptPreview && attachment?.url && (
        <AttachmentViewerModal
          isOpen={showReceiptPreview}
          onClose={() => setShowReceiptPreview(false)}
          url={attachment.url}
          type={attachment.type}
          name={attachment.name}
        />
      )}
    </div>
  );
};
