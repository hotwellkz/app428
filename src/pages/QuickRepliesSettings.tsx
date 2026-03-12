import React, { useEffect, useState, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase/config';
import { supabase } from '../lib/supabase/config';
import { useCompanyId } from '../contexts/CompanyContext';
import { useCurrentCompanyUser } from '../hooks/useCurrentCompanyUser';
import { Plus, Trash2, Edit3, Paperclip, X, ImageIcon, GripVertical } from 'lucide-react';
import type { QuickReply } from '../types/quickReplies';
import type { MediaQuickReply } from '../types/mediaQuickReplies';

const QUICK_REPLY_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024; // 20MB
const MEDIA_IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10MB per image
const MEDIA_IMAGE_MAX_COUNT = 10;
const MEDIA_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
const ALLOWED_ATTACHMENT_TYPES: Record<string, 'image' | 'video' | 'file'> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'application/pdf': 'file',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'file',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'file',
  'video/mp4': 'video'
};
const ACCEPT_ATTACHMENT = '.jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,.mp4';

export const QuickRepliesSettings: React.FC = () => {
  const companyId = useCompanyId();
  const { canAccess } = useCurrentCompanyUser();
  const canEdit = canAccess('quickReplies');

  const [items, setItems] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [keywords, setKeywords] = useState('');
  const [category, setCategory] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [attachmentFileName, setAttachmentFileName] = useState<string>('');
  const [attachmentType, setAttachmentType] = useState<QuickReply['attachmentType']>(null);
  const [attachmentRemoveRequested, setAttachmentRemoveRequested] = useState(false);
  const [attachmentUploading, setAttachmentUploading] = useState(false);

  const [mediaItems, setMediaItems] = useState<MediaQuickReply[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [showMediaForm, setShowMediaForm] = useState(false);
  const [mediaEditingId, setMediaEditingId] = useState<string | null>(null);
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaKeywords, setMediaKeywords] = useState('');
  const [mediaFiles, setMediaFiles] = useState<Array<{ url: string; order: number; fileName?: string } | { file: File }>>([]);
  const [mediaUploading, setMediaUploading] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setItems([]);
      return;
    }
    setLoading(true);
    const col = collection(db, 'quick_replies');
    const q = query(col, where('companyId', '==', companyId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: QuickReply[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            title: (data.title as string) ?? '',
            text: (data.text as string) ?? '',
            keywords: (data.keywords as string) ?? '',
            category: (data.category as string) ?? '',
            attachmentUrl: (data.attachmentUrl as string) ?? undefined,
            attachmentType: (data.attachmentType as QuickReply['attachmentType']) ?? undefined,
            attachmentFileName: (data.attachmentFileName as string) ?? undefined,
            createdBy: data.createdBy as string | undefined,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            companyId: data.companyId as string | undefined
          };
        });
        setItems(
          list.sort((a, b) => {
            const at = a.updatedAt && typeof (a.updatedAt as { toMillis?: () => number })?.toMillis === 'function'
              ? (a.updatedAt as { toMillis: () => number }).toMillis()
              : 0;
            const bt = b.updatedAt && typeof (b.updatedAt as { toMillis?: () => number })?.toMillis === 'function'
              ? (b.updatedAt as { toMillis: () => number }).toMillis()
              : 0;
            return bt - at;
          })
        );
        setLoading(false);
      },
      () => {
        setItems([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setMediaItems([]);
      return;
    }
    setMediaLoading(true);
    const col = collection(db, 'media_quick_replies');
    const q = query(col, where('companyId', '==', companyId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: MediaQuickReply[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const rawFiles = (data.files as Array<{ url?: string; order?: number; fileName?: string }>) ?? [];
          return {
            id: d.id,
            title: (data.title as string) ?? '',
            keywords: (data.keywords as string) ?? '',
            files: rawFiles
              .filter((f) => f?.url)
              .map((f, i) => ({ url: f.url!, order: f.order ?? i, fileName: f.fileName })),
            companyId: data.companyId as string | undefined,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
          };
        });
        setMediaItems(list.sort((a, b) => {
          const at = a.updatedAt && typeof (a.updatedAt as { toMillis?: () => number })?.toMillis === 'function'
            ? (a.updatedAt as { toMillis: () => number }).toMillis()
            : 0;
          const bt = b.updatedAt && typeof (b.updatedAt as { toMillis?: () => number })?.toMillis === 'function'
            ? (b.updatedAt as { toMillis: () => number }).toMillis()
            : 0;
          return bt - at;
        }));
        setMediaLoading(false);
      },
      () => {
        setMediaItems([]);
        setMediaLoading(false);
      }
    );
    return () => unsub();
  }, [companyId]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setText('');
    setKeywords('');
    setCategory('');
    setAttachmentFile(null);
    setAttachmentUrl('');
    setAttachmentFileName('');
    setAttachmentType(null);
    setAttachmentRemoveRequested(false);
  };

  const handleEdit = (entry: QuickReply) => {
    setEditingId(entry.id);
    setTitle(entry.title);
    setText(entry.text);
    setKeywords(entry.keywords);
    setCategory(entry.category);
    setAttachmentFile(null);
    setAttachmentUrl(entry.attachmentUrl ?? '');
    setAttachmentFileName(entry.attachmentFileName ?? '');
    setAttachmentType(entry.attachmentType ?? null);
    setAttachmentRemoveRequested(false);
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const mime = file.type?.toLowerCase();
    if (!ALLOWED_ATTACHMENT_TYPES[mime]) {
      window.alert('Недопустимый формат. Разрешены: JPG, PNG, WEBP, PDF, DOCX, XLSX, MP4.');
      return;
    }
    if (file.size > QUICK_REPLY_ATTACHMENT_MAX_BYTES) {
      window.alert(`Максимальный размер файла: 20 МБ.`);
      return;
    }
    setAttachmentFile(file);
    setAttachmentFileName(file.name);
    setAttachmentType(ALLOWED_ATTACHMENT_TYPES[mime] ?? 'file');
    setAttachmentUrl('');
    setAttachmentRemoveRequested(false);
  };

  const handleRemoveAttachment = () => {
    setAttachmentFile(null);
    setAttachmentUrl('');
    setAttachmentFileName('');
    setAttachmentType(null);
    setAttachmentRemoveRequested(true);
  };

  const resetMediaForm = () => {
    setShowMediaForm(false);
    setMediaEditingId(null);
    setMediaTitle('');
    setMediaKeywords('');
    setMediaFiles([]);
  };

  const handleMediaEdit = (entry: MediaQuickReply) => {
    setShowMediaForm(true);
    setMediaEditingId(entry.id);
    setMediaTitle(entry.title);
    setMediaKeywords(entry.keywords);
    setMediaFiles(
      [...entry.files].sort((a, b) => a.order - b.order).map((f) => ({ url: f.url, order: f.order, fileName: f.fileName }))
    );
  };

  const handleMediaAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files;
    e.target.value = '';
    if (!chosen?.length) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const next: Array<{ url: string; order: number; fileName?: string } | { file: File }> = [...mediaFiles];
    for (let i = 0; i < chosen.length; i++) {
      const file = chosen[i];
      if (!allowed.includes(file.type)) {
        window.alert(`Файл "${file.name}": допустимы только JPG, PNG, WEBP.`);
        continue;
      }
      if (file.size > MEDIA_IMAGE_MAX_BYTES) {
        window.alert(`Файл "${file.name}" больше 10 МБ.`);
        continue;
      }
      if (next.length >= MEDIA_IMAGE_MAX_COUNT) break;
      next.push({ file });
    }
    setMediaFiles(next.slice(0, MEDIA_IMAGE_MAX_COUNT));
  };

  const handleRemoveMediaFile = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const moveMediaFile = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= mediaFiles.length) return;
    setMediaFiles((prev) => {
      const arr = [...prev];
      const [removed] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, removed);
      return arr;
    });
  };

  const handleMediaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !canEdit) return;
    const trimmedTitle = mediaTitle.trim();
    if (!trimmedTitle) return;
    if (mediaFiles.length === 0) {
      window.alert('Добавьте хотя бы одно изображение (1–10).');
      return;
    }
    setMediaUploading(true);
    try {
      const bucket = 'clients';
      const pathPrefix = `media_quick_replies/${companyId}/${mediaEditingId || `new-${Date.now()}`}`;
      const uploaded: Array<{ url: string; order: number; fileName?: string }> = [];
      for (let i = 0; i < mediaFiles.length; i++) {
        const item = mediaFiles[i];
        if ('file' in item) {
          const safeName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
          const path = `${pathPrefix}_${i}_${safeName}`;
          const { data, error } = await supabase.storage.from(bucket).upload(path, item.file, { cacheControl: '3600', upsert: true });
          if (error) throw error;
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
          uploaded.push({ url: urlData.publicUrl, order: i, fileName: item.file.name });
        } else {
          uploaded.push({ url: item.url, order: i, fileName: item.fileName });
        }
      }
      uploaded.sort((a, b) => a.order - b.order);
      const col = collection(db, 'media_quick_replies');
      const payload = {
        title: trimmedTitle,
        keywords: mediaKeywords.trim(),
        files: uploaded.map((f) => ({ url: f.url, order: f.order, fileName: f.fileName })),
        companyId,
        updatedAt: serverTimestamp()
      };
      if (mediaEditingId) {
        await updateDoc(doc(col, mediaEditingId), payload);
      } else {
        await addDoc(col, { ...payload, createdAt: serverTimestamp() });
      }
      resetMediaForm();
    } catch (err) {
      console.error('Media quick reply save failed', err);
      window.alert('Не удалось сохранить. Попробуйте снова.');
    } finally {
      setMediaUploading(false);
    }
  };

  const handleMediaDelete = async (id: string) => {
    if (!canEdit || !window.confirm('Удалить этот медиа-шаблон?')) return;
    try {
      await deleteDoc(doc(db, 'media_quick_replies', id));
      if (mediaEditingId === id) resetMediaForm();
    } catch (err) {
      console.error('Media quick reply delete failed', err);
      window.alert('Не удалось удалить.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !canEdit) return;
    const trimmedTitle = title.trim();
    const trimmedText = text.trim();
    if (!trimmedTitle || !trimmedText) return;

    let finalAttachmentUrl: string | null = null;
    let finalAttachmentType: QuickReply['attachmentType'] = null;
    let finalAttachmentFileName: string | null = null;

    if (attachmentRemoveRequested) {
      finalAttachmentUrl = null;
      finalAttachmentType = null;
      finalAttachmentFileName = null;
    } else if (attachmentFile) {
      setAttachmentUploading(true);
      try {
        const ext = attachmentFile.name.replace(/^.*\./, '') || 'bin';
        const safeName = attachmentFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
        const path = `quick_replies/${companyId}/${editingId || `new-${Date.now()}`}_${safeName}`;
        const { data, error } = await supabase.storage
          .from('clients')
          .upload(path, attachmentFile, { cacheControl: '3600', upsert: true });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('clients').getPublicUrl(data.path);
        finalAttachmentUrl = urlData.publicUrl;
        finalAttachmentType = attachmentType ?? 'file';
        finalAttachmentFileName = attachmentFileName || attachmentFile.name;
      } catch (err) {
        console.error('Quick reply attachment upload failed', err);
        window.alert('Не удалось загрузить файл. Попробуйте снова.');
        setAttachmentUploading(false);
        return;
      }
      setAttachmentUploading(false);
    } else if (attachmentUrl) {
      finalAttachmentUrl = attachmentUrl;
      finalAttachmentType = attachmentType ?? 'file';
      finalAttachmentFileName = attachmentFileName || null;
    }

    const col = collection(db, 'quick_replies');
    const uid = auth.currentUser?.uid ?? '';

    if (editingId) {
      const ref = doc(col, editingId);
      await updateDoc(ref, {
        title: trimmedTitle,
        text: trimmedText,
        keywords: keywords.trim(),
        category: category.trim(),
        attachmentUrl: finalAttachmentUrl,
        attachmentType: finalAttachmentType,
        attachmentFileName: finalAttachmentFileName,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(col, {
        title: trimmedTitle,
        text: trimmedText,
        keywords: keywords.trim(),
        category: category.trim(),
        attachmentUrl: finalAttachmentUrl,
        attachmentType: finalAttachmentType,
        attachmentFileName: finalAttachmentFileName,
        companyId,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    if (!window.confirm('Удалить шаблон быстрого ответа?')) return;
    const col = collection(db, 'quick_replies');
    await deleteDoc(doc(col, id));
    if (editingId === id) resetForm();
  };

  const isEditing = useMemo(() => !!editingId, [editingId]);

  if (!companyId) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-500">Компания не выбрана. Настройки быстрых ответов недоступны.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none px-4 py-3 border-b bg-white flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-800">Быстрые ответы</h1>
        {!canEdit && (
          <span className="text-[11px] text-gray-500">Только просмотр</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Текстовые шаблоны</h2>
          {canEdit && (
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">
                  {isEditing ? 'Редактировать шаблон' : 'Добавить текстовый шаблон'}
                </h3>
              {isEditing && (
                <button type="button" onClick={resetForm} className="text-xs text-gray-500 hover:text-gray-700">
                  Сбросить
                </button>
              )}
            </div>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Название</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Например: Черновая отделка"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Текст ответа</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[100px]"
                  placeholder="Текст, который будет вставлен в поле ввода при выборе шаблона"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Прикрепить файл</label>
                <p className="text-[11px] text-gray-400 mb-1">
                  JPG, PNG, WEBP, PDF, DOCX, XLSX, MP4. Максимум 20 МБ.
                </p>
                <input
                  type="file"
                  accept={ACCEPT_ATTACHMENT}
                  onChange={handleAttachmentChange}
                  className="hidden"
                  id="quick-reply-attachment"
                />
                {!(attachmentFile || attachmentUrl) && (
                  <label
                    htmlFor="quick-reply-attachment"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer"
                  >
                    <Paperclip className="w-4 h-4" />
                    Загрузить файл
                  </label>
                )}
                {(attachmentFile || attachmentUrl) && !attachmentRemoveRequested && (
                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                    <span className="truncate" title={attachmentFileName}>
                      📎 {attachmentFileName || 'Файл'}
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveAttachment}
                      className="text-red-600 hover:text-red-700 text-xs whitespace-nowrap"
                    >
                      удалить файл
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ключевые слова (через запятую)</label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="черновая, черно, чернов"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Категория (необязательно)</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Например: Отделка"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                disabled={!title.trim() || !text.trim() || attachmentUploading}
              >
                <Plus className="w-4 h-4" />
                {attachmentUploading ? 'Загрузка…' : isEditing ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </form>
          )}

          <div className="space-y-3">
            <h3 className="text-xs font-medium text-gray-500">Список текстовых шаблонов</h3>
          {loading && <p className="text-sm text-gray-500">Загрузка…</p>}
            {!loading && items.length === 0 && (
              <p className="text-sm text-gray-500">
                Нет шаблонов. {canEdit ? 'Добавьте первый шаблон — в чате по ключевым словам будет подсказка.' : ''}
              </p>
            )}
            <div className="space-y-2">
              {items.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex items-start justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-800">
                    {item.title || 'Без названия'}
                    {item.attachmentUrl && <span className="ml-1 text-gray-500" title="Есть вложение">📎</span>}
                  </h3>
                  {item.category && <p className="text-[11px] text-gray-500 mt-0.5">{item.category}</p>}
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.text}</p>
                  {item.keywords && (
                    <p className="text-[11px] text-gray-400 mt-1">Ключи: {item.keywords}</p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
                      title="Редактировать"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="p-1 rounded-md hover:bg-red-50 text-red-500"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Медиа шаблоны</h2>
          <p className="text-xs text-gray-500">Вызов в чате по команде / (слэш). Например: /сравнение, /дом</p>
          {canEdit && !showMediaForm && (
            <button
              type="button"
              onClick={() => { setShowMediaForm(true); setMediaEditingId(null); setMediaTitle(''); setMediaKeywords(''); setMediaFiles([]); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              <ImageIcon className="w-4 h-4" />
              Добавить медиа шаблон
            </button>
          )}
          {canEdit && showMediaForm && (
            <form onSubmit={handleMediaSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">
                  {mediaEditingId ? 'Редактировать медиа-шаблон' : 'Новый медиа-шаблон'}
                </h3>
                <button type="button" onClick={resetMediaForm} className="text-xs text-gray-500 hover:text-gray-700">
                  Отмена
                </button>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Название</label>
                <input
                  type="text"
                  value={mediaTitle}
                  onChange={(e) => setMediaTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Например: SIP vs Газоблок"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ключевые слова (через запятую)</label>
                <input
                  type="text"
                  value={mediaKeywords}
                  onChange={(e) => setMediaKeywords(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="сравнение, sip, газоблок"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Изображения (1–10, JPG/PNG/WEBP, макс. 10 МБ на файл)</label>
                <input
                  type="file"
                  accept={MEDIA_IMAGE_ACCEPT}
                  multiple
                  onChange={handleMediaAttachmentChange}
                  className="hidden"
                  id="media-quick-reply-images"
                />
                <label
                  htmlFor="media-quick-reply-images"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Добавить изображения
                </label>
                {mediaFiles.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {mediaFiles.map((item, index) => (
                      <li key={index} className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm">
                        <span className="cursor-grab text-gray-400" title="Перетащите для смены порядка" onMouseDown={(ev) => ev.preventDefault()}>
                          <GripVertical className="w-4 h-4" />
                        </span>
                        <span className="flex-1 truncate">
                          {'file' in item ? item.file.name : (item.fileName || `Изображение ${index + 1}`)}
                        </span>
                        <div className="flex items-center gap-1">
                          {index > 0 && (
                            <button type="button" onClick={() => moveMediaFile(index, index - 1)} className="text-gray-500 hover:text-gray-700 text-xs">
                              ↑
                            </button>
                          )}
                          {index < mediaFiles.length - 1 && (
                            <button type="button" onClick={() => moveMediaFile(index, index + 1)} className="text-gray-500 hover:text-gray-700 text-xs">
                              ↓
                            </button>
                          )}
                          <button type="button" onClick={() => handleRemoveMediaFile(index)} className="text-red-600 hover:text-red-700 text-xs">
                            удалить
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  disabled={!mediaTitle.trim() || mediaFiles.length === 0 || mediaUploading}
                >
                  <Plus className="w-4 h-4" />
                  {mediaUploading ? 'Загрузка…' : mediaEditingId ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          )}
          <div className="space-y-2">
            {mediaLoading && <p className="text-sm text-gray-500">Загрузка…</p>}
            {!mediaLoading && mediaItems.length === 0 && (
              <p className="text-sm text-gray-500">Нет медиа-шаблонов. Добавьте шаблон — в чате по команде / будет список.</p>
            )}
            {mediaItems.map((entry) => (
              <div
                key={entry.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex items-start justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                    <ImageIcon className="w-4 h-4 text-gray-500" />
                    {entry.title || 'Без названия'}
                    <span className="text-gray-400 font-normal">({entry.files.length})</span>
                  </h3>
                  {entry.keywords && <p className="text-[11px] text-gray-400 mt-0.5">Ключи: {entry.keywords}</p>}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMediaEdit(entry)}
                      className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
                      title="Редактировать"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMediaDelete(entry.id)}
                      className="p-1 rounded-md hover:bg-red-50 text-red-500"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default QuickRepliesSettings;
