import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CategoryCardType } from '../../../types';
import { transferFunds } from '../../../lib/firebase/transactions';
import {
  createExpenseCategory,
  updateExpenseCategory,
  ensureDefaultExpenseCategory,
  ensureFuelExpenseCategory,
  DEFAULT_EXPENSE_CATEGORY_NAME,
  FUEL_EXPENSE_CATEGORY_NAME
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
import { useAIConfigured } from '../../../hooks/useAIConfigured';
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
  const { configured: aiConfigured, loading: aiLoading } = useAIConfigured();
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
  const hasSetFuelCategoryForOpen = useRef(false);
  const hasSetDefaultCommentForOpen = useRef(false);
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

  /** Результат распознавания фото для формы «Заправка»: сумма, пробег, литры, АЗС и т.д. */
  const [fuelReceiptParseResult, setFuelReceiptParseResult] = useState<{
    totalAmount?: number;
    odometerKm?: number;
    liters?: number;
    pricePerLiter?: number;
    gasStation?: string | null;
    fuelType?: string | null;
    confidence: 'high' | 'medium' | 'low';
    odometerConfidence?: 'high' | 'medium' | 'low';
    amountConfidence?: 'high' | 'medium' | 'low';
  } | null>(null);

  /** Редактируемые значения перед применением распознанного чека (только для «Заправка»). */
  const [editableFuelParse, setEditableFuelParse] = useState<{
    amount: string;
    odometerKm: string;
    liters: string;
    pricePerLiter: string;
    gasStation: string;
    fuelType: string;
  } | null>(null);

  /** URL изображения для полноэкранного просмотра (чек/фото). */
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const isFuelTransfer = targetCategory.title === 'Заправка';

  const VEHICLES: { id: string; name: string }[] = [
    { id: 'sprinter-1', name: 'Sprinter 1' },
    { id: 'sprinter-2', name: 'Sprinter 2' }
  ];

  const [vehicleId, setVehicleId] = useState<string>('');
  const [odometerKm, setOdometerKm] = useState<string>('');
  const [liters, setLiters] = useState<string>('');
  const [pricePerLiter, setPricePerLiter] = useState<string>('');
  const [fuelType, setFuelType] = useState<string>('ДТ');
  const [gasStation, setGasStation] = useState<string>('');
  const [isFullTank, setIsFullTank] = useState<boolean>(false);

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

  // Для формы «Заправка»: чекбокс «Полный бак» включён по умолчанию при каждом открытии
  useEffect(() => {
    if (isOpen && targetCategory.title === 'Заправка') {
      setIsFullTank(true);
    }
  }, [isOpen, targetCategory?.title]);

  // Для формы «Заправка»: при первом открытии подставить комментарий «Заправка», если поле пустое
  useEffect(() => {
    if (!isOpen) {
      hasSetDefaultCommentForOpen.current = false;
      return;
    }
    if (targetCategory.title !== 'Заправка') return;
    if (hasSetDefaultCommentForOpen.current) return;
    hasSetDefaultCommentForOpen.current = true;
    setDescription((prev) => (prev.trim() === '' ? 'Заправка' : prev));
  }, [isOpen, targetCategory?.title]);

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

  // Для формы «Заправка»: автоматически подставляем категорию расхода «Заправка» (находим в справочнике или создаём один раз)
  useEffect(() => {
    if (!isOpen) {
      hasSetFuelCategoryForOpen.current = false;
      return;
    }
    if (!isFuelTransfer || !user?.uid) return;
    if (hasSetFuelCategoryForOpen.current) return;
    hasSetFuelCategoryForOpen.current = true;
    const fuel = expenseCategories.find((c) => c.name === FUEL_EXPENSE_CATEGORY_NAME);
    if (fuel) {
      setExpenseCategoryId(fuel.id);
      return;
    }
    ensureFuelExpenseCategory(user.uid).then((id) => {
      setExpenseCategoryId(id);
    }).catch((err) => {
      console.error('ensureFuelExpenseCategory:', err);
      hasSetFuelCategoryForOpen.current = false;
    });
  }, [isOpen, isFuelTransfer, user?.uid, expenseCategories]);

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
    setFuelReceiptParseResult(null);
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
        reader.readAsDataURL(firstUploadedImage.file);
      });
      const token = await getAuthToken();
      const body = isFuelTransfer
        ? { imageDataUrl: dataUrl, mode: 'fuel' as const }
        : { imageDataUrl: dataUrl };
      const res = await fetch('/.netlify/functions/ai-receipt-parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'Ошибка распознавания чека');
        return;
      }
      if (isFuelTransfer) {
        const hasAny = data.totalAmount != null || data.odometerKm != null || data.liters != null ||
          data.gasStation != null || data.fuelType != null;
        if (!hasAny) {
          setError('Не удалось распознать данные с фото. Проверьте сумму и пробег вручную.');
          return;
        }
        setFuelReceiptParseResult({
          totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : undefined,
          odometerKm: typeof data.odometerKm === 'number' ? data.odometerKm : undefined,
          liters: typeof data.liters === 'number' ? data.liters : undefined,
          pricePerLiter: typeof data.pricePerLiter === 'number' ? data.pricePerLiter : undefined,
          gasStation: data.gasStation != null ? String(data.gasStation).trim() || null : null,
          fuelType: data.fuelType != null ? String(data.fuelType).trim() || null : null,
          confidence: ['high', 'medium', 'low'].includes(data.confidence) ? data.confidence : 'medium',
          odometerConfidence: ['high', 'medium', 'low'].includes(data.odometerConfidence) ? data.odometerConfidence : undefined,
          amountConfidence: ['high', 'medium', 'low'].includes(data.amountConfidence) ? data.amountConfidence : undefined,
        });
      } else {
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
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка при распознавании чека');
    } finally {
      setReceiptParseLoading(false);
    }
  }, [firstUploadedImage, isFuelTransfer]);

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

  /** Применить (отредактированные) значения распознанного чека в форму «Заправка». Использует editableFuelParse, если есть. */
  const applyEditedFuelParse = useCallback(() => {
    if (!editableFuelParse) return;
    const a = editableFuelParse.amount.trim();
    if (a) setAmount(formatNumber(a));
    if (editableFuelParse.odometerKm.trim()) setOdometerKm(editableFuelParse.odometerKm.trim());
    if (editableFuelParse.liters.trim()) setLiters(editableFuelParse.liters.trim());
    if (editableFuelParse.pricePerLiter.trim()) setPricePerLiter(editableFuelParse.pricePerLiter.trim());
    if (editableFuelParse.gasStation.trim()) setGasStation(editableFuelParse.gasStation.trim());
    if (editableFuelParse.fuelType.trim()) setFuelType(editableFuelParse.fuelType.trim());
    setFuelReceiptParseResult(null);
    setEditableFuelParse(null);
    showSuccessNotification('Поля заправки заполнены');
  }, [editableFuelParse]);

  useEffect(() => {
    if (!isOpen) return;
    submittedSuccessRef.current = false;
  }, [isOpen]);

  // Синхронизация редактируемых полей с результатом распознавания (Заправка)
  useEffect(() => {
    if (!fuelReceiptParseResult) {
      setEditableFuelParse(null);
      return;
    }
    const r = fuelReceiptParseResult;
    setEditableFuelParse({
      amount: r.totalAmount != null ? String(Math.round(r.totalAmount)) : '',
      odometerKm: r.odometerKm != null ? String(r.odometerKm) : '',
      liters: r.liters != null ? String(r.liters) : '',
      pricePerLiter: r.pricePerLiter != null ? String(r.pricePerLiter) : '',
      gasStation: r.gasStation ?? '',
      fuelType: r.fuelType ?? '',
    });
  }, [fuelReceiptParseResult]);

  useEffect(() => {
    if (isOpen) return;
    setReceiptParseResult(null);
    setFuelReceiptParseResult(null);
    setEditableFuelParse(null);
    setImagePreviewUrl(null);
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
    if (isFuelTransfer) {
      if (!vehicleId) {
        setError('Выберите транспорт для заправки');
        return;
      }
      const odo = odometerKm.trim();
      const odoNum = odo ? Number(odo.replace(',', '.')) : NaN;
      if (!odo || !Number.isFinite(odoNum) || odoNum < 0) {
        setError('Укажите пробег на одометре (км)');
        return;
      }
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

      let fuelData;
      if (isFuelTransfer) {
        const odoNum = Number(odometerKm.trim().replace(',', '.'));
        const litersNum = liters.trim() ? Number(liters.trim().replace(',', '.')) : null;
        const priceNum = pricePerLiter.trim() ? Number(pricePerLiter.trim().replace(',', '.')) : null;
        const vehicle = VEHICLES.find(v => v.id === vehicleId);
        fuelData = {
          vehicleId,
          vehicleName: vehicle?.name ?? vehicleId,
          odometerKm: odoNum,
          liters: litersNum,
          pricePerLiter: priceNum,
          fuelType: fuelType || null,
          gasStation: gasStation.trim() || null,
          isFullTank,
          receiptRecognized: false,
          receiptFileUrl: uploadedOnly[0]?.url ?? null,
          receiptRef: uploadedOnly[0]?.path ?? null,
          recognizedAt: null,
          recognizedSource: 'manual' as const,
          derivedFuelStats: null
        };
      }

      if (!companyId) return;
      const effectiveExpenseCategoryId = showExpenseCategory
        ? expenseCategoryId || undefined
        : isFuelTransfer && user?.uid
          ? (expenseCategoryId || await ensureFuelExpenseCategory(user.uid))
          : undefined;
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
        expenseCategoryId: effectiveExpenseCategoryId,
        needsReview,
        fuelData,
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
          <div className={`flex-1 overflow-y-auto flex flex-col min-h-0 ${isFuelTransfer ? 'p-4 md:p-5 space-y-3' : 'p-6 space-y-6'}`}>
          {/* Верхний блок: для мобильной «Заправка» — одна компактная строка (От | баланс | Кому) без подписи «Текущий баланс» */}
          <div className={`space-y-1 pb-2 ${isFuelTransfer ? 'mb-2' : 'mb-6'}`}>
            {isFuelTransfer ? (
              <>
                <div className="flex items-center justify-between gap-2 text-sm flex-wrap">
                  <span className="text-gray-600 shrink-0">От: {sourceCategory.title}</span>
                  <span className={balanceValue < 0 ? 'text-red-500 font-medium' : 'text-green-600 font-medium'} aria-label="Баланс">
                    {balanceValue < 0 ? `−${formatMoney(Math.abs(balanceValue))}` : formatMoney(balanceValue)}
                  </span>
                  <span className="text-gray-600 shrink-0">Кому: {targetCategory.title}</span>
                </div>
                <div className="hidden md:block text-sm text-gray-500">
                  Текущий баланс:{' '}
                  <span className={balanceValue < 0 ? 'text-red-500' : 'text-green-600'}>
                    {balanceValue < 0 ? `−${formatMoney(Math.abs(balanceValue))}` : formatMoney(balanceValue)}
                  </span>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>

            {isFuelTransfer ? (
              /* Форма «Заправка»: 3 блока, на desktop — 2 колонки */
              <div className="grid md:grid-cols-2 gap-4 md:gap-5 md:items-start">
                {/* Левая колонка (desktop): Основное + Комментарий. На mobile: сумма первая, затем одна строка Пробег + Транспорт, заголовок «Основное» скрыт. */}
                <div className="space-y-3 md:space-y-4">
                  <div>
                    <p className="hidden md:block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Основное</p>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Сумма перевода</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={amount}
                          onChange={handleAmountChange}
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="1 000 000"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
                        <div className="md:order-2">
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Пробег, км <span className="text-red-500">*</span></label>
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={odometerKm}
                            onChange={(e) => setOdometerKm(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="км"
                          />
                        </div>
                        <div className="md:order-1">
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Транспорт <span className="text-red-500">*</span></label>
                          <select
                            value={vehicleId}
                            onChange={(e) => setVehicleId(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Машина</option>
                            {VEHICLES.map((v) => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-0.5">Комментарий</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[60px] md:min-h-[56px] resize-y"
                      placeholder="Назначение перевода"
                      rows={2}
                    />
                    {needsReview && (
                      <p className="mt-1 text-xs text-amber-700">Контролер проверит категорию.</p>
                    )}
                  </div>
                </div>

                {/* Правая колонка (desktop): Данные по топливу + Чек */}
                <div className="space-y-3 md:space-y-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Данные по топливу</p>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Литры</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            inputMode="decimal"
                            value={liters}
                            onChange={(e) => setLiters(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Л"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Цена/л</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            inputMode="decimal"
                            value={pricePerLiter}
                            onChange={(e) => setPricePerLiter(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="₸"
                          />
                        </div>
                      </div>
                      {/* Desktop: Тип топлива | Полный бак, затем АЗС. Mobile: одна строка Тип топлива | АЗС, Полный бак перенесён в нижние чекбоксы */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Тип топлива</label>
                          <select
                            value={fuelType}
                            onChange={(e) => setFuelType(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="ДТ">ДТ</option>
                            <option value="АИ-92">АИ-92</option>
                            <option value="АИ-95">АИ-95</option>
                            <option value="Газ">Газ</option>
                          </select>
                        </div>
                        <div className="hidden md:flex items-end pb-1">
                          <label className="flex items-center gap-1.5 text-xs text-gray-600">
                            <input
                              id="fuel-full-tank-desktop"
                              type="checkbox"
                              checked={isFullTank}
                              onChange={(e) => setIsFullTank(e.target.checked)}
                              className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded"
                            />
                            Полный бак
                          </label>
                        </div>
                        <div className="md:hidden">
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">АЗС</label>
                          <input
                            type="text"
                            value={gasStation}
                            onChange={(e) => setGasStation(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Название АЗС"
                          />
                        </div>
                      </div>
                      <div className="hidden md:block">
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">АЗС</label>
                        <input
                          type="text"
                          value={gasStation}
                          onChange={(e) => setGasStation(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Название АЗС"
                        />
                      </div>
                    </div>
                  </div>
                  {/* На mobile скрыт: нижняя панель уже даёт камеру и прикрепление; на desktop — блок «Чек» с зоной загрузки */}
                  <div className="hidden md:block">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Чек</p>
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={files.length >= MAX_FILES}
                        className="p-1.5 text-gray-500 hover:text-gray-700 rounded border border-gray-300 hover:border-gray-400 transition-colors disabled:opacity-50"
                        title="Камера"
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                    </div>
                    <div
                      {...getRootProps()}
                      className={`border border-dashed rounded-md cursor-pointer transition-colors p-2.5 text-center
                        ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
                        ${files.length > 0 ? 'hidden' : ''}`}
                    >
                      <input {...getInputProps()} />
                      <PaperclipIcon className="h-5 w-5 text-gray-400 mx-auto mb-0.5" />
                      <p className="text-xs text-gray-500">Файл или фото чека</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Обычная форма переводов */
              <>
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
              </>
            )}

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

            {/* Чекбоксы: для «Заправка» скрываем ЗП; Безнал/Треб.ут. — компактно в «Дополнительно» */}
            {!isFuelTransfer && (
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
            )}
            {isFuelTransfer && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                <span className="text-gray-500 hidden md:inline">Дополнительно:</span>
                <label className="flex items-center gap-1.5 md:hidden">
                  <input
                    id="fuel-full-tank-mobile"
                    type="checkbox"
                    checked={isFullTank}
                    onChange={(e) => setIsFullTank(e.target.checked)}
                    className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded"
                  />
                  <span>Полный бак</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={isCashless}
                    onChange={(e) => {
                      userTouchedCashlessRef.current = true;
                      setIsCashless(e.target.checked);
                    }}
                    className="h-3.5 w-3.5 text-purple-600 border-gray-300 rounded"
                  />
                  <span>Безнал</span>
                </label>
                <label className="flex items-center gap-1.5" title="Требует уточнения">
                  <input
                    type="checkbox"
                    checked={needsReview}
                    onChange={(e) => setNeedsReview(e.target.checked)}
                    className="h-3.5 w-3.5 text-amber-500 border-gray-300 rounded"
                  />
                  <span>Треб. ут.</span>
                </label>
              </div>
            )}

            {/* Десктопная версия: для «Заправка» только кнопка отправки; для остальных — блок прикрепления + кнопка */}
            <div className="hidden md:block">
              {!isFuelTransfer && (
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
                    <div className="flex flex-col items-center justify-center">
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
                  </div>
                </div>
              )}

              <div className="hidden md:flex justify-end items-center gap-2 mt-2">
                {files.length > 0 && (
                  <button
                    type="button"
                    onClick={fillFromReceipt}
                    disabled={receiptParseLoading || (aiLoading === false && aiConfigured === false)}
                    title={aiConfigured === false && !aiLoading ? 'Подключите AI в Интеграциях' : 'Заполнить по чеку'}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {receiptParseLoading ? (
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full" />
                    ) : (
                      <ScanLine className="h-4 w-4" />
                    )}
                    Зап. по чеку
                  </button>
                )}
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
              <div className={isFuelTransfer ? 'space-y-1.5' : 'space-y-2'}>
                {editableFuelParse && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-3">
                    <p className="text-sm font-medium text-blue-900">Распознано по фото</p>
                    <p className="text-xs text-blue-700">Проверьте и при необходимости измените значения перед применением.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Сумма, ₸</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editableFuelParse.amount}
                          onChange={(e) => setEditableFuelParse((prev) => prev ? { ...prev, amount: e.target.value } : null)}
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Пробег, км</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editableFuelParse.odometerKm}
                          onChange={(e) => setEditableFuelParse((prev) => prev ? { ...prev, odometerKm: e.target.value } : null)}
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Литры</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editableFuelParse.liters}
                          onChange={(e) => setEditableFuelParse((prev) => prev ? { ...prev, liters: e.target.value } : null)}
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">Цена/л, ₸</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editableFuelParse.pricePerLiter}
                          onChange={(e) => setEditableFuelParse((prev) => prev ? { ...prev, pricePerLiter: e.target.value } : null)}
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-0.5">АЗС</label>
                        <input
                          type="text"
                          value={editableFuelParse.gasStation}
                          onChange={(e) => setEditableFuelParse((prev) => prev ? { ...prev, gasStation: e.target.value } : null)}
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                          placeholder="Название АЗС"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={applyEditedFuelParse}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Применить
                      </button>
                      <button
                        type="button"
                        onClick={() => { setFuelReceiptParseResult(null); setEditableFuelParse(null); }}
                        className="px-3 py-1.5 text-sm rounded-lg border border-blue-300 text-blue-800 hover:bg-blue-100"
                      >
                        Отмена
                      </button>
                    </div>
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
                {files.map((file, index) => {
                  const imageUrl = file.file.type.startsWith('image/') ? (file.previewUrl || file.url) : null;
                  return (
                  <div
                    key={file.id}
                    className={`flex items-center gap-2 bg-gray-50 ${isFuelTransfer ? 'p-2 rounded-md' : 'p-3 rounded-lg'}`}
                  >
                    <div
                      className={`flex-shrink-0 relative bg-gray-200 overflow-hidden flex items-center justify-center cursor-pointer ${isFuelTransfer ? 'w-10 h-10 rounded-md' : 'w-14 h-14 rounded-lg'} ${imageUrl ? 'ring-1 ring-gray-300 hover:ring-blue-400' : ''}`}
                      onClick={imageUrl ? () => setImagePreviewUrl(imageUrl) : undefined}
                      role={imageUrl ? 'button' : undefined}
                      aria-label={imageUrl ? 'Открыть в полном размере' : undefined}
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
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
                        <p
                          className={`font-medium text-gray-900 truncate ${isFuelTransfer ? 'text-xs' : 'text-sm'} ${imageUrl ? 'cursor-pointer hover:text-blue-600' : ''}`}
                          onClick={imageUrl ? () => setImagePreviewUrl(imageUrl) : undefined}
                          role={imageUrl ? 'button' : undefined}
                          title={imageUrl ? 'Открыть в полном размере' : undefined}
                        >
                          {file.file.name}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-gray-400 hover:text-gray-500 flex-shrink-0"
                        >
                          <XMarkIcon className={isFuelTransfer ? 'h-4 w-4' : 'h-5 w-5'} />
                        </button>
                      </div>
                      <p className={`text-gray-500 ${isFuelTransfer ? 'text-[11px]' : 'text-xs'}`}>
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
                  );
                })}
              </div>
            )}

            {error && (
              <div className="text-sm text-red-500">{error}</div>
            )}
          </div>

          {/* Нижняя панель (mobile): камера, скрепка, при наличии файла — «Зап. по чеку», отправка. pr-14 — safe-area от плавающего сайдбара. */}
          <div
            className={`flex-shrink-0 md:hidden flex items-center justify-end gap-2 p-2.5 pr-14 border-t border-gray-200 ${isFuelTransfer ? 'bg-gray-50' : 'bg-white'}`}
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
            {files.length > 0 && (
              <button
                type="button"
                onClick={fillFromReceipt}
                disabled={receiptParseLoading || (aiLoading === false && aiConfigured === false)}
                title={aiConfigured === false && !aiLoading ? 'Подключите AI в Интеграциях' : 'Заполнить по чеку'}
                aria-label="Заполнить по чеку"
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-full text-xs font-medium border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                {receiptParseLoading ? (
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full" />
                ) : (
                  <ScanLine className="h-4 w-4 shrink-0" />
                )}
                <span>Зап. по чеку</span>
              </button>
            )}
            <button
              type="submit"
              disabled={loading || files.some(f => f.status === 'uploading' || f.status === 'pending')}
              className={`p-2.5 text-white rounded-full transition-colors shrink-0
                ${loading || files.some(f => f.status === 'uploading' || f.status === 'pending')
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
                }`}
            >
              <SendHorizontal className="h-5 w-5" />
            </button>
          </div>
        </form>

        {/* Полноэкранный просмотр прикреплённого изображения (чек/фото) */}
        {imagePreviewUrl && (
          <div
            className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setImagePreviewUrl(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Просмотр изображения"
          >
            <button
              type="button"
              onClick={() => setImagePreviewUrl(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
              aria-label="Закрыть"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            <img
              src={imagePreviewUrl}
              alt="Чек"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    </div>
  );
};
