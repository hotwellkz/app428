import React from 'react';
import { MessageSquare, GitBranch, BarChart3, Wallet } from 'lucide-react';

const PREVIEWS = [
  { icon: MessageSquare, label: 'Чаты и WhatsApp', color: 'from-sf-primary/20 to-sf-accent/20' },
  { icon: GitBranch, label: 'Сделки и воронка', color: 'from-sf-text-secondary/20 to-sf-primary/20' },
  { icon: BarChart3, label: 'Аналитика', color: 'from-sf-accent/20 to-sf-primaryLight' },
  { icon: Wallet, label: 'Транзакции и финансы', color: 'from-sf-primaryLight to-sf-backgroundSection' },
];

export const ScreenshotsSection: React.FC = () => (
  <section className="font-sans py-20 md:py-28 bg-sf-backgroundSection/80">
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
      <h2 className="text-3xl md:text-4xl font-bold text-sf-text-primary text-center mb-4">
        Интерфейс 2wix
      </h2>
      <p className="text-lg text-sf-text-secondary text-center max-w-2xl mx-auto mb-14">
        Всё под рукой: чаты, сделки, отчёты и операции в одном продукте
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {PREVIEWS.map(({ icon: Icon, label, color }) => (
          <div
            key={label}
            className="rounded-sfCard border border-sf-border bg-sf-surface overflow-hidden shadow-sfCard hover:shadow-sfCardHover transition-shadow"
          >
            <div className={`aspect-video bg-gradient-to-br ${color} flex items-center justify-center p-6`}>
              <div className="w-16 h-16 rounded-sfCard bg-sf-surface/90 shadow-sfMd flex items-center justify-center text-sf-text-secondary">
                <Icon className="w-8 h-8" />
              </div>
            </div>
            <div className="p-4 border-t border-sf-borderLight">
              <p className="font-medium text-sf-text-primary text-center">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
