export interface Product {
  id: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  averagePurchasePrice: number;
  averagePrice?: number;
  totalPurchasePrice: number;
  unit: string;
  order: number;
  // Поля для ручного управления ценой
  manualPriceEnabled?: boolean;
  manualAveragePrice?: number | null;
  isManualPrice?: boolean;
  manualPrice?: number | null;
  displayPrice?: number | null;
  createdAt?: any;
  updatedAt?: any;
}

export interface Transaction {
  id: string;
  type: 'in' | 'out';
  quantity: number;
  price: number;
  date: any;
  description: string;
  previousQuantity: number;
  newQuantity: number;
  previousValue: number;
  newValue: number;
}

export interface Movement {
  id: string;
  productId: string;
  type: 'in' | 'out';
  quantity: number;
  date: any;
  description: string;
}