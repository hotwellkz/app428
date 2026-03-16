import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Calculator } from 'lucide-react';
import { useReceiptCalculation } from '../../hooks/useReceiptCalculation';
import { ReceiptCalculationProps } from '../../types/receipt';

export const ReceiptCalculation: React.FC<ReceiptCalculationProps> = ({
  clientId
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const data = useReceiptCalculation(clientId);

  const formatAmount = (amount: number): string => {
    return Math.round(amount).toLocaleString('ru-RU') + ' ₸';
  };

  return (
    <div className="mt-6 bg-white rounded-lg shadow-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-gray-400" />
          <span className="font-medium text-gray-900 text-sm sm:text-base">Расчет по чекам</span>
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {isExpanded && (
        <div className="divide-y divide-gray-100">
          {/* Операционный расход */}
          <div className="p-3 sm:p-4 hover:bg-gray-50">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-xs sm:text-base">Операционный расход</span>
              <span className="font-medium text-xs sm:text-base">{formatAmount(data.operationalExpense)}</span>
            </div>
          </div>
          
          {/* СИП панели */}
          <div className="p-3 sm:p-4 hover:bg-gray-50">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-xs sm:text-base">Стены из СИП панелей (несущие)</span>
              <span className="font-medium text-xs sm:text-base">{formatAmount(data.sipWalls)}</span>
            </div>
          </div>
          
          {/* Утепление потолка */}
          <div className="p-3 sm:p-4 hover:bg-gray-50">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-gray-600 text-xs sm:text-base">Пенополистирол (утепление потолка)</span>
                {data.ceilingInsulation > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-emerald-100 text-emerald-800">
                    Синхронизировано с Крышей
                  </span>
                )}
              </div>
              <span className="font-medium text-xs sm:text-base">{formatAmount(data.ceilingInsulation)}</span>
            </div>
            {data.ceilingInsulation === 0 && (
              <div className="mt-1 text-xs text-amber-600">
                ⚠️ Не найдено в смете "Крыша + навес"
              </div>
            )}
          </div>
          
          {/* Общий расход */}
          <div className="p-3 sm:p-4 hover:bg-gray-50">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-xs sm:text-base">Общий расход + Работа + Склад</span>
              <span className="font-medium text-xs sm:text-base">{formatAmount(data.generalExpense)}</span>
            </div>
          </div>

          {/* Цена по договору */}
          <div className="p-3 sm:p-4 bg-blue-50">
            <div className="flex justify-between items-center">
              <span className="font-medium text-blue-900 text-xs sm:text-base">Цена по договору</span>
              <span className="font-bold text-blue-900 text-xs sm:text-base">{formatAmount(data.contractPrice)}</span>
            </div>
          </div>
          
          {/* Итого общий расход */}
          <div className="p-3 sm:p-4 bg-gray-50">
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-900 text-xs sm:text-base">Итого общий расход</span>
              <span className="font-bold text-gray-900 text-xs sm:text-base">{formatAmount(data.totalExpense)}</span>
            </div>
          </div>
          
          {/* Итого чистая прибыль */}
          <div className="p-3 sm:p-4 bg-red-50">
            <div className="flex justify-between items-center">
              <span className="font-medium text-red-900 text-xs sm:text-base">Итого чистая прибыль</span>
              <span className="font-bold text-red-900 text-xs sm:text-base">{formatAmount(data.netProfit)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};