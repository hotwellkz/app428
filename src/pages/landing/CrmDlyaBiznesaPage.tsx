import React from 'react';
import { Link } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import { PublicCTA } from './PublicCTA';
import { Building2, MessageSquare, GitBranch, BarChart3, Users, Layers } from 'lucide-react';

const TITLE = 'CRM для бизнеса — 2wix | Универсальная CRM-система для малого и среднего бизнеса';
const DESCRIPTION = '2wix — CRM для бизнеса: клиенты, сделки, WhatsApp, аналитика и процессы в одной системе. Подходит для разных отраслей и отделов продаж.';

export const CrmDlyaBiznesaPage: React.FC = () => (
  <SEOPageLayout title={TITLE} description={DESCRIPTION}>
    <section className="pt-28 pb-16 md:pt-36 md:pb-24 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
          CRM для бизнеса в одном окне
        </h1>
        <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto">
          Универсальная CRM-система для малого и среднего бизнеса: клиенты, продажи, WhatsApp-коммуникации и операционное управление без сложного внедрения.
        </p>
      </div>
    </section>

    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">Что решает 2wix для бизнеса</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { icon: Building2, title: 'Единая база', text: 'Клиенты, контакты и история взаимодействий в одном месте. Подходит для любого типа бизнеса — от отдела продаж до строительства и производства.' },
            { icon: MessageSquare, title: 'WhatsApp и коммуникации', text: 'Переписка с клиентами в интерфейсе CRM, быстрые ответы и шаблоны. Идеально для компаний, которые получают заявки через мессенджеры.' },
            { icon: GitBranch, title: 'Сделки и воронка', text: 'Воронка продаж, этапы, перенос сделок и отчётность по конверсии. Контроль менеджеров и прозрачность для руководства.' },
            { icon: BarChart3, title: 'Аналитика', text: 'Дашборды и отчёты по сделкам, продажам и активности. Управленческая аналитика для принятия решений.' },
            { icon: Users, title: 'Контроль сотрудников', text: 'Роли и права доступа: владелец, администратор, менеджер. Гибкая настройка под структуру компании.' },
            { icon: Layers, title: 'Гибкость под ниши', text: 'Один продукт — разные сценарии: продажи, строительство, производство, сервисные команды. Настраиваемые модули под ваши процессы.' },
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
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-10">Связанные разделы</h2>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/crm-dlya-prodazh" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
            CRM для отдела продаж
          </Link>
          <Link to="/whatsapp-crm" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
            WhatsApp CRM
          </Link>
          <Link to="/vozmozhnosti" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
            Все возможности
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
