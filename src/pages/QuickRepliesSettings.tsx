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
import { useCompanyId } from '../contexts/CompanyContext';
import { useCurrentCompanyUser } from '../hooks/useCurrentCompanyUser';
import { Plus, Trash2, Edit3 } from 'lucide-react';
import type { QuickReply } from '../types/quickReplies';

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

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setText('');
    setKeywords('');
    setCategory('');
  };

  const handleEdit = (entry: QuickReply) => {
    setEditingId(entry.id);
    setTitle(entry.title);
    setText(entry.text);
    setKeywords(entry.keywords);
    setCategory(entry.category);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !canEdit) return;
    const trimmedTitle = title.trim();
    const trimmedText = text.trim();
    if (!trimmedTitle || !trimmedText) return;

    const col = collection(db, 'quick_replies');
    const uid = auth.currentUser?.uid ?? '';

    if (editingId) {
      const ref = doc(col, editingId);
      await updateDoc(ref, {
        title: trimmedTitle,
        text: trimmedText,
        keywords: keywords.trim(),
        category: category.trim(),
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(col, {
        title: trimmedTitle,
        text: trimmedText,
        keywords: keywords.trim(),
        category: category.trim(),
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
        {canEdit && (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">
                {isEditing ? 'Редактировать шаблон' : 'Добавить шаблон'}
              </h2>
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
                disabled={!title.trim() || !text.trim()}
              >
                <Plus className="w-4 h-4" />
                {isEditing ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Шаблоны</h2>
          {loading && <p className="text-sm text-gray-500">Загрузка…</p>}
          {!loading && items.length === 0 && (
            <p className="text-sm text-gray-500">
              Нет шаблонов. {canEdit ? 'Добавьте первый шаблон — в чате WhatsApp по ключевым словам будет показываться подсказка.' : ''}
            </p>
          )}
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex items-start justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-800">{item.title || 'Без названия'}</h3>
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
      </div>
    </div>
  );
};

export default QuickRepliesSettings;
