/** Запись быстрого ответа (шаблон для WhatsApp CRM). */
export interface QuickReply {
  id: string;
  title: string;
  text: string;
  /** Ключевые слова через запятую для поиска (например: "черновая,черно,чернов"). */
  keywords: string;
  category: string;
  /** Публичный URL вложения (Supabase Storage). */
  attachmentUrl?: string | null;
  /** Тип вложения для WhatsApp API: image | video | file | audio */
  attachmentType?: 'image' | 'video' | 'file' | 'audio' | null;
  /** Имя файла для отображения. */
  attachmentFileName?: string | null;
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  companyId?: string;
}
