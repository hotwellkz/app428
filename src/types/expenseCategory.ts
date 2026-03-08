import { Timestamp } from 'firebase/firestore';

export interface ExpenseCategory {
  id: string;
  name: string;
  createdAt: Timestamp;
  createdBy: string;
  /** Количество использований в транзакциях (для сортировки по популярности) */
  usageCount?: number;
  /** Цвет для badge/точки в истории: red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, pink */
  color?: string;
}

export interface ExpenseCategoryCreate {
  name: string;
  createdAt: Timestamp;
  createdBy: string;
}
