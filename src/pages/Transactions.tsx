import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getSettingsFromCache, saveSettingsToCache } from '../lib/cache';
import { deleteCategory } from '../lib/firebase/categories';
import { showSuccessNotification, showErrorNotification } from '../utils/notifications';

const TRANSACTIONS_CACHE_KEY = 'transactions_page_cache';

const getTransactionsCacheKey = (companyId: string | null) =>
  companyId ? `${TRANSACTIONS_CACHE_KEY}_${companyId}` : null;

import { Helmet } from 'react-helmet-async';
import { 
  DndContext, 
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  AutoScrollActivator,
  type DragMoveEvent,
} from '@dnd-kit/core';
import { CategoryRow } from '../components/transactions/CategoryRow';
import { useCategories } from '../hooks/useCategories';
import { useCompanyId } from '../contexts/CompanyContext';
import { useCurrentCompanyUser } from '../hooks/useCurrentCompanyUser';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CategoryCardType } from '../types';
import { TransactionHistory } from '../components/transactions/history/TransactionHistory';
import { TransferModal } from '../components/transactions/transfer/TransferModal';
import { AddWarehouseItemModal } from '../components/transactions/AddWarehouseItemModal';
import { useNavigate } from 'react-router-dom';
import { RayBackground } from '../components/RayBackground';
import { PageMetadata } from '../components/PageMetadata';
import './Transactions.css';
import { PendingTransactionsProvider } from '../contexts/PendingTransactionsContext';
// Баланс для всех категорий (включая проекты) берём из Firestore (categories.amount).
// Раньше для проектов подставляли sumAbsAmountByCategory, из-за чего при переводе
// объект→сотрудник у объекта отображался рост суммы вместо списания.

export const Transactions: React.FC = () => {
  const companyId = useCompanyId();
  const { companyUser } = useCurrentCompanyUser();
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const { categories: loadedCategories, loading, error } = useCategories();
  const [categories, setCategories] = useState<CategoryCardType[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [localLoading, setLocalLoading] = useState(true);

  // Сброс при смене компании: сразу очищаем список, чтобы не показывать чужие данные
  useEffect(() => {
    if (!companyId) {
      setCategories([]);
      setFromCache(false);
      setLocalLoading(false);
      return;
    }
    setCategories([]);
    setFromCache(false);
    setLocalLoading(true);
  }, [companyId]);

  // Кэш отключён как источник категорий: только Firestore (loadedCategories).
  // Иначе при переключении компании из кэша могли подмешиваться чужие данные.
  useEffect(() => {
    if (!companyId) return;
    setLocalLoading(false);
  }, [companyId]);

  // Когда пришли данные с сервера — используем баланс из Firestore (categories.amount) для всех категорий.
  // Для проектов тоже показываем categories.amount, чтобы при переводе объект→сотрудник сумма у объекта уменьшалась.
  useEffect(() => {
    if (!companyId) {
      setCategories([]);
      return;
    }
    if (!loadedCategories?.length) {
      setCategories([]);
      setFromCache(false);
      setLocalLoading(false);
      return;
    }
    const merged = loadedCategories
      .filter((c) => c.isVisible !== false && c.companyId === companyId)
      .map((c) => ({ ...c }));
    const bad = merged.filter((c) => c.companyId !== companyId);
    if (bad.length > 0) {
      console.error('[transactions] merged contained wrong companyId', { companyId, bad });
      setCategories([]);
    } else {
      if (import.meta.env?.DEV && merged.some((c) => c.row === 3)) {
        const projects = merged.filter((c) => c.row === 3);
        console.log('[TX_PAGE] карточки проектов (row=3) для отображения:', projects.map((c) => ({ id: c.id, title: c.title, amount: c.amount })));
      }
      setCategories(merged);
    }
    setFromCache(false);
    const cacheKey = getTransactionsCacheKey(companyId);
    if (cacheKey) {
      saveSettingsToCache(
        cacheKey,
        merged.map(({ id, title, amount, color, row, isVisible, type, companyId: catCompanyId }) => ({
          id,
          title,
          amount,
          color,
          row,
          isVisible,
          type,
          companyId: catCompanyId ?? companyId,
        }))
      );
    }
  }, [companyId, loadedCategories]);

  // Экспортируем функцию обновления глобально для StickyNavigation (очищаем кэш текущей компании)
  useEffect(() => {
    (window as any).refreshTransactionsPage = () => {
      const key = getTransactionsCacheKey(companyId);
      if (key) {
        localStorage.removeItem(key);
        caches.open('hotwell-settings-v1').then(cache => cache.delete(`/settings/${key}`));
      }
      window.location.reload();
    };
    return () => { delete (window as any).refreshTransactionsPage; };
  }, [companyId]);

  // Диагностика дублей: один и тот же title с разными id (только dev). Вызов до любых return.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || categories.length === 0) return;
    const visible = categories.filter(c => c.isVisible !== false);
    const byTitle = new Map<string, { id: string; row: number; isVisible?: boolean }[]>();
    visible.forEach(c => {
      const list = byTitle.get(c.title) || [];
      list.push({ id: c.id, row: c.row ?? 0, isVisible: c.isVisible });
      byTitle.set(c.title, list);
    });
    const duplicateTitles = Array.from(byTitle.entries()).filter(([, list]) => list.length > 1);
    if (duplicateTitles.length > 0) {
      console.log('DUPLICATE ACCOUNT CHECK (titles with multiple ids)', duplicateTitles.map(([title, matches]) => ({ title, matches })));
    }
    const bazanasha = byTitle.get('БазаНаша');
    if (bazanasha) {
      console.log('DUPLICATE ACCOUNT CHECK', { title: 'БазаНаша', matches: bazanasha.map(m => ({ id: m.id, row: m.row, sourceCollection: 'visibleCategories (Transactions)' })) });
    }
  }, [categories]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryCardType | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAddWarehouseModal, setShowAddWarehouseModal] = useState(false);
  const [transferData, setTransferData] = useState<{
    sourceCategory: CategoryCardType;
    targetCategory: CategoryCardType;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 300,
        tolerance: 8,
      },
    })
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pointerYRef = useRef<number | null>(null);
  const autoScrollRafRef = useRef(0);

  const trackPointer = useCallback((e: Event) => {
    const ev = e as TouchEvent & MouseEvent;
    if (ev.touches?.[0]) pointerYRef.current = ev.touches[0].clientY;
    else if (typeof ev.clientY === 'number') pointerYRef.current = ev.clientY;
  }, []);

  const stopDragAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = 0;
    }
    pointerYRef.current = null;
    window.removeEventListener('touchmove', trackPointer, true);
    window.removeEventListener('pointermove', trackPointer, true);
  }, [trackPointer]);

  const runDragAutoScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    const y = pointerYRef.current;
    if (el && y != null) {
      const rect = el.getBoundingClientRect();
      const margin = 100;
      const speed = 36;
      if (y > rect.bottom - margin) el.scrollTop += speed;
      else if (y < rect.top + margin) el.scrollTop -= speed;
    }
    autoScrollRafRef.current = requestAnimationFrame(runDragAutoScroll);
  }, []);

  useEffect(
    () => () => {
      if (autoScrollRafRef.current) cancelAnimationFrame(autoScrollRafRef.current);
      window.removeEventListener('touchmove', trackPointer, true);
      window.removeEventListener('pointermove', trackPointer, true);
    },
    [trackPointer]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    const ev = event.activatorEvent as TouchEvent | MouseEvent | undefined;
    if (ev?.touches?.[0]) pointerYRef.current = ev.touches[0].clientY;
    else if (ev && 'clientY' in ev) pointerYRef.current = ev.clientY;
    window.addEventListener('touchmove', trackPointer, { capture: true, passive: true });
    window.addEventListener('pointermove', trackPointer, { capture: true, passive: true });
    autoScrollRafRef.current = requestAnimationFrame(runDragAutoScroll);
  };

  /** Доп. прокрутка по rect карточки (desktop / когда есть translated) */
  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const el = scrollContainerRef.current;
    const translated = event.active.rect.current.translated;
    if (!el || !translated) return;
    pointerYRef.current = translated.top + translated.height / 2;
    const clientY = pointerYRef.current;
    const rect = el.getBoundingClientRect();
    const margin = 80;
    const speed = 28;
    if (clientY > rect.bottom - margin) el.scrollTop += speed;
    else if (clientY < rect.top + margin) el.scrollTop -= speed;
  }, []);

  const navigate = useNavigate();

  const handleDragEnd = async (event: DragEndEvent) => {
    stopDragAutoScroll();
    const { active, over } = event;
    setActiveId(null);
    
    if (over && active.id !== over.id) {
      const targetCategory = categories.find(c => c.id === over.id);
      const sourceCategory = categories.find(c => c.id === active.id) ?? (active.data.current as CategoryCardType);
      
      if (targetCategory) {
        // Проверяем, является ли цель складом или "Общ Расх"
        if (targetCategory.row === 4) {
          // Если цель - категория "Склад"
          if (targetCategory.title === 'Склад') {
            if (targetCategory.title === 'Склад') {
              // Перенаправляем на страницу нового прихода
              navigate('/warehouse/income/new', { 
                state: { 
                  selectedEmployee: sourceCategory.title
                }
              });
            }
            return;
          }
          
          // Если цель - "Общ Расх"
          if (targetCategory.title === 'Общ Расх') {
            // Источник — верхний ряд: сотрудник (row 2) или компания (row 1)
            if (sourceCategory.row === 1 || sourceCategory.row === 2) {
              setTransferData({
                sourceCategory,
                targetCategory
              });
              setShowTransferModal(true);
            } else if (sourceCategory.row === 4) {
              // Перенаправляем на страницу нового расхода
              navigate('/warehouse/expense/new', {
                state: {
                  selectedProject: targetCategory.id,
                  projectTitle: targetCategory.title
                }
              });
            }
            return;
          } else {
            // Для остальных категорий склада открываем модальное окно перевода
            setTransferData({
              sourceCategory,
              targetCategory
            });
            setShowTransferModal(true);
            return;
          }
        }

        // Проверяем, является ли источник складом, а цель - проектом
        if (sourceCategory.row === 4 && targetCategory.row === 3) {
          // Перенаправляем на страницу нового расхода с предварительно выбранным проектом
          navigate('/warehouse/expense/new', { 
            state: { 
              selectedProject: targetCategory.id,
              projectTitle: targetCategory.title
            }
          });
          return;
        }

        setTransferData({
          sourceCategory,
          targetCategory
        });
        setShowTransferModal(true);
      }
    }
  };

  const handleHistoryClick = (category: CategoryCardType) => {
    setSelectedCategory(category);
    setShowHistory(true);
  };

  const handleEmployeeHistoryClick = (category: CategoryCardType) => {
    if (maskAmountEmployeeCategoryIds.has(category.id)) {
      showErrorNotification('Недостаточно прав для просмотра');
      return;
    }
    handleHistoryClick(category);
  };

  const handleDeleteCategory = async (category: CategoryCardType) => {
    if (!companyId || deleteInProgress) return;
    try {
      setDeleteInProgress(true);
      await deleteCategory(category.id, category.title, false, companyId);
      showSuccessNotification('Объект удалён');
    } catch (error) {
      console.error('Error deleting category:', error);
      showErrorNotification(error instanceof Error ? error.message : 'Ошибка удаления');
    } finally {
      setDeleteInProgress(false);
    }
  };

  const handleEditCategory = (category: CategoryCardType) => {
    // Функция вызывается после успешного редактирования категории
    // Обновляем список категорий, чтобы отобразить изменения
    // Данные уже обновлены в EditCategoryModal, просто обновляем кэш
    if (window.refreshTransactionsPage) {
      // Используем существующую функцию обновления
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  };

  // SEO-оптимизация
  const seoData = {
    title: 'CRM система для строительных компаний | Управление финансами и транзакциями',
    description: 'Эффективное управление финансами в строительном бизнесе. CRM система для строительных компаний с функциями учета транзакций, управления складом и контроля движения средств.',
    keywords: 'CRM система для строительных компаний, управление строительством, учет транзакций, строительный бизнес, управление финансами строительной компании, складской учет строительство',
    focusKeyword: 'CRM система для строительных компаний'
  };

  if (!companyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500 p-4">
          Загрузка компании…
        </div>
      </div>
    );
  }

  if (!fromCache && (localLoading || loading)) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-xl text-red-500 p-4 bg-white rounded-lg shadow">
          {error}
        </div>
      </div>
    );
  }

  // Показываем, что данные из кэша (опционально)
  // Можно добавить индикатор: {fromCache && <span>Данные из кэша</span>}


  // Финальная изоляция: показываем только категории текущей компании (запрет показа без/с чужим companyId)
  const visibleCategories = categories.filter(
    (c) => c.isVisible !== false && c.companyId === companyId
  );

  const clientCategories = visibleCategories.filter(c => c.row === 1);
  const employeeCategories = visibleCategories.filter(c => c.row === 2);
  const projectCategories = visibleCategories.filter(c => c.row === 3);
  const warehouseCategories = visibleCategories.filter(c => c.row === 4);

  const isOwnerOrAdmin = companyUser?.role === 'owner' || companyUser?.role === 'admin';
  const viewAllEmployeeBalances =
    isOwnerOrAdmin || companyUser?.permissions?.viewAllEmployeeBalances !== false;
  const ownEmployeeCategoryId = companyUser?.permissions?.employeeCategoryId;
  const maskAmountEmployeeCategoryIds =
    !viewAllEmployeeBalances && employeeCategories.length > 0
      ? new Set(employeeCategories.filter((c) => c.id !== ownEmployeeCategoryId).map((c) => c.id))
      : new Set<string>();

  const hasNoObjects = visibleCategories.length === 0;

  // Runtime debug: источник данных для каждой категории и отдельно для "Склад"
  if (import.meta.env?.DEV) {
    const rawCategories = categories.map((c) => ({
      id: c.id,
      title: c.title,
      row: c.row,
      amount: c.amount,
      companyId: c.companyId ?? '(null)',
      source: fromCache ? 'cache' : 'live',
      whyIncluded: c.companyId === companyId ? 'companyId match' : 'EXCLUDED'
    }));
    const loadedSnapshot = (loadedCategories ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      row: c.row,
      amount: c.amount,
      companyId: c.companyId ?? '(null)'
    }));
    const displayedSnapshot = visibleCategories.map((c) => ({
      id: c.id,
      title: c.title,
      row: c.row,
      amount: c.amount,
      companyId: c.companyId ?? '(null)',
      source: fromCache ? 'cache' : 'live',
      whyIncluded: 'companyId === currentCompanyId'
    }));
    console.log('[transactions-debug]', {
      currentCompanyId: companyId,
      rawCategories,
      loadedCategories: loadedSnapshot,
      visibleCategories: displayedSnapshot,
      fromCache
    });
    const stockAll = categories.filter((c) => c.title === 'Склад' || (c.row === 4 && c.title?.includes('Склад')));
    if (stockAll.length > 0) {
      console.log('[transactions-stock-debug]', {
        currentCompanyId: companyId,
        foundCategoryIds: stockAll.map((c) => c.id),
        foundTitles: stockAll.map((c) => c.title),
        foundCompanyIds: stockAll.map((c) => c.companyId ?? '(null)'),
        foundAmounts: stockAll.map((c) => c.amount),
        finalChosen: visibleCategories.filter((c) => c.title === 'Склад' || (c.row === 4 && c.title?.includes('Склад'))),
        chosenBecause: 'visibleCategories = filter by companyId === currentCompanyId'
      });
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <PageMetadata 
        title="Транзакции | HotWell.KZ"
        description="Управление транзакциями и финансами"
      />
      <Helmet>
        <title>{seoData.title}</title>
        <meta name="description" content={seoData.description} />
        <meta name="keywords" content={seoData.keywords} />
        {/* Open Graph теги для социальных сетей */}
        <meta property="og:title" content={seoData.title} />
        <meta property="og:description" content={seoData.description} />
        <meta property="og:type" content="website" />
        {/* Дополнительные мета-теги */}
        <link rel="canonical" href="https://yourdomain.com/transactions" />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <div
        ref={scrollContainerRef}
        className="transactions-container transactions-scroll-container w-full"
        style={{ height: '100dvh', maxHeight: '100vh' }}
      >
        <PendingTransactionsProvider>
          <DndContext
            sensors={sensors}
            autoScroll={{
              enabled: true,
              acceleration: 18,
              activator: AutoScrollActivator.Pointer,
              threshold: { x: 0.12, y: 0.12 },
            }}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onDragCancel={() => {
              stopDragAutoScroll();
              setActiveId(null);
            }}
          >
            <div className="relative min-h-screen pb-8">
              <RayBackground theme="light" />
              <div className="relative z-10 p-2 sm:p-3 space-y-2">
              {hasNoObjects ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <p className="text-gray-600 text-lg mb-4">У вас пока нет объектов</p>
                  <button
                    type="button"
                    onClick={() => setShowAddWarehouseModal(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Создать первый объект
                  </button>
                </div>
              ) : (
                <>
              <CategoryRow
                title="Клиенты"
                categories={clientCategories}
                onHistoryClick={handleHistoryClick}
                onDeleteCategory={handleDeleteCategory}
                onEditCategory={handleEditCategory}
                rowNumber={1}
              />
              
              <CategoryRow
                title="Сотрудники"
                categories={employeeCategories}
                onHistoryClick={handleEmployeeHistoryClick}
                onDeleteCategory={handleDeleteCategory}
                onEditCategory={handleEditCategory}
                rowNumber={2}
                maskAmountCategoryIds={maskAmountEmployeeCategoryIds}
              />
              
              <CategoryRow
                title="Проекты"
                categories={projectCategories}
                onHistoryClick={handleHistoryClick}
                onDeleteCategory={handleDeleteCategory}
                onEditCategory={handleEditCategory}
                rowNumber={3}
              />
              
              <CategoryRow
                title="Склад"
                categories={warehouseCategories}
                onHistoryClick={handleHistoryClick}
                onDeleteCategory={handleDeleteCategory}
                onEditCategory={handleEditCategory}
                onAddCategory={() => setShowAddWarehouseModal(true)}
                rowNumber={4}
              />
                </>
              )}
              </div>

            {showHistory && selectedCategory && (
              <TransactionHistory
                category={selectedCategory}
                isOpen={showHistory}
                onClose={() => setShowHistory(false)}
              />
            )}

            {showTransferModal && transferData && (
              <TransferModal
                sourceCategory={transferData.sourceCategory}
                targetCategory={transferData.targetCategory}
                isOpen={showTransferModal}
                onClose={() => {
                  setShowTransferModal(false);
                  setTransferData(null);
                }}
              />
            )}

            {showAddWarehouseModal && (
              <AddWarehouseItemModal
                isOpen={showAddWarehouseModal}
                onClose={() => setShowAddWarehouseModal(false)}
              />
            )}
            </div>
          </DndContext>
        </PendingTransactionsProvider>
      </div>
    </div>
  );
};