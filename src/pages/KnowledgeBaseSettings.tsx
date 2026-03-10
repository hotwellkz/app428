import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { useCompanyId } from '../contexts/CompanyContext';
import { useCurrentCompanyUser } from '../hooks/useCurrentCompanyUser';
import { Plus, Trash2, Edit3 } from 'lucide-react';

interface KnowledgeBaseEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  updatedAt?: unknown;
}

export const KnowledgeBaseSettings: React.FC = () => {
  const companyId = useCompanyId();
  const { canAccess } = useCurrentCompanyUser();
  const canEdit = canAccess('knowledgeBase');

  const [items, setItems] = useState<KnowledgeBaseEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!companyId) {
      setItems([]);
      return;
    }
    setLoading(true);
    const col = collection(db, 'knowledgeBase');
    const q = query(col, where('companyId', '==', companyId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: KnowledgeBaseEntry[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: (data.title as string) ?? '',
            content: (data.content as string) ?? '',
            category: (data.category as string) ?? '',
            updatedAt: data.updatedAt
          };
        });
        setItems(
          list.sort((a, b) => {
            const at = a.updatedAt && typeof (a.updatedAt as any).toMillis === 'function'
              ? (a.updatedAt as any).toMillis()
              : 0;
            const bt = b.updatedAt && typeof (b.updatedAt as any).toMillis === 'function'
              ? (b.updatedAt as any).toMillis()
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

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setCategory('');
    setContent('');
  };

  const handleEdit = (entry: KnowledgeBaseEntry) => {
    setEditingId(entry.id);
    setTitle(entry.title);
    setCategory(entry.category);
    setContent(entry.content);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !canEdit) return;
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle || !trimmedContent) return;

    const col = collection(db, 'knowledgeBase');

    if (editingId) {
      const ref = doc(col, editingId);
      await updateDoc(ref, {
        title: trimmedTitle,
        category: category.trim(),
        content: trimmedContent,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(col, {
        title: trimmedTitle,
        category: category.trim(),
        content: trimmedContent,
        updatedAt: serverTimestamp(),
        companyId
      });
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    if (!window.confirm('Удалить запись базы знаний?')) return;
    const col = collection(db, 'knowledgeBase');
    await deleteDoc(doc(col, id));
    if (editingId === id) resetForm();
  };

  const isEditing = useMemo(() => !!editingId, [editingId]);

  if (!canEdit) {
    return (
      <div className="p-4">
        <h1 className="text-lg font-semibold text-gray-800 mb-2">AI База знаний</h1>
        <p className="text-sm text-gray-500">
          У вас нет доступа к этому разделу. Обратитесь к администратору компании.
        </p>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-500">
          Компания не выбрана. Настройки базы знаний недоступны.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none px-4 py-3 border-b bg-white flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-800">AI База знаний</h1>
        {!canEdit && (
          <span className="text-[11px] text-gray-500">
            Только просмотр (требуется роль администратора)
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {canEdit && (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">
                {isEditing ? 'Редактировать запись' : 'Добавить запись'}
              </h2>
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
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
                  placeholder="Например: Адрес офиса"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Категория (необязательно)</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Например: Общая информация"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Текст</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[100px]"
                  placeholder="Краткий факт или ответ, который можно использовать в AI-ответах"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                disabled={!title.trim() || !content.trim()}
              >
                <Plus className="w-4 h-4" />
                {isEditing ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Записи базы знаний</h2>
          {loading && <p className="text-sm text-gray-500">Загрузка…</p>}
          {!loading && items.length === 0 && (
            <p className="text-sm text-gray-500">
              Пока нет записей. {canEdit ? 'Добавьте первую запись базы знаний.' : 'Обратитесь к администратору для заполнения базы знаний.'}
            </p>
          )}
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-col gap-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800">
                      {item.title || 'Без названия'}
                    </h3>
                    {item.category && (
                      <p className="text-[11px] text-gray-500">{item.category}</p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
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
                <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                  {item.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseSettings;

