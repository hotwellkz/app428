/** Один файл в шаблоне быстрого ответа. */
export interface QuickReplyFile {
  id: string;
  url: string;
  name: string;
  type: 'image' | 'video' | 'file' | 'audio';
  size?: number;
}

/** Запись быстрого ответа (шаблон для WhatsApp CRM). */
export interface QuickReply {
  id: string;
  title: string;
  text: string;
  /** Ключевые слова через запятую для поиска (например: "черновая,черно,чернов"). */
  keywords: string;
  category: string;
  /** Массив прикреплённых файлов (до 10). */
  files?: QuickReplyFile[];
  /** @deprecated Используйте files[]. Один файл — для обратной совместимости со старыми шаблонами. */
  attachmentUrl?: string | null;
  /** @deprecated Используйте files[]. */
  attachmentType?: 'image' | 'video' | 'file' | 'audio' | null;
  /** @deprecated Используйте files[]. */
  attachmentFileName?: string | null;
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  companyId?: string;
}
