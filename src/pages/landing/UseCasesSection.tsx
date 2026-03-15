import React from 'react';
import { MessageCircle, Target, HardHat, Factory, Truck, Database } from 'lucide-react';

const CASES = [
  { icon: MessageCircle, title: 'Продажи через WhatsApp', desc: 'Заявки из чатов, быстрые ответы и учёт в CRM.' },
  { icon: Target, title: 'Отдел продаж', desc: 'Воронка, лиды, конверсии и отчётность.' },
  { icon: HardHat, title: 'Строительная компания', desc: 'Объекты, сметы, склад, документы и финансы.' },
  { icon: Factory, title: 'Производство', desc: 'Материалы, остатки, приходы и расходы по объектам.' },
  { icon: Truck, title: 'Команда с полевыми сотрудниками', desc: 'Выезды, заявки и учёт по клиентам.' },
  { icon: Database, title: 'Управление клиентской базой', desc: 'Единая база, история и коммуникации.' },
];

export const UseCasesSection: React.FC = () => (
  <section id="use-cases" className="font-sans py-20 md:py-28 bg-sf-background">
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
      <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
        Сценарии использования
      </h2>
      <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
        Один продукт — разные ниши и форматы работы
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {CASES.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="rounded-sfCard border border-sf-border bg-sf-backgroundSection/50 p-6 hover:border-sf-cardBorder hover:bg-sf-primaryLight/30 transition-all duration-200"
          >
            <div className="w-12 h-12 rounded-sfCard bg-sf-surface border border-sf-border flex items-center justify-center text-sf-accent mb-4 shadow-sfSm">
              <Icon className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-sf-text-primary mb-2">{title}</h3>
            <p className="text-sm text-sf-text-secondary">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);
