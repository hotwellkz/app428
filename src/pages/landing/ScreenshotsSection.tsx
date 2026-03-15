import React from 'react';
import { MessageSquare, GitBranch, BarChart3, Wallet } from 'lucide-react';

const PREVIEWS = [
  { icon: MessageSquare, label: 'Чаты и WhatsApp', color: 'from-emerald-500/20 to-teal-500/20' },
  { icon: GitBranch, label: 'Сделки и воронка', color: 'from-slate-500/20 to-slate-600/20' },
  { icon: BarChart3, label: 'Аналитика', color: 'from-blue-500/20 to-indigo-500/20' },
  { icon: Wallet, label: 'Транзакции и финансы', color: 'from-amber-500/20 to-orange-500/20' },
];

export const ScreenshotsSection: React.FC = () => (
  <section className="py-20 md:py-28 bg-slate-50/80">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-4">
        Интерфейс 2wix
      </h2>
      <p className="text-lg text-slate-600 text-center max-w-2xl mx-auto mb-14">
        Всё под рукой: чаты, сделки, отчёты и операции в одном продукте
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {PREVIEWS.map(({ icon: Icon, label, color }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-lg shadow-slate-200/50 hover:shadow-xl transition-shadow"
          >
            <div className={`aspect-video bg-gradient-to-br ${color} flex items-center justify-center p-6`}>
              <div className="w-16 h-16 rounded-2xl bg-white/90 shadow-lg flex items-center justify-center text-slate-600">
                <Icon className="w-8 h-8" />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100">
              <p className="font-medium text-slate-900 text-center">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
