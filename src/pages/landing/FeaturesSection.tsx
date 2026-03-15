import React from 'react';
import {
  Users,
  MessageSquare,
  GitBranch,
  Zap,
  BarChart3,
  Shield,
  Wallet,
  Package,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Users,
    title: 'Клиенты',
    desc: 'База клиентов, контакты, история взаимодействий и сделок.',
  },
  {
    icon: MessageSquare,
    title: 'WhatsApp / чаты',
    desc: 'Переписка с клиентами в одном интерфейсе, быстрые ответы и шаблоны.',
  },
  {
    icon: GitBranch,
    title: 'Сделки и воронка',
    desc: 'Воронка продаж, этапы, перенос между этапами и отчётность.',
  },
  {
    icon: Zap,
    title: 'Быстрые ответы',
    desc: 'Шаблоны сообщений для типовых ситуаций — ускорение работы менеджеров.',
  },
  {
    icon: BarChart3,
    title: 'Аналитика',
    desc: 'Дашборды, отчёты по сделкам, продажам и активности команды.',
  },
  {
    icon: Shield,
    title: 'Роли и права',
    desc: 'Гибкая настройка доступа: владелец, администратор, менеджер, сотрудник.',
  },
  {
    icon: Wallet,
    title: 'Финансы / транзакции',
    desc: 'Учёт операций по объектам, одобрение, лента и отчёты.',
  },
  {
    icon: Package,
    title: 'Склад / материалы',
    desc: 'Остатки, приходы и расходы, привязка к объектам и проектам.',
  },
];

export const FeaturesSection: React.FC = () => (
  <section id="features" className="py-20 md:py-28 bg-white">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-4">
        Ключевые возможности
      </h2>
      <p className="text-lg text-slate-600 text-center max-w-2xl mx-auto mb-14">
        Всё необходимое для продаж, коммуникаций и операционного управления
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-6 hover:bg-white hover:shadow-lg hover:border-slate-200 transition-all duration-200"
          >
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shadow-sm mb-4">
              <Icon className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);
