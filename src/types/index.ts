import { ReactNode } from 'react';

export interface CategoryCardType {
  id: string;
  title: string;
  amount: string;
  iconName: string;
  icon?: ReactNode;
  color: string;
  row?: number;
  isVisible?: boolean;
  /** Тип счёта: employee, company, general_expense и др. Для условия показа поля "Категория расхода". */
  type?: string;
}

export interface TopStatType {
  label: string;
  value: string;
}

export interface Transaction {
  id: string;
  categoryId: string;
  fromUser: string;
  toUser: string;
  amount: number;
  description: string;
  type: 'income' | 'expense';
  date: any;
}

export interface CategoryData {
  title: string;
  icon: string;
  color: string;
  row?: number;
  isVisible?: boolean;
}