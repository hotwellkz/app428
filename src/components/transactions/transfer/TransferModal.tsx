import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CategoryCardType } from '../../../types';
import { transferFunds } from '../../../lib/firebase/transactions';
import {
  createExpenseCategory,
  updateExpenseCategory,
  ensureDefaultExpenseCategory,
  DEFAULT_EXPENSE_CATEGORY_NAME
} from '../../../lib/firebase/expenseCategories';
import { showErrorNotification, showSuccessNotification } from '../../../utils/notifications';
import { formatMoney } from '../../../utils/formatMoney';
import { XMarkIcon, PencilIcon } from '@heroicons/react/24/outline';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../../../lib/supabase/config';
import { PaperclipIcon, SendHorizontal, Camera, ScanLine } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { useAuth } from '../../../hooks/useAuth';
import { getAuthToken } from '../../../lib/firebase/auth';
import { useCompanyId } from '../../../contexts/CompanyContext';
import { useExpenseCategories } from '../../../hooks/useExpenseCategories';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { ExpenseCategoryMobilePicker } from '../../ExpenseCategoryMobilePicker';
import { ExpenseCategoryManageModal } from '../../ExpenseCategoryManageModal';
import type { ExpenseCategory } from '../../../types/expenseCategory';

interface TransferModalProps {
  sourceCategory: CategoryCardType;
  targetCategory: CategoryCardType;
  isOpen: boolean;
  onClose: () => void;
}

type FileUploadStatus = 'pending' | 'uploading' | 'uploaded' | 'error';

interface FileUpload {
  id: string;
  file: File;
  progress: number;
  status: FileUploadStatus;
  path?: string;
  url?: string;
  previewUrl?: string;
  errorMessage?: string;
}

const MAX_IMAGE_SIZE_PX = 1600;
const MAX_IMAGE_SIZE_MB = 0.4;
const MAX_FILES = 5;

const CREATE_NEW_ID = '__create_new_expense_category__';

/** Название категории «наша компания» — при переводе ИЗ неё автоматически включаем «Безнал». */
const HOTWELL_SOURCE_TITLE = 'HotWell';

type ReceiptItem = { name: string; quantity?: number; unit?: string; unitPrice?: number; lineTotal?: number };

function buildStructuredComment(
  items: ReceiptItem[],
  totalAmount: number
): string {
  if (!items.length) return '';
  const lines = items.map(
    (it, i) => {
      const q = it.quantity ?? 0;
      const up = it.unitPrice ?? 0;
      const lineTotal = it.lineTotal ?? (q && up ? q * up : 0);
      const sum = Math.round(lineTotal * 100) / 100;
      return `${i + 1}) ${it.name} — ${q}${it.unit ? ` ${it.unit}` : ''} × ${up} = ${sum} ₸`;
    }
  );
  const total = Math.round(totalAmount * 100) / 100;
  return `По чеку:\n${lines.join('\n')}\nИтого по чеку: ${total} ₸`;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  sourceCategory,
  targetCategory,
  isOpen,
  onClose
}) => {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const { categories: expenseCategories } = useExpenseCategories(user?.uid);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSalary, setIsSalary] = useState(false);
  const [isCashless, setIsCashless] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const userTouchedCashlessRef = useRef(false);
  const [expenseCategoryId, setExpenseCategoryId] = useState<string>('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [expenseDropdownOpen, setExpenseDropdownOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [updatingCategory, setUpdatingCategory] = useState(false);
  const [mobilePickerOpen, setMobilePickerOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const expenseDropdownRef = useRef<HTMLDivElement>(null);
  const hasSetDefaultCategoryForOpen = useRef(false);
  const isMobile = useIsMobile(768);
  const submittedSuccessRef = useRef(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [receiptParseLoading, setReceiptParseLoading] = useState(false);
  const [receiptParseResult, setReceiptParseResult] = useState<{
    totalAmount: number;
    comment: string;
    structuredComment?: string;
    confidence: 'high' | 'medium' | 'low';
    items?: Array<{ name: string; quantity?: number; unit?: string; unitPrice?: number; lineTotal?: number }>;
    totalByItems?: number;
    receiptTotal?: number;
    totalsMatch?: boolean;
  } | null>(null);

  const isFromTopRow =
    sourceCategory.type === 'employee' || sourceCategory.type === 'company' ||
    (sourceCategory.row === 1 || sourceCategory.row === 2);
  const isToGeneralExpense =
    targetCategory.type === 'general_expense' || targetCategory.title === 'Общ Расх';
  const showExpenseCategory = isFromTopRow && isToGeneralExpense;

  const balanceValue = parseFloat(String(sourceCategory?.amount ?? 0).replace(/[^\d.-]/g, '')) || 0;

  // При закрытии модалки сбрасываем флаг «пользователь менял Безнал вручную»
  useEffect(() => {
    if (!isOpen) userTouchedCashlessRef.current = false;
  }, [isOpen]);

  // Авто-включение «Безнал» при переводе ИЗ HotWell (только если пользователь ещё не менял чекбокс вручную)
  useEffect(() => {
    if (!isOpen) return;
    if (sourceCategory.title !== HOTWELL_SOURCE_TITLE) return;
    if (userTouchedCashlessRef.current) return;
    setIsCashless(true);
  }, [isOpen, sourceCategory?.id, sourceCategory?.title]);

  // Категория "Прочее" по умолчанию только при открытии модалки (не при каждом обновлении списка)
  useEffect(() => {
    if (!isOpen) {
      hasSetDefaultCategoryForOpen.current = false;
      return;
    }
    if (!showExpenseCategory || !user?.uid || expenseCategories.length === 0) return;
    if (hasSetDefaultCategoryForOpen.current) return;
    hasSetDefaultCategoryForOpen.current = true;
    const other = expenseCategories.find((c) => c.name === DEFAULT_EXPENSE_CATEGORY_NAME);
    if (other) {
      setExpenseCategoryId(other.id);
      return;
    }
    ensureDefaultExpenseCategory(user.uid).then((id) => {
      setExpenseCategoryId(id);
    }).catch((err) => {
      console.error('ensureDefaultExpenseCategory:', err);
    });
  }, [isOpen, showExpenseCategory, user?.uid, expenseCategories]);

  // Закрытие dropdown при клике снаружи
  useEffect(() => {
    if (!expenseDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (expenseDropdownRef.current && !expenseDropdownRef.current.contains(e.target as Node)) {
        setExpenseDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [expenseDropdownOpen]);

  const selectedExpenseCategory = expenseCategories.find((c) => c.id === expenseCategoryId);

  const handleStartEdit = (cat: ExpenseCategory) => {
    setEditingCategoryId(cat.id);
    setEditingName(cat.name);
  };

  const handleSaveEdit = async () => {
    if (editingCategoryId == null || !editingName.trim()) {
      setEditingCategoryId(null);
      return;
    }
    setUpdatingCategory(true);
    try {
      await updateExpenseCategory(editingCategoryId, editingName.trim());
      setEditingCategoryId(null);
      setEditingName('');
    } catch (err) {
      showErrorNotification(err instanceof Error ? err.message : 'Ошибка обновления категории');
    } finally {
      setUpdatingCategory(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingCategoryId(null);
    setEditingName('');
  };

  // Функция для форматирования числа с разделителями
  const formatNumber = (value: string) => {
    // Убираем все пробелы и буквы, оставляем только цифры и точку
    const numbers = value.replace(/[^\d.]/g, '');
    
    // Разделяем на целую и дробную части
    const parts = numbers.split('.');
    const wholePart = parts[0];
    const decimalPart = parts[1];

    // Форматируем целую часть, добавляя пробелы
    const formattedWholePart = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    // Возвращаем отформатированное число
    return decimalPart !== undefined 
      ? `${formattedWholePart}.${decimalPart}`
      : formattedWholePart;
  };

  // Функция для очистки форматирования перед отправкой
  const cleanNumber = (value: string) => {
    return value.replace(/\s/g, '');
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatNumber(value);
    setAmount(formatted);
  };

  const startPreupload = useCallback(
    async (file: File, id: string) => {
      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        try {
          fileToUpload = await imageCompression(file, {
            maxSizeMB: MAX_IMAGE_SIZE_MB,
            maxWidthOrHeight: MAX_IMAGE_SIZE_PX,
            useWebWorker: true,
            fileType: 'image/jpeg'
          });
        } catch (e) {
          console.warn('Image compression failed, uploading original:', e);
        }
      }
      setFiles(prev =>
        prev.map(f => (f.id === id ? { ...f, status: 'uploading' as const, progress: 10 } : f))
      );
      const timestamp = Date.now();
      const safeName = fileToUpload.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `companies/${companyId}/files/${sourceCategory.id}/${timestamp}-${id}-${safeName}`;
      try {
        const { data, error } = await supabase.storage.from('transactions').upload(path, fileToUpload, {
          cacheControl: '3600',
          upsert: true
        });
        if (error) throw error;
        if (!data?.path) throw new Error('Upload successful but no path returned');
        const {
          data: { publicUrl }
        } = supabase.storage.from('transactions').getPublicUrl(data.path);
        setFiles(prev =>
          prev.map(f =>
            f.id === id
              ? {
                  ...f,
                  status: 'uploaded' as const,
                  progress: 100,
                  path: data.path,
                  url: publicUrl,
                  previewUrl: undefined
                }
              : f
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Ошибка загрузки';
        setFiles(prev =>
          prev.map(f =>
            f.id === id ? { ...f, status: 'error' as const, errorMessage: msg } : f
          )
        );
        showErrorNotification(`Файл ${file.name}: ${msg}`);
      }
    },
    [sourceCategory.id]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const rest = MAX_FILES - files.length;
      if (rest <= 0) return;
      const toAdd = acceptedFiles.slice(0, rest).map(file => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
        return {
          id,
          file,
          progress: 0,
          status: 'pending' as FileUploadStatus,
          previewUrl
        };
      });
      setFiles(prev => [...prev, ...toAdd]);
      toAdd.forEach(item => startPreupload(item.file, item.id));
    },
    [files.length, startPreupload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 10 * 1024 * 1024,
    maxFiles: MAX_FILES,
    disabled: files.length >= MAX_FILES
  });

  const removeFile = useCallback(
    async (index: number) => {
      const item = files[index];
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item.status === 'uploaded' && item.path) {
        try {
          await supabase.storage.from('transactions').remove([item.path]);
        } catch (e) {
          console.warn('Failed to remove file from storage:', e);
        }
      }
      setFiles(prev => prev.filter((_, i) => i !== index));
    },
    [files]
  );

  const handleCameraCapture = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const chosen = e.target.files?.[0];
      e.target.value = '';
      if (!chosen || files.length >= MAX_FILES) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const previewUrl = URL.createObjectURL(chosen);
      const newItem: FileUpload = {
        id,
        file: chosen,
        progress: 0,
        status: 'pending',
        previewUrl
      };
      setFiles(prev => [...prev, newItem]);
      startPreupload(chosen, id);
    },
    [files.length, startPreupload]
  );

  const firstUploadedImage = files.find(
    (f) => f.status === 'uploaded' && f.file.type.startsWith('image/')
  );

  const fillFromReceipt = useCallback(async () => {
    if (!firstUploadedImage?.file) return;
    setReceiptParseLoading(true);
    setReceiptParseResult(null);
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
        reader.readAsDataURL(firstUploadedImage.file);
      });
      const token = await getAuthToken();
      const res = await fetch('/.netlify/functions/ai-receipt-parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'Ошибка распознавания чека');
        return;
      }
      if (data.totalAmount == null && !data.comment) {
        setError('Не удалось уверенно распознать чек. Проверьте сумму и комментарий вручную.');
        return;
      }
      setReceiptParseResult({
        totalAmount: Number(data.totalAmount) || 0,
        comment: typeof data.comment === 'string' ? data.comment : 'По чеку/накладной',
        structuredComment: typeof data.structuredComment === 'string' && data.structuredComment.trim() ? data.structuredComment.trim() : undefined,
        confidence: ['high', 'medium', 'low'].includes(data.confidence) ? data.confidence : 'medium',
        items: Array.isArray(data.items) ? data.items : undefined,
        totalByItems: typeof data.totalByItems === 'number' ? data.totalByItems : undefined,
        receiptTotal: typeof data.receiptTotal === 'number' ? data.receiptTotal : undefined,
        totalsMatch: data.totalsMatch === true || data.totalsMatch === false ? data.totalsMatch : undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка при распознавании чека');
    } finally {
      setReceiptParseLoading(false);
    }
  }, [firstUploadedImage]);

  const applyReceiptResult = useCallback(() => {
    if (!receiptParseResult) return;
    setAmount(formatNumber(String(Math.round(receiptParseResult.totalAmount))));
    let commentToApply =
      receiptParseResult.structuredComment && receiptParseResult.structuredComment.trim()
        ? receiptParseResult.structuredComment.trim()
        : '';
    if (!commentToApply && receiptParseResult.items && receiptParseResult.items.length > 0) {
      commentToApply = buildStructuredComment(
        receiptParseResult.items,
        receiptParseResult.receiptTotal ?? receiptParseResult.totalAmount
      );
    }
    if (!commentToApply) commentToApply = receiptParseResult.comment;
    setDescription(commentToApply);
    setReceiptParseResult(null);
    showSuccessNotification('Заполнено по чеку');
  }, [receiptParseResult]);

  useEffect(() => {
    if (!isOpen) return;
    submittedSuccessRef.current = false;
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    setReceiptParseResult(null);
    const toDelete = files.filter(f => f.status === 'uploaded' && f.path);
    if (!submittedSuccessRef.current && toDelete.length > 0) {
      toDelete.forEach(({ path }) => {
        if (path) supabase.storage.from('transactions').remove([path]).catch(() => {});
      });
    }
    files.forEach(f => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setFiles([]);
  }, [isOpen, files]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedAmount = cleanNumber(amount);
    if (!cleanedAmount || parseFloat(cleanedAmount) <= 0) {
      setError('Сумма должна быть больше нуля');
      return;
    }
    if (showExpenseCategory && !expenseCategoryId) {
      setError('Выберите категорию расхода');
      return;
    }
    const stillUploading = files.some(f => f.status === 'uploading' || f.status === 'pending');
    if (stillUploading) {
      setError('Дождитесь завершения загрузки файлов');
      return;
    }
    const uploadedOnly = files.filter((f): f is FileUpload & { path: string; url: string } => f.status === 'uploaded' && !!f.path && !!f.url);
    if (files.length > 0 && uploadedOnly.length === 0) {
      setError('Есть файлы с ошибкой загрузки. Удалите их или попробуйте снова.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const uploadedFiles = uploadedOnly.map(({ file, path, url }) => ({
        name: file.name,
        url,
        type: file.type,
        size: file.size,
        path
      }));

      if (!companyId) return;
      await transferFunds({
        sourceCategory,
        targetCategory,
        amount: parseFloat(cleanedAmount),
        description,
        attachments: uploadedFiles,
        waybillNumber: '',
        waybillData: {},
        isSalary,
        isCashless,
        expenseCategoryId: showExpenseCategory ? expenseCategoryId || undefined : undefined,
        needsReview,
        companyId
      });

      showSuccessNotification('Перевод успешно выполнен');
      submittedSuccessRef.current = true;
      onClose();
    } catch (error) {
      console.error('Error in transfer:', error);
      setError(error instanceof Error ? error.message : 'Произошла ошибка при переводе');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start md:items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-lg w-full max-w-lg md:mt-0 mt-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0 bg-white z-10">
          <div className="w-8" aria-hidden />
          <h2 className="text-lg font-semibold text-center flex-1 min-w-0 truncate">
            Перевод средств
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-500 shrink-0"
            aria-label="Закрыть"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleCameraCapture}
            aria-label="Сделать фото"
          />
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="mb-6 space-y-1 pb-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">От: {sourceCategory.title}</span>
              <span className="text-gray-600">Кому: {targetCategory.title}</span>
            </div>
            <div className="text-sm text-gray-500">
              Текущий баланс:{' '}
              <span className={balanceValue < 0 ? 'text-red-500' : 'text-green-600'}>
                {balanceValue < 0 ? `−${formatMoney(Math.abs(balanceValue))}` : formatMoney(balanceValue)}
              </span>
            </div>
          </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Сумма перевода
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={handleAmountChange}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="1 000 000"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Комментарий к переводу
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Укажите назначение перевода"
                rows={3}
              />
              {needsReview && (
                <p className="mt-1 text-xs text-amber-700">
                  Контролер проверит категорию перевода.
                </p>
              )}
            </div>

            {showExpenseCategory && (
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Категория расхода
                </label>
                {!showNewCategoryInput ? (
                  <>
                    {/* Desktop: dropdown с редактированием */}
                    <div ref={expenseDropdownRef} className="hidden md:block relative">
                      <button
                        type="button"
                        onClick={() => setExpenseDropdownOpen((v) => !v)}
                        className="w-full px-3 py-2 border rounded-lg text-left bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between"
                      >
                        <span className={expenseCategoryId ? 'text-gray-900' : 'text-gray-500'}>
                          {selectedExpenseCategory?.name ?? 'Выберите категорию'}
                        </span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {expenseDropdownOpen && (
                        <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {expenseCategories.map((cat) => (
                            <div
                              key={cat.id}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                            >
                              {editingCategoryId === cat.id ? (
                                <>
                                  <input
                                    type="text"
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEdit();
                                      if (e.key === 'Escape') handleCancelEdit();
                                    }}
                                    className="flex-1 px-2 py-1 border rounded text-sm"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    disabled={updatingCategory}
                                    onClick={handleSaveEdit}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                    title="Сохранить"
                                  >
                                    {updatingCategory ? '…' : '✓'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                                    title="Отмена"
                                  >
                                    ✕
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setExpenseCategoryId(cat.id);
                                      setExpenseDropdownOpen(false);
                                    }}
                                    className="flex-1 text-left text-sm text-gray-900"
                                  >
                                    {cat.name}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartEdit(cat);
                                    }}
                                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                                    title="Редактировать"
                                  >
                                    <PencilIcon className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setShowNewCategoryInput(true);
                              setExpenseDropdownOpen(false);
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50"
                          >
                            + Создать новую категорию
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Mobile: кнопка-триггер → открывает bottom sheet picker */}
                    <div className="md:hidden">
                      <button
                        type="button"
                        onClick={() => setMobilePickerOpen(true)}
                        className="w-full px-4 py-3 border rounded-xl text-left bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between min-h-[48px]"
                      >
                        <span className={expenseCategoryId ? 'text-gray-900 font-medium' : 'text-gray-500'}>
                          {selectedExpenseCategory?.name ?? 'Выберите категорию'}
                        </span>
                        <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    <ExpenseCategoryMobilePicker
                      isOpen={mobilePickerOpen}
                      onClose={() => setMobilePickerOpen(false)}
                      categories={expenseCategories}
                      selectedId={expenseCategoryId}
                      onSelect={setExpenseCategoryId}
                      onCreateNew={() => setShowNewCategoryInput(true)}
                      onManage={() => setManageModalOpen(true)}
                    />
                    <ExpenseCategoryManageModal
                      isOpen={manageModalOpen}
                      onClose={() => setManageModalOpen(false)}
                      categories={expenseCategories}
                    />
                  </>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Название категории"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={creatingCategory || !newCategoryName.trim()}
                        onClick={async () => {
                          if (!user?.uid || !newCategoryName.trim()) return;
                          setCreatingCategory(true);
                          try {
                            const id = await createExpenseCategory(newCategoryName.trim(), user.uid);
                            setExpenseCategoryId(id);
                            setShowNewCategoryInput(false);
                            setNewCategoryName('');
                          } catch (err) {
                            showErrorNotification(err instanceof Error ? err.message : 'Ошибка создания категории');
                          } finally {
                            setCreatingCategory(false);
                          }
                        }}
                        className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                      >
                        {creatingCategory ? 'Сохранение...' : 'Сохранить'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewCategoryInput(false);
                          setNewCategoryName('');
                        }}
                        className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Чекбоксы в одну строку, на узком экране перенос */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={isSalary}
                  onChange={(e) => setIsSalary(e.target.checked)}
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                />
                <span className="text-gray-700">ЗП</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={isCashless}
                  onChange={(e) => {
                    userTouchedCashlessRef.current = true;
                    setIsCashless(e.target.checked);
                  }}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <span className="text-gray-700">Безнал</span>
              </label>
              <label
                className="flex items-center space-x-2 text-sm"
                title="Требует уточнения"
              >
                <input
                  type="checkbox"
                  checked={needsReview}
                  onChange={(e) => setNeedsReview(e.target.checked)}
                  className="h-4 w-4 text-amber-500 focus:ring-amber-500 border-gray-300 rounded"
                />
                <span className="text-gray-700">Треб.ут.</span>
              </label>
            </div>

            {/* Десктопная версия кнопок */}
            <div className="hidden md:block">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Прикрепить файлы
                  </label>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={files.length >= MAX_FILES}
                    className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg border border-gray-300 hover:border-gray-400 transition-colors disabled:opacity-50"
                    title="Камера"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg cursor-pointer transition-colors
                    ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
                    p-4`}
                >
                  <input {...getInputProps()} />
                  {/* Desktop и планшетная версия */}
                  <div className="hidden md:flex flex-col items-center justify-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <p className="mt-1 text-sm text-gray-600">
                      Перетащите файлы сюда или нажмите для выбора
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Поддерживаются изображения, PDF и документы Word (до 10MB)
                    </p>
                  </div>
                  {/* Мобильная версия */}
                  <div className="md:hidden flex items-center justify-center">
                    <svg
                      className="h-6 w-6 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Десктопная кнопка отправки */}
              <div className="hidden md:flex justify-end">
                <button
                  type="submit"
                  disabled={loading || files.some(f => f.status === 'uploading' || f.status === 'pending')}
                  className={`px-4 py-2 text-white font-medium rounded-lg
                    ${loading || files.some(f => f.status === 'uploading' || f.status === 'pending')
                      ? 'bg-blue-400 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                >
                  {loading ? 'Выполняется...' : files.some(f => f.status === 'uploading' || f.status === 'pending') ? 'Загрузка файлов...' : 'Выполнить перевод'}
                </button>
              </div>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                {firstUploadedImage && (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs text-slate-500">Можно распознать чек по первому изображению</span>
                    <button
                      type="button"
                      onClick={fillFromReceipt}
                      disabled={receiptParseLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-800 text-sm font-medium hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {receiptParseLoading ? (
                        <>
                          <span className="animate-spin inline-block w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full" />
                          Распознаём чек…
                        </>
                      ) : (
                        <>
                          <ScanLine className="w-4 h-4" />
                          Заполнить по чеку
                        </>
                      )}
                    </button>
                  </div>
                )}
                {receiptParseResult && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                    <p className="text-sm font-medium text-emerald-900">Распознано по чеку</p>
                    <p className="text-sm text-emerald-800">
                      Сумма: <strong>{formatMoney(receiptParseResult.totalAmount)}</strong>
                    </p>
                    {receiptParseResult.items && receiptParseResult.items.length > 0 && (
                      <div className="text-xs text-emerald-800 bg-emerald-100/60 rounded p-2 space-y-1">
                        <p className="font-medium">По позициям:</p>
                        <ul className="space-y-0.5">
                          {receiptParseResult.items.map((row, i) => (
                            <li key={i}>
                              {row.name}
                              {row.quantity != null && row.quantity > 0 && (
                                <> — {row.quantity}{row.unit ? ` ${row.unit}` : ''}</>
                              )}
                              {row.unitPrice != null && row.unitPrice > 0 && (
                                <> × {formatMoney(row.unitPrice)}</>
                              )}
                              {row.lineTotal != null && row.lineTotal > 0 && (
                                <> = {formatMoney(row.lineTotal)}</>
                              )}
                            </li>
                          ))}
                        </ul>
                        {receiptParseResult.totalByItems != null && receiptParseResult.totalByItems > 0 && (
                          <p className="pt-1 border-t border-emerald-200 mt-1">
                            Итог по позициям: {formatMoney(receiptParseResult.totalByItems)}
                            {receiptParseResult.receiptTotal != null && receiptParseResult.receiptTotal > 0 && (
                              <> · По чеку: {formatMoney(receiptParseResult.receiptTotal)}</>
                            )}
                            {receiptParseResult.totalsMatch === false && (
                              <span className="text-amber-700 ml-1"> · расхождение</span>
                            )}
                            {receiptParseResult.totalsMatch === true && (
                              <span className="text-emerald-700 ml-1"> · совпадает</span>
                            )}
                          </p>
                        )}
                      </div>
                    )}
                    {(() => {
                      const structured =
                        receiptParseResult.structuredComment?.trim() ||
                        (receiptParseResult.items?.length
                          ? buildStructuredComment(
                              receiptParseResult.items,
                              receiptParseResult.receiptTotal ?? receiptParseResult.totalAmount
                            )
                          : '');
                      return structured ? (
                        <div className="text-xs text-emerald-800">
                          <p className="font-medium text-emerald-900">В комментарий будет записано:</p>
                          <pre className="mt-1 p-2 bg-white/70 rounded border border-emerald-200 whitespace-pre-wrap break-words font-sans text-emerald-800 max-h-32 overflow-y-auto">
                            {structured}
                          </pre>
                        </div>
                      ) : (
                        <p className="text-xs text-emerald-700 line-clamp-2" title={receiptParseResult.comment}>
                          Комментарий: {receiptParseResult.comment}
                        </p>
                      );
                    })()}
                    <p className="text-xs text-emerald-600">
                      Уверенность: {receiptParseResult.confidence === 'high' ? 'высокая' : receiptParseResult.confidence === 'medium' ? 'средняя' : 'низкая'}
                    </p>
                    {receiptParseResult.confidence === 'low' && (
                      <p className="text-xs text-amber-700">Проверьте сумму и комментарий вручную.</p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={applyReceiptResult}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        Применить
                      </button>
                      <button
                        type="button"
                        onClick={() => setReceiptParseResult(null)}
                        className="px-3 py-1.5 text-sm rounded-lg border border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
                {files.map((file, index) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-shrink-0 relative w-14 h-14 rounded-lg bg-gray-200 overflow-hidden flex items-center justify-center">
                      {file.file.type.startsWith('image/') && (file.previewUrl || file.url) ? (
                        <img
                          src={file.previewUrl || file.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <PaperclipIcon className="h-6 w-6 text-gray-500" />
                      )}
                      {file.status === 'uploading' && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg">
                          <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
                        </div>
                      )}
                      {file.status === 'uploaded' && (
                        <span className="absolute bottom-1 right-1 text-green-600 text-xs font-medium bg-white/90 px-1 rounded">✓</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 relative">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.file.name}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-gray-400 hover:text-gray-500 flex-shrink-0"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">
                        {(file.file.size / 1024).toFixed(1)} KB
                        {file.status === 'uploading' && ' · загрузка...'}
                        {file.status === 'uploaded' && ' · загружен'}
                        {file.status === 'error' && file.errorMessage && ` · ${file.errorMessage}`}
                      </p>
                      {(file.status === 'uploading' || file.status === 'pending') && file.progress > 0 && (
                        <div className="mt-1">
                          <div className="bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${file.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="text-sm text-red-500">{error}</div>
            )}
          </div>

          {/* Нижняя панель (mobile): скрепка, камера, отправка. pr-14 — safe-area от плавающего сайдбара (StickyNavigation) справа. */}
          <div
            className="flex-shrink-0 md:hidden flex items-center justify-end gap-3 p-3 pr-14 bg-white"
            style={{ borderTop: '1px solid #e5e7eb' }}
          >
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="p-2.5 text-gray-600 hover:text-gray-900 bg-gray-100 rounded-full transition-colors"
              aria-label="Камера"
            >
              <Camera className="h-5 w-5" />
            </button>
            <button
              type="button"
              {...getRootProps()}
              className="p-2.5 text-gray-600 hover:text-gray-900 bg-gray-100 rounded-full transition-colors"
            >
              <input {...getInputProps()} />
              <PaperclipIcon className="h-5 w-5" />
            </button>
            <button
              type="submit"
              disabled={loading || files.some(f => f.status === 'uploading' || f.status === 'pending')}
              className={`p-2.5 text-white rounded-full transition-colors
                ${loading || files.some(f => f.status === 'uploading' || f.status === 'pending')
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
                }`}
            >
              <SendHorizontal className="h-5 w-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
