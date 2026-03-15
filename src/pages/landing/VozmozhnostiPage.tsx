import React from 'react';
import { Link } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import { PublicCTA } from './PublicCTA';
import { Users, MessageSquare, GitBranch, FileText, BarChart3, Wallet, Shield, Package, Folder } from 'lucide-react';

const TITLE = 'Возможности CRM 2wix — функции и модули для бизнеса';
const DESCRIPTION = 'Полный обзор возможностей 2wix: клиенты, WhatsApp, сделки, шаблоны, аналитика, транзакции, роли, склад и файлы. CRM-система для бизнеса и продаж.';

const FEATURES = [
  { icon: Users, title: 'Клиенты', desc: 'База клиентов, контакты, история взаимодействий и сделок. Единая карточка по каждому клиенту.' },
  { icon: MessageSquare, title: 'WhatsApp и чаты', desc: 'Переписка с клиентами в одном интерфейсе, быстрые ответы и шаблоны сообщений.' },
  { icon: GitBranch, title: 'Сделки и воронка', desc: 'Воронка продаж, этапы, перенос сделок, отчётность по конверсии и менеджерам.' },
  { icon: FileText, title: 'Шаблоны и документы', desc: 'Шаблоны договоров и типовых документов. Быстрое формирование документов по сделке.' },
  { icon: BarChart3, title: 'Аналитика', desc: 'Дашборды, отчёты по сделкам, продажам и активности команды. Управленческая отчётность.' },
  { icon: Wallet, title: 'Транзакции и финансы', desc: 'Учёт операций по объектам и проектам, одобрение, лента операций и отчёты.' },
  { icon: Shield, title: 'Роли и права', desc: 'Владелец, администратор, менеджер, сотрудник. Гибкая настройка доступа к разделам и действиям.' },
  { icon: Package, title: 'Склад и материалы', desc: 'Остатки, приходы и расходы, привязка к объектам и проектам. Учёт для производства и строительства.' },
  { icon: Folder, title: 'Файлы', desc: 'Файлы клиентов и документы по сделкам в одном месте. Порядок в документации.' },
];

export const VozmozhnostiPage: React.FC = () => (
  <SEOPageLayout title={TITLE} description={DESCRIPTION}>
    <section className="pt-28 pb-16 md:pt-36 md:pb-24 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
          Возможности CRM 2wix
        </h1>
        <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto">
          Всё необходимое для продаж, коммуникаций и операционного управления: клиенты, WhatsApp, сделки, аналитика, финансы, склад и права доступа в одной системе.
        </p>
      </div>
    </section>

    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">Функциональные блоки</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 hover:border-slate-300 transition-colors">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="py-16 md:py-24 bg-slate-50/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-10">Куда двигаться дальше</h2>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/crm-dlya-biznesa" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
            CRM для бизнеса
          </Link>
          <Link to="/crm-dlya-prodazh" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
            CRM для продаж
          </Link>
          <Link to="/whatsapp-crm" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
            WhatsApp CRM
          </Link>
          <Link to="/ceny" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
            Цены
          </Link>
          <Link to="/faq" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
            Вопросы и ответы
          </Link>
        </div>
      </div>
    </section>

    <PublicCTA />
  </SEOPageLayout>
);
