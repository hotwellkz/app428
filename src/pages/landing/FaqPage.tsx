import React from 'react';
import { Link } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import { PublicCTA } from './PublicCTA';

const TITLE = 'Вопросы и ответы — 2wix CRM | FAQ';
const DESCRIPTION = 'Ответы на частые вопросы о 2wix: для кого подходит, использование не только в строительстве, WhatsApp, настройка, регистрация, права доступа, сделки и аналитика.';

const FAQ_GROUPS = [
  {
    title: 'Для кого подходит 2wix',
    items: [
      { q: 'Для кого подходит 2wix?', a: '2wix подходит для малого и среднего бизнеса, отделов продаж, компаний с заявками через WhatsApp, строительных и производственных компаний, сервисных команд. Это универсальная CRM, а не только для одной отрасли.' },
      { q: 'Можно ли использовать 2wix не только в строительстве?', a: 'Да. 2wix — универсальная CRM для бизнеса. Строительство — один из сценариев (объекты, сметы, склад), но система одинаково подходит для продаж, услуг, производства и любых команд, которым нужны клиенты, сделки и коммуникации.' },
    ],
  },
  {
    title: 'Функциональность',
    items: [
      { q: 'Есть ли в 2wix интеграция с WhatsApp?', a: 'Да. В 2wix встроен WhatsApp CRM: переписка с клиентами в одном интерфейсе, быстрые ответы, шаблоны и связь чатов со сделками. Заявки из мессенджера попадают в воронку.' },
      { q: 'Можно ли настроить 2wix под нашу компанию?', a: 'Да. Доступны роли и права (владелец, администратор, менеджер, сотрудник), настройка доступа к разделам меню и дополнительные права (например, одобрение транзакций). Модули можно использовать в зависимости от задач.' },
      { q: 'Как устроена регистрация?', a: 'Вы создаёте компанию и становитесь владельцем. Далее можно приглашать сотрудников по email. Регистрация и создание компании занимают несколько минут, без длительного внедрения.' },
    ],
  },
  {
    title: 'Права и контроль',
    items: [
      { q: 'Есть ли в 2wix права доступа?', a: 'Да. Настраиваются роли (владелец, администратор, менеджер, сотрудник), доступ к разделам меню и дополнительные права. Владелец может назначать, например, право одобрять транзакции отдельным сотрудникам.' },
      { q: 'Можно ли вести сделки и аналитику?', a: 'Да. В 2wix есть воронка сделок, этапы, перенос между этапами и отчётность по конверсии. Аналитика включает дашборды и отчёты по сделкам, продажам и активности команды.' },
    ],
  },
];

export const FaqPage: React.FC = () => (
  <SEOPageLayout title={TITLE} description={DESCRIPTION}>
    <section className="pt-28 pb-16 md:pt-36 md:pb-24 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
          Вопросы и ответы
        </h1>
        <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto">
          Ответы на частые вопросы о 2wix: возможности, настройка, регистрация и использование CRM для бизнеса и продаж.
        </p>
      </div>
    </section>

    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {FAQ_GROUPS.map((group) => (
          <div key={group.title} className="mb-14 last:mb-0">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">{group.title}</h2>
            <ul className="space-y-6">
              {group.items.map(({ q, a }) => (
                <li key={q} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6">
                  <h3 className="font-semibold text-slate-900 mb-2">{q}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{a}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>

    <section className="py-16 md:py-24 bg-slate-50/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-10">Дальше</h2>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/ceny" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
            Цены
          </Link>
          <Link to="/vozmozhnosti" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
            Возможности
          </Link>
          <Link to="/" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
            На главную
          </Link>
        </div>
      </div>
    </section>

    <PublicCTA />
  </SEOPageLayout>
);
