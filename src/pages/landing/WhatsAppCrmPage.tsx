import React from 'react';
import { Link } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import { PublicCTA } from './PublicCTA';
import { MessageSquare, Zap, Users, GitBranch, History, BarChart2 } from 'lucide-react';

const TITLE = 'WhatsApp CRM — 2wix | CRM с интеграцией WhatsApp для бизнеса';
const DESCRIPTION = 'WhatsApp CRM от 2wix: единый интерфейс чатов, быстрые ответы, сделки и история переписки. Управляйте заявками из мессенджера в одной системе.';

export const WhatsAppCrmPage: React.FC = () => (
  <SEOPageLayout title={TITLE} description={DESCRIPTION}>
    <section className="pt-28 pb-16 md:pt-36 md:pb-24 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
          WhatsApp CRM для бизнеса
        </h1>
        <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto">
          Переписка с клиентами в одном интерфейсе, быстрые ответы, сделки и аналитика. Заявки из WhatsApp — в воронке и под контролем.
        </p>
      </div>
    </section>

    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">Возможности WhatsApp CRM</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { icon: MessageSquare, title: 'Единый интерфейс чатов', text: 'Все диалоги с клиентами в одном окне. Не переключайтесь между мессенджером и CRM — всё в 2wix.' },
            { icon: Zap, title: 'Быстрые ответы', text: 'Шаблоны сообщений для типовых ситуаций. Ускорение работы менеджеров и единый тон общения.' },
            { icon: Users, title: 'Контроль переписки', text: 'Распределение чатов между менеджерами, права доступа и прозрачность для руководителя.' },
            { icon: GitBranch, title: 'Сделки из чатов', text: 'Заявки из переписки попадают в воронку. Связь клиента, чата и сделки в одной карточке.' },
            { icon: History, title: 'Клиентская история', text: 'Вся переписка и история взаимодействий по клиенту. Контекст для любого сотрудника.' },
            { icon: BarChart2, title: 'Аналитика по переписке', text: 'Объёмы переписки, скорость ответов и активность менеджеров. Отчёты для оптимизации работы.' },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="py-16 md:py-24 bg-slate-50/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-10">Читайте также</h2>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/crm-dlya-prodazh" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
            CRM для продаж
          </Link>
          <Link to="/vozmozhnosti" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
            Все возможности
          </Link>
          <Link to="/crm-dlya-biznesa" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
            CRM для бизнеса
          </Link>
          <Link to="/ceny" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
            Цены
          </Link>
        </div>
      </div>
    </section>

    <PublicCTA />
  </SEOPageLayout>
);
