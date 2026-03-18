import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import {
  MessageCircle,
  Check,
  ArrowRight,
  FileText,
  LayoutDashboard,
} from 'lucide-react';
import { buildWhatsAppUrl, WHATSAPP_CONTACT_NUMBER } from '../../config/whatsapp';

const TITLE = 'CRM для Kaspi-магазина в Казахстане — интеграция заказов, WhatsApp и клиентов | 2wix';
const DESCRIPTION =
  'Подключите Kaspi-магазин к CRM 2wix: заказы, клиенты, WhatsApp, обработка заявок и автоматизация продаж в одной системе. Для интернет-магазинов в Казахстане.';

const PROBLEMS = [
  'Заказы приходится обрабатывать вручную',
  'Клиенты теряются между Kaspi и WhatsApp',
  'Менеджеры долго отвечают',
  'Нет единой карточки клиента',
  'Сложно контролировать статус заказа и коммуникацию',
  'Много рутины',
];

const FEATURES = [
  'Подтягивание заказов из Kaspi-магазина по API',
  'Отображение имени клиента, номера, суммы, статуса заказа',
  'Открытие WhatsApp из карточки заказа в один клик',
  'Быстрый старт переписки по шаблону',
  'Хранение клиентов в единой базе CRM',
  'Объединение заказов и чатов в одном окне',
  'Удобная работа менеджеров без переключения между сервисами',
  'История общения с клиентом',
  'Интеграция по официальному Kaspi API',
  'Ручная и плановая синхронизация (4 раза в день или по расписанию)',
];

const HOW_IT_WORKS = [
  { step: 1, title: 'Подключаете Kaspi API в разделе «Интеграции»', sub: 'Указываете токен из личного кабинета Магазина на Kaspi.kz' },
  { step: 2, title: 'CRM получает заказы магазина', sub: 'Заказы подтягиваются автоматически или по кнопке «Синхронизировать»' },
  { step: 3, title: 'Заказы появляются в системе', sub: 'Номер заказа, клиент, телефон, сумма, адрес, товары — всё в одном списке' },
  { step: 4, title: 'Менеджер открывает клиента и сразу пишет в WhatsApp', sub: 'Один клик — чат открыт, можно отправить приветственное сообщение по шаблону' },
  { step: 5, title: 'Все коммуникации и статус работы сохраняются в CRM', sub: 'История переписки, сделки, заметки — в одной карточке' },
];

const FOR_WHOM = [
  'Продавцы на Kaspi.kz',
  'Интернет-магазины в Казахстане',
  'Компании с отделом продаж',
  'Бизнесы с большим потоком входящих заказов',
  'Магазины, которые общаются с клиентами через WhatsApp',
];

const BENEFITS = [
  'Меньше ручной работы — заказы приходят в CRM сами',
  'Быстрее ответ клиенту — всё в одном окне',
  'Меньше потерь заявок — ничего не теряется между Kaspi и мессенджером',
  'Всё в одном месте — заказы, чаты, клиенты, сделки',
  'Прозрачность для собственника — видно нагрузку и ответы менеджеров',
  'Проще масштабировать продажи — удобнее управлять потоком заказов',
];

const FAQ_ITEMS = [
  { q: 'Можно ли подключить Kaspi-магазин к CRM?', a: 'Да. В CRM 2wix есть раздел «Интеграции», где вы подключаете свой магазин на Kaspi.kz по API. У каждой компании в CRM — свой магазин и свои настройки синхронизации.' },
  { q: 'Как работает интеграция Kaspi API?', a: 'Вы сохраняете API-токен из личного кабинета Магазина на Kaspi.kz в настройках CRM. Система по расписанию или по вашей кнопке запрашивает новые заказы и создаёт карточки в CRM с данными клиента, телефона, суммы и товаров. Заказы можно синхронизировать вручную или 4 раза в день автоматически.' },
  { q: 'Можно ли видеть заказы Kaspi в CRM?', a: 'Да. После подключения интеграции заказы появляются в разделе чатов CRM: номер заказа, имя клиента, телефон, сумма, статус, адрес доставки и список товаров. Из карточки заказа можно сразу открыть WhatsApp и написать клиенту.' },
  { q: 'Можно ли сразу написать клиенту в WhatsApp?', a: 'Да. В карточке заказа Kaspi в CRM есть кнопка «Написать в WhatsApp» — открывается чат с клиентом. Можно вставить готовый шаблон первого сообщения и отправить. Вся переписка сохраняется в CRM.' },
  { q: 'Подходит ли система для бизнеса в Казахстане?', a: 'Да. CRM 2wix ориентирована на бизнес в Казахстане: интеграция с Kaspi.kz, работа с WhatsApp, учёт в тенге, русский и казахский интерфейс. Подходит для интернет-магазинов и отделов продаж.' },
  { q: 'Нужен ли программист для подключения?', a: 'Нет. Достаточно получить API-токен в личном кабинете Магазина на Kaspi.kz (Настройки → API) и вставить его в раздел «Интеграции» в CRM. Подключение занимает несколько минут.' },
  { q: 'Как часто синхронизируются заказы?', a: 'По умолчанию можно запускать синхронизацию вручную кнопкой «Синхронизировать сейчас». Либо настроить автоматическую синхронизацию 4 раза в день. Реже — чтобы не нагружать API и не делать лишних запросов.' },
  { q: 'Можно ли подключить несколько магазинов?', a: 'У каждой компании в CRM — свой набор интеграций. Одна компания подключает один свой Kaspi-магазин. Если у вас несколько юрлиц или брендов — для каждого можно создать отдельную компанию в CRM и подключить свой магазин.' },
];

interface FormState {
  name: string;
  phone: string;
  company: string;
  comment: string;
}

interface FormErrors {
  name?: string;
  phone?: string;
  general?: string;
}

function buildFormWhatsAppMessage(values: FormState): string {
  const parts: string[] = [];
  parts.push('Здравствуйте! Хочу подключить CRM для Kaspi-магазина.');
  parts.push('');
  if (values.name.trim()) parts.push(`Имя: ${values.name.trim()}`);
  if (values.phone.trim()) parts.push(`Телефон: ${values.phone.trim()}`);
  if (values.company.trim()) parts.push(`Магазин/компания: ${values.company.trim()}`);
  if (values.comment.trim()) parts.push(`Комментарий: ${values.comment.trim()}`);
  parts.push('');
  parts.push('Пожалуйста, свяжитесь со мной.');
  return parts.join('\n');
}

export const CrmDlyaKaspiPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({ name: '', phone: '', company: '', comment: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formSent, setFormSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: FormErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Введите имя';
    if (!form.phone.trim()) nextErrors.phone = 'Введите телефон';
    if (nextErrors.name || nextErrors.phone) {
      nextErrors.general = 'Заполните обязательные поля, чтобы отправить заявку в WhatsApp.';
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    const message = buildFormWhatsAppMessage(form);
    const url = buildWhatsAppUrl(message, WHATSAPP_CONTACT_NUMBER);
    window.open(url, '_blank', 'noopener,noreferrer');
    setFormSent(true);
    setForm({ name: '', phone: '', company: '', comment: '' });
  };

  return (
    <SEOPageLayout title={TITLE} description={DESCRIPTION} path="/crm-dlya-kaspi">
      {/* Hero */}
      <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sf-backgroundSection via-sf-background to-sf-background" />
        <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-amber-100/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sf-text-primary tracking-tight">
                CRM для Kaspi-магазина в Казахстане
              </h1>
              <p className="mt-6 text-lg md:text-xl text-sf-text-secondary max-w-xl leading-relaxed">
                Подтягивайте заказы из Kaspi, открывайте WhatsApp в один клик, ведите клиентов и переписку в одной CRM.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/register-company')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-sfCard font-semibold text-sf-text-inverse bg-sf-primary hover:bg-sf-primaryHover shadow-lg transition-all"
                >
                  Получить консультацию
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/register-company')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-sfCard font-semibold text-sf-text-secondary bg-sf-surface border border-sf-border hover:border-sf-cardBorder transition-all"
                >
                  Посмотреть демо
                </button>
                <a
                  href="#form"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-sfCard font-semibold text-sf-text-secondary bg-sf-backgroundSection border border-sf-borderLight hover:bg-sf-backgroundPage transition-all"
                >
                  Оставить заявку
                </a>
              </div>
            </div>
            <div className="rounded-sfCard border border-sf-cardBorder bg-sf-surface p-6 shadow-sfCard">
              <div className="aspect-video bg-sf-backgroundSection rounded-lg flex items-center justify-center text-sf-text-muted">
                <div className="text-center">
                  <LayoutDashboard className="w-16 h-16 mx-auto mb-2 opacity-60" />
                  <p className="text-sm">Интерфейс CRM: заказы Kaspi, чаты, карточка клиента</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-sf-text-muted text-center">
                Заказы из Kaspi отображаются в списке чатов, справа — карточка с кнопкой WhatsApp и данными заказа.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Проблемы */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Какие проблемы решает интеграция
          </h2>
          <p className="text-sf-text-secondary text-center mb-12 max-w-2xl mx-auto">
            Владельцы магазинов на Kaspi.kz часто сталкиваются с одними и теми же сложностями. CRM с интеграцией Kaspi помогает их снять.
          </p>
          <ul className="grid sm:grid-cols-2 gap-4">
            {PROBLEMS.map((item) => (
              <li key={item} className="flex items-start gap-3 p-4 rounded-sfCard bg-sf-backgroundSection/80">
                <span className="text-amber-600 mt-0.5">•</span>
                <span className="text-sf-text-secondary">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Возможности */}
      <section className="py-16 md:py-20 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Что умеет интеграция Kaspi с CRM
          </h2>
          <p className="text-sf-text-secondary text-center mb-12 max-w-2xl mx-auto">
            Описанные возможности доступны в продукте после подключения Kaspi в разделе «Интеграции».
          </p>
          <ul className="space-y-4">
            {FEATURES.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-sf-accent flex-shrink-0 mt-0.5" />
                <span className="text-sf-text-secondary">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Как это работает */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-12">
            Как это работает
          </h2>
          <ol className="space-y-8">
            {HOW_IT_WORKS.map(({ step, title, sub }) => (
              <li key={step} className="flex gap-6">
                <span className="flex-shrink-0 w-12 h-12 rounded-full bg-sf-primary text-white font-bold flex items-center justify-center">
                  {step}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-sf-text-primary">{title}</h3>
                  <p className="text-sf-text-secondary mt-1">{sub}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Для кого */}
      <section className="py-16 md:py-20 bg-sf-backgroundSection/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Для кого подходит
          </h2>
          <p className="text-sf-text-secondary text-center mb-12 max-w-2xl mx-auto">
            CRM с интеграцией Kaspi ориентирована на продавцов и интернет-магазины в Казахстане.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {FOR_WHOM.map((item) => (
              <span
                key={item}
                className="px-4 py-2 rounded-sfCard bg-sf-surface border border-sf-cardBorder text-sf-text-secondary text-sm"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Преимущества */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-12">
            Почему это удобно
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENEFITS.map((item) => (
              <div
                key={item}
                className="rounded-sfCard border border-sf-cardBorder bg-sf-surface p-6 shadow-sfCard hover:shadow-sfCardHover transition-shadow"
              >
                <p className="text-sf-text-secondary">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Скриншоты / интерфейс */}
      <section className="py-16 md:py-20 bg-sf-backgroundSection/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
            Интерфейс CRM для работы с заказами Kaspi
          </h2>
          <p className="text-sf-text-secondary text-center mb-12 max-w-2xl mx-auto">
            Заказы, чаты и карточка клиента в одном окне. Быстрые действия: WhatsApp и ссылка на заказ в Kaspi.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-sfCard border border-sf-cardBorder bg-sf-surface p-4 shadow-sm">
              <div className="aspect-[4/3] bg-sf-backgroundSection rounded-lg flex items-center justify-center mb-3">
                <FileText className="w-12 h-12 text-sf-text-muted" />
              </div>
              <p className="text-sm font-medium text-sf-text-primary">Блок интеграции Kaspi в настройках</p>
              <p className="text-xs text-sf-text-muted mt-1">Подключение API, синхронизация, статус последнего импорта</p>
            </div>
            <div className="rounded-sfCard border border-sf-cardBorder bg-sf-surface p-4 shadow-sm">
              <div className="aspect-[4/3] bg-sf-backgroundSection rounded-lg flex items-center justify-center mb-3">
                <LayoutDashboard className="w-12 h-12 text-sf-text-muted" />
              </div>
              <p className="text-sm font-medium text-sf-text-primary">Список заказов и чатов</p>
              <p className="text-xs text-sf-text-muted mt-1">Заказы Kaspi отображаются в общем списке с меткой и данными клиента</p>
            </div>
            <div className="rounded-sfCard border border-sf-cardBorder bg-sf-surface p-4 shadow-sm">
              <div className="aspect-[4/3] bg-sf-backgroundSection rounded-lg flex items-center justify-center mb-3">
                <MessageCircle className="w-12 h-12 text-sf-text-muted" />
              </div>
              <p className="text-sm font-medium text-sf-text-primary">Карточка заказа и кнопка WhatsApp</p>
              <p className="text-xs text-sf-text-muted mt-1">Детали заказа, быстрый шаблон сообщения, открытие чата в один клик</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-12">
            Вопросы и ответы
          </h2>
          <div className="space-y-8">
            {FAQ_ITEMS.map(({ q, a }) => (
              <div key={q} className="border-b border-sf-borderLight pb-8 last:border-0">
                <h3 className="text-lg font-semibold text-sf-text-primary mb-2">{q}</h3>
                <p className="text-sf-text-secondary">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA внизу */}
      <section className="py-20 md:py-28 bg-sf-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Подключим CRM для вашего Kaspi-магазина
          </h2>
          <p className="text-lg text-white/95 mb-10 max-w-xl mx-auto">
            Покажем, как автоматизировать обработку заказов и объединить Kaspi с WhatsApp в одной системе.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
            <a
              href="#form"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfButton font-semibold text-sf-primary bg-white hover:bg-sf-surfaceElevated shadow-sfCardHover transition-all"
            >
              Оставить заявку
            </a>
            <button
              type="button"
              onClick={() => navigate('/register-company')}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfButton font-semibold text-white border-2 border-white/50 hover:border-white/70 transition-all"
            >
              Получить демо
            </button>
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-sfButton font-semibold text-white border-2 border-white/50 hover:border-white/70 transition-all"
            >
              <MessageCircle className="w-5 h-5" />
              Написать в WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Лид-форма */}
      <section id="form" className="py-16 md:py-20 bg-sf-backgroundSection/80 scroll-mt-24">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-sf-text-primary text-center mb-4">
            Оставить заявку в WhatsApp
          </h2>
          <p className="text-sf-text-secondary text-center mb-8">
            Оставьте контакты — мы свяжемся с вами и покажем, как подключить Kaspi к CRM. После отправки откроется WhatsApp с готовым сообщением.
          </p>
          {formSent ? (
            <div className="rounded-sfCard bg-sf-primaryLight border border-sf-cardBorder p-6 text-center text-sf-text-primary">
              Спасибо! Мы получили заявку и свяжемся с вами в ближайшее время.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="lead-name" className="block text-sm font-medium text-sf-text-primary mb-1">
                  Имя <span className="text-red-500">*</span>
                </label>
                <input
                  id="lead-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-sfButton border border-sf-border px-4 py-2.5 text-sf-text-primary focus:ring-2 focus:ring-sf-primary focus:border-sf-primary"
                  placeholder="Как к вам обращаться"
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="lead-phone" className="block text-sm font-medium text-sf-text-primary mb-1">
                  Телефон <span className="text-red-500">*</span>
                </label>
                <input
                  id="lead-phone"
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded-sfButton border border-sf-border px-4 py-2.5 text-sf-text-primary focus:ring-2 focus:ring-sf-primary focus:border-sf-primary"
                  placeholder="+7 (___) ___-__-__"
                />
                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
              </div>
              <div>
                <label htmlFor="lead-company" className="block text-sm font-medium text-sf-text-primary mb-1">
                  Магазин / компания
                </label>
                <input
                  id="lead-company"
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  className="w-full rounded-sfButton border border-sf-border px-4 py-2.5 text-sf-text-primary focus:ring-2 focus:ring-sf-primary focus:border-sf-primary"
                  placeholder="Название магазина на Kaspi или компании"
                />
              </div>
              <div>
                <label htmlFor="lead-comment" className="block text-sm font-medium text-sf-text-primary mb-1">
                  Комментарий
                </label>
                <textarea
                  id="lead-comment"
                  rows={3}
                  value={form.comment}
                  onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                  className="w-full rounded-sfButton border border-sf-border px-4 py-2.5 text-sf-text-primary focus:ring-2 focus:ring-sf-primary focus:border-sf-primary resize-none"
                  placeholder="Что вас интересует: демо, консультация, подключение"
                />
              </div>
              {errors.general && (
                <p className="text-xs text-red-600">
                  {errors.general}
                </p>
              )}
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-sfCard font-semibold text-sf-text-inverse bg-sf-primary hover:bg-sf-primaryHover shadow-md transition-all"
              >
                Отправить заявку в WhatsApp
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </section>
    </SEOPageLayout>
  );
};
