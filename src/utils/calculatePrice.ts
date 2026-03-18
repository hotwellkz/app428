import type { CalculatorInput, CalculationResult } from '../types/calculator';
import { getConfigSync } from './configLoader';
import { GLOBAL_PRICE_MULTIPLIER } from '../config/pricing';
import { calculatePriceWithConfig, type CalculatorConfig } from '../lib/calculatorEngine';

/**
 * Расчёт стоимости для UI-калькулятора. Использует конфиг из Firebase/дефолтов и единый движок.
 */
export const calculatePrice = (params: CalculatorInput): CalculationResult => {
  const config = getConfigSync() as CalculatorConfig;
  return calculatePriceWithConfig(params, {
    ...config,
    GLOBAL_PRICE_MULTIPLIER: config.GLOBAL_PRICE_MULTIPLIER ?? GLOBAL_PRICE_MULTIPLIER
  });
};
