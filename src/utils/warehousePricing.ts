import { Product } from '../types/warehouse';

export type WarehouseProductLike = Partial<Product> & {
  price?: number;
  averageSellingPrice?: number;
};

export interface ExpenseItemLike {
  product: WarehouseProductLike;
  quantity: number;
  price?: number;
}

export const getProductEffectivePrice = (product?: WarehouseProductLike | null): number => {
  if (!product) {
    return 0;
  }

  if (typeof product.displayPrice === 'number') {
    return product.displayPrice;
  }

  const manualFlag =
    typeof product.manualPriceEnabled === 'boolean'
      ? product.manualPriceEnabled
      : product.isManualPrice;

  const manualValue =
    product.manualAveragePrice ?? product.manualPrice;

  if (manualFlag && typeof manualValue === 'number') {
    return manualValue;
  }

  if (typeof product.averagePurchasePrice === 'number') {
    return product.averagePurchasePrice;
  }

  if (typeof product.averagePrice === 'number') {
    return product.averagePrice;
  }

  if (typeof product.price === 'number') {
    return product.price;
  }

  if (typeof product.averageSellingPrice === 'number') {
    return product.averageSellingPrice;
  }

  return 0;
};

export const resolveExpenseItemPrice = (item: ExpenseItemLike): number => {
  if (typeof item.price === 'number' && !Number.isNaN(item.price)) {
    return item.price;
  }

  return getProductEffectivePrice(item.product);
};

export const calculateExpenseTotals = (items: ExpenseItemLike[]) => {
  return items.reduce(
    (acc, item) => {
      const price = resolveExpenseItemPrice(item);
      const amount = item.quantity * price;

      return {
        quantity: acc.quantity + item.quantity,
        amount: acc.amount + amount,
        total: acc.total + amount
      };
    },
    { quantity: 0, amount: 0, total: 0 }
  );
};



