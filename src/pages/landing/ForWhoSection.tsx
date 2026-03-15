import React from 'react';
import { Users, MessageCircle, Building2, HardHat, Factory, Wrench } from 'lucide-react';

const ITEMS = [
  { icon: Users, label: 'Для отделов продаж', desc: 'Воронки, лиды, отчётность' },
  { icon: MessageCircle, label: 'Для компаний с WhatsApp-заявками', desc: 'Чаты, быстрые ответы, CRM в одном месте' },
  { icon: Building2, label: 'Для малого и среднего бизнеса', desc: 'Всё необходимое без сложных внедрений' },
  { icon: HardHat, label: 'Для строительных компаний', desc: 'Объекты, сметы, склад, документы' },
  { icon: Factory, label: 'Для производственных компаний', desc: 'Склад, материалы, учёт' },
  { icon: Wrench, label: 'Для сервисных команд', desc: 'Заявки, выезды, клиенты' },
];

export const ForWhoSection: React.FC = () => (
  <section id="for-who" className="py-20 md:py-28 bg-slate-50/80">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-4">
        Для кого подходит
      </h2>
      <p className="text-lg text-slate-600 text-center max-w-2xl mx-auto mb-14">
        Универсальная платформа для разных отраслей и типов бизнеса
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {ITEMS.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="group rounded-2xl bg-white border border-slate-200/80 p-6 shadow-sm hover:shadow-lg hover:border-slate-300/80 transition-all duration-200"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
              <Icon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">{label}</h3>
            <p className="text-sm text-slate-600">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);
