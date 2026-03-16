import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
import { getAuthToken } from '../lib/firebase/auth';
import { DeleteQuickReplyTemplateModal } from '../components/modals/DeleteQuickReplyTemplateModal';
import { showSuccessNotification, showErrorNotification } from '../utils/notifications';
import { supabase } from '../lib/supabase/config';
import { useCompanyId } from '../contexts/CompanyContext';
import { useCurrentCompanyUser } from '../hooks/useCurrentCompanyUser';
import { Plus, Trash2, Edit3, Paperclip, X, ImageIcon } from 'lucide-react';
import type { QuickReply, QuickReplyFile } from '../types/quickReplies';
import type { MediaQuickReply } from '../types/mediaQuickReplies';

const QUICK_REPLY_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024; // 20MB per file
const MAX_QUICK_REPLY_FILES = 10;
const MEDIA_IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10MB per image
const MEDIA_IMAGE_MAX_COUNT = 10;
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
  type AttachedFileItem = QuickReplyFile | { file: File; id: string };
  const [attachedFiles, setAttachedFiles] = useState<AttachedFileItem[]>([]);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [deleteTemplateModal, setDeleteTemplateModal] = useState<{ id: string; title: string } | null>(
    null
  );
  const [deleteTemplateLoading, setDeleteTemplateLoading] = useState(false);

  const [mediaItems, setMediaItems] = useState<MediaQuickReply[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [showMediaForm, setShowMediaForm] = useState(false);
  const [mediaEditingId, setMediaEditingId] = useState<string | null>(null);
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaKeywords, setMediaKeywords] = useState('');
  type MediaFileEntry =
    | { url: string; order: number; fileName?: string }
    | { file: File; previewUrl?: string };
  const [mediaFiles, setMediaFiles] = useState<MediaFileEntry[]>([]);
  const [mediaUploading, setMediaUploading] = useState(false);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);

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
          const rawFiles = data.files as Array<{ id?: string; url?: string; name?: string; type?: string; size?: number }> | undefined;
          let files: QuickReply['files'];
          if (rawFiles?.length) {
            files = rawFiles
              .filter((f) => f?.url)
              .map((f) => ({
                id: (f.id ?? `f-${d.id}-${Math.random().toString(36).slice(2)}`) as string,
                url: f.url!,
                name: f.name ?? 'Файл',
                type: (f.type ?? 'file') as QuickReplyFile['type'],
                size: f.size
              }));
          } else if (data.attachmentUrl) {
            files = [{
              id: 'legacy',
              url: data.attachmentUrl as string,
              name: (data.attachmentFileName as string) || 'Файл',
              type: ((data.attachmentType as string) || 'file') as QuickReplyFile['type'],
              size: undefined
            }];
          } else {
            files = undefined;
          }
          return {
            id: d.id,
            title: (data.title as string) ?? '',
            text: (data.text as string) ?? '',
            keywords: (data.keywords as string) ?? '',
            category: (data.category as string) ?? '',
            files,
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
    setAttachedFiles([]);
  };

  const handleEdit = (entry: QuickReply) => {
    setEditingId(entry.id);
    setTitle(entry.title);
    setText(entry.text);
    setKeywords(entry.keywords);
    setCategory(entry.category);
    if (entry.files?.length) {
      setAttachedFiles([...entry.files]);
    } else if (entry.attachmentUrl) {
      setAttachedFiles([{
        id: 'legacy',
        url: entry.attachmentUrl,
        name: entry.attachmentFileName ?? 'Файл',
        type: (entry.attachmentType ?? 'file') as QuickReplyFile['type'],
        size: undefined
      }]);
    } else {
      setAttachedFiles([]);
    }
  };

  const addFilesFromInput = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const next: AttachedFileItem[] = [...attachedFiles];
    for (let i = 0; i < fileList.length; i++) {
      if (next.length >= MAX_QUICK_REPLY_FILES) break;
      const file = fileList[i];
      const mime = file.type?.toLowerCase();
      const type = ALLOWED_ATTACHMENT_TYPES[mime];
      if (!type) {
        window.alert(`Файл "${file.name}": допустимы только JPG, PNG, WEBP, PDF, DOCX, XLSX, MP4.`);
        continue;
      }
      if (file.size > QUICK_REPLY_ATTACHMENT_MAX_BYTES) {
        window.alert(`Файл "${file.name}" больше 20 МБ.`);
        continue;
      }
      next.push({ file, id: crypto.randomUUID?.() ?? `p-${Date.now()}-${i}` });
    }
    setAttachedFiles(next.slice(0, MAX_QUICK_REPLY_FILES));
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFilesFromInput(e.target.files);
    e.target.value = '';
  };

  const handleRemoveAttachedFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addFilesFromInput(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const revokeMediaPreviews = useCallback((list: MediaFileEntry[]) => {
    list.forEach((item) => {
      if ('file' in item && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  }, []);

  const resetMediaForm = () => {
    setMediaFiles((prev) => {
      revokeMediaPreviews(prev);
      return [];
    });
    setShowMediaForm(false);
    setMediaEditingId(null);
    setMediaTitle('');
    setMediaKeywords('');
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

  const isAllowedMediaImage = (file: File): boolean => {
    const mime = (file.type || '').toLowerCase();
    if (mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/png' || mime === 'image/webp') return true;
    const name = (file.name || '').toLowerCase();
    if (/\.(jpe?g|png|webp)$/i.test(name)) return true;
    return false;
  };

  const handleMediaAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const chosen = input.files;
    if (import.meta.env.DEV) console.log('[media template] FILES:', chosen?.length, chosen);
    if (!chosen?.length) {
      input.value = '';
      return;
    }
    const next: MediaFileEntry[] = [...mediaFiles];
    for (let i = 0; i < chosen.length; i++) {
      const file = chosen[i];
      if (import.meta.env.DEV) console.log('[media template] file', file.name, file.type, file.size);
      if (!isAllowedMediaImage(file)) {
        window.alert(`«${file.name}»: нужен JPG, PNG или WEBP (тип: ${file.type || 'не указан'}).`);
        continue;
      }
      if (file.size > MEDIA_IMAGE_MAX_BYTES) {
        window.alert(`Файл "${file.name}" больше 10 МБ.`);
        continue;
      }
      if (next.length >= MEDIA_IMAGE_MAX_COUNT) break;
      const previewUrl = URL.createObjectURL(file);
      next.push({ file, previewUrl });
    }
    setMediaFiles(next.slice(0, MEDIA_IMAGE_MAX_COUNT));
    requestAnimationFrame(() => {
      input.value = '';
    });
  };

  const handleRemoveMediaFile = (index: number) => {
    setMediaFiles((prev) => {
      const item = prev[index];
      if (item && 'file' in item && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
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

    const bucket = 'clients';
    const pathPrefix = `quick_replies/${companyId}/${editingId ?? `new-${Date.now()}`}`;
    const finalFiles: QuickReplyFile[] = [];
    const hasPending = attachedFiles.some((item) => 'file' in item);
    if (hasPending) {
      setAttachmentUploading(true);
      try {
        for (const item of attachedFiles) {
          if ('file' in item) {
            const safeName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
            const path = `${pathPrefix}_${item.id}_${safeName}`;
            const { data, error } = await supabase.storage.from(bucket).upload(path, item.file, { cacheControl: '3600', upsert: true });
            if (error) throw error;
            const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
            const mime = item.file.type?.toLowerCase();
            const type = ALLOWED_ATTACHMENT_TYPES[mime] ?? 'file';
            finalFiles.push({
              id: item.id,
              url: urlData.publicUrl,
              name: item.file.name,
              type,
              size: item.file.size
            });
          } else {
            finalFiles.push(item);
          }
        }
      } catch (err) {
        console.error('Quick reply files upload failed', err);
        window.alert('Не удалось загрузить файлы. Попробуйте снова.');
        setAttachmentUploading(false);
        return;
      }
      setAttachmentUploading(false);
    } else {
      attachedFiles.forEach((item) => {
        if (!('file' in item)) finalFiles.push(item);
      });
    }

    const col = collection(db, 'quick_replies');
    const uid = auth.currentUser?.uid ?? '';
    const filesForFirestore = finalFiles.map((f) => ({
      id: f.id,
      url: f.url,
      name: f.name,
      type: f.type,
      ...(f.size != null ? { size: f.size } : {})
    }));
    const rawPayload: Record<string, unknown> = {
      title: trimmedTitle,
      text: trimmedText,
      keywords: keywords.trim(),
      category: category.trim(),
      files: filesForFirestore,
      attachmentUrl: null,
      attachmentType: null,
      attachmentFileName: null,
      updatedAt: serverTimestamp()
    };
    const payload = Object.fromEntries(
      Object.entries(rawPayload).filter(([, v]) => v !== undefined)
    ) as Record<string, unknown>;

    if (editingId) {
      await updateDoc(doc(col, editingId), payload);
    } else {
      await addDoc(col, {
        ...payload,
        companyId,
        createdBy: uid,
        createdAt: serverTimestamp()
      });
    }
    resetForm();
  };

  const openDeleteTemplateModal = (id: string, title: string) => {
    if (!canEdit) return;
    setDeleteTemplateModal({ id, title: title.trim() || 'Без названия' });
  };

  const closeDeleteTemplateModal = () => {
    if (!deleteTemplateLoading) setDeleteTemplateModal(null);
  };

  const confirmDeleteTemplate = async () => {
    if (!deleteTemplateModal || !canEdit) return;
    const { id } = deleteTemplateModal;
    const token = await getAuthToken();
    if (!token) {
      showErrorNotification('Ошибка авторизации. Обновите страницу и повторите попытку.');
      return;
    }
    setDeleteTemplateLoading(true);
    const applyDeleted = () => {
      setItems((prev) => prev.filter((x) => x.id !== id));
      if (editingId === id) resetForm();
      setDeleteTemplateModal(null);
      showSuccessNotification('Шаблон успешно удалён');
    };
    try {
      const res = await fetch('/api/templates-delete', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        applyDeleted();
        return;
      }
      // API не проксируется (404) или недоступен — удаление напрямую в Firestore (как до Netlify)
      if (res.status === 404 || res.status === 405) {
        await deleteDoc(doc(db, 'quick_replies', id));
        applyDeleted();
        return;
      }
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || `Ошибка ${res.status}`);
    } catch (e) {
      if (e instanceof Error && /permission|Permission/i.test(e.message)) {
        showErrorNotification(e.message);
        return;
      }
      try {
        await deleteDoc(doc(db, 'quick_replies', id));
        applyDeleted();
      } catch (e2) {
        console.error('Delete template failed', e, e2);
        showErrorNotification(e instanceof Error ? e.message : 'Не удалось удалить шаблон');
      }
    } finally {
      setDeleteTemplateLoading(false);
    }
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
      <DeleteQuickReplyTemplateModal
        open={!!deleteTemplateModal}
        templateTitle={deleteTemplateModal?.title ?? ''}
        deleting={deleteTemplateLoading}
        onCancel={closeDeleteTemplateModal}
        onConfirm={confirmDeleteTemplate}
      />
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
                <label className="block text-xs text-gray-500 mb-1">Прикрепить файлы (до {MAX_QUICK_REPLY_FILES})</label>
                <p className="text-[11px] text-gray-400 mb-1">
                  JPG, PNG, WEBP, PDF, DOCX, XLSX, MP4. Максимум 20 МБ на файл.
                </p>
                <input
                  type="file"
                  accept={ACCEPT_ATTACHMENT}
                  multiple
                  onChange={handleAttachmentChange}
                  className="hidden"
                  id="quick-reply-attachment"
                />
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/50 p-3 text-center"
                >
                  <label
                    htmlFor="quick-reply-attachment"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 cursor-pointer"
                  >
                    <Paperclip className="w-4 h-4" />
                    Добавить файл
                  </label>
                  <p className="text-[11px] text-gray-400 mt-1">или перетащите файлы сюда</p>
                </div>
                {attachedFiles.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {attachedFiles.map((item, index) => (
                      <li key={'file' in item ? item.id : item.id} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                        <span className="truncate flex-1" title={'file' in item ? item.file.name : item.name}>
                          📎 {'file' in item ? item.file.name : item.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachedFile(index)}
                          className="text-red-600 hover:text-red-700 text-xs whitespace-nowrap"
                        >
                          Удалить
                        </button>
                      </li>
                    ))}
                  </ul>
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
                    {((item.files?.length ?? 0) > 0 || item.attachmentUrl) && <span className="ml-1 text-gray-500" title="Есть вложения">📎</span>}
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
                      onClick={() => openDeleteTemplateModal(item.id, item.title)}
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
              onClick={() => {
                setMediaFiles((prev) => {
                  revokeMediaPreviews(prev);
                  return [];
                });
                setShowMediaForm(true);
                setMediaEditingId(null);
                setMediaTitle('');
                setMediaKeywords('');
              }}
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
                {/* Не display:none — на части мобильных браузеров ломает выбор файла */}
                <input
                  ref={mediaFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleMediaAttachmentChange}
                  className="sr-only fixed w-px h-px opacity-0 pointer-events-none overflow-hidden"
                  aria-label="Выбор изображений"
                />
                <button
                  type="button"
                  onClick={() => mediaFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 active:bg-gray-100 touch-manipulation min-h-[44px]"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  Добавить изображения
                </button>
                {mediaFiles.length > 0 && (
                  <div className="mt-3 preview-container">
                    <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {mediaFiles.map((item, index) => (
                        <li
                          key={'file' in item ? `${item.file.name}-${index}` : `${item.url}-${index}`}
                          className="relative rounded-[14px] border border-gray-200 bg-gray-50 overflow-hidden shadow-sm"
                        >
                          <div className="aspect-square bg-gray-100 flex items-center justify-center">
                            {'file' in item && item.previewUrl ? (
                              <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                            ) : 'url' in item ? (
                              <img src={item.url} alt="" className="w-full h-full object-cover" />
                            ) : null}
                          </div>
                          <div className="p-2 flex flex-col gap-1 border-t border-gray-100 bg-white">
                            <span className="text-[10px] text-gray-600 truncate" title={'file' in item ? item.file.name : item.fileName}>
                              {'file' in item ? item.file.name : item.fileName || `№${index + 1}`}
                            </span>
                            <div className="flex flex-wrap items-center gap-1">
                              {index > 0 && (
                                <button type="button" onClick={() => moveMediaFile(index, index - 1)} className="text-gray-500 text-xs px-1 py-0.5 rounded border border-gray-200">
                                  ↑
                                </button>
                              )}
                              {index < mediaFiles.length - 1 && (
                                <button type="button" onClick={() => moveMediaFile(index, index + 1)} className="text-gray-500 text-xs px-1 py-0.5 rounded border border-gray-200">
                                  ↓
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveMediaFile(index)}
                                className="text-red-600 text-xs px-2 py-0.5 rounded border border-red-100 bg-red-50"
                              >
                                Удалить
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
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
