import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { ArrowLeft, ArrowDownRight, ArrowUpRight, FileText, Search, X, Calendar, Filter, Download, Lock, Unlock, Pencil, Receipt } from 'lucide-react';
import { formatTime } from '../utils/dateUtils';
import { WaybillModal } from '../components/waybills/WaybillModal';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCurrentCompanyUser } from '../hooks/useCurrentCompanyUser';
import { useAIConfigured } from '../hooks/useAIConfigured';
import { exportFeedToExcel } from '../utils/exportFeedToExcel';
import { showErrorNotification, showSuccessNotification } from '../utils/notifications';
import { useFeedPaginated } from '../hooks/useFeedPaginated';
import { API_CONFIG } from '../config/api';
import { useCategories } from '../hooks/useCategories';
import { useExpenseCategories } from '../hooks/useExpenseCategories';
import { CategoryCardType } from '../types';
import {
  editFeedTransaction,
  approveTransaction,
  rejectTransaction,
  secureDeleteTransaction,
  canDeleteTransaction,
  deleteTransaction
} from '../lib/firebase/transactions';
import { useSwipeable } from 'react-swipeable';
import { DeletePasswordModal } from '../components/transactions/DeletePasswordModal';
import { useMobileSidebar } from '../contexts/MobileSidebarContext';
import { Menu } from 'lucide-react';
import { HeaderSearchBar } from '../components/HeaderSearchBar';
import { AttachmentViewerModal } from '../components/AttachmentViewerModal';
import { TransactionCard } from '../components/transactions/TransactionCard';
import {
  VirtualizedTransactionsList,
  buildFlattenedRowsFromGrouped,
  type VirtualizedRow
} from '../components/transactions/VirtualizedTransactionsList';
import { UpdateCommentByReceiptModal } from '../components/transactions/UpdateCommentByReceiptModal';
import type { TransactionCardTransaction } from '../components/transactions/TransactionCard';
import { FeedFiltersPanel } from '../components/feed/FeedFiltersPanel';
import { FeedFilterChips } from '../components/feed/FeedFilterChips';

const EXPORT_PAGE_SIZE = 500;
const LARGE_EXPORT_WARNING_THRESHOLD = 20000;

/** Нормализует дату транзакции из API (строка → { seconds, nanoseconds }) */
function normalizeTransactionForExport(t: Record<string, unknown>): Record<string, unknown> {
  if (t.date && typeof t.date === 'string') {
    const ms = new Date(t.date).getTime();
    return { ...t, date: { seconds: Math.floor(ms / 1000), nanoseconds: 0 } };
  }
  return t;
}

/**
 * Загружает все транзакции за период пагинированными запросами к API.
 * Без выбранных дат (allPeriod) запрашивает все транзакции.
 * Если передан entityId — только транзакции выбранной сущности (проект/клиент/иконка или "general").
 */
async function fetchAllTransactionsForExport(
  params: {
    dateFrom?: string | null;
    dateTo?: string | null;
    allPeriod: boolean;
    entityId?: string | null;
  },
  onProgress?: (count: number) => void
): Promise<Transaction[]> {
  const base = (API_CONFIG.BASE_URL || '').replace(/\/$/, '');
  const allTransactions: Transaction[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const searchParams = new URLSearchParams();
    searchParams.set('limit', String(EXPORT_PAGE_SIZE));
    searchParams.set('offset', String(offset));
    if (params.entityId) {
      searchParams.set('entityId', params.entityId);
    }
    if (!params.allPeriod) {
      if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
      if (params.dateTo) searchParams.set('dateTo', params.dateTo);
    }
    const url = `${base}/transactions?${searchParams.toString()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Ошибка загрузки данных: ${response.status}`);
    const data = await response.json();
    const list = Array.isArray(data) ? data : (data.data ?? data.items ?? []);
    list.forEach((item: Record<string, unknown>) => {
      allTransactions.push(normalizeTransactionForExport(item) as Transaction);
    });
    onProgress?.(allTransactions.length);
    if (list.length < EXPORT_PAGE_SIZE) hasMore = false;
    else offset += EXPORT_PAGE_SIZE;
  }
  return allTransactions;
}

interface Transaction {
  id: string;
  fromUser: string;
  toUser: string;
  amount: number;
  description: string;
  date: {
    seconds: number;
    nanoseconds: number;
  };
  type: 'income' | 'expense';
  categoryId: string;
  expenseCategoryId?: string;
  waybillId?: string;
  waybillType?: 'income' | 'expense';
  waybillNumber?: string;
  waybillData?: {
    documentNumber: string;
    date: any;
    supplier?: string;
    project?: string;
    note: string;
    items: Array<{
      product: {
        name: string;
        unit: string;
      };
      quantity: number;
      price: number;
    }>;
  };
  editType?: 'reversal' | 'correction';
  reversalOf?: string;
  correctedFrom?: string;
  status?: 'pending' | 'approved' | 'rejected';
  needsReview?: boolean;
  isSalary?: boolean;
  isCashless?: boolean;
  attachments?: Array<{ name: string; url: string; type: string }>;
  reversedAt?: unknown;
}

interface WaybillData {
  documentNumber: string;
  date: any;
  supplier: string;
  project?: string;
  note: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    unit: string;
  }>;
}

export const Feed: React.FC = () => {
  console.log('Feed mounted');
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { categories, employeeCategories, projectCategories, visibleCategories } = useCategories();
  const { categories: expenseCategories } = useExpenseCategories(user?.uid);
  const expenseCategoryById = useMemo(() => {
    const m = new Map<string, { name: string; color?: string }>();
    expenseCategories.forEach((c) => m.set(c.id, { name: c.name, color: c.color }));
    return m;
  }, [expenseCategories]);

  const approvedEmails: string[] = useMemo(
    () =>
      (import.meta.env.VITE_APPROVED_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    []
  );

  const { companyUser } = useCurrentCompanyUser();
  const { configured: aiConfigured } = useAIConfigured();
  const isTrustedForApproval = useMemo(() => {
    const email = user?.email || '';
    const byEmail = !!email && approvedEmails.includes(email.toLowerCase());
    const byGlobalAdmin = user?.role === 'global_admin';
    const byOwner = companyUser?.role === 'owner';
    const byPermission = companyUser?.permissions?.approveTransactions === true;
    const canModerate = byEmail || byGlobalAdmin || byOwner || byPermission;
    if (import.meta.env.DEV) {
      console.log('[Feed] CAN MODERATE (Одобрить/Отклонить):', canModerate, { byEmail, byGlobalAdmin, byOwner, byPermission });
    }
    return canModerate;
  }, [user?.email, user?.role, approvedEmails, companyUser?.role, companyUser?.permissions?.approveTransactions]);

  /** Синхронная проверка для отображения кнопки удаления в списке (без запроса в БД). */
  const canShowDeleteForTransaction = useCallback(
    (t: { companyId?: string }) =>
      !!(
        user?.role === 'global_admin' ||
        user?.role === 'superAdmin' ||
        user?.role === 'admin' ||
        (companyUser?.role === 'owner' && t.companyId === companyUser?.companyId)
      ),
    [user?.role, companyUser?.role, companyUser?.companyId]
  );

  const { toggle: toggleMobileSidebar } = useMobileSidebar();
  
  // Используем оптимизированный хук для пагинированной загрузки
  const {
    transactions: paginatedTransactions,
    loading: paginatedLoading,
    loadingMore: paginatedLoadingMore,
    hasMore,
    loadMore,
    totalCount,
    refresh,
    patchTransaction
  } = useFeedPaginated({
    defaultDays: 60,
    enabled: !!user && !authLoading
  });

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggeredRef = useRef(false);
  useEffect(() => {
    if (!hasMore || paginatedLoading || paginatedLoadingMore || !loadMore) return;
    const el = loadMoreSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [e] = entries;
        if (!e?.isIntersecting || loadMoreTriggeredRef.current) return;
        loadMoreTriggeredRef.current = true;
        loadMore().finally(() => {
          loadMoreTriggeredRef.current = false;
        });
      },
      { rootMargin: '200px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, paginatedLoading, paginatedLoadingMore, loadMore]);

  const [selectedWaybill, setSelectedWaybill] = useState<WaybillData | null>(null);
  const [showWaybill, setShowWaybill] = useState(false);
  const [waybillType, setWaybillType] = useState<'income' | 'expense'>('expense');
  const [receiptView, setReceiptView] = useState<{ url: string; type: string; name?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      const s = localStorage.getItem('feed-filters');
      if (s) return (JSON.parse(s)?.searchQuery as string) ?? '';
    } catch (_) {}
    return '';
  });
  const [showSearch, setShowSearch] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>(() => {
    if (typeof window === 'undefined') return { start: null, end: null };
    try {
      const s = localStorage.getItem('feed-filters');
      if (s) {
        const p = JSON.parse(s);
        const start = p?.dateFrom ? new Date(p.dateFrom) : null;
        const end = p?.dateTo ? new Date(p.dateTo) : null;
        if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) return { start, end };
      }
    } catch (_) {}
    return { start: null, end: null };
  });
  const [showFilters, setShowFilters] = useState(false);
  const [minAmount, setMinAmount] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const s = localStorage.getItem('feed-filters');
      if (s) return (JSON.parse(s)?.minAmount as string) ?? '';
    } catch (_) {}
    return '';
  });
  const [maxAmount, setMaxAmount] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const s = localStorage.getItem('feed-filters');
      if (s) return (JSON.parse(s)?.maxAmount as string) ?? '';
    } catch (_) {}
    return '';
  });

  const FEED_FILTERS_STORAGE_KEY = 'feed-filters';
  type FilterType = 'all' | 'income' | 'expense' | 'transfer' | 'correction';
  const [filterType, setFilterType] = useState<FilterType>(() => {
    if (typeof window === 'undefined') return 'all';
    try {
      const s = localStorage.getItem(FEED_FILTERS_STORAGE_KEY);
      if (s) {
        const p = JSON.parse(s);
        if (['all', 'income', 'expense', 'transfer', 'correction'].includes(p?.filterType)) return p.filterType;
      }
    } catch (_) {}
    return 'all';
  });
  const [filterUser, setFilterUser] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const s = localStorage.getItem(FEED_FILTERS_STORAGE_KEY);
      if (s) return (JSON.parse(s)?.filterUser as string) ?? '';
    } catch (_) {}
    return '';
  });
  const [filterCategoryId, setFilterCategoryId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const s = localStorage.getItem(FEED_FILTERS_STORAGE_KEY);
      if (s) return (JSON.parse(s)?.filterCategoryId as string) ?? '';
    } catch (_) {}
    return '';
  });
  const [filterExpenseCategoryId, setFilterExpenseCategoryId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const s = localStorage.getItem(FEED_FILTERS_STORAGE_KEY);
      if (s) return (JSON.parse(s)?.filterExpenseCategoryId as string) ?? '';
    } catch (_) {}
    return '';
  });
  const [filterNeedsReview, setFilterNeedsReview] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const s = localStorage.getItem(FEED_FILTERS_STORAGE_KEY);
      if (s) return !!JSON.parse(s)?.filterNeedsReview;
    } catch (_) {}
    return false;
  });
  const [filterCorrection, setFilterCorrection] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const s = localStorage.getItem(FEED_FILTERS_STORAGE_KEY);
      if (s) return !!JSON.parse(s)?.filterCorrection;
    } catch (_) {}
    return false;
  });
  const [filterApproved, setFilterApproved] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const s = localStorage.getItem(FEED_FILTERS_STORAGE_KEY);
      if (s) return !!JSON.parse(s)?.filterApproved;
    } catch (_) {}
    return false;
  });
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);

  const saveFiltersToStorage = useCallback(() => {
    try {
      localStorage.setItem(
        FEED_FILTERS_STORAGE_KEY,
        JSON.stringify({
          filterType,
          filterUser,
          filterCategoryId,
          filterExpenseCategoryId,
          minAmount: minAmount || undefined,
          maxAmount: maxAmount || undefined,
          filterNeedsReview,
          filterCorrection,
          filterApproved,
          searchQuery: searchQuery || undefined,
          dateFrom: dateRange.start?.toISOString(),
          dateTo: dateRange.end?.toISOString()
        })
      );
    } catch (_) {}
  }, [filterType, filterUser, filterCategoryId, filterExpenseCategoryId, minAmount, maxAmount, filterNeedsReview, filterCorrection, filterApproved, searchQuery, dateRange.start, dateRange.end]);
  useEffect(() => {
    saveFiltersToStorage();
  }, [saveFiltersToStorage]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFromDate, setExportFromDate] = useState<string>('');
  const [exportToDate, setExportToDate] = useState<string>('');
  const [exportAllPeriod, setExportAllPeriod] = useState(false);
  const [exportError, setExportError] = useState<string>('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [pendingLargeExport, setPendingLargeExport] = useState<{
    transactions: Transaction[];
    fromDate: Date | null;
    toDate: Date | null;
    allPeriod: boolean;
    currentFilters: { searchQuery?: string; minAmount?: string; maxAmount?: string };
  } | null>(null);

  const [editMode, setEditMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem('feed-edit-mode') === 'true';
  });
  const [showEditPasswordModal, setShowEditPasswordModal] = useState(false);
  const [editPassword, setEditPassword] = useState('');
  const [editPasswordError, setEditPasswordError] = useState<string>('');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    // Ждем завершения проверки авторизации
    if (authLoading) {
      return;
    }

    // Если пользователь не авторизован, перенаправляем на логин
    if (!user) {
      navigate('/login');
      return;
    }
  }, [user, authLoading, navigate]);


  // ВСЕ ХУКИ ДОЛЖНЫ БЫТЬ ДО УСЛОВНЫХ RETURN
  const filteredTransactions = useMemo(() => {
    return paginatedTransactions.filter((transaction) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery.trim() ||
        transaction.fromUser.toLowerCase().includes(searchLower) ||
        transaction.toUser.toLowerCase().includes(searchLower) ||
        transaction.description.toLowerCase().includes(searchLower) ||
        (transaction.waybillNumber && transaction.waybillNumber.toLowerCase().includes(searchLower)) ||
        (transaction.waybillData?.project && String(transaction.waybillData.project).toLowerCase().includes(searchLower)) ||
        Math.abs(transaction.amount).toString().includes(searchQuery);

      const transactionDate = new Date(transaction.date.seconds * 1000);
      const matchesDateRange =
        (!dateRange.start || transactionDate >= dateRange.start) && (!dateRange.end || transactionDate <= dateRange.end);

      const amount = Math.abs(transaction.amount);
      const matchesAmountRange =
        (!minAmount || amount >= Number(minAmount)) && (!maxAmount || amount <= Number(maxAmount));

      const matchesType =
        filterType === 'all' ||
        (filterType === 'income' && transaction.type === 'income') ||
        (filterType === 'expense' && transaction.type === 'expense') ||
        (filterType === 'transfer' && transaction.type === 'income') ||
        (filterType === 'correction' && transaction.editType === 'correction');

      const matchesUser =
        !filterUser.trim() ||
        transaction.fromUser === filterUser ||
        transaction.toUser === filterUser;

      const catTitle = visibleCategories.find((c) => c.id === filterCategoryId)?.title;
      const matchesCategoryByTitle =
        !filterCategoryId ||
        transaction.categoryId === filterCategoryId ||
        transaction.toUser === catTitle ||
        transaction.fromUser === catTitle;

      const matchesExpenseCategory =
        !filterExpenseCategoryId || transaction.expenseCategoryId === filterExpenseCategoryId;

      const matchesNeedsReview = !filterNeedsReview || !!transaction.needsReview;
      const matchesCorrection = !filterCorrection || transaction.editType === 'correction';
      const matchesApproved = !filterApproved || transaction.status === 'approved';

      return (
        matchesSearch &&
        matchesDateRange &&
        matchesAmountRange &&
        matchesType &&
        matchesUser &&
        matchesCategoryByTitle &&
        matchesExpenseCategory &&
        matchesNeedsReview &&
        matchesCorrection &&
        matchesApproved
      );
    });
  }, [
    paginatedTransactions,
    searchQuery,
    dateRange,
    minAmount,
    maxAmount,
    filterType,
    filterUser,
    filterCategoryId,
    filterExpenseCategoryId,
    filterNeedsReview,
    filterCorrection,
    filterApproved,
    visibleCategories
  ]);

  const uniqueUserNames = useMemo(() => {
    const set = new Set<string>();
    paginatedTransactions.forEach((t) => {
      if (t.fromUser) set.add(t.fromUser);
      if (t.toUser) set.add(t.toUser);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [paginatedTransactions]);

  const resetFilters = useCallback(() => {
    setDateRange({ start: null, end: null });
    setMinAmount('');
    setMaxAmount('');
    setSearchQuery('');
    setFilterType('all');
    setFilterUser('');
    setFilterCategoryId('');
    setFilterExpenseCategoryId('');
    setFilterNeedsReview(false);
    setFilterCorrection(false);
    setFilterApproved(false);
  }, []);

  const categoryTitleById = useCallback(
    (id: string) => visibleCategories.find((c) => c.id === id)?.title,
    [visibleCategories]
  );
  const expenseCategoryNameById = useCallback(
    (id: string) => expenseCategoryById.get(id)?.name,
    [expenseCategoryById]
  );

  const runExportWithTransactions = useCallback(
    async (
      transactions: Transaction[],
      fromDate: Date | null,
      toDate: Date | null,
      allPeriod: boolean,
      filtersOverride?: { searchQuery?: string; minAmount?: string; maxAmount?: string }
    ) => {
      await exportFeedToExcel({
        transactions,
        fromDate,
        toDate,
        allPeriod,
        currentFilters: filtersOverride ?? {
          searchQuery: searchQuery || undefined,
          minAmount: minAmount || undefined,
          maxAmount: maxAmount || undefined,
        },
      });
      showSuccessNotification('Отчёт успешно экспортирован');
      setShowExportModal(false);
      setExportFromDate('');
      setExportToDate('');
      setExportAllPeriod(false);
      setPendingLargeExport(null);
    },
    [searchQuery, minAmount, maxAmount]
  );

  const formatDate = (timestamp: { seconds: number; nanoseconds: number }) => {
    const date = new Date(timestamp.seconds * 1000);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Сегодня';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчера';
    } else {
      const weekday = date.toLocaleDateString('ru-RU', { weekday: 'short' });
      const formattedWeekday = weekday.replace('.', '').toUpperCase();
      const dayMonthYear = date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      return `${formattedWeekday}, ${dayMonthYear}`;
    }
  };

  const groupTransactionsByDate = () => {
    const grouped: { [key: string]: { transactions: Transaction[]; total: number } } = {};
    filteredTransactions.forEach((transaction) => {
      const dateKey = formatDate(transaction.date);
      if (!grouped[dateKey]) {
        grouped[dateKey] = { transactions: [], total: 0 };
      }
      grouped[dateKey].transactions.push(transaction);
      grouped[dateKey].total += Math.abs(transaction.amount);
    });

    // Приоритет сортировки:
    // 1) needsReview = true
    // 2) status = pending
    // 3) status = approved
    // 4) status = rejected
    Object.values(grouped).forEach((group) => {
      group.transactions.sort((a, b) => {
        const aNeeds = !!a.needsReview;
        const bNeeds = !!b.needsReview;
        if (aNeeds !== bNeeds) return aNeeds ? -1 : 1;

        const aStatus = a.status ?? 'approved';
        const bStatus = b.status ?? 'approved';
        const statusRank = { pending: 0, approved: 1, rejected: 2 } as const;
        const aRank = statusRank[aStatus as keyof typeof statusRank] ?? 1;
        const bRank = statusRank[bStatus as keyof typeof statusRank] ?? 1;
        if (aRank !== bRank) return aRank - bRank;

        // По дате (сначала новые)
        const aSec = a.date.seconds;
        const bSec = b.date.seconds;
        return bSec - aSec;
      });
    });

    return grouped;
  };

  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [updateCommentTransaction, setUpdateCommentTransaction] = useState<TransactionCardTransaction | null>(null);
  const [deletePermission, setDeletePermission] = useState<{
    allowed: boolean;
    requiresPassword: boolean;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!transactionToDelete) {
      setDeletePermission(null);
      return;
    }
    let cancelled = false;
    canDeleteTransaction(transactionToDelete.id).then((perm) => {
      if (cancelled) return;
      if (!perm.allowed) {
        showErrorNotification('Доступ запрещен. Только для администраторов или владельца компании.');
        setTransactionToDelete(null);
        setDeletePermission(null);
        return;
      }
      setDeletePermission(perm);
    });
    return () => {
      cancelled = true;
    };
  }, [transactionToDelete?.id]);

  const handleDeleteConfirm = useCallback(
    async (password: string) => {
      if (!transactionToDelete) return;
      if (isDeleting) return;

      setIsDeleting(true);
      try {
        await secureDeleteTransaction(transactionToDelete.id, password);
        showSuccessNotification('Транзакция успешно удалена');
        setTransactionToDelete(null);
        setDeletePermission(null);
        refresh();
      } catch (error) {
        console.error('Error deleting transaction from feed:', error);
        showErrorNotification(
          error instanceof Error ? error.message : 'Ошибка при удалении транзакции'
        );
        throw error;
      } finally {
        setIsDeleting(false);
      }
    },
    [transactionToDelete, isDeleting, refresh]
  );

  const handleOwnerDeleteConfirm = useCallback(async () => {
    if (!transactionToDelete || !user?.uid) return;
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteTransaction(transactionToDelete.id, user.uid);
      showSuccessNotification('Транзакция успешно удалена');
      setTransactionToDelete(null);
      setDeletePermission(null);
      refresh();
    } catch (error) {
      console.error('Error deleting transaction from feed:', error);
      showErrorNotification(
        error instanceof Error ? error.message : 'Ошибка при удалении транзакции'
      );
    } finally {
      setIsDeleting(false);
    }
  }, [transactionToDelete, user?.uid, isDeleting, refresh]);

  const grouped = useMemo(() => groupTransactionsByDate(), [filteredTransactions]);

  const flatRows = useMemo((): VirtualizedRow[] => {
    const rows = buildFlattenedRowsFromGrouped(grouped, {
      getDateLabel: (k) => k,
      getFromCategoryId: (t) => visibleCategories.find((c) => c.title === t.fromUser)?.id,
      getObjectCategoryId: (t) => visibleCategories.find((c) => c.title === t.toUser)?.id,
      getCategoryColor: (t) =>
        t.expenseCategoryId ? (expenseCategoryById.get(t.expenseCategoryId)?.color ?? 'gray') : 'gray',
      getCategoryName: (t) => (t.expenseCategoryId ? expenseCategoryById.get(t.expenseCategoryId)?.name : undefined)
    });
    if (rows.length > 0) {
      rows.push({
        type: 'footer',
        id: 'footer',
        loading: paginatedLoadingMore,
        allLoaded: !hasMore && filteredTransactions.length > 0
      });
    }
    return rows;
  }, [grouped, visibleCategories, expenseCategoryById, hasMore, paginatedLoadingMore, filteredTransactions.length]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || flatRows.length === 0) return;
    const date = flatRows.filter((r) => r.type === 'date').length;
    const transaction = flatRows.filter((r) => r.type === 'transaction').length;
    const footer = flatRows.filter((r) => r.type === 'footer').length;
    console.log('[Feed] flatRows DIAG', {
      flatRows_length: flatRows.length,
      transactions_length: filteredTransactions.length,
      breakdown: { date, transaction, footer },
      expected_total: date + transaction + footer
    });
  }, [flatRows, filteredTransactions.length]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Диагностика для production (Netlify): в консоли видно состояние загрузки и данных
  useEffect(() => {
    console.log('[Feed PROD DIAG]', {
      authLoading,
      paginatedLoading,
      paginatedTransactionsLength: paginatedTransactions?.length ?? 0,
      flatRowsLength: flatRows?.length ?? 0
    });
  }, [authLoading, paginatedLoading, paginatedTransactions?.length, flatRows?.length]);

  // Показываем загрузку, пока проверяется авторизация (ПОСЛЕ ВСЕХ ХУКОВ). Фон явный, чтобы не было «пустого экрана».
  if (authLoading || (paginatedLoading && paginatedTransactions.length === 0)) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  const handleWaybillClick = async (transaction: Transaction) => {
    if (!transaction.waybillData) return;
    
    setSelectedWaybill({
      documentNumber: transaction.waybillNumber || '',
      date: transaction.waybillData.date,
      supplier: transaction.waybillData.supplier || transaction.waybillData.project || '',
      note: transaction.waybillData.note || '',
      items: transaction.waybillData.items.map(item => ({
        id: '',
        name: item.product.name,
        quantity: item.quantity,
        price: item.price,
        unit: item.product.unit
      }))
    });
    setWaybillType(transaction.type === 'income' ? 'income' : 'expense');
    setShowWaybill(true);
  };

  const handleExportClick = () => {
    setShowExportModal(true);
    setExportError('');
    // Устанавливаем сегодняшнюю дату по умолчанию для "По"
    if (!exportToDate) {
      const today = new Date();
      setExportToDate(today.toISOString().split('T')[0]);
    }
  };

  const handleExportSubmit = async () => {
    setExportError('');

    if (!exportAllPeriod) {
      if (!exportFromDate) {
        setExportError('Укажите дату начала периода');
        return;
      }
      if (exportFromDate && exportToDate && new Date(exportFromDate) > new Date(exportToDate)) {
        setExportError('Дата начала не может быть позже даты окончания');
        return;
      }
    }

    setExportLoading(true);
    setExportProgress(0);

    try {
      const dateFrom = exportAllPeriod ? null : (exportFromDate || null);
      const dateTo = exportAllPeriod ? null : (exportToDate || null);
      const allTransactions = await fetchAllTransactionsForExport(
        { dateFrom, dateTo, allPeriod: exportAllPeriod },
        (count) => setExportProgress(count)
      );

      if (allTransactions.length === 0) {
        showErrorNotification('Нет данных для экспорта за выбранный период');
        setExportLoading(false);
        setExportProgress(0);
        return;
      }

      if (allTransactions.length > LARGE_EXPORT_WARNING_THRESHOLD) {
        setPendingLargeExport({
          transactions: allTransactions,
          fromDate: exportFromDate ? new Date(exportFromDate) : null,
          toDate: exportToDate ? new Date(exportToDate) : null,
          allPeriod: exportAllPeriod,
          currentFilters: {
            searchQuery: searchQuery || undefined,
            minAmount: minAmount || undefined,
            maxAmount: maxAmount || undefined,
          },
        });
        setExportLoading(false);
        setExportProgress(0);
        return;
      }

      const fromDateObj = exportFromDate ? new Date(exportFromDate) : null;
      const toDateObj = exportToDate ? new Date(exportToDate) : null;
      await runExportWithTransactions(allTransactions, fromDateObj, toDateObj, exportAllPeriod);
    } catch (error) {
      console.error('Error exporting feed:', error);
      showErrorNotification(error instanceof Error ? error.message : 'Ошибка при экспорте отчёта');
    } finally {
      setExportLoading(false);
      setExportProgress(0);
    }
  };

  const handleConfirmLargeExport = async () => {
    if (!pendingLargeExport) return;
    setExportLoading(true);
    try {
      await runExportWithTransactions(
        pendingLargeExport.transactions,
        pendingLargeExport.fromDate,
        pendingLargeExport.toDate,
        pendingLargeExport.allPeriod,
        pendingLargeExport.currentFilters
      );
    } catch (error) {
      console.error('Error exporting feed:', error);
      showErrorNotification(error instanceof Error ? error.message : 'Ошибка при экспорте отчёта');
    } finally {
      setExportLoading(false);
      setPendingLargeExport(null);
    }
  };

  const handleExportCancel = () => {
    setShowExportModal(false);
    setExportFromDate('');
    setExportToDate('');
    setExportAllPeriod(false);
    setExportError('');
  };

  const handleApprove = async (transaction: Transaction) => {
    setApprovingId(transaction.id);
    try {
      await approveTransaction(transaction.id);
      patchTransaction(transaction.id, { status: 'approved' });
      showSuccessNotification('Транзакция одобрена');
    } catch (error) {
      console.error('Error approving transaction:', error);
      showErrorNotification(error instanceof Error ? error.message : 'Ошибка при одобрении транзакции');
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (transaction: Transaction) => {
    setRejectingId(transaction.id);
    try {
      await rejectTransaction(transaction.id);
      patchTransaction(transaction.id, { status: 'rejected' });
      showSuccessNotification('Транзакция отклонена');
    } catch (error) {
      console.error('Error rejecting transaction:', error);
      showErrorNotification(error instanceof Error ? error.message : 'Ошибка при отклонении транзакции');
    } finally {
      setRejectingId(null);
    }
  };

  return (
    <div className="flex flex-col h-dvh bg-gray-100 overflow-hidden feed-page">
      <div
        className="flex-shrink-0 fixed top-0 left-0 sm:left-64 right-0 bg-white z-50 transition-all duration-300 border-b border-[#e5e7eb]"
        style={{ background: '#ffffff' }}
      >
        <HeaderSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Поиск по операциям..."
          onClose={() => {
            setSearchQuery('');
            setShowSearch(false);
          }}
          isOpen={showSearch}
        />

        {/* Header: mobile — [бургер][назад] | заголовок | [download][lock][search]; desktop — без изменений */}
        <div
          className="relative flex items-center min-h-[56px] h-14 px-3 md:px-6 md:py-3 md:min-h-0 md:h-auto"
          style={{ paddingLeft: '12px', paddingRight: '12px' }}
        >
          {/* LEFT: на mobile [бургер][назад] в одной группе; на desktop — назад + заголовок + бейджи */}
          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0 w-[96px] md:w-auto md:min-w-0" style={{ gap: '8px' }}>
            {/* Бургер только на mobile, встроен в header */}
            <button
              type="button"
              onClick={toggleMobileSidebar}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
              style={{ color: '#374151' }}
              aria-label="Меню"
            >
              <Menu className="w-6 h-6" style={{ width: 24, height: 24 }} />
            </button>
            <button
              onClick={() => window.history.back()}
              className="flex items-center justify-center w-10 h-10 md:w-auto md:h-auto md:min-w-0 p-2 md:-ml-0 md:mr-4 flex-shrink-0"
              style={{ color: '#374151' }}
              aria-label="Назад"
            >
              <ArrowLeft className="w-6 h-6" style={{ width: 24, height: 24 }} />
            </button>
            {/* На desktop — заголовок и бейдж слева */}
            <h1
              className="hidden md:block text-xl font-semibold text-gray-900"
              style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '20px', fontWeight: 600, color: '#111827' }}
            >
              Лента
            </h1>
            {editMode && (
              <span className="hidden md:inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                🔓 Режим редактирования
              </span>
            )}
            <div className="hidden md:flex items-center gap-2 text-sm font-medium" style={{ color: '#FAAD14' }}>
              <span>⚠</span>
              <span>
                Требуют уточнения:{' '}
                {filteredTransactions.filter((t) => t.needsReview).length}
              </span>
            </div>
          </div>

          {/* CENTER: на mobile заголовок по центру оставшегося места */}
          <div className="flex-1 flex items-center justify-center min-w-0 md:hidden">
            <h1
              className="text-center truncate"
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '18px',
                fontWeight: 600,
                color: '#111827'
              }}
            >
              Лента
            </h1>
          </div>

          {/* RIGHT: иконки (mobile — только иконки, компактно; desktop — как было) */}
          <div className="flex items-center flex-shrink-0 md:ml-auto" style={{ gap: '6px' }}>
            <button
              onClick={handleExportClick}
              disabled={exportLoading}
              className={`flex items-center justify-center rounded-lg transition-colors duration-200 p-2 md:px-3 md:py-2 md:gap-2 ${
                exportLoading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-emerald-500 text-white hover:bg-emerald-600'
              }`}
              title={exportLoading ? 'Идёт экспорт...' : 'Скачать отчёт в Excel'}
            >
              {exportLoading ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 md:h-4 md:w-4 border-2 border-white border-t-transparent md:border-b-2 md:border-emerald-500" />
                  <span className="hidden md:inline text-sm ml-1">Экспорт...</span>
                </>
              ) : (
                <>
                  <Download className="w-6 h-6 md:w-4 md:h-4 text-white" />
                  <span className="hidden md:inline text-sm">Скачать отчёт</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                if (editMode) {
                  setEditMode(false);
                  if (typeof window !== 'undefined') {
                    window.sessionStorage.removeItem('feed-edit-mode');
                  }
                } else {
                  setShowEditPasswordModal(true);
                  setEditPassword('');
                  setEditPasswordError('');
                }
              }}
              className={`flex items-center justify-center rounded-full border p-2 md:px-3 md:py-2 md:gap-1 text-sm ${
                editMode
                  ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
              style={!editMode ? { color: '#374151' } : undefined}
              title={editMode ? 'Выключить режим редактирования' : 'Включить режим редактирования'}
            >
              {editMode ? (
                <Unlock style={{ width: 24, height: 24 }} className="md:w-4 md:h-4 text-red-600" />
              ) : (
                <Lock style={{ width: 24, height: 24, color: '#374151' }} className="md:w-4 md:h-4 md:text-gray-600" />
              )}
              <span className="hidden md:inline">Режим редактирования</span>
            </button>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 hover:bg-gray-100 rounded-full flex items-center justify-center"
              style={{ color: '#374151' }}
              aria-label="Поиск"
            >
              <Search style={{ width: 24, height: 24 }} className="md:w-5 md:h-5 md:text-gray-500" />
            </button>
            <button
              onClick={() => setShowFiltersDrawer(true)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-full flex items-center justify-center"
              style={{ color: '#374151' }}
              aria-label="Фильтры"
            >
              <Filter className="w-5 h-5 md:w-5 md:h-5 text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Мобильный drawer фильтров (Bottom Sheet) */}
      {showFiltersDrawer &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Фильтры"
          >
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setShowFiltersDrawer(false)}
              aria-hidden
            />
            <div
              className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto bg-white rounded-t-2xl shadow-xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b bg-white rounded-t-2xl flex-shrink-0">
                <h2 className="text-lg font-semibold text-gray-900">Фильтры</h2>
                <button
                  type="button"
                  onClick={() => setShowFiltersDrawer(false)}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
                  aria-label="Закрыть"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 pb-8 overflow-y-auto">
                <FeedFiltersPanel
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                  filterType={filterType}
                  setFilterType={setFilterType}
                  filterUser={filterUser}
                  setFilterUser={setFilterUser}
                  filterCategoryId={filterCategoryId}
                  setFilterCategoryId={setFilterCategoryId}
                  filterExpenseCategoryId={filterExpenseCategoryId}
                  setFilterExpenseCategoryId={setFilterExpenseCategoryId}
                  minAmount={minAmount}
                  setMinAmount={setMinAmount}
                  maxAmount={maxAmount}
                  setMaxAmount={setMaxAmount}
                  filterNeedsReview={filterNeedsReview}
                  setFilterNeedsReview={setFilterNeedsReview}
                  filterCorrection={filterCorrection}
                  setFilterCorrection={setFilterCorrection}
                  filterApproved={filterApproved}
                  setFilterApproved={setFilterApproved}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  visibleCategories={visibleCategories}
                  expenseCategories={expenseCategories.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
                  uniqueUserNames={uniqueUserNames}
                  onReset={resetFilters}
                  onApply={() => setShowFiltersDrawer(false)}
                  compact
                  currentUser={user}
                />
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Контент: grid Sidebar уже учтён через sm:pl-64. Только колонка ленты скроллится. */}
      <div className="flex-1 min-h-0 overflow-hidden pt-14 md:pt-28 sm:pl-64 flex flex-col lg:grid lg:grid-cols-[1fr_400px]">
        {/* Колонка ленты — единственная с overflow-y-auto (scrollbar только здесь) */}
        <div
          ref={scrollContainerRef}
          className="feed-content flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden bg-gray-100 w-full max-w-7xl mx-auto lg:max-w-[720px] lg:mx-auto"
        >
          {/* Быстрые фильтры — только на desktop; на мобильных перенесены в панель фильтров */}
          <div className="hidden md:flex flex-wrap gap-2 px-4 py-2 bg-gray-100 border-b border-gray-200 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                setDateRange({ start: d, end: new Date() });
              }}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
            >
              Сегодня
            </button>
            <button
              type="button"
              onClick={() => {
                if (!user?.displayName && !user?.email) return;
                const myName = (user?.displayName || user?.email || '').trim();
                setFilterUser(myName);
              }}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
            >
              Мои операции
            </button>
            <button
              type="button"
              onClick={() => setFilterType('expense')}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
            >
              Расходы
            </button>
            <button
              type="button"
              onClick={() => setFilterType('income')}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
            >
              Доходы
            </button>
            <button
              type="button"
              onClick={() => setFilterNeedsReview(true)}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
            >
              Требует уточнения
            </button>
          </div>
          {/* Активные фильтры (чипы) */}
          <div className="px-4 py-2 flex-shrink-0 border-b border-gray-100">
            <FeedFilterChips
              dateRange={dateRange}
              filterType={filterType}
              filterUser={filterUser}
              filterCategoryId={filterCategoryId}
              filterExpenseCategoryId={filterExpenseCategoryId}
              minAmount={minAmount}
              maxAmount={maxAmount}
              filterNeedsReview={filterNeedsReview}
              filterCorrection={filterCorrection}
              filterApproved={filterApproved}
              searchQuery={searchQuery}
              categoryTitleById={categoryTitleById}
              expenseCategoryNameById={expenseCategoryNameById}
              onClearDate={() => setDateRange({ start: null, end: null })}
              onClearType={() => setFilterType('all')}
              onClearUser={() => setFilterUser('')}
              onClearCategory={() => setFilterCategoryId('')}
              onClearExpenseCategory={() => setFilterExpenseCategoryId('')}
              onClearAmount={() => { setMinAmount(''); setMaxAmount(''); }}
              onClearNeedsReview={() => setFilterNeedsReview(false)}
              onClearCorrection={() => setFilterCorrection(false)}
              onClearApproved={() => setFilterApproved(false)}
              onClearSearch={() => setSearchQuery('')}
            />
          </div>
          <div className="flex-1 min-h-0">
            {flatRows.length > 0 && (
              <VirtualizedTransactionsList
                rows={flatRows}
                width="100%"
                context="feed"
                isTrustedForApproval={isTrustedForApproval}
                editMode={editMode}
                onReceiptClick={(a) => setReceiptView(a)}
                onWaybillClick={handleWaybillClick}
                onApprove={handleApprove}
                onEdit={setEditingTransaction}
                onDeleteRequest={setTransactionToDelete}
                onUpdateCommentByReceipt={setUpdateCommentTransaction}
                aiConfigured={aiConfigured === true}
                canDeleteTransaction={canShowDeleteForTransaction}
                approvingTransactionId={approvingId}
                rejectingTransactionId={rejectingId}
                hasMore={hasMore}
                loading={paginatedLoadingMore}
                onLoadMore={loadMore}
                scrollContainerRef={scrollContainerRef}
              />
            )}
          </div>
          {/* Кнопка «Загрузить ещё» только на desktop */}
          {hasMore && !paginatedLoadingMore && flatRows.length > 0 && (
            <div className="hidden md:flex justify-center py-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => loadMore()}
                disabled={paginatedLoading}
                className="px-4 py-2 text-sm text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Загрузить ещё
              </button>
            </div>
          )}

          {!paginatedLoading && filteredTransactions.length === 0 && (
          <div className="text-center py-12 px-4">
            {searchQuery ? (
              <>
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">Ничего не найдено</h3>
                <p className="text-gray-500">Попробуйте изменить параметры поиска</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <ArrowDownRight className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">История операций пуста</h3>
                <p className="text-gray-500">Здесь будут отображаться все операции</p>
              </>
            )}
          </div>
        )}
        </div>

        {/* Правая колонка — фильтры и статистика (без скролла) */}
        <div className="hidden lg:block feed-filters overflow-visible lg:sticky lg:top-28 lg:self-start lg:pl-4 lg:pr-6">
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Фильтры</h2>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                  aria-label={showFilters ? 'Свернуть фильтры' : 'Развернуть фильтры'}
                >
                  <Filter className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className={showFilters ? 'block' : 'hidden'}>
                <FeedFiltersPanel
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                  filterType={filterType}
                  setFilterType={setFilterType}
                  filterUser={filterUser}
                  setFilterUser={setFilterUser}
                  filterCategoryId={filterCategoryId}
                  setFilterCategoryId={setFilterCategoryId}
                  filterExpenseCategoryId={filterExpenseCategoryId}
                  setFilterExpenseCategoryId={setFilterExpenseCategoryId}
                  minAmount={minAmount}
                  setMinAmount={setMinAmount}
                  maxAmount={maxAmount}
                  setMaxAmount={setMaxAmount}
                  filterNeedsReview={filterNeedsReview}
                  setFilterNeedsReview={setFilterNeedsReview}
                  filterCorrection={filterCorrection}
                  setFilterCorrection={setFilterCorrection}
                  filterApproved={filterApproved}
                  setFilterApproved={setFilterApproved}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  visibleCategories={visibleCategories}
                  expenseCategories={expenseCategories.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
                  uniqueUserNames={uniqueUserNames}
                  onReset={resetFilters}
                  onApply={undefined}
                />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Статистика</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Всего транзакций</p>
                  <p className="text-2xl font-semibold text-gray-900">{filteredTransactions.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Общая сумма</p>
                  <p className="text-2xl font-semibold text-red-600">
                    -{Math.round(filteredTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0)).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₸
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

        {transactionToDelete && deletePermission?.allowed && deletePermission.requiresPassword && (
          <DeletePasswordModal
            isOpen
            onClose={() => {
              if (isDeleting) return;
              setTransactionToDelete(null);
              setDeletePermission(null);
            }}
            onConfirm={handleDeleteConfirm}
          />
        )}

        {transactionToDelete && deletePermission?.allowed && !deletePermission.requiresPassword && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000] p-4" role="dialog" aria-modal="true">
            <div className="bg-white rounded-2xl shadow-xl w-[90%] max-w-[420px] p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Удалить транзакцию?</h2>
              <p className="text-sm text-gray-600 mb-4">Это действие нельзя отменить.</p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (isDeleting) return;
                    setTransactionToDelete(null);
                    setDeletePermission(null);
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleOwnerDeleteConfirm}
                  disabled={isDeleting}
                  className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? 'Удаление…' : 'Удалить'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showWaybill && selectedWaybill && createPortal(
          <WaybillModal
            isOpen={showWaybill}
            onClose={() => {
              setShowWaybill(false);
              setSelectedWaybill(null);
            }}
            data={selectedWaybill}
            type={waybillType}
          />,
          document.body
        )}

        <AttachmentViewerModal
          isOpen={!!receiptView}
          onClose={() => setReceiptView(null)}
          url={receiptView?.url ?? ''}
          type={receiptView?.type}
          name={receiptView?.name}
        />

        {updateCommentTransaction && updateCommentTransaction.attachments?.[0] && (
          <UpdateCommentByReceiptModal
            isOpen
            onClose={() => setUpdateCommentTransaction(null)}
            transactionId={updateCommentTransaction.id}
            currentDescription={updateCommentTransaction.description ?? ''}
            attachment={updateCommentTransaction.attachments[0]}
            onSuccess={() => setUpdateCommentTransaction(null)}
          />
        )}

        {showEditPasswordModal && createPortal(
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]"
            onClick={() => {
              setShowEditPasswordModal(false);
              setEditPassword('');
              setEditPasswordError('');
            }}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-gray-500" />
                  Режим редактирования
                </h2>
                <button
                  onClick={() => {
                    setShowEditPasswordModal(false);
                    setEditPassword('');
                    setEditPasswordError('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Введите пароль для включения режима редактирования ленты.
              </p>
              <input
                type="password"
                value={editPassword}
                onChange={(e) => {
                  setEditPassword(e.target.value);
                  setEditPasswordError('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                placeholder="Пароль"
                autoFocus
              />
              {editPasswordError && (
                <p className="mt-2 text-sm text-red-600">{editPasswordError}</p>
              )}
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowEditPasswordModal(false);
                    setEditPassword('');
                    setEditPasswordError('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    const envPassword = import.meta.env.VITE_FEED_EDIT_PASSWORD;
                    if (!envPassword) {
                      setEditPasswordError('Пароль не настроен в окружении (VITE_FEED_EDIT_PASSWORD)');
                      return;
                    }
                    if (editPassword !== envPassword) {
                      setEditPasswordError('Неверный пароль');
                      return;
                    }
                    setEditMode(true);
                    if (typeof window !== 'undefined') {
                      window.sessionStorage.setItem('feed-edit-mode', 'true');
                    }
                    setShowEditPasswordModal(false);
                    setEditPassword('');
                    setEditPasswordError('');
                    showSuccessNotification('Режим редактирования включён');
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-500 rounded-md hover:bg-emerald-600"
                >
                  Войти
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {editingTransaction && createPortal(
          <EditTransactionModal
            transaction={editingTransaction}
            peopleAccounts={employeeCategories}
            objectAccounts={visibleCategories}
            expenseCategories={expenseCategories}
            isSaving={isSavingEdit}
            onClose={() => {
              if (isSavingEdit) return;
              setEditingTransaction(null);
            }}
            onSave={async (updated) => {
              if (isSavingEdit) return;
              try {
                setIsSavingEdit(true);

                const newFromCategory = employeeCategories.find(c => c.id === updated.fromCategoryId);
                const newToCategory = visibleCategories.find(c => c.id === updated.toCategoryId);
                const afterAuditCategory = employeeCategories.find(c => c.id === updated.auditCategoryId);

                if (!newFromCategory || !newToCategory) {
                  throw new Error('Не удалось найти выбранные счета');
                }
                if (process.env.NODE_ENV === 'development') {
                  console.log('FEED EDIT save: toCategory для истории счёта "Куда"', {
                    toCategoryId: updated.toCategoryId,
                    newToCategoryId: newToCategory.id,
                    newToCategoryTitle: newToCategory.title,
                    match: updated.toCategoryId === newToCategory.id
                  });
                  console.log('EDIT SAVE PAYLOAD', {
                    originalId: editingTransaction.id,
                    fromCategoryId: newFromCategory.id,
                    toCategoryId: newToCategory.id,
                    fromCategoryTitle: newFromCategory.title,
                    toCategoryTitle: newToCategory.title
                  });
                }

                await editFeedTransaction({
                  originalTransactionId: editingTransaction.id,
                  newFromCategory,
                  newToCategory,
                  newAmount: updated.amount,
                  newDescription: updated.comment,
                  newExpenseCategoryId: updated.expenseCategoryId ?? undefined,
                  newIsSalary: updated.isSalary,
                  newIsCashless: updated.isCashless,
                  newNeedsReview: updated.needsReview,
                  audit: {
                    transactionId: editingTransaction.id,
                    before: {
                      from: editingTransaction.fromUser,
                      to: editingTransaction.toUser,
                      amount: editingTransaction.amount,
                      comment: editingTransaction.description,
                      category: editingTransaction.fromUser || null,
                      isSalary: !!editingTransaction.isSalary,
                      isCashless: !!editingTransaction.isCashless,
                      needsReview: !!editingTransaction.needsReview
                    },
                    after: {
                      from: newFromCategory.title,
                      to: newToCategory.title,
                      amount: updated.amount,
                      comment: updated.comment,
                      category: afterAuditCategory?.title ?? null,
                      isSalary: updated.isSalary,
                      isCashless: updated.isCashless,
                      needsReview: updated.needsReview
                    }
                  }
                });

                showSuccessNotification('Транзакция успешно отредактирована');
                setEditingTransaction(null);
                // Не вызываем refresh() — onSnapshot получит обновление из Firestore,
                // список обновится без перезагрузки, скролл сохранится
              } catch (error) {
                console.error('Error editing transaction:', error);
                showErrorNotification(
                  error instanceof Error ? error.message : 'Ошибка при редактировании транзакции'
                );
              } finally {
                setIsSavingEdit(false);
              }
            }}
          />,
          document.body
        )}

        {/* Предупреждение о большом объёме экспорта (> 20000 записей) */}
        {pendingLargeExport && createPortal(
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]"
            onClick={() => setPendingLargeExport(null)}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Большой объём данных</h2>
              <p className="text-sm text-gray-600 mb-4">
                Загружено записей: <strong>{pendingLargeExport.transactions.length.toLocaleString('ru-RU')}</strong>.
                Экспорт такого объёма может занять время и замедлить приложение. Продолжить?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setPendingLargeExport(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Отмена
                </button>
                <button
                  onClick={handleConfirmLargeExport}
                  disabled={exportLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-500 rounded-md hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {exportLoading && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />}
                  Продолжить
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Модальное окно экспорта */}
        {showExportModal && createPortal(
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={handleExportCancel}
          >
            <div 
              className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Экспорт ленты в Excel</h2>
                  <button
                    onClick={handleExportCancel}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {exportError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{exportError}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportAllPeriod}
                        onChange={(e) => {
                          setExportAllPeriod(e.target.checked);
                          setExportError('');
                        }}
                        className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Выгрузить все операции (без ограничения по датам)
                      </span>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        С какой даты
                      </label>
                      <input
                        type="date"
                        value={exportFromDate}
                        onChange={(e) => {
                          setExportFromDate(e.target.value);
                          setExportError('');
                        }}
                        disabled={exportAllPeriod}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                          exportAllPeriod ? 'bg-gray-100 cursor-not-allowed' : ''
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        По какую дату
                      </label>
                      <input
                        type="date"
                        value={exportToDate}
                        onChange={(e) => {
                          setExportToDate(e.target.value);
                          setExportError('');
                        }}
                        disabled={exportAllPeriod}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                          exportAllPeriod ? 'bg-gray-100 cursor-not-allowed' : ''
                        }`}
                      />
                      {!exportAllPeriod && !exportToDate && (
                        <p className="mt-1 text-xs text-gray-500">
                          Если не указано, будет использована сегодняшняя дата
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {exportLoading && (
                  <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-500 border-t-transparent" />
                    <span className="text-sm text-emerald-800">
                      Загрузка данных… {exportProgress > 0 && `Загружено записей: ${exportProgress.toLocaleString('ru-RU')}`}
                    </span>
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={handleExportCancel}
                    disabled={exportLoading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleExportSubmit}
                    disabled={exportLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-500 rounded-md hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {exportLoading && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />}
                    Скачать
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

interface EditTransactionModalProps {
  transaction: Transaction;
  peopleAccounts: CategoryCardType[];
  objectAccounts: CategoryCardType[];
  expenseCategories: Array<{ id: string; name: string }>;
  isSaving: boolean;
  onClose: () => void;
  onSave: (data: {
    fromCategoryId: string;
    toCategoryId: string;
    amount: number;
    comment: string;
    auditCategoryId: string | null;
    expenseCategoryId: string | null;
    isSalary: boolean;
    isCashless: boolean;
    needsReview: boolean;
  }) => void;
}

const EXPENSE_ACCOUNT_TITLES = ['Общ Расх', 'Расходы', 'Прочие расходы'];

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  peopleAccounts,
  objectAccounts,
  expenseCategories,
  isSaving,
  onClose,
  onSave
}) => {
  const [fromCategoryId, setFromCategoryId] = useState<string>(() => {
    const match = peopleAccounts.find(c => c.title === transaction.fromUser);
    return match?.id ?? '';
  });
  const [toCategoryId, setToCategoryId] = useState<string>(() => {
    const target = objectAccounts.find(c => c.title === transaction.toUser);
    return target?.id ?? '';
  });
  const [amount, setAmount] = useState<string>(Math.abs(transaction.amount).toString());
  const [comment, setComment] = useState<string>(transaction.description);
  const [isSalary, setIsSalary] = useState<boolean>(!!transaction.isSalary);
  const [isCashless, setIsCashless] = useState<boolean>(!!transaction.isCashless);
  const [needsReview, setNeedsReview] = useState<boolean>(!!transaction.needsReview);
  const [auditCategoryId, setAuditCategoryId] = useState<string>(() => {
    const match = peopleAccounts.find(c => c.title === transaction.fromUser);
    return match?.id ?? '';
  });
  const [expenseCategoryId, setExpenseCategoryId] = useState<string>(() => transaction.expenseCategoryId ?? '');
  const [error, setError] = useState<string>('');
  const [toAccountSearch, setToAccountSearch] = useState<string>('');
  const filteredObjectAccounts = useMemo(() => {
    const q = toAccountSearch.trim().toLowerCase();
    if (!q) return objectAccounts;
    return objectAccounts.filter((c) => c.title.toLowerCase().includes(q));
  }, [objectAccounts, toAccountSearch]);

  const selectedToCategory = objectAccounts.find((c) => c.id === toCategoryId);
  const isToExpenseAccount =
    selectedToCategory &&
    (selectedToCategory.type === 'general_expense' ||
      EXPENSE_ACCOUNT_TITLES.includes(selectedToCategory.title));
  const showExpenseCategory = !!isToExpenseAccount;

  const handleSubmit = () => {
    setError('');

    if (!fromCategoryId || !toCategoryId) {
      setError('Выберите счета "Откуда" и "Куда"');
      return;
    }

    if (showExpenseCategory && !expenseCategoryId) {
      setError('Выберите категорию расхода');
      return;
    }

    const numericAmount = Number(amount.replace(',', '.'));
    if (!numericAmount || numericAmount <= 0) {
      setError('Введите корректную сумму');
      return;
    }

    if (!comment.trim()) {
      setError('Введите комментарий');
      return;
    }

    onSave({
      fromCategoryId,
      toCategoryId,
      amount: numericAmount,
      comment: comment.trim(),
      auditCategoryId: auditCategoryId || null,
      expenseCategoryId: showExpenseCategory ? expenseCategoryId || null : null,
      isSalary,
      isCashless,
      needsReview
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Pencil className="w-5 h-5 text-gray-500" />
            Редактирование транзакции
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isSaving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Откуда (счёт)
              </label>
              <select
                value={fromCategoryId}
                onChange={(e) => setFromCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Выберите счёт</option>
                {peopleAccounts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Куда (счёт)
              </label>
              {objectAccounts.length > 8 && (
                <input
                  type="text"
                  value={toAccountSearch}
                  onChange={(e) => setToAccountSearch(e.target.value)}
                  placeholder="Поиск счёта..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 mb-2"
                />
              )}
              <select
                value={toCategoryId}
                onChange={(e) => setToCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Выберите счёт</option>
                {filteredObjectAccounts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {showExpenseCategory && (
            <div id="expenseCategoryBlock">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Категория расхода
              </label>
              <select
                id="expenseCategory"
                value={expenseCategoryId}
                onChange={(e) => setExpenseCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Выберите категорию</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Сумма
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Категория (для журнала аудита)
              </label>
              <select
                value={auditCategoryId}
                onChange={(e) => setAuditCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Выберите человека</option>
                {peopleAccounts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Комментарий
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">Тип операции</p>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6" style={{ minHeight: 36 }}>
              <label className="inline-flex items-center gap-2 cursor-pointer min-h-[36px]">
                <input
                  type="checkbox"
                  checked={isSalary}
                  onChange={(e) => setIsSalary(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700">ЗП</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer min-h-[36px]">
                <input
                  type="checkbox"
                  checked={isCashless}
                  onChange={(e) => setIsCashless(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700">Безнал</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer min-h-[36px]" title="Требует уточнения">
                <input
                  type="checkbox"
                  checked={needsReview}
                  onChange={(e) => setNeedsReview(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700">Треб.уч.</span>
              </label>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-500 rounded-md hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            )}
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};