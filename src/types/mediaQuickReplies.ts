/** Медиа-шаблон быстрого ответа (набор изображений по команде /). */
export interface MediaQuickReply {
  id: string;
  title: string;
  /** Ключевые слова через запятую для поиска по /команде */
  keywords: string;
  /** Файлы в порядке отправки */
  files: Array< { url: string; order: number; fileName?: string } >;
  companyId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}
