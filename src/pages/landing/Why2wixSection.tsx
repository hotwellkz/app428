import React from 'react';
import { LayoutDashboard, Rocket, Settings, Users, MessageSquare, Eye, BarChart2 } from 'lucide-react';

const REASONS = [
  { icon: LayoutDashboard, title: 'Всё в одном окне', text: 'Клиенты, чаты, сделки, финансы и склад — единый рабочий стол.' },
  { icon: Rocket, title: 'Быстрый запуск', text: 'Начните работу без долгого внедрения и обучения.' },
  { icon: Settings, title: 'Гибкая настройка', text: 'Подстройте модули и права под свой бизнес.' },
  { icon: Users, title: 'Контроль менеджеров', text: 'Роли, доступ к разделам и прозрачность действий.' },
  { icon: MessageSquare, title: 'Работа с WhatsApp', text: 'Переписка и заявки из мессенджера в одной системе.' },
  { icon: Eye, title: 'Прозрачность по сделкам', text: 'Воронка, этапы и история — всё на виду.' },
  { icon: BarChart2, title: 'Управленческая аналитика', text: 'Отчёты и дашборды для принятия решений.' },
];

export const Why2wixSection: React.FC = () => (
  <section className="py-20 md:py-28 bg-slate-50/80">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-4">
        Почему 2wix
      </h2>
      <p className="text-lg text-slate-600 text-center max-w-2xl mx-auto mb-14">
        Платформа, которая растёт вместе с вашим бизнесом
      </p>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {REASONS.map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="flex gap-4 rounded-2xl bg-white border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
