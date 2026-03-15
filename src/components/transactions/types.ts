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
}
