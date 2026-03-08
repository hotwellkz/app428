import { describe, expect, it } from 'vitest';
import { calculateExpenseTotals, getProductEffectivePrice, resolveExpenseItemPrice } from '../warehousePricing';
import { Product } from '../../types/warehouse';

const createProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'product-1',
  name: 'OSB 12 мм',
  category: 'Плиты',
  quantity: 10,
  minQuantity: 2,
  averagePurchasePrice: 5200,
  totalPurchasePrice: 52000,
  unit: 'шт',
  order: 1,
  ...overrides
});

describe('warehousePricing', () => {
  it('возвращает среднюю цену, если ручной режим отключён', () => {
    const product = createProduct();
    expect(getProductEffectivePrice(product)).toBe(5200);
  });

  it('использует ручную цену при включённом флаге', () => {
    const product = createProduct({
      manualPriceEnabled: true,
      manualAveragePrice: 8562
    });

    expect(getProductEffectivePrice(product)).toBe(8562);
  });

  it('resolveExpenseItemPrice отдаёт цену позиции, если она уже задана', () => {
    const product = createProduct();
    const itemPrice = 9999;

    expect(
      resolveExpenseItemPrice({
        product,
        quantity: 3,
        price: itemPrice
      })
    ).toBe(itemPrice);
  });

  it('корректно считает итоговые суммы с учётом ручных цен', () => {
    const manualProduct = createProduct({
      id: 'product-2',
      manualPriceEnabled: true,
      manualAveragePrice: 7000
    });

    const autoProduct = createProduct({
      id: 'product-3',
      averagePurchasePrice: 4300
    });

    const totals = calculateExpenseTotals([
      { product: manualProduct, quantity: 2 },
      { product: autoProduct, quantity: 3 }
    ]);

    expect(totals.quantity).toBe(5);
    expect(totals.amount).toBe(2 * 7000 + 3 * 4300);
    expect(totals.total).toBe(totals.amount);
  });
});



