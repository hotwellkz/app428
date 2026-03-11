import React, { useState, useEffect, useRef } from 'react';
import { Input } from './Input';
import { Dropdown } from './Dropdown';
import { CalculatorState, CalculationResult, CalculatorInput, CustomWork } from '../../types/calculator';
import { calculatePrice } from '../../utils/calculatePrice';
import { loadCalculatorConfig, getConfigSync } from '../../utils/configLoader';
import { PARTITION_OPTIONS } from '../../utils/calculatorData';
import { DELIVERY_CITIES } from '../../utils/deliveryData';
import { calculatorFormatters } from '../../utils/calculatorFormatters';

interface CalculatorFormProps {
  onCalculationChange: (result: CalculationResult, area: number) => void;
  onOptionsChange?: (options: { isVatIncluded: boolean; isInstallment: boolean; installmentAmount: number; hideFundamentCost: boolean; hideKitCost: boolean; hideAssemblyCost: boolean; hideDeliveryCost: boolean }) => void;
  onParametersChange?: (parameters: any) => void;
  isAdvancedMode?: boolean;
  /** Начальные значения формы (например из кэша для чата) */
  initialValues?: Partial<CalculatorState>;
}

// Получить опции перегородок для определенной высоты
const getPartitionOptionsForHeight = (height: number) => {
  if (height === 2.5) return PARTITION_OPTIONS.height_2_5;
  if (height === 2.8) return PARTITION_OPTIONS.height_2_8;
  if (height === 2.9) return PARTITION_OPTIONS.height_2_9;
  if (height === 3.0) return PARTITION_OPTIONS.height_3_0;
  if (height === 3.5) return PARTITION_OPTIONS.height_3_5;
  if (height === 4.0) return PARTITION_OPTIONS.height_4_0;
  return PARTITION_OPTIONS.height_2_5; // fallback
};

export const CalculatorForm: React.FC<CalculatorFormProps> = ({ 
  onCalculationChange, 
  onOptionsChange, 
  onParametersChange, 
  isAdvancedMode = true,
  initialValues
}) => {
  const [configLoaded, setConfigLoaded] = useState(false);
  const appliedInitialRef = useRef(false);

  // Загружаем конфигурацию при монтировании компонента
  useEffect(() => {
    const initConfig = async () => {
      await loadCalculatorConfig();
      setConfigLoaded(true);
    };
    initConfig();
  }, []);

  const [formData, setFormData] = useState<CalculatorState>({
    area: '',
    foundation: '',
    floors: '',
    firstFloorType: '',
    secondFloorType: '',
    thirdFloorType: '',
    firstFloorHeight: '',
    secondFloorHeight: '',
    thirdFloorHeight: '',
    firstFloorThickness: '',
    secondFloorThickness: '',
    thirdFloorThickness: '',
    partitionType: '',
    ceiling: '',
    roofType: '2-скатная (строп. сист. + металлочерепица)',
    houseShape: '',
    additionalWorks: '',
    useCustomWorks: false,
    customWorks: [{ name: '', price: 0 }],
    deliveryCity: '',
  });

  // Стандартные значения при открытии калькулятора (простой и профессиональный режим)
  const STANDARD_DEFAULTS = {
    foundation: 'Ж/Б ленточный, Выс 50см',
    floors: '1 этаж',
    firstFloorType: 'Полноценный',
    firstFloorHeight: '2,5 м',
    firstFloorThickness: 'SIP-163 мм',
    partitionType: 'Профиль + гипсокартон + мин. вата, толщина 100 мм',
    ceiling: 'Потолок утеплённый (пенополистирол 145 мм)',
    roofType: '2-скатная (строп. сист. + металлочерепица)',
    houseShape: 'Простая форма',
  };

  // Инициализируем стандартные значения один раз после загрузки конфигурации. Кэш (initialValues) подмешиваем только по непустым полям.
  useEffect(() => {
    if (!configLoaded || appliedInitialRef.current) return;
    appliedInitialRef.current = true;
    const config = getConfigSync();
    setFormData(prev => {
      const defaults = {
        foundation: prev.foundation || STANDARD_DEFAULTS.foundation,
        floors: prev.floors || STANDARD_DEFAULTS.floors,
        firstFloorType: prev.firstFloorType || STANDARD_DEFAULTS.firstFloorType,
        secondFloorType: prev.secondFloorType || config.SECOND_FLOOR_TYPE_OPTIONS[0]?.label || '',
        thirdFloorType: prev.thirdFloorType || config.THIRD_FLOOR_TYPE_OPTIONS[0]?.label || '',
        firstFloorHeight: prev.firstFloorHeight || STANDARD_DEFAULTS.firstFloorHeight,
        secondFloorHeight: prev.secondFloorHeight || config.FLOOR_HEIGHT_OPTIONS[0]?.label || '',
        thirdFloorHeight: prev.thirdFloorHeight || config.FLOOR_HEIGHT_OPTIONS[0]?.label || '',
        firstFloorThickness: prev.firstFloorThickness || STANDARD_DEFAULTS.firstFloorThickness,
        secondFloorThickness: prev.secondFloorThickness || config.WALL_THICKNESS_OPTIONS[0]?.label || '',
        thirdFloorThickness: prev.thirdFloorThickness || config.WALL_THICKNESS_OPTIONS[0]?.label || '',
        partitionType: prev.partitionType || STANDARD_DEFAULTS.partitionType,
        ceiling: prev.ceiling || STANDARD_DEFAULTS.ceiling,
        roofType: prev.roofType || STANDARD_DEFAULTS.roofType,
        houseShape: prev.houseShape || STANDARD_DEFAULTS.houseShape,
        additionalWorks: prev.additionalWorks || config.ADDITIONAL_WORKS_OPTIONS[0]?.label || '',
        deliveryCity: prev.deliveryCity || (config.DELIVERY_OPTIONS || DELIVERY_CITIES)[0]?.label || '',
      };
      const next = { ...prev, ...defaults };
      if (!initialValues || typeof initialValues !== 'object') return next;
      const merged = { ...next };
      for (const [key, val] of Object.entries(initialValues)) {
        if (val === undefined || val === null) continue;
        if (typeof val === 'string' && val.trim() === '') continue;
        if (typeof val === 'number' && Number.isNaN(val)) continue;
        if (key in merged) merged[key as keyof CalculatorState] = val as never;
      }
      return merged;
    });
  }, [configLoaded, initialValues]);

  const [areaError, setAreaError] = useState<string>('');
  
  // Состояние для чекбоксов НДС и рассрочки
  const [isVatIncluded, setIsVatIncluded] = useState(false);
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentAmount, setInstallmentAmount] = useState<number>(0);

  // Состояние для чекбоксов отображения разделов стоимости
  const [hideFundamentCost, setHideFundamentCost] = useState(false);
  const [hideKitCost, setHideKitCost] = useState(false);
  const [hideAssemblyCost, setHideAssemblyCost] = useState(false);
  const [hideDeliveryCost, setHideDeliveryCost] = useState(false);

  // Функции для управления кастомными работами
  const updateCustomWork = (index: number, field: keyof CustomWork, value: string | number) => {
    const updatedWorks = [...formData.customWorks];
    updatedWorks[index] = { ...updatedWorks[index], [field]: value };
    setFormData(prev => ({ ...prev, customWorks: updatedWorks }));
  };

  const addCustomWork = () => {
    setFormData(prev => ({
      ...prev,
      customWorks: [...prev.customWorks, { name: '', price: 0 }]
    }));
  };

  const removeCustomWork = (index: number) => {
    if (formData.customWorks.length > 1) {
      setFormData(prev => ({
        ...prev,
        customWorks: prev.customWorks.filter((_, i) => i !== index)
      }));
    }
  };

  // Валидация площади
  const validateArea = (area: string): string => {
    if (!area) return '';
    if (!configLoaded) return '';
    
    const numArea = parseFloat(area);
    const config = getConfigSync();
    if (isNaN(numArea)) return 'Введите корректное число';
    if (numArea < config.AREA_LIMITS.min) return `Минимальная площадь ${config.AREA_LIMITS.min} м²`;
    if (numArea > config.AREA_LIMITS.max) return `Максимальная площадь ${config.AREA_LIMITS.max} м²`;
    return '';
  };

  // Обновить расчет при изменении данных
  useEffect(() => {
    if (!configLoaded) return;
    
    const area = parseFloat(formData.area) || 0;
    const config = getConfigSync();
    
    if (area >= config.AREA_LIMITS.min && area <= config.AREA_LIMITS.max) {
      const firstFloorHeightOption = config.FLOOR_HEIGHT_OPTIONS.find((opt: any) => opt.label === formData.firstFloorHeight);
      const secondFloorHeightOption = config.FLOOR_HEIGHT_OPTIONS.find((opt: any) => opt.label === formData.secondFloorHeight);
      const thirdFloorHeightOption = config.FLOOR_HEIGHT_OPTIONS.find((opt: any) => opt.label === formData.thirdFloorHeight);
      
      const firstFloorThicknessOption = config.WALL_THICKNESS_OPTIONS.find((opt: any) => opt.label === formData.firstFloorThickness);
      const secondFloorThicknessOption = config.WALL_THICKNESS_OPTIONS.find((opt: any) => opt.label === formData.secondFloorThickness);
      const thirdFloorThicknessOption = config.WALL_THICKNESS_OPTIONS.find((opt: any) => opt.label === formData.thirdFloorThickness);
      
      // Для 3 этажей автоматически используем "Полноценный" для второго этажа
      const effectiveSecondFloorType = formData.floors === '3 этажа' ? 'Полноценный' : formData.secondFloorType;
      
      const calculatorInput: CalculatorInput = {
        area,
        foundation: formData.foundation,
        floors: formData.floors,
        firstFloorType: formData.firstFloorType,
        secondFloorType: effectiveSecondFloorType,
        thirdFloorType: formData.thirdFloorType,
        firstFloorHeight: firstFloorHeightOption?.value || 2.5,
        secondFloorHeight: secondFloorHeightOption?.value || 2.5,
        thirdFloorHeight: thirdFloorHeightOption?.value || 2.5,
        firstFloorThickness: firstFloorThicknessOption?.value || 163,
        secondFloorThickness: secondFloorThicknessOption?.value || 163,
        thirdFloorThickness: thirdFloorThicknessOption?.value || 163,
        partitionType: formData.partitionType,
        ceiling: formData.ceiling,
        roofType: formData.roofType,
        houseShape: formData.houseShape,
        additionalWorks: formData.additionalWorks,
        useCustomWorks: formData.useCustomWorks,
        customWorks: formData.customWorks,
        deliveryCity: formData.deliveryCity,
      };

      const result = calculatePrice(calculatorInput);
      onCalculationChange(result, area);
    } else {
      onCalculationChange({
        fundamentCost: 0,
        kitCost: 0,
        assemblyCost: 0,
        total: 0,
        pricePerSqm: 0,
        deliveryCost: 0
      }, area);
    }
  }, [formData, onCalculationChange, configLoaded]);

  // Передаем состояние чекбоксов в родительский компонент
  useEffect(() => {
    if (onOptionsChange) {
      onOptionsChange({ 
        isVatIncluded, 
        isInstallment, 
        installmentAmount,
        hideFundamentCost,
        hideKitCost,
        hideAssemblyCost,
        hideDeliveryCost
      });
    }
  }, [isVatIncluded, isInstallment, installmentAmount, hideFundamentCost, hideKitCost, hideAssemblyCost, hideDeliveryCost, onOptionsChange]);

  // Передаем параметры калькулятора в родительский компонент
  useEffect(() => {
    if (onParametersChange) {
      onParametersChange({
        foundation: formData.foundation,
        floors: formData.floors,
        firstFloorType: formData.firstFloorType,
        secondFloorType: formData.secondFloorType,
        thirdFloorType: formData.thirdFloorType,
        firstFloorHeight: formData.firstFloorHeight,
        secondFloorHeight: formData.secondFloorHeight,
        thirdFloorHeight: formData.thirdFloorHeight,
        firstFloorThickness: formData.firstFloorThickness,
        secondFloorThickness: formData.secondFloorThickness,
        thirdFloorThickness: formData.thirdFloorThickness,
        partitionType: formData.partitionType,
        ceiling: formData.ceiling,
        roofType: formData.roofType,
        houseShape: formData.houseShape,
        additionalWorks: formData.additionalWorks,
        useCustomWorks: formData.useCustomWorks,
        customWorks: formData.customWorks,
        deliveryCity: formData.deliveryCity,
      });
    }
  }, [formData, isVatIncluded, isInstallment, installmentAmount, hideFundamentCost, hideKitCost, hideAssemblyCost, hideDeliveryCost, onParametersChange]);

  const handleFieldChange = (field: keyof CalculatorState, value: string) => {
    if (field === 'area') {
      setAreaError(validateArea(value));
    }

    // Обработка чекбокса для кастомных работ
    if (field === 'useCustomWorks') {
      const boolValue = value === 'true';
      setFormData(prev => ({
        ...prev,
        [field]: boolValue
      }));
      return;
    }

    // При изменении высоты первого этажа, обновляем опции перегородок
    if (field === 'firstFloorHeight' && configLoaded) {
      const config = getConfigSync();
      const heightOption = config.FLOOR_HEIGHT_OPTIONS.find((opt: any) => opt.label === value);
      if (heightOption) {
        const partitionOptions = getPartitionOptionsForHeight(heightOption.value);
        setFormData(prev => ({
          ...prev,
          [field]: value,
          partitionType: partitionOptions[0]?.label || '' // сбрасываем на первую опцию
        }));
        return;
      }
    }

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Получаем текущие опции перегородок
  const currentFirstFloorHeight = configLoaded ? 
    getConfigSync().FLOOR_HEIGHT_OPTIONS.find((opt: any) => opt.label === formData.firstFloorHeight) :
    null;
  const currentPartitionOptions = configLoaded && currentFirstFloorHeight ? 
    getPartitionOptionsForHeight(currentFirstFloorHeight.value) : [];

  // Фильтруем опции крыши в зависимости от количества этажей
  const filteredRoofOptions = configLoaded ? 
    getConfigSync().ROOF_OPTIONS.filter((option: any) => {
      if (!option.floors) return true;
      return option.floors === formData.floors.charAt(0);
    }) : [];

  if (!configLoaded) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка конфигурации калькулятора...</p>
        </div>
      </div>
    );
  }

  const config = getConfigSync();

  return (
    <div className="space-y-6">
      {/* Информация о режиме */}
      {!isAdvancedMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="p-1 bg-blue-100 rounded-lg">
              <span className="text-blue-600 text-lg">ℹ️</span>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-800 mb-1">
                Упрощенный режим расчета
              </h4>
              <p className="text-sm text-blue-700">
                Некоторые технические параметры (фундамент, перегородки, потолок, толщина стен) 
                установлены по умолчанию и участвуют в расчете. 
                Для их настройки переключитесь в профессиональный режим.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Площадь застройки */}
        <Input
          label="Площадь застр. (м²)"
          value={formData.area}
          onChange={(value) => handleFieldChange('area', value)}
          type="number"
          min={config.AREA_LIMITS.min}
          max={config.AREA_LIMITS.max}
          placeholder={`Введите площадь от ${config.AREA_LIMITS.min} до ${config.AREA_LIMITS.max} м²`}
          error={areaError}
        />

        {/* Фундамент - только в профессиональном режиме */}
        {isAdvancedMode && (
          <Dropdown
            label="Фундамент"
            value={formData.foundation}
            onChange={(value) => handleFieldChange('foundation', value)}
            options={config.FOUNDATION_OPTIONS.map((opt: any) => ({ label: opt.label, value: opt.label }))}
          />
        )}

        {/* Количество этажей */}
        <Dropdown
          label="Количество этажей"
          value={formData.floors}
          onChange={(value) => handleFieldChange('floors', value)}
          options={config.FLOORS_OPTIONS.map((opt: any) => ({ label: opt.label, value: opt.label }))}
        />

        {/* Тип первого этажа (только для одноэтажных домов) */}
        {formData.floors === '1 этаж' && (
          <Dropdown
            label="Тип первого этажа"
            value={formData.firstFloorType}
            onChange={(value) => handleFieldChange('firstFloorType', value)}
            options={config.FIRST_FLOOR_TYPE_OPTIONS.map((opt: any) => ({ label: opt.label, value: opt.label }))}
          />
        )}

        {/* Тип второго этажа (только для двухэтажных домов) */}
        {formData.floors === '2 этажа' && (
          <Dropdown
            label="Тип второго этажа"
            value={formData.secondFloorType}
            onChange={(value) => handleFieldChange('secondFloorType', value)}
            options={config.SECOND_FLOOR_TYPE_OPTIONS.map((opt: any) => ({ label: opt.label, value: opt.label }))}
          />
        )}

        {/* Тип третьего этажа (только для трехэтажных домов) */}
        {formData.floors === '3 этажа' && (
          <Dropdown
            label="Тип третьего этажа"
            value={formData.thirdFloorType}
            onChange={(value) => handleFieldChange('thirdFloorType', value)}
            options={config.THIRD_FLOOR_TYPE_OPTIONS.map((opt: any) => ({ label: opt.label, value: opt.label }))}
          />
        )}

        {/* Высота первого этажа */}
        <Dropdown
          label="Высота первого этажа"
          value={formData.firstFloorHeight}
          onChange={(value) => handleFieldChange('firstFloorHeight', value)}
          options={config.FLOOR_HEIGHT_OPTIONS.map((opt: any) => ({ label: opt.label, value: opt.label }))}
        />

        {/* Толщина стены первого этажа - только в профессиональном режиме */}
        {isAdvancedMode && (
          <Dropdown
            label="Толщина ст. 1-го эт."
            value={formData.firstFloorThickness}
            onChange={(value) => handleFieldChange('firstFloorThickness', value)}
            options={config.WALL_THICKNESS_OPTIONS.map((opt: any) => ({ label: opt.label, value: opt.label }))}
          />
        )}

        {/* Высота второго этажа (только для двухэтажных и трехэтажных домов) */}
        {(formData.floors === '2 этажа' || formData.floors === '3 этажа') && (
          <Dropdown
            label="Высота второго этажа"
            value={formData.secondFloorHeight}
            onChange={(value) => handleFieldChange('secondFloorHeight', value)}
            options={config.FLOOR_HEIGHT_OPTIONS.map((opt: any) => ({ label: opt.label, value: opt.label }))}
          />
        )}

        {/* Толщина стены второго этажа - только в профессиональном режиме */}
        {isAdvancedMode && (formData.floors === '2 этажа' || formData.floors === '3 этажа') && (
          <Dropdown
            label="Толщина стены 2-го этажа"
            value={formData.secondFloorThickness}
            onChange={(value) => handleFieldChange('secondFloorThickness', value)}
            options={config.WALL_THICKNESS_OPTIONS.map((opt: any) => ({ label: opt.label, value: opt.label }))}
          />
        )}

        {/* Высота третьего этажа (только для трехэтажных домов) */}
        {formData.floors === '3 этажа' && (
          <Dropdown
            label="Высота третьего этажа"
            value={formData.thirdFloorHeight}
            onChange={(value) => handleFieldChange('thirdFloorHeight', value)}
            options={config.FLOOR_HEIGHT_OPTIONS.map((opt: any) => ({ label: opt.label, value: opt.label }))}
          />
        )}

        {/* Толщина стены третьего этажа - только в профессиональном режиме */}
        {isAdvancedMode && formData.floors === '3 этажа' && (
          <Dropdown
            label="Толщина стены 3-го этажа"
            value={formData.thirdFloorThickness}
            onChange={(value) => handleFieldChange('thirdFloorThickness', value)}
            options={config.WALL_THICKNESS_OPTIONS.map((opt: any) => ({ label: opt.label, value: opt.label }))}
          />
        )}

        {/* Тип перегородок - только в профессиональном режиме */}
        {isAdvancedMode && (
          <Dropdown
            label="Тип перегородок"
            value={formData.partitionType}
            onChange={(value) => handleFieldChange('partitionType', value)}
            options={currentPartitionOptions.map((opt: any) => ({ label: opt.label, value: opt.label }))}
          />
        )}

        {/* Потолок - только в профессиональном режиме */}
        {isAdvancedMode && (
          <Dropdown
            label="Потолок"
            value={formData.ceiling}
            onChange={(value) => handleFieldChange('ceiling', value)}
            options={config.CEILING_OPTIONS.map((opt: any) => ({ label: opt.label, value: opt.label }))}
          />
        )}

        {/* Тип крыши */}
        <Dropdown
          label="Тип крыши"
          value={formData.roofType}
          onChange={(value) => handleFieldChange('roofType', value)}
          options={filteredRoofOptions.map((opt: any) => ({ label: opt.label, value: opt.label }))}
        />

        {/* Форма дома */}
        <Dropdown
          label="Форма дома"
          value={formData.houseShape}
          onChange={(value) => handleFieldChange('houseShape', value)}
          options={config.HOUSE_SHAPE_OPTIONS.map((opt: any) => ({ label: opt.label, value: opt.label }))}
        />
      </div>

      {/* Дополнительные работы - вынесен из grid */}
      <div className="w-full">
        {!formData.useCustomWorks ? (
          <div className="max-w-sm">
            <Dropdown
              label="Дополнительные работы"
              value={formData.additionalWorks}
              onChange={(value) => handleFieldChange('additionalWorks', value)}
              options={config.ADDITIONAL_WORKS_OPTIONS.map((opt: any) => ({ label: opt.label, value: opt.label }))}
            />
          </div>
        ) : (
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Дополнительные работы (кастомные)
            </label>
            <div className="space-y-3">
              {formData.customWorks.map((work, index) => (
                <div key={index} className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center w-full">
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      placeholder="Наименование работы"
                      value={work.name}
                      onChange={(e) => updateCustomWork(index, 'name', e.target.value)}
                      className="w-full min-w-[250px] max-w-[400px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Стоимость, ₸"
                      value={calculatorFormatters.formatPriceForForm(work.price)}
                      onChange={(e) => updateCustomWork(index, 'price', calculatorFormatters.unformatPriceFromForm(e.target.value))}
                      className="w-32 lg:w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                    />
                    {formData.customWorks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCustomWork(index)}
                        className="flex-shrink-0 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Удалить работу"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addCustomWork}
                className="inline-flex items-center px-3 py-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors text-sm font-medium"
              >
                ➕ Добавить работу
              </button>
            </div>
          </div>
        )}

        <div className="mt-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={formData.useCustomWorks}
              onChange={(e) => handleFieldChange('useCustomWorks', e.target.checked.toString())}
              className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
            />
            Ввести работы вручную
          </label>
        </div>
      </div>

      {/* Город доставки - только в профессиональном режиме */}
      {isAdvancedMode && (
        <div className="w-full">
          <div className="max-w-sm">
            <Dropdown
              label="Город доставки"
              value={formData.deliveryCity}
              onChange={(value) => handleFieldChange('deliveryCity', value)}
              options={(config.DELIVERY_OPTIONS || DELIVERY_CITIES).map((opt: any) => ({ label: opt.label, value: opt.label }))}
            />
          </div>
        </div>
      )}

      {/* Дополнительные опции */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-md font-medium text-gray-900 mb-3">Дополнительные параметры</h3>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isVatIncluded}
              onChange={(e) => setIsVatIncluded(e.target.checked)}
              className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
            />
            Отображать цены с НДС (+16%)
          </label>

          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isInstallment}
                onChange={(e) => setIsInstallment(e.target.checked)}
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
              />
              С рассрочкой (+17%)
            </label>
            
            {isInstallment && (
              <div className="mt-2 ml-6">
                <label className="block text-sm text-gray-600 mb-1">
                  Сумма рассрочки (если не указана — считается от всей суммы):
                </label>
                <input
                  type="text"
                  value={calculatorFormatters.formatPriceForForm(installmentAmount)}
                  onChange={(e) => setInstallmentAmount(calculatorFormatters.unformatPriceFromForm(e.target.value))}
                  placeholder="Введите сумму рассрочки"
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors text-sm"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Управление отображением разделов стоимости */}
      <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
        <h3 className="text-md font-medium text-gray-900 mb-3">Не отображать в коммерческом предложении:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={hideFundamentCost}
              onChange={(e) => setHideFundamentCost(e.target.checked)}
              className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
            />
            Стоимость фундамента
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={hideKitCost}
              onChange={(e) => setHideKitCost(e.target.checked)}
              className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
            />
            Стоимость домокомплекта
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={hideAssemblyCost}
              onChange={(e) => setHideAssemblyCost(e.target.checked)}
              className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
            />
            Стоимость сборки
          </label>

          {/* Чекбокс для скрытия доставки - только в профессиональном режиме */}
          {isAdvancedMode && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={hideDeliveryCost}
                onChange={(e) => setHideDeliveryCost(e.target.checked)}
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
              />
              Город доставки
            </label>
          )}
        </div>
      </div>
    </div>
  );
};