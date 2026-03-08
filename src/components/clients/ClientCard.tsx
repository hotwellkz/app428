import React, { useState } from 'react';
import { Building2, Eye, EyeOff, X } from 'lucide-react';
import { Client } from '../../types/client';
import { useClientPayments } from '../../hooks/useClientPayments';
import { PaymentProgress } from './PaymentProgress';
import { useReceiptCalculation } from '../../hooks/useReceiptCalculation';
import { ConstructionProgress } from './ConstructionProgress';
import { formatMoney, formatPhoneNumber, formatPercent } from '../../utils/formatters';
import { doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useIsMobile } from '../../hooks/useIsMobile';
import { ClientActions } from './ClientActions';

interface ClientCardProps {
  client: Client;
  onContextMenu: (e: React.MouseEvent, client: Client) => void;
  onClientClick: (client: Client) => void;
  onToggleVisibility: (client: Client) => Promise<void>;
  type: 'building' | 'deposit' | 'built';
  rowNumber: string;
}

// Функция форматирования даты (полный год для desktop)
function formatDate(date: Timestamp | Date | string): string {
  if (!date) return '';
  const dateObj = toDateObj(date);
  return dateObj.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// Короткий формат даты для mobile (двузначный год: 30.01.26)
function formatDateShort(date: Timestamp | Date | string): string {
  if (!date) return '';
  const dateObj = toDateObj(date);
  return dateObj.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  });
}

function toDateObj(date: Timestamp | Date | string): Date {
  if (date instanceof Timestamp) return date.toDate();
  if (typeof date === 'string') return new Date(date);
  return date;
}

export const ClientCard: React.FC<ClientCardProps> = ({
  client,
  onContextMenu,
  onClientClick,
  onToggleVisibility,
  type,
  rowNumber,
}) => {
  const { progress, remainingAmount } = useClientPayments(client);
  const { netProfit } = useReceiptCalculation(client.id);
  const profitPercentage = ((netProfit / (client.totalAmount || 1)) * 100).toFixed(2);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [newAddress, setNewAddress] = useState(client.constructionAddress || '');
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState(client.startDate || '');
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(client.startDate || '');
  const [showBuildDaysModal, setShowBuildDaysModal] = useState(false);
  const [buildDays, setBuildDays] = useState(client.buildDays || 45);
  const [showRemainingDaysModal, setShowRemainingDaysModal] = useState(false);
  const [remainingDaysInput, setRemainingDaysInput] = useState('');
  const isMobile = useIsMobile();

  // Функция расчета дней до начала строительства
  const calculateDaysToStart = () => {
    if (!startDate) return null;
    
    const today = new Date();
    const start = new Date(startDate);
    const diffTime = start.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  // Функция расчета оставшихся дней строительства
  const calculateBuildDaysLeft = () => {
    if (client.status !== 'building') return null;
    
    // Безопасное получение количества дней
    const totalDays = Number(client.buildDays) || Number(buildDays) || 45;
    
    // Используем startDate для расчета дней строительства
    const buildStartDate = client.startDate || client.categoryChangeDate || client.createdAt;
    if (!buildStartDate) return null;
    
    // Безопасный парсинг даты
    const startBuild = new Date(buildStartDate);
    if (isNaN(startBuild.getTime())) return null;
    
    const today = new Date();
    const daysPassed = Math.floor((today.getTime() - startBuild.getTime()) / (1000 * 60 * 60 * 24));
    const daysLeft = totalDays - daysPassed;
    
    // Возвращаем корректное число или 0, но не отрицательное
    return Math.max(0, daysLeft);
  };

  const daysToStart = calculateDaysToStart();
  const buildDaysLeft = calculateBuildDaysLeft();

  // Функция для автоматической установки startDate при переводе в "Строим"
  const handleStatusChange = async (newStatus: 'building' | 'deposit' | 'built') => {
    try {
      const updateData: any = { status: newStatus };
      
      // Если переводим в "Строим" и startDate не установлена - устанавливаем текущую дату
      if (newStatus === 'building' && !client.startDate) {
        updateData.startDate = new Date().toISOString().split('T')[0]; // Формат YYYY-MM-DD
      }
      
      await updateDoc(doc(db, "clients", client.id), updateData);
      
      // Локальное обновление
      (client as any).status = newStatus;
      if (updateData.startDate) {
        (client as any).startDate = updateData.startDate;
        setStartDate(updateData.startDate);
      }
    } catch (error) {
      console.error('Error updating client status:', error);
      alert("Ошибка при изменении статуса клиента");
    }
  };

  const getStatusColors = () => {
    switch (type) {
      case 'building':
        return 'border-emerald-500';
      case 'deposit':
        return 'border-amber-500';
      case 'built':
        return 'border-blue-500';
      default:
        return 'border-gray-300';
    }
  };

  const isDeadlineNear = () => {
    if (type !== 'building') return false;

    const startDate = client.createdAt?.toDate() || new Date();
    const deadlineDate = new Date(startDate);
    deadlineDate.setDate(deadlineDate.getDate() + (client.constructionDays || 0));

    const now = new Date();
    const daysLeft = Math.ceil(
      (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysLeft <= 5;
  };

  const isDeadlinePassed = () => {
    if (type !== 'building') return false;

    const startDate = client.createdAt?.toDate() || new Date();
    const deadlineDate = new Date(startDate);
    deadlineDate.setDate(deadlineDate.getDate() + (client.constructionDays || 0));

    return new Date() > deadlineDate;
  };

  const handleVisibilityClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await onToggleVisibility(client);
  };


  const handleAddressClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setNewAddress(client.constructionAddress || '');
    setShowAddressModal(true);
  };

  const handleDateClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setSelectedDate(startDate || '');
    setShowDateModal(true);
  };

  const handleBuildDaysClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setBuildDays(client.buildDays || 45);
    setShowBuildDaysModal(true);
  };

  const handleRemainingDaysClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setRemainingDaysInput('');
    setShowRemainingDaysModal(true);
  };

  const handleRemainingDaysSubmit = async () => {
    const enteredDaysLeft = parseInt(remainingDaysInput);
    
    if (isNaN(enteredDaysLeft) || enteredDaysLeft < 0) {
      alert("Введите корректное число");
      return;
    }
    
    const totalBuildDays = client.buildDays || 45;
    const daysPassed = totalBuildDays - enteredDaysLeft;
    
    // Рассчитываем дату старта = сегодня минус количество прошедших дней
    const today = new Date();
    const calculatedStartDate = new Date(today);
    calculatedStartDate.setDate(today.getDate() - daysPassed);
    
    const startDateString = calculatedStartDate.toISOString().split('T')[0]; // Формат YYYY-MM-DD
    
    setLoading(true);
    try {
      await updateDoc(doc(db, "clients", client.id), {
        startDate: startDateString,
        buildDays: totalBuildDays
      });
      
      // Локальное обновление
      (client as any).startDate = startDateString;
      (client as any).buildDays = totalBuildDays;
      setStartDate(startDateString);
      setBuildDays(totalBuildDays);
      setShowRemainingDaysModal(false);
      setRemainingDaysInput('');
    } catch (error) {
      console.error('Error updating start date:', error);
      alert("Ошибка при сохранении даты");
    } finally {
      setLoading(false);
    }
  };

  const renderAddress = () => {
    // Для статуса "built" показываем адрес (кликабельный для редактирования)
    if (client.status === 'built') {
      if (client.constructionAddress) {
        const addressDisplay = isMobile
          ? client.constructionAddress.replace(/^г\.\s*/i, '')
          : client.constructionAddress;
        return (
          <span 
            style={{
              fontSize: '10px',
              color: '#999',
              cursor: 'pointer',
              fontWeight: '400'
            }}
            onClick={handleAddressClick}
          >
            {` | ${addressDisplay}`}
          </span>
        );
      } else {
        return (
          <span 
            style={{
              fontSize: '10px',
              color: '#999',
              cursor: 'pointer',
              fontWeight: '400'
            }}
            onClick={handleAddressClick}
          >
            {' | —'}
          </span>
        );
      }
    }

    const separator = ' | ';
    const elements = [];
    
    // Адрес строительства (на mobile — без "г." для компактности)
    if (client.constructionAddress) {
      if (isMobile) {
        const addressForMobile = client.constructionAddress.replace(/^г\.\s*/i, '');
        const shortAddress = addressForMobile.length > 15
          ? addressForMobile.slice(0, 15) + '...'
          : addressForMobile;
          
        elements.push(
          <span 
            key="address"
            style={{
              fontSize: '10px',
              color: '#999',
              display: 'inline',
              cursor: 'pointer',
              fontWeight: '400'
            }}
            onClick={handleAddressClick}
          >
            {shortAddress}
          </span>
        );
      } else {
        // Десктопная версия - тоже кликабельный адрес
        elements.push(
          <span 
            key="address"
            style={{
              fontSize: '10px',
              color: '#999',
              display: 'inline',
              cursor: 'pointer',
              fontWeight: '400'
            }}
            onClick={handleAddressClick}
          >
            {client.constructionAddress}
          </span>
        );
      }
    } else {
      // Если адреса нет - показываем кликабельный элемент для добавления
      elements.push(
        <span 
          key="address"
          style={{
            fontSize: '10px',
            color: '#999',
            display: 'inline',
            cursor: 'pointer',
            fontWeight: '400'
          }}
          onClick={handleAddressClick}
          title="Добавить адрес"
        >
          📍 Добавить адрес
        </span>
      );
    }

    // Логика отображения в зависимости от статуса
    if (client.status === 'deposit') {
      // Для задатка - показываем дату начала строительства
      const dateDisplay = startDate
        ? (isMobile ? formatDateShort(startDate) : new Date(startDate).toLocaleDateString('ru-RU'))
        : '00.00.0000';
        
      elements.push(
        <span 
          key="startDate"
          style={{
            fontSize: '10px',
            color: '#999',
            display: 'inline',
            cursor: 'pointer',
            fontWeight: '400'
          }}
          onClick={handleDateClick}
        >
          📅 {dateDisplay}
        </span>
      );
      
      // Дни до начала
      if (daysToStart !== null && startDate) {
        const isUrgent = daysToStart <= 5 && daysToStart > 0;
        const daysText = daysToStart > 0 
          ? `через ${daysToStart} дн.`
          : daysToStart === 0 
            ? 'сегодня'
            : 'уже началось';
            
        elements.push(
          <span 
            key="days"
            className={isUrgent ? 'blink' : ''}
            style={{
              fontSize: '10px',
              color: isUrgent ? 'red' : '#999',
              display: 'inline',
              fontWeight: isUrgent ? 'bold' : '400'
            }}
          >
            {daysText}
          </span>
        );
      }
    } else if (client.status === 'building') {
      // Для строительства - показываем дату старта и таймер дней (на mobile — короткий формат)
      if (client.startDate) {
        const startDateFormatted = isMobile
          ? formatDateShort(client.startDate)
          : new Date(client.startDate).toLocaleDateString('ru-RU');
        elements.push(
          <span 
            key="startDate"
            style={{
              fontSize: '10px',
              color: '#999',
              display: 'inline',
              cursor: 'pointer',
              fontWeight: '400'
            }}
            onClick={handleDateClick}
          >
            🏗 старт: {startDateFormatted}
          </span>
        );
      }
      
      if (buildDaysLeft !== null && !isNaN(buildDaysLeft)) {
        const isUrgent = buildDaysLeft <= 7;
        const daysText = isMobile ? `ост: ${buildDaysLeft} дн.` : `осталось: ${buildDaysLeft} дн.`;
        
        elements.push(
          <span 
            key="buildDays"
            style={{
              fontSize: '10px',
              color: '#999',
              display: 'inline',
              cursor: 'pointer',
              fontWeight: '400'
            }}
            onClick={handleBuildDaysClick}
          >
            <span 
              className={isUrgent ? 'blink' : ''}
              style={{
                color: isUrgent ? 'red' : 'inherit',
                fontWeight: isUrgent ? 'bold' : 'inherit'
              }}
            >
              {daysText}
            </span>
          </span>
        );
      } else {
        // Показываем предупреждение, если данные некорректны
        elements.push(
          <span 
            key="buildDaysError"
            style={{
              fontSize: '10px',
              color: 'red',
              display: 'inline',
              cursor: 'pointer',
              fontWeight: '400'
            }}
            onClick={handleRemainingDaysClick}
          >
            ⚠ Укажите дату старта
          </span>
        );
      }
    }
    
    if (elements.length > 0) {
      if (isMobile) {
        return (
          <>
            {separator}
            {elements.map((el, index) => (
              <React.Fragment key={index}>
                {index > 0 && ' '}
                {el}
              </React.Fragment>
            ))}
          </>
        );
      } else {
        return (
          <>
            {separator}
            {elements.map((el, index) => (
              <React.Fragment key={index}>
                {index > 0 && ' '}
                {el}
              </React.Fragment>
            ))}
          </>
        );
      }
    }
    
    return '';
  };

  return (
    <>
      <div
        className={`relative bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border-l-4 ${getStatusColors()}`}
      >
        {/* Дата создания клиента */}
        {client.createdAt && (
          <span style={{
            position: 'absolute',
            top: '4px',
            left: '6px',
            fontSize: '10px',
            color: '#999',
            zIndex: 1,
            fontWeight: '400'
          }}>
            {isMobile ? formatDateShort(client.createdAt) : formatDate(client.createdAt)}{renderAddress()}
          </span>
        )}
        
        <div 
          className="p-2.5 sm:p-4"
          onContextMenu={(e) => onContextMenu(e, client)}
          onClick={() => onClientClick(client)}
        >
          {/* Мобильная версия */}
          <div className="sm:hidden pt-3">
            {/* Верхняя строка: номер, дата, имя клиента */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div 
                className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer"
                onClick={() => onClientClick(client)}
                onContextMenu={(e) => onContextMenu(e, client)}
              >
                <span className="text-[10px] font-medium text-gray-500 flex-shrink-0">
                  {rowNumber}
                </span>
                <span
                  className={`font-medium text-xs truncate min-w-0 ${
                    isDeadlinePassed() || isDeadlineNear()
                      ? 'text-red-600'
                      : 'text-gray-900'
                  }`}
                  style={{ maxWidth: 'calc(100vw - 200px)' }}
                >
                  {client.lastName} {client.firstName}
                </span>
              </div>
              {/* Иконки действий - компактная группа справа */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <ClientActions
                  client={client}
                  size="sm"
                  className="flex items-center gap-0.5"
                  stopPropagation
                  allowWrap
                />
                <button
                  onClick={handleVisibilityClick}
                  className="p-0.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
                  title={client.isIconsVisible ? 'Скрыть иконки' : 'Показать иконки'}
                >
                  {client.isIconsVisible ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Вторая строка: объект и сумма */}
            <div 
              className="flex items-center justify-between gap-2 mb-1.5 cursor-pointer"
              onClick={() => onClientClick(client)}
              onContextMenu={(e) => onContextMenu(e, client)}
            >
              <div className="text-[10px] text-gray-600 truncate min-w-0 flex-1" style={{ maxWidth: '60%' }}>
                {client.objectName || '—'}
              </div>
              <div className="text-[10px] text-gray-600 font-medium flex-shrink-0">
                {formatMoney(client.totalAmount || 0)}
              </div>
            </div>

            {/* Третья строка: чистая прибыль */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="text-[10px] text-gray-500 flex-shrink-0">
                Прибыль:
              </div>
              <div className="text-right min-w-0 flex-1">
                {(() => {
                  const percent = parseFloat(profitPercentage);
                  const isValid = !isNaN(percent) && Math.abs(percent) < 10000;
                  
                  if (isValid) {
                    return (
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <span className={`text-[10px] font-medium whitespace-nowrap ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatMoney(netProfit)}
                        </span>
                        <span className={`text-[10px] whitespace-nowrap ${netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          ({formatPercent((netProfit / (client.totalAmount || 1)) * 100)})
                        </span>
                      </div>
                    );
                  } else {
                    return (
                      <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: 'red', fontWeight: 500 }}>
                        ⚠ Заполните
                      </span>
                    );
                  }
                })()}
              </div>
            </div>

            {/* Четвертая строка: прогресс-бары */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="min-w-0">
                <ConstructionProgress client={client} />
              </div>
              <div className="min-w-0">
                <PaymentProgress
                  progress={progress}
                  remainingAmount={remainingAmount}
                />
              </div>
            </div>
          </div>

          {/* Планшетная и десктопная версия */}
          <div className="hidden sm:block">
            <div className="grid grid-cols-[50px,40px,1fr,120px,120px,160px,160px,180px] gap-3 items-center">
              <div className="text-sm font-medium text-gray-500">{rowNumber}</div>

              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center ${
                  type === 'building'
                    ? 'bg-emerald-100'
                    : type === 'deposit'
                    ? 'bg-amber-100'
                    : 'bg-blue-100'
                }`}
              >
                <Building2 className="w-4 h-4 text-gray-600" />
              </div>

              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`font-medium text-sm truncate ${
                    isDeadlinePassed() || isDeadlineNear()
                      ? 'text-red-600'
                      : 'text-gray-900'
                  }`}
                >
                  {client.lastName} {client.firstName}
                </span>
                <span className="text-sm text-gray-500">
                  {client.phone ? formatPhoneNumber(client.phone) : ''}
                </span>
              </div>

              <div className="text-sm text-gray-600 truncate">
                {client.objectName || '—'}
              </div>

              <div className="min-w-[120px]">
                <ConstructionProgress client={client} />
              </div>

              <div className="flex flex-col items-end">
                <span className="text-sm text-gray-600 font-medium whitespace-nowrap">
                  {formatMoney(client.totalAmount || 0)}
                </span>
                {(() => {
                  const percent = parseFloat(profitPercentage);
                  const isValid = !isNaN(percent) && Math.abs(percent) < 10000;
                  
                  if (isValid) {
                    return (
                <span
                  className={`text-xs ${
                    netProfit < 500000 ? 'text-red-600' : 'text-emerald-600'
                  } font-medium whitespace-nowrap`}
                >
                  {formatMoney(netProfit)} ({profitPercentage}%)
                </span>
                    );
                  } else {
                    return (
                      <span className="text-xs font-medium whitespace-nowrap" style={{ color: 'red', fontWeight: 500 }}>
                        ⚠ Заполните
                      </span>
                    );
                  }
                })()}
              </div>

              <PaymentProgress progress={progress} remainingAmount={remainingAmount} />

              <div className="flex items-center gap-2">
                <ClientActions
                  client={client}
                  size="md"
                  className="flex items-center gap-1"
                  stopPropagation
                  allowWrap={false}
                />
                <button
                  onClick={handleVisibilityClick}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                  title={client.isIconsVisible ? 'Скрыть иконки' : 'Показать иконки'}
                >
                  {client.isIconsVisible ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showAddressModal && (
        <div 
          className="address-modal-overlay"
          onClick={() => setShowAddressModal(false)}
        >
          <div 
            className="address-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-semibold text-gray-800">
                {client.constructionAddress ? 'Редактировать адрес строительства' : 'Добавить адрес строительства'}
              </h3>
              <button
                onClick={() => setShowAddressModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
              placeholder="Введите адрес строительства (например: г. Алматы, ул. Абая 123)"
              rows={Math.max(3, newAddress.split('\n').length)}
            />
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  await updateDoc(doc(db, "clients", client.id), {
                    constructionAddress: newAddress
                  });
                  setShowAddressModal(false);
                  // Локальное обновление данных клиента
                  client.constructionAddress = newAddress;
                } catch (error) {
                  console.error('Error updating address:', error);
                  alert("Ошибка при сохранении адреса");
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                fontSize: '14px',
                backgroundColor: '#28a745',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}

      {showDateModal && (
        <div 
          className="address-modal-overlay"
          onClick={() => setShowDateModal(false)}
        >
          <div 
            className="address-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-semibold text-gray-800">
                Выберите дату начала строительства
              </h3>
              <button
                onClick={() => setShowDateModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="date"
              value={selectedDate ? new Date(selectedDate).toISOString().split('T')[0] : ''}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontFamily: 'inherit'
              }}
            />
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  await updateDoc(doc(db, "clients", client.id), {
                    startDate: selectedDate
                  });
                  setStartDate(selectedDate);
                  setShowDateModal(false);
                  // Локальное обновление данных клиента
                  (client as any).startDate = selectedDate;
                } catch (error) {
                  console.error('Error updating start date:', error);
                  alert("Ошибка при сохранении даты");
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading || !selectedDate}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                fontSize: '14px',
                backgroundColor: loading || !selectedDate ? '#ccc' : '#28a745',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: loading || !selectedDate ? 'not-allowed' : 'pointer',
                opacity: loading || !selectedDate ? 0.6 : 1
              }}
            >
              {loading ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}

      {showBuildDaysModal && (
        <div 
          className="address-modal-overlay"
          onClick={() => setShowBuildDaysModal(false)}
        >
          <div 
            className="address-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-semibold text-gray-800">
                Количество дней строительства
              </h3>
              <button
                onClick={() => setShowBuildDaysModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="number"
              value={buildDays}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setBuildDays(!isNaN(value) && value > 0 ? value : 45);
              }}
              min="1"
              max="365"
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontFamily: 'inherit'
              }}
              placeholder="Количество дней (например, 45)"
            />
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  const numericBuildDays = Number(buildDays) || 45;
                  await updateDoc(doc(db, "clients", client.id), {
                    buildDays: numericBuildDays
                  });
                  setShowBuildDaysModal(false);
                  // Локальное обновление данных клиента
                  (client as any).buildDays = numericBuildDays;
                  setBuildDays(numericBuildDays);
                } catch (error) {
                  console.error('Error updating build days:', error);
                  alert("Ошибка при сохранении количества дней");
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading || buildDays < 1}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                fontSize: '14px',
                backgroundColor: loading || buildDays < 1 ? '#ccc' : '#28a745',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: loading || buildDays < 1 ? 'not-allowed' : 'pointer',
                opacity: loading || buildDays < 1 ? 0.6 : 1
              }}
            >
              {loading ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}

      {showRemainingDaysModal && (
        <div 
          className="address-modal-overlay"
          onClick={() => setShowRemainingDaysModal(false)}
        >
          <div 
            className="address-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-semibold text-gray-800">
                Введите количество оставшихся дней
              </h3>
              <button
                onClick={() => setShowRemainingDaysModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="number"
              value={remainingDaysInput}
              onChange={(e) => setRemainingDaysInput(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontFamily: 'inherit'
              }}
              placeholder="Количество оставшихся дней"
            />
            <button
              onClick={handleRemainingDaysSubmit}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                fontSize: '14px',
                backgroundColor: '#28a745',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Сохранить
            </button>
          </div>
        </div>
      )}
    </>
  );
};