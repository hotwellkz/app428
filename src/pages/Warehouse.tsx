import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Search, Package, AlertTriangle, FileText, ArrowUpRight, ArrowDownRight, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMobileSidebar } from '../contexts/MobileSidebarContext';
import { HeaderSearchBar } from '../components/HeaderSearchBar';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types/warehouse';
import { useCompanyId } from '../contexts/CompanyContext';
import { WarehouseSection } from '../components/warehouse/WarehouseSection';
import { ProductContextMenu } from '../components/warehouse/ProductContextMenu';
import { ProductDetails } from '../components/warehouse/ProductDetails';
import { TransactionHistory } from '../components/warehouse/TransactionHistory';
import { QRCodeModal } from '../components/warehouse/QRCodeModal';
import { showErrorNotification } from '../utils/notifications';
import { getProductEffectivePrice } from '../utils/warehousePricing';

export const Warehouse: React.FC = () => {
  const navigate = useNavigate();
  const companyId = useCompanyId();
  const { isOpen: isMobileMenuOpen, toggle: toggleMobileSidebar } = useMobileSidebar();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<'all' | '1' | '2' | '3'>('all');
  const [showLowStock, setShowLowStock] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    product: Product;
  } | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductDetails, setShowProductDetails] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [totalValue, setTotalValue] = useState(0);
  const [selectedHistoryProduct, setSelectedHistoryProduct] = useState<Product | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(500);

  useEffect(() => {
    if (!companyId) {
      setProducts([]);
      setLoading(false);
      return;
    }
    let q;
    try {
      if (showLowStock) {
        q = query(
          collection(db, 'products'),
          where('companyId', '==', companyId),
          orderBy('name')
        );
      } else {
        q = query(
          collection(db, 'products'),
          where('companyId', '==', companyId),
          ...(selectedWarehouse !== 'all' ? [where('warehouse', '==', selectedWarehouse)] : []),
          orderBy('name')
        );
      }
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const productsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Product[];
          const filteredData = showLowStock
            ? productsData.filter(p => p.quantity <= (p.minQuantity || 5))
            : productsData;
          const warehouseFilteredData = selectedWarehouse === 'all'
            ? filteredData
            : filteredData.filter(p => p.warehouse === selectedWarehouse);
          const enrichedProducts = warehouseFilteredData.map(product => ({
            ...product,
            displayPrice: getProductEffectivePrice(product)
          }));
          setProducts(enrichedProducts);
          setLoading(false);
        },
        (err: unknown) => {
          const code = (err as { code?: string })?.code;
          if (code === 'failed-precondition') {
            console.warn('[Warehouse] Firestore index is still building. Show empty list until ready.');
            setProducts([]);
          } else {
            console.error('Error in products subscription:', err);
          }
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (error) {
      console.error('Error in products subscription:', error);
      setLoading(false);
      return () => {};
    }
  }, [companyId, selectedWarehouse, showLowStock]);

  useEffect(() => {
    const total = products.reduce((sum, product) => {
      const price = product.displayPrice ?? getProductEffectivePrice(product);
      return sum + Math.floor((product.quantity || 0) * price);
    }, 0);
    setTotalValue(total);
  }, [products]);

  const handleContextMenu = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    const x = e.clientX;
    const y = e.clientY;
    
    // Проверяем, чтобы меню не выходило за пределы экрана
    const menuWidth = 200;
    const menuHeight = 300;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    const adjustedX = x + menuWidth > viewportWidth ? viewportWidth - menuWidth - 10 : x;
    const adjustedY = y + menuHeight > viewportHeight ? viewportHeight - menuHeight - 10 : y;
    
    setContextMenu({
      x: adjustedX,
      y: adjustedY,
      product
    });
    setSelectedProduct(product);
  };

  // Закрываем контекстное меню при клике вне его
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setShowProductDetails(true);
  };

  const handleViewHistory = async (product: Product) => {
    try {
      if (!product) {
        showErrorNotification('Товар не найден');
        return;
      }
      setSelectedHistoryProduct(product);
      setShowHistory(true);
    } catch (error) {
      showErrorNotification('Не удалось загрузить историю транзакций');
    }
  };

  const handleViewQRCode = (product: Product) => {
    if (!product) {
      showErrorNotification('Товар не найден');
      return;
    }
    setSelectedProduct(product);
    setShowQRCode(true);
  };

  const filteredProducts = products.filter(product => {
    const searchString = searchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(searchString) ||
      product.category?.toLowerCase().includes(searchString)
    );
  });

  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;
    const setHeight = () => setListHeight(el.clientHeight);
    setHeight();
    const ro = new ResizeObserver(setHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, filteredProducts.length]);

  const handleSearchFocus = () => {
    // Проверяем, является ли устройство мобильным
    if (window.innerWidth < 640) { // 640px - это стандартный брейкпоинт sm: в Tailwind
      // Добавляем небольшую задержку, чтобы дать время клавиатуре появиться
      setTimeout(() => {
        searchInputRef.current?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
    }
  };

  return (
    <div className="flex flex-col h-dvh bg-gray-50 overflow-hidden">
        <div className="flex-shrink-0 sticky top-0 z-[100] bg-white border-b" style={{ borderColor: '#e5e7eb', background: '#ffffff' }}>
          {/* Mobile: двухуровневый header */}
          <div className="md:hidden">
            <HeaderSearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Поиск товаров..." onClose={() => { setSearchQuery(''); setShowSearch(false); }} isOpen={showSearch} mobileOnly={false} />
            <div className="flex items-center min-h-[56px] h-14 max-w-7xl mx-auto" style={{ paddingLeft: '12px', paddingRight: '12px', background: '#ffffff', borderBottom: showSearch ? 'none' : '1px solid #e5e7eb' }}>
              <div className="flex items-center gap-2 flex-shrink-0 w-[96px]" style={{ gap: '8px' }}>
                <button type="button" onClick={toggleMobileSidebar} className="flex items-center justify-center w-10 h-10 rounded-[10px] hover:bg-gray-100 transition-colors flex-shrink-0" style={{ color: '#374151' }} aria-label="Меню">
                  <Menu className="w-6 h-6" style={{ width: 24, height: 24 }} />
                </button>
                <button onClick={() => { if (showSearch) { setShowSearch(false); setSearchQuery(''); } else { window.history.back(); } }} className="flex items-center justify-center w-10 h-10 rounded-[10px] hover:bg-gray-100 transition-colors flex-shrink-0" style={{ color: '#374151' }} aria-label="Назад">
                  <ArrowLeft className="w-6 h-6" style={{ width: 24, height: 24 }} />
                </button>
              </div>
              <div className="flex-1 flex items-center justify-center min-w-0">
                <h1 className="text-center truncate" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '18px', fontWeight: 600, color: '#111827' }}>Склад</h1>
              </div>
              <div className="flex items-center flex-shrink-0" style={{ gap: '8px' }}>
                <button type="button" onClick={() => setShowSearch(!showSearch)} className="flex items-center justify-center w-10 h-10 rounded-[10px] hover:bg-gray-100 transition-colors" style={{ color: '#374151' }} aria-label="Поиск">
                  <Search className="w-6 h-6" style={{ width: 24, height: 24 }} />
                </button>
                <button type="button" onClick={() => setShowLowStock(!showLowStock)} className={`flex items-center justify-center w-10 h-10 rounded-[10px] transition-colors ${showLowStock ? 'bg-red-50 text-red-500' : 'hover:bg-gray-100'}`} style={!showLowStock ? { color: '#374151' } : undefined} title="Показать товары которых мало на складе" aria-label="Мало на складе">
                  <AlertTriangle className="w-6 h-6" style={{ width: 24, height: 24 }} />
                </button>
              </div>
            </div>
            {!isMobileMenuOpen && (
              <div className="flex items-center justify-between max-w-7xl mx-auto h-10" style={{ paddingLeft: '12px', paddingRight: '12px', background: '#ffffff', borderBottom: '1px solid #f1f5f9' }}>
                <span className="text-sm font-medium text-gray-700 truncate">Склад</span>
                <span className="font-semibold truncate px-2" style={{ color: '#16a34a', fontWeight: 600 }}>{Math.round(totalValue).toLocaleString('ru-RU')} ₸</span>
                <div className="flex items-center flex-shrink-0" style={{ gap: '4px' }}>
                  <button onClick={() => navigate('/warehouse/income/new')} className="flex items-center justify-center w-10 h-10 rounded-[10px] text-emerald-600 hover:bg-emerald-50 transition-colors" title="Приход" aria-label="Приход">
                    <ArrowUpRight className="w-6 h-6" style={{ width: 24, height: 24 }} />
                  </button>
                  <button onClick={() => navigate('/warehouse/expense/new')} className="flex items-center justify-center w-10 h-10 rounded-[10px] text-red-600 hover:bg-red-50 transition-colors" title="Расход" aria-label="Расход">
                    <ArrowDownRight className="w-6 h-6" style={{ width: 24, height: 24 }} />
                  </button>
                  <button onClick={() => navigate('/warehouse/documents')} className="flex items-center justify-center w-10 h-10 rounded-[10px] text-gray-600 hover:bg-gray-100 transition-colors" title="Документы" aria-label="Документы">
                    <FileText className="w-6 h-6" style={{ width: 24, height: 24 }} />
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Desktop: до 1024px — прежний header */}
          <div className="hidden md:block lg:hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 py-2">
                <div className="flex items-center justify-between w-full sm:w-auto">
                  <div className="flex items-center">
                    <button onClick={() => window.history.back()} className="mr-2">
                      <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-semibold text-gray-900">Склад</h1>
                      <div className="flex items-center ml-2">
                        <span className="text-base font-medium text-emerald-600">{Math.round(totalValue).toLocaleString()} ₸</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={() => navigate('/warehouse/income/new')}
                  className="px-3 py-1.5 bg-emerald-500 text-white rounded hover:bg-emerald-600 text-sm flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Приход
                </button>
                <button
                  onClick={() => navigate('/warehouse/expense/new')}
                  className="px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 text-sm flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Расход
                </button>
                <button
                  onClick={() => navigate('/warehouse/documents')}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
                  title="Документы"
                >
                  <FileText className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="py-2 overflow-x-hidden max-w-7xl mx-auto px-4 sm:px-6">
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={handleSearchFocus}
                    className="block w-full rounded-lg border-0 py-1.5 pl-10 pr-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6"
                    placeholder="Поиск товаров"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showLowStock}
                    onChange={(e) => setShowLowStock(e.target.checked)}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-600"
                  />
                  Показать товары которых мало на складе
                </label>
              </div>
            </div>
          </div>

          {/* Desktop: от 1024px — CRM-структура (заголовок слева, действия справа, поиск снизу) */}
          <div className="hidden lg:block warehouse-header pt-5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="header-top flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Склад</h1>
                  <p className="mt-0.5 text-sm text-gray-500">
                    Общий остаток: {Math.round(totalValue).toLocaleString('ru-RU')} ₸
                  </p>
                </div>
                <div className="header-actions flex items-center gap-2 flex-shrink-0 mt-1">
                  <button
                    onClick={() => navigate('/warehouse/income/new')}
                    className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5"
                    style={{ background: '#22c55e' }}
                  >
                    <Plus className="w-4 h-4" /> Приход
                  </button>
                  <button
                    onClick={() => navigate('/warehouse/expense/new')}
                    className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5"
                    style={{ background: '#ef4444' }}
                  >
                    <Plus className="w-4 h-4" /> Расход
                  </button>
                  <button
                    onClick={() => navigate('/warehouse/documents')}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Документы"
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="header-bottom search-container mt-4 mb-4 overflow-x-hidden">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative max-w-[500px] flex-1 min-w-0">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={handleSearchFocus}
                      className="block w-full rounded-lg border-0 py-2 pl-10 pr-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-emerald-600 text-sm"
                      placeholder="Поиск товаров..."
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={showLowStock}
                      onChange={(e) => setShowLowStock(e.target.checked)}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-600"
                    />
                    Показать товары которых мало на складе
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="w-full px-4 py-2 flex-1 min-h-0 flex flex-col overflow-hidden lg:max-w-5xl lg:mx-auto">
          {loading ? (
            <div className="flex justify-center items-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                <Package className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-base font-medium text-gray-900 mb-1">Нет товаров</h3>
              <p className="text-sm text-gray-500">
                {searchQuery ? 'По вашему запросу ничего не найдено' : 'Добавьте первый товар'}
              </p>
            </div>
          ) : (
            <div
              ref={listContainerRef}
              className="warehouse-list space-y-1 flex-1 min-h-0 min-h-[calc(100dvh-180px)]"
            >
              <WarehouseSection
                title="Склад"
                subtitle="Основной склад"
                products={filteredProducts}
                onContextMenu={handleContextMenu}
                onProductClick={handleProductClick}
                onViewHistory={handleViewHistory}
                onViewQRCode={handleViewQRCode}
                warehouse="1"
                listHeight={listHeight}
              />
            </div>
          )}
          </div>
        </div>

        {contextMenu && (
          <ProductContextMenu
            position={{ x: contextMenu.x, y: contextMenu.y }}
            product={contextMenu.product}
            onClose={() => setContextMenu(null)}
          />
        )}

        {showProductDetails && selectedProduct && (
          <ProductDetails
            product={selectedProduct}
            onBack={() => setShowProductDetails(false)}
          />
        )}

        {showHistory && selectedHistoryProduct && (
          <TransactionHistory
            product={selectedHistoryProduct}
            isOpen={showHistory}
            onClose={() => {
              setShowHistory(false);
              setSelectedHistoryProduct(null);
            }}
          />
        )}

        {showQRCode && selectedProduct && (
          <QRCodeModal
            isOpen={showQRCode}
            onClose={() => {
              setShowQRCode(false);
              setSelectedProduct(null);
            }}
            product={selectedProduct}
          />
        )}
    </div>
  );
};
