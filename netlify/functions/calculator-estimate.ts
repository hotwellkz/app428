/**
 * API расчёта стоимости дома. Единый движок с UI-калькулятором (src/lib/calculatorEngine).
 * Вызывается AI-ботом при достаточных данных (город, площадь, этажность).
 */
import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import type { CalculatorInput, CalculationResult } from '../../src/types/calculator';
import { calculatePriceWithConfig } from '../../src/lib/calculatorEngine';
import { getDefaultCalculatorConfig } from '../../src/lib/calculatorDefaultConfig';

const LOG_PREFIX = '[calculator-estimate]';
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

function withCors(res: HandlerResponse): HandlerResponse {
  return { ...res, headers: { ...CORS_HEADERS, ...res.headers } };
}

function log(...args: unknown[]) {
  console.log(LOG_PREFIX, ...args);
}

/** Дефолтные подписи как в UI (CalculatorForm STANDARD_DEFAULTS) */
const DEFAULT_LABELS = {
  foundation: 'Ж/Б ленточный, Выс 50см',
  floors1: '1 этаж',
  floors2: '2 этажа',
  floors3: '3 этажа',
  firstFloorType: 'Полноценный',
  firstFloorHeight: '2,5 м',
  firstFloorThickness: 163,
  partitionType: 'Профиль + гипсокартон + мин. вата, толщина 100 мм',
  ceiling: 'Потолок утеплённый (пенополистирол 145 мм)',
  roofType: '2-скатная (строп. сист. + металлочерепица)',
  houseShape: 'Простая форма',
  additionalWorks: 'Без дополнительных работ'
};

export interface CalculatorEstimateBody {
  areaM2: number;
  floorsCount: 1 | 2 | 3;
  deliveryCity?: string | null;
  /** Опционально: полный набор параметров (подписи как в UI) */
  params?: Partial<CalculatorInput>;
}

export interface CalculatorEstimateResponse {
  totalPrice: number;
  currency: string;
  breakdown: { foundation: number; kit: number; assembly: number; delivery?: number };
  appliedParams: Record<string, unknown>;
  calculationVersion: string;
  error?: string;
}

function buildCalculatorInput(body: CalculatorEstimateBody): CalculatorInput {
  const area = Number(body.areaM2);
  const floorsCount = body.floorsCount ?? 1;
  const floorsLabel = floorsCount === 1 ? DEFAULT_LABELS.floors1 : floorsCount === 2 ? DEFAULT_LABELS.floors2 : DEFAULT_LABELS.floors3;
  const deliveryCity = (body.deliveryCity && body.deliveryCity.trim()) || '';

  const config = getDefaultCalculatorConfig();
  const firstHeightOption = config.FLOOR_HEIGHT_OPTIONS.find((o: { label: string }) => o.label === DEFAULT_LABELS.firstFloorHeight) ?? config.FLOOR_HEIGHT_OPTIONS[0];
  const firstThicknessOption = config.WALL_THICKNESS_OPTIONS.find((o: { value: number }) => o.value === DEFAULT_LABELS.firstFloorThickness) ?? config.WALL_THICKNESS_OPTIONS[0];

  const base: CalculatorInput = {
    area,
    foundation: body.params?.foundation ?? DEFAULT_LABELS.foundation,
    floors: body.params?.floors ?? floorsLabel,
    firstFloorType: body.params?.firstFloorType ?? DEFAULT_LABELS.firstFloorType,
    secondFloorType: body.params?.secondFloorType ?? DEFAULT_LABELS.firstFloorType,
    thirdFloorType: body.params?.thirdFloorType ?? DEFAULT_LABELS.firstFloorType,
    firstFloorHeight: (firstHeightOption as { value: number })?.value ?? 2.5,
    secondFloorHeight: 2.5,
    thirdFloorHeight: 2.5,
    firstFloorThickness: (firstThicknessOption as { value: number })?.value ?? 163,
    secondFloorThickness: 163,
    thirdFloorThickness: 163,
    partitionType: body.params?.partitionType ?? DEFAULT_LABELS.partitionType,
    ceiling: body.params?.ceiling ?? DEFAULT_LABELS.ceiling,
    roofType: body.params?.roofType ?? DEFAULT_LABELS.roofType,
    houseShape: body.params?.houseShape ?? DEFAULT_LABELS.houseShape,
    additionalWorks: body.params?.additionalWorks ?? DEFAULT_LABELS.additionalWorks,
    deliveryCity: deliveryCity || undefined
  };
  return base;
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return withCors({ statusCode: 204, headers: {}, body: '' });
  }
  if (event.httpMethod !== 'POST') {
    return withCors({
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    });
  }

  let body: CalculatorEstimateBody;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as CalculatorEstimateBody) ?? {};
  } catch {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON' })
    });
  }

  const areaM2 = Number(body.areaM2);
  const floorsCount = body.floorsCount ?? 1;
  if (!Number.isFinite(areaM2) || areaM2 < 10 || areaM2 > 1500) {
    return withCors({
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'areaM2 must be between 10 and 1500', totalPrice: 0 })
    });
  }

  try {
    const config = getDefaultCalculatorConfig();
    const params = buildCalculatorInput(body);
    if (process.env.DEBUG || process.env.NODE_ENV !== 'production') {
      log('params=', JSON.stringify(params));
    }
    const result: CalculationResult = calculatePriceWithConfig(params, config);
    const response: CalculatorEstimateResponse = {
      totalPrice: result.total,
      currency: 'KZT',
      breakdown: {
        foundation: result.fundamentCost,
        kit: result.kitCost,
        assembly: result.assemblyCost,
        delivery: result.deliveryCost
      },
      appliedParams: { area: params.area, floors: params.floors, deliveryCity: params.deliveryCity },
      calculationVersion: 'v1'
    };
    if (process.env.DEBUG || process.env.NODE_ENV !== 'production') {
      log('calculatorResult totalPrice=', result.total);
    }
    return withCors({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    });
  } catch (e) {
    log('calculator error', e);
    return withCors({
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Calculation failed', totalPrice: 0, detail: String(e) })
    });
  }
};
