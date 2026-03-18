export interface Transaction {
  id: string;
  companyId?: string;
  fromUser: string;
  toUser: string;
  amount: number;
  description: string;
  date: any;
  type: 'income' | 'expense';
  categoryId: string;
  isSalary?: boolean;
  isCashless?: boolean;
  waybillNumber?: string;
  waybillData?: {
    documentNumber: string;
    date: string;
    project: string;
    note: string;
    items: Array<{
      product: {
        name: string;
        unit: string;
      };
      quantity: number;
      price: number;
    }>;
  };
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size: number;
    path: string;
  }>;
  expenseCategoryId?: string;
  status?: 'pending' | 'approved' | 'rejected';
  needsReview?: boolean;
  fuelData?: {
    vehicleId: string;
    vehicleName: string;
    odometerKm: number;
    liters?: number | null;
    pricePerLiter?: number | null;
    fuelType?: string | null;
    gasStation?: string | null;
    isFullTank?: boolean;
    derivedFuelStats?: {
      previousFuelTransactionId?: string | null;
      previousOdometerKm?: number | null;
      distanceSincePrevFuelingKm?: number | null;
      estimatedConsumptionLPer100?: number | null;
      status: 'normal' | 'warning' | 'critical' | 'insufficient_data';
      note?: string | null;
    } | null;
  };
}
