/**
 * Дефолтная конфигурация калькулятора без Firebase.
 * Используется в Netlify function calculator-estimate и при отсутствии загруженного конфига.
 */
import * as defaultConfig from '../utils/calculatorData';
import { DELIVERY_CITIES } from '../utils/deliveryData';
import type { CalculatorConfig } from './calculatorEngine';

const GLOBAL_PRICE_MULTIPLIER = 1.1;

export function getDefaultCalculatorConfig(): CalculatorConfig {
  return {
    BASE_PRICES: defaultConfig.BASE_PRICES,
    FOUNDATION_OPTIONS: defaultConfig.FOUNDATION_OPTIONS,
    FLOORS_OPTIONS: defaultConfig.FLOORS_OPTIONS,
    FIRST_FLOOR_TYPE_OPTIONS: defaultConfig.FIRST_FLOOR_TYPE_OPTIONS,
    SECOND_FLOOR_TYPE_OPTIONS: defaultConfig.SECOND_FLOOR_TYPE_OPTIONS,
    THIRD_FLOOR_TYPE_OPTIONS: defaultConfig.THIRD_FLOOR_TYPE_OPTIONS,
    FLOOR_HEIGHT_OPTIONS: defaultConfig.FLOOR_HEIGHT_OPTIONS,
    WALL_THICKNESS_OPTIONS: defaultConfig.WALL_THICKNESS_OPTIONS,
    PARTITION_OPTIONS: defaultConfig.PARTITION_OPTIONS,
    CEILING_OPTIONS: defaultConfig.CEILING_OPTIONS,
    ROOF_OPTIONS: defaultConfig.ROOF_OPTIONS,
    HOUSE_SHAPE_OPTIONS: defaultConfig.HOUSE_SHAPE_OPTIONS,
    ADDITIONAL_WORKS_OPTIONS: defaultConfig.ADDITIONAL_WORKS_OPTIONS,
    DELIVERY_OPTIONS: [...DELIVERY_CITIES],
    COST_BREAKDOWN: defaultConfig.COST_BREAKDOWN,
    AREA_LIMITS: defaultConfig.AREA_LIMITS,
    GLOBAL_PRICE_MULTIPLIER
  };
}
