import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSwipeable } from 'react-swipeable';
import { showErrorNotification, showSuccessNotification } from '../utils/notifications';
import { PasswordPrompt } from '../components/PasswordPrompt';
import { DeletePasswordModal } from '../components/transactions/DeletePasswordModal';
import { ExpenseWaybill } from '../components/warehouse/ExpenseWaybill';
import { Transaction } from '../components/transactions/types';
import { TransactionHeader } from '../components/transactions/TransactionHeader';
import { TransactionStats } from '../components/transactions/TransactionStats';
import { TransferModal } from '../components/transactions/transfer/TransferModal';
import { ChevronDown, ChevronUp, Calendar, Filter, ArrowLeft, BarChart2, Download, Menu, Search } from 'lucide-react';
import { useMobileSidebar } from '../contexts/MobileSidebarContext';
import { HeaderSearchBar } from '../components/HeaderSearchBar';
import clsx from 'clsx';
import { deleteTransaction, secureDeleteTransaction } from '../lib/firebase';
import { auth } from '../lib/firebase';
import { useTransactionsPaginated } from '../hooks/useTransactionsPaginated';
import { useAuth } from '../hooks/useAuth';
import { useExpenseCategories } from '../hooks/useExpenseCategories';
import {
  VirtualizedTransactionsList,
  buildFlattenedRowsFromGrouped,
  buildGroupedByDateKey,
  formatDateKeyAsLabel,
  type VirtualizedRow
} from '../components/transactions/VirtualizedTransactionsList';
import { AttachmentViewerModal } from '../components/AttachmentViewerModal';
import { exportTransactionsReport } from '../utils/exportTransactionsReport';
import { TransactionExportModal, TransactionExportFilters } from '../components/transactions/TransactionExportModal';

// Мемоизированный компонент фильтров
const TransactionFilters = memo(({
  showAllFilters,
  setShowAllFilters,
  filterSalary,
  setFilterSalary,
  filterCashless,
  setFilterCashless,
  selectedYear,
  setSelectedYear,
  availableYears,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  showYearFilter,
  setShowYearFilter,
  showDateRangeFilter,
  setShowDateRangeFilter
}: any) => (
  <div className="space-y-2 mt-2">
    {showAllFilters && (
      <>
        {/* Чекбоксы ЗП и Безнал */}
        <div className="bg-white rounded-lg shadow mb-2">
          <div className="px-4 py-3">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="salaryFilter"
                  checked={filterSalary}
                  onChange={(e) => setFilterSalary(e.target.checked)}
                  className="w-4 h-4 text-emerald-500 rounded border-gray-300 focus:ring-emerald-500"
                />
                <label htmlFor="salaryFilter" className="text-sm text-gray-600">
                  Зарплата
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cashlessFilter"
                  checked={filterCashless}
                  onChange={(e) => setFilterCashless(e.target.checked)}
                  className="w-4 h-4 text-emerald-500 rounded border-gray-300 focus:ring-emerald-500"
                />
                <label htmlFor="cashlessFilter" className="text-sm text-gray-600">
                  Безнал
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Остальные фильтры аналогично оригиналу... */}
      </>
    )}
  </div>
));

TransactionFilters.displayName = 'TransactionFilters';

export const OptimizedTransactionHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: categoryId } = useParams();
  
  // Состояния UI
  const [categoryTitle, setCategoryTitle] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [showDeletePasswordModal, setShowDeletePasswordModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [swipedTransactionId, setSwipedTransactionId] = useState<string | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [showWaybill, setShowWaybill] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [receiptView, setReceiptView] = useState<{ url: string; type: string; name?: string } | null>(null);
  
  // Состояния фильтров
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showAllFilters, setShowAllFilters] = useState(false);
  const [showYearFilter, setShowYearFilter] = useState(false);
  const [showDateRangeFilter, setShowDateRangeFilter] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [filterSalary, setFilterSalary] = useState(false);
  const [filterCashless, setFilterCashless] = useState(false);
  const [showStats, setShowStats] = useState(() => {
    const saved = localStorage.getItem('showTransactionStats');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Состояние для отслеживания ошибок загрузки
  const [error, setError] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const { user } = useAuth();
  const { toggle: toggleMobileSidebar } = useMobileSidebar();
  const { categories: expenseCategories } = useExpenseCategories(user?.uid);
  const expenseCategoryById = useMemo(() => {
    const m = new Map<string, { name: string; color?: string }>();
    expenseCategories.forEach((c) => m.set(c.id, { name: c.name, color: c.color }));
    return m;
  }, [expenseCategories]);

  // Используем оптимизированный хук для данных
  const {
    transactions,
    loading,
    hasMore,
    loadMore,
    totalAmount,
    salaryTotal,
    cashlessTotal
  } = useTransactionsPaginated({
    categoryId: categoryId!,
    pageSize: 50,
    enabled: !!categoryId
  });

  // Debug: результат выборки истории (только development)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !categoryId || loading) return;
    console.log('HISTORY RESULTS', {
      count: transactions.length,
      ids: transactions.map(t => t.id),
      categories: transactions.map(t => (t as { categoryId?: string }).categoryId)
    });
  }, [categoryId, loading, transactions]);

  // Мемоизированная фильтрация транзакций
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Фильтрация по поиску
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.description.toLowerCase().includes(query) ||
        t.fromUser.toLowerCase().includes(query) ||
        t.toUser.toLowerCase().includes(query) ||
        Math.abs(t.amount).toString().includes(query)
      );
    }

    // Фильтрация по ЗП и Безналу
    if (filterSalary) {
      filtered = filtered.filter(t => t.isSalary);
    }
    if (filterCashless) {
      filtered = filtered.filter(t => t.isCashless);
    }

    // Фильтрация по году
    if (selectedYear !== null) {
      filtered = filtered.filter(t => {
        if (t.date && t.date.toDate) {
          const transactionDate = t.date.toDate();
          return transactionDate.getFullYear() === selectedYear;
        }
        return false;
      });
    }

    // Фильтрация по диапазону дат
    if (startDate && endDate) {
      filtered = filtered.filter(t => {
        if (t.date && t.date.toDate) {
          const transactionDate = t.date.toDate();
          const start = new Date(startDate);
          const end = new Date(endDate);
          return transactionDate >= start && transactionDate <= end;
        }
        return false;
      });
    }

    // Сортировка: pending → approved → rejected, затем по дате (новее сверху)
    const statusOrder: Record<string, number> = {
      pending: 0,
      approved: 1,
      rejected: 2
    };

    const sorted = [...filtered].sort((a, b) => {
      const sa = statusOrder[a.status ?? 'approved'] ?? 1;
      const sb = statusOrder[b.status ?? 'approved'] ?? 1;
      if (sa !== sb) return sa - sb;

      const da = a.date && a.date.toDate ? a.date.toDate().getTime() : 0;
      const db = b.date && b.date.toDate ? b.date.toDate().getTime() : 0;
      return db - da;
    });

    return sorted;
  }, [transactions, searchQuery, filterSalary, filterCashless, selectedYear, startDate, endDate]);

  // Мемоизированный список доступных годов
  const availableYears = useMemo(() => {
    const years = new Set(
      transactions
        .filter(t => t.date && t.date.toDate)
        .map(t => t.date.toDate().getFullYear())
    );
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  // Группировка и плоский список для виртуализации
  const groupedByDate = useMemo(
    () => buildGroupedByDateKey(filteredTransactions),
    [filteredTransactions]
  );

  const flatRows = useMemo((): VirtualizedRow[] => {
    const rows = buildFlattenedRowsFromGrouped(groupedByDate, {
      getDateLabel: formatDateKeyAsLabel,
      getCategoryColor: (t) =>
        t.expenseCategoryId ? (expenseCategoryById.get(t.expenseCategoryId)?.color ?? 'gray') : 'gray',
      getCategoryName: (t) => (t.expenseCategoryId ? expenseCategoryById.get(t.expenseCategoryId)?.name : undefined)
    });
    if (rows.length > 0) {
      rows.push({
        type: 'footer',
        id: 'footer',
        loading,
        allLoaded: !hasMore && filteredTransactions.length > 0
      });
    }
    return rows;
  }, [groupedByDate, expenseCategoryById, hasMore, loading, filteredTransactions.length]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Загрузка названия категории
  useEffect(() => {
    if (!categoryId) return;

    const loadCategoryTitle = async () => {
      try {
        const categoryDoc = await getDoc(doc(db, 'categories', categoryId));
        if (categoryDoc.exists()) {
          const title = categoryDoc.data().title;
          setCategoryTitle(title);
          setError(null);
          if (process.env.NODE_ENV === 'development') {
            const win = window as any;
            const routeIdUsedByTransactionsPage = categoryId;
            const correctionIncomeCategoryId = win.__lastCorrectionIncomeCategoryId;
            const correctionTitle = win.__lastCorrectionIncomeCategoryTitle;
            const titlesMatch = correctionTitle != null && title === correctionTitle;
            const idsMatch = correctionIncomeCategoryId != null && routeIdUsedByTransactionsPage === correctionIncomeCategoryId;
            console.log('HISTORY QUERY', {
              routeId: categoryId,
              routeCategoryTitle: title,
              queryField: 'categoryId',
              filters: 'status!==cancelled, editType!==reversal, id not in correctedFromIds'
            });
            console.log('HISTORY PAGE query categoryId (должен совпадать с CORRECTION DOC categoryId)', {
              categoryId,
              categoryTitle: title
            });
            console.log('COMPARE TARGET ACCOUNT IDS', {
              routeIdUsedByTransactionsPage,
              correctionIncomeCategoryId,
              categoryTitleFromRoute: title,
              correctionIncomeCategoryTitle: correctionTitle,
              titlesMatch,
              idsMatch
            });
          }
        } else {
          setError('Категория не найдена');
        }
      } catch (error) {
        console.error('Error loading category:', error);
        setError('Ошибка загрузки категории');
      }
    };

    loadCategoryTitle();
  }, [categoryId]);

  // Сохранение настроек статистики
  useEffect(() => {
    localStorage.setItem('showTransactionStats', JSON.stringify(showStats));
  }, [showStats]);

  // Мемоизированные обработчики событий
  const handlers = useSwipeable({
    onSwipedLeft: useCallback((eventData: any) => {
      const card = (eventData.event.target as HTMLElement).closest('[data-transaction-id]');
      if (card) {
        const transactionId = card.getAttribute('data-transaction-id');
        setSwipedTransactionId(transactionId);
        setSwipeDirection('left');
      }
    }, []),
    onSwipedRight: useCallback(() => {
      setSwipedTransactionId(null);
      setSwipeDirection(null);
    }, []),
    trackMouse: true,
  });

  const handleDelete = useCallback(async (password: string) => {
    if (!selectedTransaction) {
      setShowPasswordPrompt(false);
      setSelectedTransaction(null);
      setSwipedTransactionId(null);
      setSwipeDirection(null);
      return;
    }
    try {
      console.log('[UI DELETE CONFIRM]', {
        selectedTransactionId: selectedTransaction.id,
        categoryId,
        page: 'project history',
        route: window.location.pathname
      });
      await secureDeleteTransaction(selectedTransaction.id, password);
      showSuccessNotification('Операция успешно удалена');
    } catch (error) {
      console.error('Error deleting transaction:', error);
      showErrorNotification(error instanceof Error ? error.message : 'Ошибка при удалении операции');
    } finally {
      setShowPasswordPrompt(false);
      setSelectedTransaction(null);
      setSwipedTransactionId(null);
      setSwipeDirection(null);
    }
  }, [selectedTransaction]);

  const handleDeleteClick = useCallback((transaction: Transaction) => {
    console.log('[UI DELETE CLICK]', {
      selectedTransactionId: transaction.id,
      categoryId,
      page: 'project history',
      route: window.location.pathname
    });
    setSelectedTransaction(transaction);
    setShowPasswordPrompt(true);
  }, []);

  const handleWaybillClick = useCallback((transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowWaybill(true);
  }, []);

  // Вычисляем агрегаты для отфильтрованных транзакций
  const filteredTotals = useMemo(() => {
    const total = filteredTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const salary = filteredTransactions.reduce((sum, t) => 
      t.isSalary ? sum + Math.abs(t.amount) : sum, 0
    );
    const cashless = filteredTransactions.reduce((sum, t) => 
      t.isCashless ? sum + Math.abs(t.amount) : sum, 0
    );
    return { total, salary, cashless };
  }, [filteredTransactions]);

  // Обработчик экспорта в Excel
  // Экспорт в Excel — вызывается только после подтверждения в модалке
  const exportTransactions = useCallback(async (filters: TransactionExportFilters) => {
    try {
      if (filteredTransactions.length === 0) {
        showErrorNotification('Нет данных для экспорта');
        return;
      }
      showSuccessNotification('Начинаем экспорт...');
      if (!categoryId) {
        throw new Error('ID категории не найден');
      }
      const startDateExport = filters.startDate ?? filters.dateFrom ?? startDate;
      const endDateExport = filters.endDate ?? filters.dateTo ?? endDate;
      await exportTransactionsReport({
        categoryId,
        categoryTitle,
        projectTransactions: filteredTransactions,
        totals: {
          totalAmount: filteredTotals.total,
          salaryTotal: filteredTotals.salary,
          cashlessTotal: filteredTotals.cashless
        },
        filters: {
          searchQuery,
          filterSalary,
          filterCashless,
          selectedYear,
          startDate: startDateExport,
          endDate: endDateExport
        }
      });
      showSuccessNotification('Отчёт успешно экспортирован');
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      showErrorNotification(err instanceof Error ? err.message : 'Ошибка при экспорте отчёта');
    }
  }, [filteredTransactions, categoryId, categoryTitle, filteredTotals, searchQuery, filterSalary, filterCashless, selectedYear, startDate, endDate]);

  // Отладка
  useEffect(() => {
    console.log('OptimizedTransactionHistoryPage mounted with categoryId:', categoryId);
  }, [categoryId]);

  // Отображение ошибки
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Ошибка</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/transactions')}
            className="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600"
          >
            Вернуться к транзакциям
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-gray-100">
      {/* Header: как на Feed — [бургер][←] | Ист.оп / Юха-Ф138 | [export][filter][analytics][search]; sticky */}
      <div
        className="flex-shrink-0 sticky top-0 z-[100] bg-white border-b"
        style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}
      >
        <HeaderSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Поиск по описанию..."
          onClose={() => { setSearchQuery(''); setShowSearch(false); }}
          isOpen={showSearch}
        />
        <div
          className="flex items-center min-h-[56px] h-auto py-2 max-w-[1200px] mx-auto px-4 lg:px-[60px] lg:pr-[40px]"
          style={{ paddingLeft: '12px', paddingRight: '12px' }}
        >
          <div className="flex items-center gap-2 flex-shrink-0 w-[96px] md:w-auto" style={{ gap: '8px' }}>
            <button
              type="button"
              onClick={toggleMobileSidebar}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-[10px] hover:bg-gray-100 transition-colors flex-shrink-0"
              style={{ color: '#374151' }}
              aria-label="Меню"
            >
              <Menu className="w-6 h-6" style={{ width: 24, height: 24 }} />
            </button>
            <button
              onClick={() => { if (showSearch) { setShowSearch(false); setSearchQuery(''); } else { navigate(-1); } }}
              className="flex items-center justify-center w-10 h-10 md:w-auto md:h-auto md:p-2 rounded-[10px] md:rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
              style={{ color: '#374151' }}
              aria-label="Назад"
            >
              <ArrowLeft className="w-6 h-6" style={{ width: 24, height: 24 }} />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-2 text-center md:text-left md:items-start">
            <h1 className="text-lg font-semibold text-gray-900 truncate w-full" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '18px', fontWeight: 600, color: '#111827' }}>
              Ист.оп
            </h1>
            {categoryTitle && (
              <span className="text-sm text-gray-500 truncate w-full" style={{ fontSize: '13px', color: '#6b7280' }}>
                {categoryTitle}
              </span>
            )}
          </div>

          <div className="flex items-center flex-shrink-0" style={{ gap: '6px' }}>
            <button
              onClick={() => setIsExportOpen(true)}
              disabled={filteredTransactions.length === 0}
              className={clsx(
                'flex items-center justify-center w-10 h-10 md:w-auto md:h-auto md:px-3 md:py-2 rounded-[10px] md:rounded-lg transition-colors flex-shrink-0',
                filteredTransactions.length === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-emerald-500 text-white hover:bg-emerald-600'
              )}
              title={filteredTransactions.length === 0 ? 'Нет данных для экспорта' : 'Скачать отчёт в Excel'}
            >
              <Download className="w-5 h-5 md:w-4 md:h-4" style={{ width: 24, height: 24 }} />
              <span className="hidden sm:inline ml-1 text-sm">Скачать отчёт</span>
            </button>
            <button
              onClick={() => setShowAllFilters(!showAllFilters)}
              className={clsx(
                'flex items-center justify-center w-10 h-10 rounded-[10px] md:rounded-lg transition-colors',
                showAllFilters ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-gray-100'
              )}
              style={!showAllFilters ? { color: '#374151' } : undefined}
              title="Фильтры"
            >
              <Filter className="w-5 h-5" style={{ width: 24, height: 24 }} />
            </button>
            <button
              onClick={() => setShowStats(!showStats)}
              className={clsx(
                'flex items-center justify-center w-10 h-10 rounded-[10px] md:rounded-lg transition-colors',
                showStats ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-gray-100'
              )}
              style={!showStats ? { color: '#374151' } : undefined}
              title="Аналитика"
            >
              <BarChart2 className="w-5 h-5" style={{ width: 24, height: 24 }} />
            </button>
            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              className="flex items-center justify-center w-10 h-10 rounded-[10px] hover:bg-gray-100 transition-colors"
              style={{ color: '#374151' }}
              aria-label="Поиск"
            >
              <Search className="w-5 h-5" style={{ width: 24, height: 24 }} />
            </button>
          </div>
        </div>
      </div>

      {/* Контент: flex-1 min-h-0 + один scroll container для списка (как на Feed). */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Статистика */}
      {showStats && (
        <div className="max-w-[1200px] mx-auto px-4 lg:px-[60px] lg:pr-[40px]">
          <TransactionStats
            totalAmount={totalAmount}
            salaryTotal={salaryTotal}
            cashlessTotal={cashlessTotal}
          />
        </div>
      )}

      {/* Фильтры */}
      <div className="max-w-[1200px] mx-auto px-4 lg:px-[60px] lg:pr-[40px]">
        <TransactionFilters
          showAllFilters={showAllFilters}
          setShowAllFilters={setShowAllFilters}
          filterSalary={filterSalary}
          setFilterSalary={setFilterSalary}
          filterCashless={filterCashless}
          setFilterCashless={setFilterCashless}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          availableYears={availableYears}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          showYearFilter={showYearFilter}
          setShowYearFilter={setShowYearFilter}
          showDateRangeFilter={showDateRangeFilter}
          setShowDateRangeFilter={setShowDateRangeFilter}
        />
      </div>

      {/* Scroll container для виртуализированного списка (как на Feed). */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-[1200px] mx-auto px-4 lg:px-[60px] lg:pr-[40px]">
          <div {...handlers}>
            {flatRows.length > 0 ? (
              <VirtualizedTransactionsList
                rows={flatRows}
                width="100%"
                context="history"
                onReceiptClick={(a) => setReceiptView(a)}
                onWaybillClick={handleWaybillClick}
                onDeleteRequest={handleDeleteClick}
                hasMore={hasMore}
                loading={loading}
                onLoadMore={loadMore}
                scrollContainerRef={scrollContainerRef}
              />
            ) : loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">Транзакции не найдены</p>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Модальные окна */}
      {showPasswordPrompt && (
        <PasswordPrompt
          isOpen={showPasswordPrompt}
          onClose={() => {
            setShowPasswordPrompt(false);
            setSelectedTransaction(null);
          }}
          onSuccess={() => {
            setShowPasswordPrompt(false);
            setShowDeletePasswordModal(true);
          }}
        />
      )}

      {showDeletePasswordModal && selectedTransaction && (
        <DeletePasswordModal
          isOpen={true}
          onClose={() => {
            setShowDeletePasswordModal(false);
            setSelectedTransaction(null);
            setSwipedTransactionId(null);
            setSwipeDirection(null);
          }}
          onConfirm={handleDelete}
        />
      )}

      <AttachmentViewerModal
        isOpen={!!receiptView}
        onClose={() => setReceiptView(null)}
        url={receiptView?.url ?? ''}
        type={receiptView?.type}
        name={receiptView?.name}
      />

      {showWaybill && selectedTransaction?.waybillData && (
        <ExpenseWaybill
          isOpen={showWaybill}
          onClose={() => {
            setShowWaybill(false);
            setSelectedTransaction(null);
          }}
          data={selectedTransaction.waybillData}
        />
      )}

      {showTransferModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Редактирование транзакции</h3>
            <p className="text-gray-600 mb-4">Функция редактирования будет доступна в следующей версии</p>
            <button
              onClick={() => {
                setShowTransferModal(false);
                setSelectedTransaction(null);
                setSwipedTransactionId(null);
                setSwipeDirection(null);
              }}
              className="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {isExportOpen && (
        <TransactionExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          onConfirm={(filters) => {
            exportTransactions(filters);
            setIsExportOpen(false);
          }}
          defaultDateFrom={startDate}
          defaultDateTo={endDate}
        />
      )}
    </div>
  );
}; 