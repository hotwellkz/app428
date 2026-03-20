import React from 'react';
import { Link } from 'react-router-dom';
import { publicTokens } from '../theme';

/** Группы ссылок футера: только публичные страницы. Внутренняя CRM не включается. */
const FOOTER_GROUPS = [
  {
    title: 'Продукт',
    links: [
      { label: 'Возможности', to: '/vozmozhnosti' },
      { label: 'Цены', to: '/ceny' },
      { label: 'FAQ', to: '/faq' },
      { label: 'Вход', to: '/' },
    ],
  },
  {
    title: 'CRM и отрасли',
    links: [
      { label: 'CRM для бизнеса', to: '/crm-dlya-biznesa' },
      { label: 'CRM для малого бизнеса', to: '/crm-dlya-malogo-biznesa' },
      { label: 'CRM для продаж', to: '/crm-dlya-prodazh' },
      { label: 'CRM для команды', to: '/crm-dlya-komandy' },
      { label: 'CRM для строительной компании', to: '/crm-dlya-stroitelnoi-kompanii' },
      { label: 'CRM для производства', to: '/crm-dlya-proizvodstva' },
      { label: 'CRM для сферы услуг', to: '/crm-dlya-uslug' },
      { label: 'CRM для Kaspi-магазина', to: '/crm-dlya-kaspi' },
    ],
  },
  {
    title: 'Функции',
    links: [
      { label: 'Управление клиентами', to: '/upravlenie-klientami' },
      { label: 'Учёт клиентов', to: '/uchet-klientov' },
      { label: 'Единая база клиентов', to: '/edinaya-baza-klientov' },
      { label: 'Клиенты', to: '/klienty' },
      { label: 'Управление заявками', to: '/upravlenie-zayavkami' },
      { label: 'Сделки и воронка', to: '/sdelki-i-voronka' },
      { label: 'WhatsApp CRM', to: '/whatsapp-crm' },
      { label: 'CRM с телефонией (Twilio)', to: '/crm-twilio' },
      { label: 'WhatsApp для отдела продаж', to: '/whatsapp-dlya-otdela-prodazh' },
      { label: 'WhatsApp и чаты', to: '/whatsapp-i-chaty' },
      { label: 'Быстрые ответы', to: '/bystrye-otvety' },
      { label: 'Аналитика продаж', to: '/analitika-prodazh' },
      { label: 'Аналитика', to: '/analitika' },
      { label: 'Контроль менеджеров', to: '/kontrol-menedzherov' },
      { label: 'Роли и права', to: '/roli-i-prava' },
      { label: 'Транзакции и финансы', to: '/tranzakcii-i-finansy' },
      { label: 'Склад и материалы', to: '/sklad-i-materialy' },
    ],
  },
  {
    title: 'Полезное',
    links: [
      { label: 'Что такое CRM', to: '/chto-takoe-crm' },
      { label: 'Как выбрать CRM', to: '/kak-vybrat-crm' },
      { label: 'Зачем нужна CRM', to: '/zachem-nuzhna-crm' },
      { label: 'CRM или Excel', to: '/crm-ili-excel' },
    ],
  },
];

export const PublicFooter: React.FC = () => (
  <footer
    id="footer"
    className="font-sans bg-sf-primary py-sectionSm md:py-16 text-white"
    data-public-site
  >
    <div className={publicTokens.container.base}>
      <div className="flex flex-col gap-10 md:gap-12">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          <Link to="/" className="flex items-center gap-2 text-white font-semibold text-lg hover:text-white shrink-0">
            <span className="w-8 h-8 rounded-sfButton bg-white/20 flex items-center justify-center text-white font-bold text-sm">
              2
            </span>
            2wix
          </Link>
          <nav className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8 md:gap-10">
            {FOOTER_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-4">
                  {group.title}
                </h3>
                <ul className="space-y-3">
                  {group.links.map(({ label, to }) => (
                    <li key={to + label}>
                      <Link
                        to={to}
                        className="text-sm font-medium text-white/95 hover:text-white transition-colors"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="pt-8 border-t border-white/30">
          <p className="text-sm text-white/90">© {new Date().getFullYear()} 2wix. CRM для бизнеса, продаж и коммуникаций.</p>
        </div>
      </div>
    </div>
  </footer>
);
