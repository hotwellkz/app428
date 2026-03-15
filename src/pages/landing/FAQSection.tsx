import React from 'react';

const FAQ_ITEMS = [
  {
    q: 'Что такое 2wix?',
    a: '2wix — это CRM-платформа для бизнеса: клиенты, сделки, WhatsApp-чаты, финансы, склад и аналитика в одной системе.',
  },
  {
    q: 'Как начать пользоваться?',
    a: 'Нажмите «Попробовать» или «Создать компанию», зарегистрируйтесь и пригласите сотрудников. Можно начать работу сразу.',
  },
  {
    q: 'Подходит ли 2wix для малого бизнеса?',
    a: 'Да. Система рассчитана на малый и средний бизнес, отделы продаж и команды, которым нужен порядок в клиентах и сделках без сложного внедрения.',
  },
];

export const FAQSection: React.FC = () => (
  <section id="faq" className="py-20 md:py-28 bg-white">
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-4">
        Частые вопросы
      </h2>
      <p className="text-lg text-slate-600 text-center mb-14">
        Краткие ответы на типичные вопросы
      </p>
      <ul className="space-y-6">
        {FAQ_ITEMS.map(({ q, a }) => (
          <li key={q} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6">
            <h3 className="font-semibold text-slate-900 mb-2">{q}</h3>
            <p className="text-slate-600 text-sm leading-relaxed">{a}</p>
          </li>
        ))}
      </ul>
    </div>
  </section>
);
