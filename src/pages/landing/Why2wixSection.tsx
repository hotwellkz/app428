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
  <section className="font-sans py-20 md:py-28 bg-sf-backgroundSection/80">
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
      <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
        Почему 2wix
      </h2>
      <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
        Платформа, которая растёт вместе с вашим бизнесом
      </p>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {REASONS.map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="flex gap-4 rounded-sfCard bg-sf-surface border border-sf-borderLight p-6 shadow-sfSm hover:shadow-sfMd transition-shadow"
          >
            <div className="flex-shrink-0 w-11 h-11 rounded-sfCard bg-sf-primaryLight text-sf-accent flex items-center justify-center">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sf-text-primary mb-1">{title}</h3>
              <p className="text-sm text-sf-text-secondary leading-relaxed">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
