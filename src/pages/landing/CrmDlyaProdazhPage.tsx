import React from 'react';
import { Link } from 'react-router-dom';
import { SEOPageLayout } from './SEOPageLayout';
import { PublicCTA } from './PublicCTA';
import { Target, MessageCircle, Users, TrendingUp, BarChart3 } from 'lucide-react';

const TITLE = 'CRM для отдела продаж — 2wix | Воронка, заявки, контроль менеджеров';
const DESCRIPTION = 'CRM для продаж: воронка, заявки из WhatsApp, контроль касаний и конверсии. 2wix — система для отдела продаж и менеджеров.';

export const CrmDlyaProdazhPage: React.FC = () => (
  <SEOPageLayout title={TITLE} description={DESCRIPTION}>
    <section className="pt-28 pb-16 md:pt-36 md:pb-24 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
          CRM для отдела продаж
        </h1>
        <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto">
          Воронка продаж, заявки, контроль менеджеров и аналитика конверсии. Всё, что нужно отделу продаж и руководителю — в одной системе.
        </p>
      </div>
    </section>

    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">Что даёт 2wix отделу продаж</h2>
        <div className="grid md:grid-cols-2 gap-10">
          {[
            { icon: Target, title: 'Заявки и воронка', text: 'Лиды и заявки в одном месте. Воронка с этапами, перенос сделок между этапами, сроки и ответственные. Прозрачность по каждому менеджеру и по конвейеру в целом.' },
            { icon: MessageCircle, title: 'WhatsApp-коммуникации', text: 'Переписка с клиентами в CRM, быстрые ответы и шаблоны. Заявки из чатов сразу попадают в воронку. Не теряйте обращения из мессенджеров.' },
            { icon: Users, title: 'Контроль касаний', text: 'История взаимодействий с каждым клиентом, кто и когда звонил или писал. Настраиваемые права: кто видит какие сделки и отчёты.' },
            { icon: TrendingUp, title: 'Аналитика конверсии', text: 'Конверсия по этапам, по менеджерам, по источникам. Отчёты и дашборды для ежедневного контроля и планирования.' },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-4 rounded-2xl border border-slate-200 p-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="py-16 md:py-24 bg-slate-50/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-10">Полезные разделы</h2>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/whatsapp-crm" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
            WhatsApp CRM
          </Link>
          <Link to="/crm-dlya-biznesa" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
            CRM для бизнеса
          </Link>
          <Link to="/vozmozhnosti" className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
            Возможности
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
