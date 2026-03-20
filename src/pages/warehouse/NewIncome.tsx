import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, Barcode, Plus, Trash2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, doc, updateDoc, serverTimestamp, writeBatch, addDoc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { getTransactionStatusForCompany } from '../../lib/firebase/transactions';
import { db } from '../../lib/firebase';
import { useCompanyId } from '../../contexts/CompanyContext';
import { getNextDocumentNumber } from '../../utils/documentUtils';
import { sendTelegramNotification, formatTransactionMessage } from '../../services/telegramService';
import { useCategories } from '../../hooks/useCategories';
import { showSuccessNotification, showErrorNotification } from '../../utils/notifications';
import { Product } from '../../types/warehouse';
import { ProjectSelector } from '../../components/warehouse/ProjectSelector';
import { IncomeWaybill } from '../../components/warehouse/IncomeWaybill';
import { Scrollbars } from 'react-custom-scrollbars-2';
import { FileUpload } from '../../components/FileUpload';
import { safeComponent, validateComponent } from '../../utils/componentGuards';

// Безопасные компоненты с fallback
const SafeProjectSelector = safeComponent(ProjectSelector, 'ProjectSelector');
const SafeIncomeWaybill = safeComponent(IncomeWaybill, 'IncomeWaybill');
const SafeScrollbars = safeComponent(Scrollbars, 'Scrollbars');
const SafeFileUpload = safeComponent(FileUpload, 'FileUpload');

// Диагностический guard для проверки импортов
const validateImports = () => {
  const errors: string[] = [];
  
  if (!validateComponent(ProjectSelector, 'ProjectSelector')) {
    errors.push('ProjectSelector is undefined');
  }
  if (!validateComponent(IncomeWaybill, 'IncomeWaybill')) {
    errors.push('IncomeWaybill is undefined');
  }
  if (!validateComponent(Scrollbars, 'Scrollbars')) {
    errors.push('Scrollbars is undefined');
  }
  if (!validateComponent(FileUpload, 'FileUpload')) {
    errors.push('FileUpload is undefined');
  }
  
  if (errors.length > 0) {
    console.error('[NewIncome] Import validation failed:', errors);
    return false;
  }
  
  return true;
};

const INCOME_ITEMS_KEY = 'income_items';
const INCOME_SUPPLIER_KEY = 'income_supplier';
const INCOME_NOTE_KEY = 'income_note';
const INCOME_FILES_KEY = 'income_files';

interface IncomeItem {
  product: Product;
  quantity: number;
  price: number;
}

export const NewIncome: React.FC = () => {
  // Отладка
  console.log('NewIncome component mounted');
  
  // Диагностическая проверка импортов
  useEffect(() => {
    if (!validateImports()) {
      console.error('[NewIncome] Critical: Some imports are undefined. Component may crash.');
    }
  }, []);
  
  const navigate = useNavigate();
  const location = useLocation();
  const companyId = useCompanyId();
  const [date] = useState(new Date().toISOString().split('T')[0]);
  const [documentNumber, setDocumentNumber] = useState('');
  const [supplier, setSupplier] = useState(() => {
    // Сначала проверяем state, затем localStorage
    const state = location.state as { selectedEmployee?: string };
    return state?.selectedEmployee || localStorage.getItem(INCOME_SUPPLIER_KEY) || '';
  });

  // Состояния для отладки и обработки ошибок
  const [componentError, setComponentError] = useState<string | null>(null);
  const [isComponentLoading, setIsComponentLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setIsComponentLoading(false);
      return;
    }
    const loadDocumentNumber = async () => {
      try {
        const nextNumber = await getNextDocumentNumber('income', companyId);
        setDocumentNumber(nextNumber);
      } catch (error) {
        console.error('Error loading document number:', error);
        setComponentError('Ошибка при генерации номера документа');
        showErrorNotification('Ошибка при генерации номера документа');
      } finally {
        setIsComponentLoading(false);
      }
    };
    loadDocumentNumber();
  }, [companyId]);
  const [note, setNote] = useState(() => {
    return localStorage.getItem(INCOME_NOTE_KEY) || ''; // Инициализируем из localStorage
  });
  const [items, setItems] = useState<IncomeItem[]>(() => {
    const savedItems = localStorage.getItem(INCOME_ITEMS_KEY);
    return savedItems ? JSON.parse(savedItems) : [];
  });
  const [files, setFiles] = useState<Array<{ url: string; type: string; name: string }>>(() => {
    const savedFiles = localStorage.getItem(INCOME_FILES_KEY);
    return savedFiles ? JSON.parse(savedFiles) : [];
  });
  const [showWaybill, setShowWaybill] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { categories, loading: categoriesLoading } = useCategories();

  // Фильтруем только категории сотрудников (row === 2)
  const employeeCategories = categories.filter(c => c.row === 2 && c.isVisible !== false);

  // Сохраняем supplier в localStorage при изменении
  useEffect(() => {
    if (supplier) {
      localStorage.setItem(INCOME_SUPPLIER_KEY, supplier);
    }
  }, [supplier]);

  useEffect(() => {
    localStorage.setItem(INCOME_ITEMS_KEY, JSON.stringify(items));
  }, [items]);

  // Сохраняем файлы в localStorage
  useEffect(() => {
    localStorage.setItem(INCOME_FILES_KEY, JSON.stringify(files));
  }, [files]);

  // Сохраняем примечание в localStorage при изменении
  useEffect(() => {
    if (note) {
      localStorage.setItem(INCOME_NOTE_KEY, note);
    } else {
      localStorage.removeItem(INCOME_NOTE_KEY);
    }
  }, [note]);

  // Добавляем товар в список
  useEffect(() => {
    const state = location.state as { addedProduct?: { product: Product; quantity: number } };
    if (state?.addedProduct && state.addedProduct.product && state.addedProduct.quantity) {
      const newItem = {
        product: state.addedProduct.product,
        quantity: state.addedProduct.quantity,
        price: state.addedProduct.product.averagePurchasePrice || 0,
      };
      
      setItems(prev => {
        const existingIndex = prev.findIndex(item => item.product.id === newItem.product.id);
        if (existingIndex >= 0) {
          const newItems = [...prev];
          newItems[existingIndex] = {
            ...newItems[existingIndex],
            quantity: newItem.quantity
          };
          return newItems;
        }
        return [newItem, ...prev]; // Добавляем новый товар в начало списка
      });
      
      navigate('.', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const handleUpdateItem = (index: number, field: 'quantity' | 'price', value: number) => {
    setItems(prev => {
      const newItems = [...prev];
      newItems[index] = {
        ...newItems[index],
        [field]: value
      };
      return newItems;
    });
  };

  const handleDeleteItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteAll = () => {
    if (window.confirm('Вы уверены, что хотите удалить все товары?')) {
      setItems([]);
      localStorage.removeItem(INCOME_ITEMS_KEY);
      localStorage.removeItem(INCOME_SUPPLIER_KEY);
      setSupplier('');
      localStorage.removeItem(INCOME_NOTE_KEY);
      setNote('');
      localStorage.removeItem(INCOME_FILES_KEY);
      setFiles([]);
    }
  };

  const handleFileUpload = (fileData: { url: string; type: string; name: string }) => {
    setFiles(prev => [...prev, fileData]);
  };

  const handleRemoveFile = (url: string) => {
    setFiles(prev => prev.filter(file => file.url !== url));
  };

  const handleSubmit = async () => {
    if (!supplier) {
      showErrorNotification('Выберите сотрудника');
      return;
    }

    if (items.length === 0) {
      showErrorNotification('Добавьте товары');
      return;
    }
    if (!companyId) return;

    setIsSubmitting(true);
    try {
      const txStatus = await getTransactionStatusForCompany(companyId);
      const batch = writeBatch(db);
      const timestamp = serverTimestamp();

      // Получаем информацию о сотруднике и складе (только своей компании)
      const [supplierQuery, warehouseQuery] = await Promise.all([
        getDocs(query(
          collection(db, 'categories'),
          where('companyId', '==', companyId),
          where('title', '==', supplier),
          where('row', '==', 2)
        )),
        getDocs(query(
          collection(db, 'categories'),
          where('companyId', '==', companyId),
          where('title', '==', 'Склад'),
          where('row', '==', 4)
        ))
      ]);

      if (supplierQuery.empty) {
        showErrorNotification('Сотрудник не найден');
        setIsSubmitting(false);
        return;
      }

      if (warehouseQuery.empty) {
        showErrorNotification('Категория склада не найдена');
        setIsSubmitting(false);
        return;
      }

      const supplierCategory = supplierQuery.docs[0];
      const warehouseCategory = warehouseQuery.docs[0];
      
      // Получаем текущий баланс сотрудника
      const supplierAmount = parseFloat(supplierCategory.data().amount?.replace(/[^\d.-]/g, '') || '0');
      
      // Рассчитываем общую сумму операции
      const totalAmount = items.reduce((sum, item) => 
        sum + (item.quantity * item.price), 0);

      // Обновляем баланс сотрудника только для одобренных транзакций (owner/superAdmin)
      if (txStatus === 'approved') {
        batch.update(doc(db, 'categories', supplierCategory.id), {
          amount: `${supplierAmount - totalAmount} ₸`,
          updatedAt: timestamp
        });
      }

      const waybillRef = await addDoc(collection(db, 'warehouseDocuments'), {
        documentNumber,
        date,
        supplier,
        note,
        items: items.map(item => ({
          product: {
            name: item.product.name,
            unit: item.product.unit
          },
          quantity: item.quantity,
          price: item.price
        })),
        files,
        type: 'income',
        companyId,
        createdAt: timestamp
      });
      
      // Создаем транзакцию расхода для сотрудника
      const supplierTransactionRef = doc(collection(db, 'transactions'));
      const warehouseTransactionRef = doc(collection(db, 'transactions'));

      batch.set(supplierTransactionRef, {
        categoryId: supplierCategory.id,
        fromUser: supplier,
        toUser: 'Склад',
        amount: -totalAmount,
        description: `Расход на склад по накладной №${documentNumber}`,
        waybillNumber: documentNumber,
        waybillData: {
          documentNumber,
          date,
          supplier,
          note,
          items: items.map(item => ({
            product: {
              name: item.product.name,
              unit: item.product.unit
            },
            quantity: item.quantity,
            price: item.price
          })),
          files // Добавляем информацию о прикрепленных файлах
        },
        type: 'expense',
        date: timestamp,
        isWarehouseOperation: true,
        relatedTransactionId: warehouseTransactionRef.id,
        companyId,
        status: txStatus
      });

      batch.set(warehouseTransactionRef, {
        categoryId: warehouseCategory.id,
        fromUser: supplier,
        toUser: 'Склад',
        amount: totalAmount,
        description: `Приход на склад по накладной №${documentNumber}`,
        waybillNumber: documentNumber,
        waybillData: {
          documentNumber,
          date,
          supplier,
          note,
          items: items.map(item => ({
            product: {
              name: item.product.name,
              unit: item.product.unit
            },
            quantity: item.quantity,
            price: item.price
          })),
          files // Добавляем информацию о прикрепленных файлах
        },
        type: 'income',
        date: timestamp,
        isWarehouseOperation: true,
        relatedTransactionId: supplierTransactionRef.id,
        companyId,
        status: txStatus
      });
      // Обновляем количество и цены товаров
      for (const item of items) {
        const productRef = doc(db, 'products', item.product.id);
        const productDoc = await getDoc(productRef);
        if (!productDoc.exists()) {
          throw new Error(`Товар ${item.product.name} не найден`);
        }
        const currentData = productDoc.data();
        const currentQuantity = currentData.quantity || 0;
        const newQuantity = currentQuantity + item.quantity;

        console.log('[WAREHOUSE MUTATION]', {
          source: 'NewIncome.handleSubmit',
          productId: item.product.id,
          productName: item.product.name,
          beforeQty: currentQuantity,
          delta: item.quantity,
          afterQty: newQuantity,
          documentNumber,
          supplier,
          type: 'income'
        });
        
        // Проверяем, включен ли ручной режим цены
        const manualPriceEnabled = currentData.manualPriceEnabled === true;
        
        let updateData: any = {
          quantity: newQuantity,
          updatedAt: timestamp
        };

        if (!manualPriceEnabled) {
          // Автоматический расчет средней цены только по приходным операциям
          // Используем totalPurchasePrice для хранения суммарной стоимости всех приходов
          const currentTotalPurchasePrice = currentData.totalPurchasePrice || 0;
          const newTotalPurchasePrice = currentTotalPurchasePrice + (item.quantity * item.price);
          const newAveragePrice = newQuantity > 0 ? newTotalPurchasePrice / newQuantity : 0;

          updateData.totalPurchasePrice = newTotalPurchasePrice;
          updateData.averagePurchasePrice = newAveragePrice;
        } else {
          // В ручном режиме обновляем только количество, цена остается ручной
          // totalPurchasePrice пересчитываем для отображения общей стоимости
          const manualPrice = currentData.manualAveragePrice || currentData.averagePurchasePrice || 0;
          updateData.totalPurchasePrice = newQuantity * manualPrice;
          // Сохраняем ручную цену, если она была установлена
          if (currentData.manualAveragePrice !== undefined) {
            updateData.manualAveragePrice = currentData.manualAveragePrice;
          }
        }

        batch.update(productRef, updateData);

        // Добавляем запись в историю движения товара
        const movementRef = doc(collection(db, 'productMovements'));
        const previousAveragePrice = currentData?.averagePurchasePrice || 0;
        const newAveragePrice = manualPriceEnabled 
          ? (currentData?.manualAveragePrice || currentData?.averagePurchasePrice || 0)
          : (updateData.averagePurchasePrice || 0);
        
        batch.set(movementRef, {
          productId: item.product.id,
          companyId,
          type: 'in',
          quantity: item.quantity,
          price: item.price,
          totalPrice: item.quantity * item.price,
          warehouse: 'Основной склад',
          description: `Приход товара от ${supplier}`,
          date: serverTimestamp(),
          previousQuantity: currentData?.quantity || 0,
          newQuantity: newQuantity,
          previousAveragePrice: previousAveragePrice,
          newAveragePrice: newAveragePrice,
          supplier: supplier
        });
      }

      await batch.commit();
      
      // Отправляем уведомление в Telegram
      await sendTelegramNotification(
        formatTransactionMessage(
          supplier,
          'Склад',
          totalAmount,
          note || 'Приход на склад',
          'income',
          documentNumber
        ),
        { parseMode: 'HTML' }
      );
      
      await addDoc(collection(db, 'warehouseDocuments'), {
        documentNumber,
        date,
        supplier,
        note,
        items: items.map(item => ({
          product: {
            name: item.product.name,
            unit: item.product.unit
          },
          quantity: item.quantity,
          price: item.price
        })),
        files,
        type: 'income',
        companyId,
        createdAt: serverTimestamp()
      });

      showSuccessNotification('Товары успешно добавлены на склад');
      setShowWaybill(true);
      setItems([]);
      localStorage.removeItem(INCOME_ITEMS_KEY);
      localStorage.removeItem(INCOME_SUPPLIER_KEY);
      setSupplier('');
      localStorage.removeItem(INCOME_NOTE_KEY);
      setNote('');
      localStorage.removeItem(INCOME_FILES_KEY);
      setFiles([]);
    } catch (error) {
      console.error('Error submitting income:', error);
      showErrorNotification(error instanceof Error ? error.message : 'Ошибка при добавлении товаров');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateTotals = () => {
    return items.reduce((acc, item) => ({
      quantity: acc.quantity + item.quantity,
      amount: acc.amount + (item.quantity * item.price),
      total: acc.total + (item.quantity * item.price)
    }), { quantity: 0, amount: 0, total: 0 });
  };

  const totals = calculateTotals();

  const handleCloseWaybill = () => {
    setShowWaybill(false);
    navigate('/warehouse');
  };

  // Отображение ошибки компонента
  if (componentError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Ошибка загрузки</h2>
          <p className="text-gray-600 mb-4">{componentError}</p>
          <button
            onClick={() => navigate('/warehouse')}
            className="px-4 py-2 bg-emerald-500 text-white rounded hover:bg-emerald-600"
          >
            Вернуться к складу
          </button>
        </div>
      </div>
    );
  }

  // Отображение loading состояния
  if (isComponentLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <SafeScrollbars
      style={{ width: '100%', height: '100vh' }}
      universal={true}
      renderThumbVertical={props => <div {...props} className="thumb-vertical" />}
      autoHide
      autoHideTimeout={1000}
      autoHideDuration={200}
    >
      <div className="min-h-screen bg-gray-50">
        {/* Шапка */}
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <button onClick={() => navigate('/warehouse')} className="text-gray-600">
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-semibold text-gray-900">Приход новый</h1>
              </div>
              <div className="flex items-center gap-3">
                <button className="text-gray-600">
                  <Search className="w-6 h-6" />
                </button>
                <button className="text-gray-600">
                  <Barcode className="w-6 h-6" />
                </button>
                <button className="text-gray-600">
                  <span className="text-xl">⋮</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Форма */}
        <div className="max-w-7xl mx-auto p-2 sm:p-4 mb-32">
          <div className="bg-white rounded-lg shadow-sm mb-4">
            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              {/* Дата и номер документа */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                    Дата документа
                  </label>
                  <input
                    type="date"
                    value={date}
                    disabled
                    className="w-full px-2 py-1 sm:px-3 sm:py-2 border rounded-lg bg-gray-50 text-gray-500 text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                    Номер документа
                  </label>
                  <input
                    type="text"
                    value={documentNumber}
                    disabled
                    className="w-full px-2 py-1 sm:px-3 sm:py-2 border rounded-lg bg-gray-50 text-gray-500 text-xs sm:text-sm"
                  />
                </div>
              </div>

              {/* Поставщик */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Сотрудник
                </label>
                <select
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Выберите сотрудника</option>
                  {categoriesLoading ? (
                    <option disabled>Загрузка...</option>
                  ) : (
                    employeeCategories.map((category) => (
                      <option key={category.id} value={category.title}>
                        {category.title}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Примечание и файлы */}
              <div className="space-y-1">
                <label htmlFor="note" className="block text-sm font-medium text-gray-700">
                  Примечание
                </label>
                <div className="relative">
                  <textarea
                    id="note"
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="block w-full rounded-md border-0 py-1.5 pr-12 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm sm:leading-6"
                  />
                  <SafeFileUpload onFileUpload={handleFileUpload} files={files} onRemoveFile={handleRemoveFile} />
                </div>
              </div>
            </div>
          </div>

          {/* Список товаров */}
          <div className="bg-white rounded-lg shadow-sm">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                  <div className="text-4xl text-gray-400">📦</div>
                </div>
                <p className="text-gray-500 text-lg">Добавьте товары</p>
              </div>
            ) : (
              <div className="divide-y">
                <div className="p-4 flex justify-end">
                  <button
                    onClick={handleDeleteAll}
                    className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Удалить все
                  </button>
                </div>
                {items.map((item, index) => (
                  <div key={index} className="p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-xs sm:text-base truncate max-w-[180px] sm:max-w-none">
                        {item.product.name}
                      </h3>
                      <div className="mt-1 sm:mt-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm text-gray-500">Кол-во:</span>
                          <input
                            type="number"
                            onFocus={(e) => e.target.value = ''}
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(index, 'quantity', Number(e.target.value))}
                            className="w-14 sm:w-20 px-1 py-0.5 sm:px-2 sm:py-1 border rounded text-right text-xs sm:text-sm"
                            min="1"
                          />
                          <span className="text-xs sm:text-sm text-gray-500">{item.product.unit}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm text-gray-500">Цена:</span>
                          <input
                            type="number"
                            onFocus={(e) => e.target.value = ''}
                            value={item.price}
                            onChange={(e) => handleUpdateItem(index, 'price', Number(e.target.value))}
                            className="w-16 sm:w-24 px-1 py-0.5 sm:px-2 sm:py-1 border rounded text-right text-xs sm:text-sm"
                            min="0"
                          />
                          <span className="text-xs sm:text-sm text-gray-500">₸</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteItem(index)}
                      className="p-1 sm:p-2 text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Нижняя панель */}
          <div className="fixed bottom-0 inset-x-0 bg-white border-t shadow-lg">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center w-full sm:flex-1">
                  <div>
                    <div className="text-lg sm:text-2xl font-bold text-gray-900">{totals.quantity}</div>
                    <div className="text-xs text-gray-500">Кол-во</div>
                  </div>
                  <div>
                    <div className="text-lg sm:text-2xl font-bold text-gray-900">{Math.round(totals.amount).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</div>
                    <div className="text-xs text-gray-500">Сумма</div>
                  </div>
                  <div>
                    <div className="text-lg sm:text-2xl font-bold text-emerald-600">{Math.round(totals.total).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</div>
                    <div className="text-xs text-gray-500">Итого</div>
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !supplier || items.length === 0}
                    className="flex-1 sm:flex-none px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:bg-gray-300 text-sm sm:text-base"
                  >
                    {isSubmitting ? 'Отправка...' : 'Отправить на склад'}
                  </button>
                  <button 
                    onClick={() => navigate('/warehouse')}
                    className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-emerald-600 flex-shrink-0"
                  >
                    <span className="text-2xl">+</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {showWaybill && (
          <SafeIncomeWaybill
            isOpen={showWaybill}
            onClose={() => {
              setShowWaybill(false);
              navigate('/warehouse');
            }}
            data={{
              documentNumber,
              date,
              supplier,
              note,
              items,
              files
            }}
          />
        )}
      </div>
    </SafeScrollbars>
  );
};