import React, { useState, useCallback, useMemo } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { calculateSupervisorSalary } from '../../utils/calculateSupervisorSalary';
import { SUPERVISOR_AREA_LIMITS } from '../../utils/supervisorSalaryConfig';

/** Площади для примера средней загрузки (5 объектов в месяц). */
const EXAMPLE_LOAD_AREAS = [50, 120, 150, 300, 500] as const;
const HIGH_LOAD_OBJECTS = 9;

interface SupervisorSalaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
}

const formatSalary = (value: number): string => {
  return new Intl.NumberFormat('ru-RU').format(value);
};

export const SupervisorSalaryModal: React.FC<SupervisorSalaryModalProps> = ({
  isOpen,
  onClose,
  isMobile,
}) => {
  const [areaInput, setAreaInput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<number | null>(null);
  const [isExampleOpen, setIsExampleOpen] = useState(false);

  const exampleLoadData = useMemo(() => {
    const rows = EXAMPLE_LOAD_AREAS.map((area, index) => {
      const pay = calculateSupervisorSalary(area);
      return { area, pay: pay ?? 0, index: index + 1 };
    });
    const total = rows.reduce((sum, r) => sum + r.pay, 0);
    const avgPerObject = rows.length > 0 ? Math.round(total / rows.length) : 0;
    const highLoadIncome = Math.round(avgPerObject * HIGH_LOAD_OBJECTS);
    return { rows, total, avgPerObject, highLoadIncome };
  }, []);

  const handleCalculate = useCallback(() => {
    setError('');
    setResult(null);
    const raw = areaInput.trim().replace(/,/, '.');
    const num = parseFloat(raw);
    if (raw === '' || Number.isNaN(num)) {
      setError('Введите площадь дома');
      return;
    }
    if (num < SUPERVISOR_AREA_LIMITS.min || num > SUPERVISOR_AREA_LIMITS.max) {
      setError(`Площадь от ${SUPERVISOR_AREA_LIMITS.min} до ${SUPERVISOR_AREA_LIMITS.max} м²`);
      return;
    }
    const salary = calculateSupervisorSalary(num);
    if (salary === null) {
      setError('Не удалось рассчитать');
      return;
    }
    setResult(salary);
  }, [areaInput]);

  const handleClose = useCallback(() => {
    setAreaInput('');
    setError('');
    setResult(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const content = (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Калькулятор ЗП руководителя строительства (технадзор)
        </h2>
        <button
          type="button"
          onClick={handleClose}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Закрыть"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="supervisor-area" className="block text-sm font-medium text-gray-700 mb-1">
            Площадь дома (м²)
          </label>
          <input
            id="supervisor-area"
            type="number"
            min={SUPERVISOR_AREA_LIMITS.min}
            max={SUPERVISOR_AREA_LIMITS.max}
            step={1}
            value={areaInput}
            onChange={(e) => {
              setAreaInput(e.target.value);
              setError('');
              setResult(null);
            }}
            placeholder={`${SUPERVISOR_AREA_LIMITS.min} – ${SUPERVISOR_AREA_LIMITS.max}`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
          />
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>

        <button
          type="button"
          onClick={handleCalculate}
          className="w-full py-2.5 px-4 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors"
        >
          Рассчитать
        </button>

        {result !== null && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-gray-800 font-medium">
              Заработная плата руководителя строительства: {formatSalary(result)} ₸
            </p>
          </div>
        )}

        <div className="border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={() => setIsExampleOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 py-2 text-left rounded-lg hover:bg-gray-50 transition-colors"
            aria-expanded={isExampleOpen}
          >
            <span className="text-sm font-medium text-gray-800">
              Пример средней загрузки (5 объектов в месяц)
            </span>
            {isExampleOpen ? (
              <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
            )}
          </button>
          {isExampleOpen && (
            <div className="mt-2 p-3 sm:p-4 bg-amber-50/80 border border-amber-100 rounded-lg">
              <ul className="space-y-1.5 sm:space-y-2 text-sm">
                {exampleLoadData.rows.map(({ index, area, pay }) => (
                  <li key={`${index}-${area}`} className="flex justify-between gap-2 text-gray-700">
                    <span>Объект {index} – {area} м² →</span>
                    <span className="font-medium tabular-nums">{formatSalary(pay)} ₸</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 sm:mt-4 pt-2 border-t border-amber-200 font-semibold text-gray-900 text-sm sm:text-base">
                ИТОГО в месяц: {formatSalary(exampleLoadData.total)} ₸
              </p>
              <p className="mt-2 text-xs sm:text-sm text-gray-600">
                Ориентировочный доход при средней загрузке 5 объектов в месяц.
              </p>
              <p className="mt-2 text-xs sm:text-sm text-gray-700">
                При высокой сезонной загрузке (9 объектов в месяц): примерный доход ={' '}
                <span className="font-medium tabular-nums">{formatSalary(exampleLoadData.highLoadIncome)} ₸</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <div
          className="absolute inset-0 bg-black/50"
          onClick={handleClose}
          aria-hidden
        />
        <div className="relative w-full max-h-[85vh] bg-white rounded-t-2xl shadow-xl p-5 pb-safe overflow-y-auto animate-slide-up">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden
      />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        {content}
      </div>
    </div>
  );
};
