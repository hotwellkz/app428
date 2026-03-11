/** Запись быстрого ответа (шаблон для WhatsApp CRM). */
export interface QuickReply {
  id: string;
  title: string;
  text: string;
  /** Ключевые слова через запятую для поиска (например: "черновая,черно,чернов"). */
  keywords: string;
  category: string;
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  companyId?: string;
}
