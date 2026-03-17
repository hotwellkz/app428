import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, Barcode, Plus, Trash2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, doc, getDoc, serverTimestamp, writeBatch, getDocs, query, where } from 'firebase/firestore';
import { getTransactionStatusForCompany } from '../../lib/firebase/transactions';
import { incrementExpenseCategoryUsage } from '../../lib/firebase/expenseCategories';
import { getNextDocumentNumber } from '../../utils/documentUtils';
import { db } from '../../lib/firebase';
import { useCompanyId } from '../../contexts/CompanyContext';
import { useAuth } from '../../hooks/useAuth';
import { useExpenseCategories } from '../../hooks/useExpenseCategories';
import { Product as WarehouseProduct } from '../../types/warehouse';
import { ProjectSelector } from '../../components/warehouse/ProjectSelector';
import { showErrorNotification, showSuccessNotification } from '../../utils/notifications';
import { ExpenseWaybill } from '../../components/warehouse/ExpenseWaybill';
import { Scrollbars } from 'react-custom-scrollbars-2';
import { FileUpload } from '../../components/FileUpload';
import { calculateExpenseTotals, getProductEffectivePrice, resolveExpenseItemPrice } from '../../utils/warehousePricing';

const GENERAL_EXPENSE_TITLE = 'Общ Расх';
const EXPENSE_PROJECT_KEY = 'expense_selected_project';
const EXPENSE_ITEMS_KEY = 'expense_items';
const EXPENSE_NOTE_KEY = 'expense_note';
const EXPENSE_FILES_KEY = 'expense_files';

interface ExpenseItem {
  product: WarehouseProduct;
  quantity: number;
  price?: number;
}

export const NewExpense: React.FC = () => {
  // Отладка
  console.log('NewExpense component mounted');
  
  const navigate = useNavigate();
  const location = useLocation();
  const companyId = useCompanyId();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [documentNumber, setDocumentNumber] = useState('');
  const [selectedProject, setSelectedProject] = useState(() => {
    const state = location.state as { selectedProject?: string; projectTitle?: string };
    if (state?.selectedProject && state?.projectTitle === GENERAL_EXPENSE_TITLE) {
      return state.selectedProject;
    }
    return localStorage.getItem(EXPENSE_PROJECT_KEY) || '';
  });
  const { user } = useAuth();
  const { categories: expenseCategories } = useExpenseCategories(user?.uid);
  const [expenseCategoryId, setExpenseCategoryId] = useState('');

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
        const nextNumber = await getNextDocumentNumber('expense', companyId);
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
    return localStorage.getItem(EXPENSE_NOTE_KEY) || ''; // Инициализируем из localStorage
  });
  const [items, setItems] = useState<ExpenseItem[]>(() => {
    const savedItems = localStorage.getItem(EXPENSE_ITEMS_KEY);
    if (!savedItems) return [];

    try {
      const parsedItems: ExpenseItem[] = JSON.parse(savedItems);
      return parsedItems.map(item => ({
        ...item,
        price: typeof item.price === 'number' ? item.price : getProductEffectivePrice(item.product)
      }));
    } catch (error) {
      console.error('Failed to parse saved expense items', error);
      return [];
    }
  });
  const [files, setFiles] = useState<Array<{ url: string; type: string; name: string }>>(() => {
    const savedFiles = localStorage.getItem(EXPENSE_FILES_KEY);
    return savedFiles ? JSON.parse(savedFiles) : [];
  });
  const [showWaybill, setShowWaybill] = useState(false);
  const [loading, setLoading] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');

  // Сохраняем items в localStorage при изменении
  useEffect(() => {
    localStorage.setItem(EXPENSE_ITEMS_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    // Сохраняем файлы в localStorage
    localStorage.setItem(EXPENSE_FILES_KEY, JSON.stringify(files));
  }, [files]);

  useEffect(() => {
    const state = location.state as { selectedProject?: string };
    const projectState = location.state as { selectedProject?: string; projectTitle?: string };
    if (projectState?.selectedProject && projectState?.projectTitle) {
      setProjectTitle(projectState.projectTitle);
      setSelectedProject(projectState.selectedProject);
      localStorage.setItem(EXPENSE_PROJECT_KEY, projectState.selectedProject);
    } else if (state?.selectedProject) {
      setSelectedProject(state.selectedProject);
      localStorage.setItem(EXPENSE_PROJECT_KEY, state.selectedProject);
    }
  }, [location.state]);

  // Загружаем название проекта при смене выбора (для показа блока «Категория расхода» при «Общ Расх»)
  useEffect(() => {
    if (!selectedProject) {
      setProjectTitle('');
      return;
    }
    getDoc(doc(db, 'categories', selectedProject))
      .then((snap) => {
        if (snap.exists()) setProjectTitle((snap.data()?.title as string) ?? '');
        else setProjectTitle('');
      })
      .catch(() => setProjectTitle(''));
  }, [selectedProject]);

  // Сохраняем примечание в localStorage при изменении
  useEffect(() => {
    if (note) {
      localStorage.setItem(EXPENSE_NOTE_KEY, note);
    } else {
      localStorage.removeItem(EXPENSE_NOTE_KEY);
    }
  }, [note]);

  // Сохраняем выбранный проект при его изменении
  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId);
    localStorage.setItem(EXPENSE_PROJECT_KEY, projectId);
  };

  const handleFileUpload = (fileData: { url: string; type: string; name: string }) => {
    setFiles(prev => [...prev, fileData]);
  };

  const handleRemoveFile = (url: string) => {
    setFiles(prev => prev.filter(file => file.url !== url));
  };

  useEffect(() => {
    const state = location.state as { addedProduct?: { product: WarehouseProduct; quantity: number } };
    if (state?.addedProduct && state.addedProduct.product && state.addedProduct.quantity) {
      const newItem = {
        product: state.addedProduct.product,
        quantity: state.addedProduct.quantity,
        price: getProductEffectivePrice(state.addedProduct.product),
      };

      // Проверяем количество товара на складе
      if (state.addedProduct.product.quantity === 0) {
        showErrorNotification(`Внимание! Товар "${state.addedProduct.product.name}" закончился на складе`);
      } else if (state.addedProduct.product.quantity <= 5) {
        showErrorNotification(`Внимание! Товар "${state.addedProduct.product.name}" заканчивается на складе (осталось ${state.addedProduct.product.quantity} шт.)`);
      }
      
      setItems(prev => {
        const existingIndex = prev.findIndex(item => item.product.id === newItem.product.id);
        if (existingIndex >= 0) {
          const newItems = [...prev];
          newItems[existingIndex] = {
            ...newItems[existingIndex],
            quantity: newItem.quantity,
            price: newItem.price
          };
          return newItems;
        }
        return [newItem, ...prev]; // Добавляем новый товар в начало списка
      });
      
      navigate('.', { replace: true, state: {} });
    }
  }, [location.state, navigate]);
  const handleAddProducts = () => {
    navigate('/warehouse/products', { state: 'expense' });
  };

  const handleSubmit = async () => {
    if (!selectedProject) {
      showErrorNotification('Выберите проект');
      return;
    }
    if (projectTitle === GENERAL_EXPENSE_TITLE && !expenseCategoryId) {
      showErrorNotification('Выберите категорию расхода');
      return;
    }
    if (items.length === 0) {
      showErrorNotification('Добавьте товары');
      return;
    }
    if (!companyId) return;

    setLoading(true);
    try {
      const txStatus = await getTransactionStatusForCompany(companyId);
      const batch = writeBatch(db);

      // Получаем информацию о проекте и складе (только своей компании)
      const [projectDoc, warehouseQuery] = await Promise.all([
        getDoc(doc(db, 'categories', selectedProject)),
        getDocs(query(
          collection(db, 'categories'),
          where('companyId', '==', companyId),
          where('title', '==', 'Склад'),
          where('row', '==', 4)
        ))
      ]);

      if (!projectDoc.exists()) {
        showErrorNotification('Проект не найден');
        setLoading(false);
        return;
      }
      
      // Получаем ID категории склада
      const warehouseCategory = warehouseQuery.docs[0];
      if (!warehouseCategory) {
        showErrorNotification('Категория склада не найдена');
        setLoading(false);
        return;
      }

      const projectData = projectDoc.data();
      const projectRef = doc(db, 'categories', selectedProject);
      const warehouseCategoryRef = doc(db, 'categories', warehouseCategory.id);
      const timestamp = serverTimestamp();
      
      // Устанавливаем заголовок проекта
      const currentProjectTitle = projectData.title || 'Неизвестный проект';
      setProjectTitle(currentProjectTitle);
      
      // Получаем текущие балансы
      const projectAmount = parseFloat(projectData.amount?.replace(/[^\d.-]/g, '') || '0');
      const warehouseAmount = parseFloat(warehouseCategory.data().amount?.replace(/[^\d.-]/g, '') || '0');
      
      // Рассчитываем общую сумму операции
      const totalAmount = items.reduce((sum, item) => 
        sum + (item.quantity * resolveExpenseItemPrice(item)), 0);
      
      // Обновляем балансы только для одобренных транзакций (owner/superAdmin)
      if (txStatus === 'approved') {
        batch.update(warehouseCategoryRef, {
          amount: `${warehouseAmount - totalAmount} ₸`,
          updatedAt: timestamp
        });
        batch.update(projectRef, {
          amount: `${projectAmount + totalAmount} ₸`,
          updatedAt: timestamp
        });
      }

      // Создаем транзакцию расхода для склада
      const warehouseTransactionRef = doc(collection(db, 'transactions'));
      const projectTransactionRef = doc(collection(db, 'transactions'));

      // Сохраняем документ в коллекцию warehouseDocuments для обеспечения уникальной нумерации
      const warehouseDocumentRef = doc(collection(db, 'warehouseDocuments'));
      batch.set(warehouseDocumentRef, {
        documentNumber,
        type: 'expense',
        date: timestamp,
        projectId: selectedProject,
        projectTitle: currentProjectTitle,
        totalAmount,
        companyId,
        createdAt: timestamp
      });

      const isGeneralExpense = currentProjectTitle === GENERAL_EXPENSE_TITLE;
      const savedExpenseCategoryId = isGeneralExpense && expenseCategoryId ? expenseCategoryId : undefined;

      batch.set(warehouseTransactionRef, {
        categoryId: warehouseCategory.id,
        fromUser: 'Склад',
        toUser: currentProjectTitle,
        amount: -totalAmount,
        description: `Расход со склада по накладной №${documentNumber}`,
        waybillNumber: documentNumber,
        waybillData: {
          documentNumber,
          date,
          project: currentProjectTitle,
          note,
          items: items.map(item => ({
            product: {
              name: item.product.name,
              unit: item.product.unit
            } as const,
            quantity: item.quantity,
            price: resolveExpenseItemPrice(item)
          })),
          files
        },
        type: 'expense',
        date: timestamp,
        isWarehouseOperation: true,
        relatedTransactionId: projectTransactionRef.id,
        companyId,
        status: txStatus,
        ...(savedExpenseCategoryId ? { expenseCategoryId: savedExpenseCategoryId } : {})
      });

      batch.set(projectTransactionRef, {
        categoryId: selectedProject,
        fromUser: 'Склад',
        toUser: currentProjectTitle,
        amount: totalAmount,
        description: `Приход со склада по накладной №${documentNumber}`,
        waybillNumber: documentNumber,
        waybillData: {
          documentNumber,
          date,
          project: currentProjectTitle,
          note,
          items: items.map(item => ({
            product: {
              name: item.product.name,
              unit: item.product.unit
            } as const,
            quantity: item.quantity,
            price: resolveExpenseItemPrice(item)
          })),
          files
        },
        type: 'income',
        date: timestamp,
        isWarehouseOperation: true,
        relatedTransactionId: warehouseTransactionRef.id,
        companyId,
        status: txStatus,
        ...(savedExpenseCategoryId ? { expenseCategoryId: savedExpenseCategoryId } : {})
      });

      // Обновляем количество товаров на складе
      for (const item of items) {
        const productRef = doc(db, 'products', item.product.id);
        const productDoc = await getDoc(productRef);
        
        if (!productDoc.exists()) {
          throw new Error(`Товар ${item.product.name} не найден`);
        }

        const currentData = productDoc.data();
        const currentQuantity = currentData.quantity || 0;
        
        if (currentQuantity < item.quantity) {
          throw new Error(`Недостаточное количество товара ${item.product.name} на складе`);
        }

        // Уменьшаем количество товара
        const newQuantity = currentQuantity - item.quantity;

        console.log('[WAREHOUSE MUTATION]', {
          source: 'NewExpense.handleSubmit',
          productId: item.product.id,
          productName: item.product.name,
          beforeQty: currentQuantity,
          delta: -item.quantity,
          afterQty: newQuantity,
          documentNumber,
          selectedProject,
          type: 'expense'
        });
        
        // ВАЖНО: При расходах средняя цена НЕ меняется!
        // Она рассчитывается только по приходным операциям
        // Обновляем только количество и общую стоимость (для отображения)
        const currentAveragePrice = currentData.averagePurchasePrice || 0;
        const manualPriceEnabled = currentData.manualPriceEnabled === true;
        const effectivePrice = manualPriceEnabled 
          ? (currentData.manualAveragePrice || currentAveragePrice)
          : currentAveragePrice;
        
        let updateData: any = {
          quantity: newQuantity,
          // Обновляем totalPurchasePrice для корректного отображения общей стоимости
          totalPurchasePrice: newQuantity * effectivePrice,
          updatedAt: timestamp
        };
        
        // Сохраняем среднюю цену (она не меняется при расходах)
        updateData.averagePurchasePrice = currentAveragePrice;
        
        // Если включен ручной режим, сохраняем ручную цену
        if (manualPriceEnabled && currentData.manualAveragePrice !== undefined) {
          updateData.manualAveragePrice = currentData.manualAveragePrice;
          updateData.manualPriceEnabled = true;
        }
        
        batch.update(productRef, updateData);

        // Добавляем запись в историю движения товара
        const movementRef = doc(collection(db, 'productMovements'));
        // При расходе средняя цена не меняется, поэтому previousAveragePrice = newAveragePrice
        
        batch.set(movementRef, {
          productId: item.product.id,
          companyId,
          type: 'out',
          quantity: item.quantity,
          price: effectivePrice,
          totalPrice: item.quantity * effectivePrice,
          warehouse: 'Основной склад',
          description: `Расход товара на проект ${currentProjectTitle}`,
          date: timestamp,
          previousQuantity: currentQuantity,
          newQuantity: newQuantity,
          previousAveragePrice: currentAveragePrice,
          newAveragePrice: currentAveragePrice,
          project: currentProjectTitle
        });
      }
      
      await batch.commit();

      if (savedExpenseCategoryId) {
        try {
          await incrementExpenseCategoryUsage(savedExpenseCategoryId);
        } catch (err) {
          console.warn('incrementExpenseCategoryUsage failed:', err);
        }
      }

      // Очищаем localStorage перед показом накладной
      const clearLocalStorage = () => {
        localStorage.removeItem(EXPENSE_ITEMS_KEY);
        localStorage.removeItem(EXPENSE_PROJECT_KEY);
        localStorage.removeItem(EXPENSE_NOTE_KEY);
        localStorage.removeItem(EXPENSE_FILES_KEY);
      };
      clearLocalStorage();
      
      showSuccessNotification('Товары успешно списаны на проект');
      
      // Показываем накладную и затем переходим на страницу склада
      setShowWaybill(true);
    } catch (error) {
      console.error('Error submitting expense:', error);
      showErrorNotification(error instanceof Error ? error.message : 'Ошибка при списании товаров');
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateExpenseTotals(items);

  const handleDeleteItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteAll = () => {
    if (window.confirm('Вы уверены, что хотите удалить все товары?')) {
      setItems([]);
      localStorage.removeItem(EXPENSE_ITEMS_KEY);
    }
  };

  const handleCloseWaybill = () => {
    setShowWaybill(false);
    // Очищаем localStorage
    localStorage.removeItem(EXPENSE_ITEMS_KEY);
    localStorage.removeItem(EXPENSE_PROJECT_KEY);
    localStorage.removeItem(EXPENSE_NOTE_KEY);
    localStorage.removeItem(EXPENSE_FILES_KEY);
    // Используем setTimeout, чтобы дать время для очистки состояния
    setTimeout(() => {
      // Используем window.location вместо navigate
      window.location.href = '/warehouse';
    }, 100);
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
    <Scrollbars
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
                <h1 className="text-xl font-semibold text-gray-900">Расход новый</h1>
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

              {/* Проект */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Проект
                </label>
                <ProjectSelector
                  value={selectedProject}
                  onChange={handleProjectChange}
                />
              </div>

              {/* Категория расхода — только для «Общ Расх» */}
              {projectTitle === GENERAL_EXPENSE_TITLE && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Категория расхода <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={expenseCategoryId}
                    onChange={(e) => setExpenseCategoryId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-sm"
                    required={projectTitle === GENERAL_EXPENSE_TITLE}
                  >
                    <option value="">Выберите категорию</option>
                    {expenseCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                  <FileUpload onFileUpload={handleFileUpload} files={files} onRemoveFile={handleRemoveFile} />
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
                      <div 
                        key={item.product.id} 
                        className={`bg-white rounded-lg p-4 shadow-sm flex items-center justify-between ${
                          item.product.quantity === 0 ? 'border-2 border-red-500' : ''
                        }`}
                      >
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
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[index].quantity = Number(e.target.value);
                                  setItems(newItems);
                                }}
                                className="w-14 sm:w-20 px-1 py-0.5 sm:px-2 sm:py-1 border rounded text-right text-xs sm:text-sm"
                                min="1"
                              />
                              <span className="text-xs sm:text-sm text-gray-500">{item.product.unit}</span>
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
                        disabled={
                          loading ||
                          !selectedProject ||
                          items.length === 0 ||
                          (projectTitle === GENERAL_EXPENSE_TITLE && !expenseCategoryId)
                        }
                        className="flex-1 sm:flex-none px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:bg-gray-300 text-sm sm:text-base"
                      >
                        {loading ? 'Отправка...' : 'Отправить на проект'}
                      </button>
                      <button 
                        onClick={() => navigate('/warehouse')}
                        className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-emerald-600 transition-colors flex-shrink-0"
                      >
                        <span className="text-2xl">+</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        
          {showWaybill && (
            <ExpenseWaybill
              isOpen={showWaybill}
              onClose={handleCloseWaybill}
              data={{
                documentNumber,
                date,
                project: projectTitle,
                note,
                items,
                files
              }}
            />
          )}
        </div>
      </div>
    </Scrollbars>
  );
};