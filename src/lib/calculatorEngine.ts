/**
 * Единый расчётный движок стоимости строительства.
 * Используется: UI-калькулятор (через getConfigSync), AI-бот (через дефолтный конфиг), API calculator-estimate.
 * Один источник истины по формуле расчёта.
 */
import type { CalculatorInput, CalculationResult } from '../types/calculator';
import { calculateTrucksNeeded } from '../utils/deliveryData';

export type CalculatorConfig = {
  BASE_PRICES: Array<{ min: number; max: number; price: number }>;
  FOUNDATION_OPTIONS: Array<{ label: string; value?: number; addition?: number }>;
  FLOORS_OPTIONS: Array<{ label: string; value?: string; addition?: number }>;
  FIRST_FLOOR_TYPE_OPTIONS: Array<{ label: string; addition?: number }>;
  SECOND_FLOOR_TYPE_OPTIONS: Array<{ label: string; addition?: number }>;
  THIRD_FLOOR_TYPE_OPTIONS: Array<{ label: string; addition?: number }>;
  FLOOR_HEIGHT_OPTIONS: Array<{ label: string; value: number; addition?: number }>;
  WALL_THICKNESS_OPTIONS: Array<{ label: string; value: number; addition?: number }>;
  PARTITION_OPTIONS: Record<string, Array<{ label: string; addition?: number }>>;
  CEILING_OPTIONS: Array<{ label: string; addition?: number }>;
  ROOF_OPTIONS: Array<{ label: string; addition?: number; floors?: string }>;
  HOUSE_SHAPE_OPTIONS: Array<{ label: string; addition?: number }>;
  ADDITIONAL_WORKS_OPTIONS: Array<{ label: string; addition?: number }>;
  DELIVERY_OPTIONS: Array<{ label: string; price: number }>;
  COST_BREAKDOWN: { foundation: number; houseKit: number; assembly: number };
  AREA_LIMITS: { min: number; max: number };
  GLOBAL_PRICE_MULTIPLIER?: number;
};

const getBasePricePerSqm = (area: number, config: CalculatorConfig): number => {
  const priceRange = config.BASE_PRICES.find((range) => area >= range.min && area <= range.max);
  return priceRange ? priceRange.price : 0;
};

const getFoundationAddition = (foundation: string, config: CalculatorConfig): number => {
  const option = config.FOUNDATION_OPTIONS.find((opt) => opt.label === foundation);
  return option ? (option.value ?? option.addition ?? 0) : 0;
};

const getFloorsAddition = (floors: string, config: CalculatorConfig): number => {
  const option = config.FLOORS_OPTIONS.find((opt) => opt.label === floors);
  return option ? (option.addition ?? 0) : 0;
};

const getFirstFloorTypeAddition = (firstFloorType: string, floors: string, config: CalculatorConfig): number => {
  if (floors !== '1 этаж') return 0;
  const option = config.FIRST_FLOOR_TYPE_OPTIONS.find((opt) => opt.label === firstFloorType);
  return option ? (option.addition ?? 0) : 0;
};

const getSecondFloorTypeAddition = (secondFloorType: string, floors: string, config: CalculatorConfig): number => {
  if (floors !== '2 этажа' && floors !== '3 этажа') return 0;
  const effectiveSecondFloorType = floors === '3 этажа' ? 'Полноценный' : secondFloorType;
  const option = config.SECOND_FLOOR_TYPE_OPTIONS.find((opt) => opt.label === effectiveSecondFloorType);
  return option ? (option.addition ?? 0) : 0;
};

const getThirdFloorTypeAddition = (thirdFloorType: string, floors: string, config: CalculatorConfig): number => {
  if (floors !== '3 этажа') return 0;
  const option = config.THIRD_FLOOR_TYPE_OPTIONS.find((opt) => opt.label === thirdFloorType);
  return option ? (option.addition ?? 0) : 0;
};

const getFloorHeightAddition = (height: number, config: CalculatorConfig): number => {
  const option = config.FLOOR_HEIGHT_OPTIONS.find((opt) => opt.value === height);
  return option ? (option.addition ?? 0) : 0;
};

const getWallThicknessAddition = (thickness: number, config: CalculatorConfig): number => {
  const option = config.WALL_THICKNESS_OPTIONS.find((opt) => opt.value === thickness);
  return option ? (option.addition ?? 0) : 0;
};

const getPartitionAddition = (partitionType: string, height: number, config: CalculatorConfig): number => {
  const opts = config.PARTITION_OPTIONS as Record<string, Array<{ label: string; addition?: number }>>;
  const key =
    height === 2.5 ? 'height_2_5' : height === 2.8 ? 'height_2_8' : height === 2.9 ? 'height_2_9' : height === 3.0 ? 'height_3_0' : height === 3.5 ? 'height_3_5' : height === 4.0 ? 'height_4_0' : 'height_2_5';
  const partitionGroup = opts[key] ?? opts.height_2_5 ?? Object.values(opts)[0];
  const option = partitionGroup?.find((opt) => opt.label === partitionType);
  return option ? (option.addition ?? 0) : 0;
};

const getCeilingAddition = (ceiling: string, config: CalculatorConfig): number => {
  const option = config.CEILING_OPTIONS.find((opt) => opt.label === ceiling);
  return option ? (option.addition ?? 0) : 0;
};

const getRoofAddition = (roofType: string, floors: string, config: CalculatorConfig): number => {
  const option = config.ROOF_OPTIONS.find((opt) => {
    if (opt.floors && opt.floors !== floors.charAt(0)) return false;
    return opt.label === roofType;
  });
  return option ? (option.addition ?? 0) : 0;
};

const getHouseShapeAddition = (houseShape: string, config: CalculatorConfig): number => {
  const option = config.HOUSE_SHAPE_OPTIONS.find((opt) => opt.label === houseShape);
  return option ? (option.addition ?? 0) : 0;
};

const getAdditionalWorksAddition = (
  additionalWorks: string,
  config: CalculatorConfig,
  useCustomWorks = false,
  customWorks: Array<{ name: string; price: number | string }> = []
): number => {
  if (useCustomWorks) {
    return customWorks.reduce((sum, work) => {
      const price = typeof work.price === 'string' ? Number(work.price.replace(/\s/g, '')) : Number(work.price);
      return sum + (price || 0);
    }, 0);
  }
  const option = config.ADDITIONAL_WORKS_OPTIONS.find((opt) => opt.label === additionalWorks);
  return option ? (option.addition ?? 0) : 0;
};

const getDeliveryCost = (totalArea: number, deliveryCity: string, config: CalculatorConfig): number => {
  const deliveryOptions = config.DELIVERY_OPTIONS || [];
  const cityOption = deliveryOptions.find((c) => c.label === deliveryCity);
  if (!cityOption || cityOption.price === 0 || !deliveryCity || deliveryCity === 'Выберите город доставки') {
    return 0;
  }
  const trucksNeeded = calculateTrucksNeeded(totalArea);
  return trucksNeeded * cityOption.price;
};

const MULTIPLIER_DEFAULT = 1.1;

/**
 * Расчёт стоимости по параметрам и конфигу. Единая формула для UI и бота.
 */
export function calculatePriceWithConfig(
  params: CalculatorInput,
  config: CalculatorConfig
): CalculationResult {
  const { area } = params;
  const multiplier = config.GLOBAL_PRICE_MULTIPLIER ?? MULTIPLIER_DEFAULT;

  if (area < config.AREA_LIMITS.min || area > config.AREA_LIMITS.max) {
    return {
      fundamentCost: 0,
      kitCost: 0,
      assemblyCost: 0,
      total: 0,
      pricePerSqm: 0,
      deliveryCost: 0
    };
  }

  const basePrice = getBasePricePerSqm(area, config);
  const foundationAddition = getFoundationAddition(params.foundation, config);
  const floorsAddition = getFloorsAddition(params.floors, config);
  const firstFloorTypeAddition = getFirstFloorTypeAddition(params.firstFloorType || '', params.floors, config);
  const secondFloorTypeAddition = getSecondFloorTypeAddition(params.secondFloorType || '', params.floors, config);
  const thirdFloorTypeAddition = getThirdFloorTypeAddition(params.thirdFloorType || '', params.floors, config);
  const firstFloorHeightAddition = getFloorHeightAddition(params.firstFloorHeight, config);
  const secondFloorHeightAddition = params.secondFloorHeight ? getFloorHeightAddition(params.secondFloorHeight, config) : 0;
  const thirdFloorHeightAddition = params.thirdFloorHeight ? getFloorHeightAddition(params.thirdFloorHeight, config) : 0;
  const firstFloorThicknessAddition = getWallThicknessAddition(params.firstFloorThickness, config);
  const secondFloorThicknessAddition = params.secondFloorThickness ? getWallThicknessAddition(params.secondFloorThickness, config) : 0;
  const thirdFloorThicknessAddition = params.thirdFloorThickness ? getWallThicknessAddition(params.thirdFloorThickness, config) : 0;
  const partitionAddition = getPartitionAddition(params.partitionType, params.firstFloorHeight, config);
  const ceilingAddition = getCeilingAddition(params.ceiling, config);
  const roofAddition = getRoofAddition(params.roofType, params.floors, config);
  const houseShapeAddition = getHouseShapeAddition(params.houseShape, config);
  const additionalWorksAddition = getAdditionalWorksAddition(
    params.additionalWorks,
    config,
    params.useCustomWorks,
    params.customWorks
  );

  const pricePerSqm =
    basePrice +
    floorsAddition +
    firstFloorHeightAddition +
    secondFloorHeightAddition +
    thirdFloorHeightAddition +
    firstFloorThicknessAddition +
    secondFloorThicknessAddition +
    thirdFloorThicknessAddition +
    firstFloorTypeAddition +
    secondFloorTypeAddition +
    thirdFloorTypeAddition +
    foundationAddition +
    roofAddition +
    houseShapeAddition +
    partitionAddition +
    ceilingAddition;

  const customWorksTotal = params.useCustomWorks
    ? getAdditionalWorksAddition(params.additionalWorks, config, true, params.customWorks)
    : 0;
  const baseTotalCost = Math.round(pricePerSqm * area);
  const standardAdditionalWorksTotal = !params.useCustomWorks
    ? Math.round(getAdditionalWorksAddition(params.additionalWorks, config) * area)
    : 0;
  const deliveryCost = params.deliveryCity ? getDeliveryCost(area, params.deliveryCity, config) : 0;
  const total = baseTotalCost + standardAdditionalWorksTotal + customWorksTotal + deliveryCost;

  const costWithoutDelivery = baseTotalCost + standardAdditionalWorksTotal + customWorksTotal;
  const fundamentCost = Math.round(costWithoutDelivery * config.COST_BREAKDOWN.foundation);
  const kitCost = Math.round(costWithoutDelivery * config.COST_BREAKDOWN.houseKit);
  const assemblyCost = Math.round(costWithoutDelivery * config.COST_BREAKDOWN.assembly);

  const apply = (value: number) => Math.round(value * multiplier);
  return {
    fundamentCost: apply(fundamentCost),
    kitCost: apply(kitCost),
    assemblyCost: apply(assemblyCost),
    total: apply(total),
    pricePerSqm: apply(Math.round(pricePerSqm)),
    deliveryCost: deliveryCost !== undefined ? apply(deliveryCost) : undefined
  };
}
