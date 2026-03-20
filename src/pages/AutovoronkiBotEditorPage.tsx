import React, { useEffect, useState } from 'react';
import { Link, useMatch, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bot } from 'lucide-react';
import { auth } from '../lib/firebase/auth';
import { useCompanyId } from '../contexts/CompanyContext';
import { useCurrentCompanyUser } from '../hooks/useCurrentCompanyUser';
import {
  createCrmAiBot,
  getCrmAiBotById,
  updateCrmAiBot
} from '../lib/firebase/crmAiBots';
import { PageMetadata } from '../components/PageMetadata';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AutovoronkiBotConfigurator } from '../components/autovoronki/AutovoronkiBotConfigurator';
import { AutovoronkiBotTestingPanel } from '../components/autovoronki/AutovoronkiBotTestingPanel';
import { UniversalVoiceCallLauncher } from '../components/voice/UniversalVoiceCallLauncher';
import type { CrmAiBotStatus } from '../types/crmAiBot';
import {
  CRM_AI_BOT_CHANNEL_OPTIONS,
  CRM_AI_BOT_STATUS_OPTIONS,
  CRM_AI_BOT_TYPE_OPTIONS
} from '../types/crmAiBot';
import { defaultCrmAiBotConfig, type CrmAiBotConfig } from '../types/crmAiBotConfig';
import toast from 'react-hot-toast';
import { getFirestoreErrorMessage } from '../utils/firestoreErrors';

const ROADMAP_FEATURES = [
  'Запуск бота в чате и WhatsApp',
  'Webhooks и триггеры',
  'Аналитика и воронка',
  'Голосовой канал'
];

const FORM_ID = 'autovoronki-bot-editor-form';

export const AutovoronkiBotEditorPage: React.FC = () => {
  const companyId = useCompanyId();
  const { canAccess } = useCurrentCompanyUser();
  const canUse = canAccess('autovoronki');
  const navigate = useNavigate();
  const { botId } = useParams<{ botId: string }>();
  const isCreate = useMatch({ path: '/autovoronki/new', end: true }) != null;
  const effectiveBotId = isCreate ? null : botId;

  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [wrongCompany, setWrongCompany] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [botType, setBotType] = useState(CRM_AI_BOT_TYPE_OPTIONS[0].value);
  const [channel, setChannel] = useState(CRM_AI_BOT_CHANNEL_OPTIONS[0].value);
  const [status, setStatus] = useState<CrmAiBotStatus>('draft');
  const [config, setConfig] = useState<CrmAiBotConfig>(() => defaultCrmAiBotConfig());
  const [voiceTestOpen, setVoiceTestOpen] = useState(false);

  useEffect(() => {
    if (!companyId || !canUse || isCreate || !effectiveBotId) {
      if (!isCreate) setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const b = await getCrmAiBotById(effectiveBotId);
        if (cancelled) return;
        if (!b) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        if (b.companyId !== companyId) {
          setWrongCompany(true);
          setLoading(false);
          return;
        }
        setName(b.name);
        setDescription(b.description ?? '');
        setBotType(b.botType || 'other');
        setChannel(b.channel || 'other');
        setStatus(b.status);
        setConfig(b.config);
      } catch {
        if (!cancelled) toast.error('Не удалось загрузить бота');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, canUse, isCreate, effectiveBotId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUse) return;
    const cid = companyId?.trim();
    if (!cid) {
      toast.error('Компания не определена. Обновите страницу или проверьте привязку пользователя к компании.');
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Укажите название бота');
      return;
    }
    setSaving(true);
    try {
      if (isCreate) {
        const id = await createCrmAiBot({
          companyId: cid,
          name: trimmed,
          description: description.trim() || null,
          botType,
          channel,
          status,
          createdBy: auth.currentUser?.uid ?? null
        });
        toast.success('Бот создан');
        navigate(`/autovoronki/${id}`, { replace: true });
      } else if (effectiveBotId) {
        await updateCrmAiBot(effectiveBotId, {
          name: trimmed,
          description: description.trim() || null,
          botType,
          channel,
          status,
          config
        });
        toast.success('Настройки бота сохранены');
      }
    } catch (err) {
      console.error(isCreate ? 'createCrmAiBot' : 'updateCrmAiBot', err);
      const hint = getFirestoreErrorMessage(err);
      toast.error(
        hint
          ? `${isCreate ? 'Не удалось создать бота' : 'Не удалось сохранить'}. ${hint}`
          : isCreate
            ? 'Не удалось создать бота'
            : 'Не удалось сохранить'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!canUse) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <PageMetadata title="Автоворонки" description="Редактор бота" />
        <p className="text-gray-600 text-sm">У вас нет доступа к этому разделу.</p>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <PageMetadata title="Бот не найден" />
        <p className="text-gray-600 mb-4">Бот не найден или удалён.</p>
        <Link to="/autovoronki" className="text-emerald-600 font-medium hover:underline">
          К списку автоворонок
        </Link>
      </div>
    );
  }

  if (wrongCompany) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <PageMetadata title="Доступ запрещён" />
        <p className="text-gray-600 mb-4">Этот бот принадлежит другой компании.</p>
        <Link to="/autovoronki" className="text-emerald-600 font-medium hover:underline">
          К списку автоворонок
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  const pageTitle = isCreate ? 'Новый бот' : name || 'Редактирование бота';

  return (
    <div className="min-h-full bg-gray-50">
      <PageMetadata title={pageTitle} description="Автоворонки — настройка AI-бота" />
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 pb-2 border-b border-gray-200/80">
            <div className="flex items-start gap-3 min-w-0">
              <Link
                to="/autovoronki"
                className="mt-0.5 p-2 rounded-lg text-gray-500 hover:bg-white hover:text-gray-800 border border-transparent hover:border-gray-200 transition-colors shrink-0"
                aria-label="Назад"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-semibold text-gray-900 truncate">{pageTitle}</h1>
                  {!isCreate && (
                    <span className="text-xs font-medium text-gray-500 px-2 py-0.5 rounded-md bg-gray-100">
                      {CRM_AI_BOT_STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {isCreate
                    ? 'Укажите основные поля. Сценарий и настройки откроются после создания.'
                    : 'Основная информация, сценарий и правила — одна кнопка «Сохранить».'}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
              {!isCreate && (
                <button
                  type="button"
                  onClick={() => setVoiceTestOpen(true)}
                  className="rounded-xl border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-800 hover:bg-violet-100 transition-colors"
                >
                  Тестовый звонок
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/autovoronki')}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors order-2 sm:order-1"
              >
                Назад к списку
              </button>
              <button
                type="submit"
                form={FORM_ID}
                disabled={saving}
                className="rounded-xl bg-emerald-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors order-1 sm:order-2"
              >
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 shadow-sm space-y-5">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Основная информация</h2>

            <div>
              <label htmlFor="bot-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                Название бота <span className="text-red-500">*</span>
              </label>
              <input
                id="bot-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Бот-квалификатор WhatsApp"
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
                required
                maxLength={200}
              />
            </div>

            <div>
              <label htmlFor="bot-desc" className="block text-sm font-medium text-gray-700 mb-1.5">
                Краткое описание
              </label>
              <textarea
                id="bot-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Кратко опишите назначение бота"
                rows={3}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-y min-h-[88px]"
                maxLength={2000}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="bot-type" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Тип бота <span className="text-red-500">*</span>
                </label>
                <select
                  id="bot-type"
                  value={botType}
                  onChange={(e) => setBotType(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                >
                  {CRM_AI_BOT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="bot-channel" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Канал <span className="text-red-500">*</span>
                </label>
                <select
                  id="bot-channel"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                >
                  {CRM_AI_BOT_CHANNEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="bot-status" className="block text-sm font-medium text-gray-700 mb-1.5">
                Статус <span className="text-red-500">*</span>
              </label>
              <select
                id="bot-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as CrmAiBotStatus)}
                className="w-full sm:max-w-xs rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
              >
                {CRM_AI_BOT_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!isCreate ? (
            <AutovoronkiBotConfigurator config={config} onChange={setConfig} />
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white/80 p-6 text-center text-sm text-gray-500">
              После нажатия «Сохранить» бот будет создан с пустым сценарием — вы сразу сможете заполнить блок
              «Сценарий и настройки» на этой же странице.
            </div>
          )}

          {!isCreate && effectiveBotId ? (
            <AutovoronkiBotTestingPanel
              botId={effectiveBotId}
              botMeta={{
                name,
                description: description.trim() || null,
                botType,
                channel
              }}
              config={config}
            />
          ) : null}

          <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-5 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="w-5 h-5 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-800">Дальнейшее развитие модуля</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Сценарий, тест-чат и промпт — в блоке выше. Ниже — что подключим позже.
            </p>
            <ul className="space-y-2">
              {ROADMAP_FEATURES.map((label) => (
                <li key={label} className="flex items-center gap-3 text-sm text-gray-500">
                  <input
                    type="checkbox"
                    disabled
                    className="rounded border-gray-300 text-emerald-600 opacity-50"
                    checked={false}
                    readOnly
                  />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 pb-8">
            <button
              type="button"
              onClick={() => navigate('/autovoronki')}
              className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-emerald-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
      {!isCreate && effectiveBotId ? (
        <UniversalVoiceCallLauncher
          open={voiceTestOpen}
          onClose={() => setVoiceTestOpen(false)}
          title="Тестовый звонок"
          context={{
            source: 'bot_test',
            companyId,
            botId: effectiveBotId,
            mode: 'test'
          }}
        />
      ) : null}
    </div>
  );
};
