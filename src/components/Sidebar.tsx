import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../lib/firebase/auth';
import { 
  ArrowLeftRight, 
  ScrollText,
  Shield,
  Receipt, 
  FileText,
  Users,
  Menu,
  X,
  Package,
  Building2,
  Calculator,
  Warehouse,
  LogOut,
  User,
  MessageSquare,
  Folder,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Pin,
  PinOff,
  Plug,
  Bot,
  Activity
} from 'lucide-react';
import { useUnapprovedCount } from '../hooks/useUnapprovedCount';
import { useWhatsAppFloatingButtonState } from '../hooks/useWhatsAppFloatingButtonState';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useMenuVisibility } from '../contexts/MenuVisibilityContext';
import { useMobileSidebar } from '../contexts/MobileSidebarContext';
import { useMobileWhatsAppChat } from '../contexts/MobileWhatsAppChatContext';
import { useCurrentCompanyUser } from '../hooks/useCurrentCompanyUser';
import type { MenuSectionId } from '../types/menuAccess';

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  sectionId: MenuSectionId;
  isActive?: boolean;
  /** Бейдж (например непрочитанные WhatsApp) — показывается на иконке в свёрнутом виде */
  badgeCount?: number;
}

interface SidebarProps {
  onPageChange: (page: 'dashboard' | 'transactions' | 'feed' | 'daily-report' | 'clients' | 'templates' | 'products' | 'employees' | 'projects' | 'calculator' | 'chat' | 'warehouse' | 'deals') => void;
  currentPage: string;
}

interface MenuItemComponentProps {
  item: MenuItem;
  onClick: () => void;
  collapsed: boolean;
}

const MenuItemComponent: React.FC<MenuItemComponentProps> = ({ item, onClick, collapsed }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const badge = item.badgeCount != null && item.badgeCount > 0;

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onMouseEnter={() => collapsed && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`w-full flex items-center px-4 py-3 my-1 rounded-lg text-gray-700 transition-all duration-200 group relative ${
          item.isActive 
            ? 'bg-emerald-50 text-emerald-600 shadow-sm' 
            : 'hover:bg-gray-50'
        } ${collapsed ? 'justify-center' : 'justify-start'}`}
      >
        {item.isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-emerald-500 rounded-r-full" />
        )}
        <span className={`relative transition-transform duration-200 group-hover:scale-110 ${
          item.isActive ? 'text-emerald-600' : 'text-emerald-500'
        } ${collapsed ? 'mx-auto' : ''}`}>
          {item.icon}
          {collapsed && badge && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-semibold">
              {item.badgeCount! > 99 ? '99+' : item.badgeCount}
            </span>
          )}
        </span>
        {!collapsed && (
          <>
            <span className={`ml-3 text-sm font-medium transition-colors duration-200 ${
              item.isActive ? 'text-emerald-600' : 'text-gray-700 group-hover:text-emerald-600'
            }`}>
              {item.label}
            </span>
            {badge && (
              <span className="ml-auto min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-medium">
                {item.badgeCount! > 99 ? '99+' : item.badgeCount}
              </span>
            )}
          </>
        )}
      </button>
      
      {/* Tooltip для collapsed режима */}
      {collapsed && showTooltip && (
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 px-2 py-1 bg-gray-900 text-white text-sm rounded-md whitespace-nowrap opacity-95 pointer-events-none">
          {item.label}
          {badge && ` (${item.badgeCount})`}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
        </div>
      )}
    </div>
  );
};

const SIDEBAR_PINNED_KEY = 'sidebar-pinned';
const HOVER_COLLAPSE_DELAY_MS = 280;

export const Sidebar: React.FC<SidebarProps> = ({ onPageChange, currentPage }) => {
  const { isOpen: isMobileMenuOpen, close: setMobileMenuOpenFalse, toggle: toggleMobileMenu } = useMobileSidebar();
  const mobileWhatsApp = useMobileWhatsAppChat();
  const navigate = useNavigate();
  const location = useLocation();
  /** WhatsApp: бургер в шапке страницы. Аналитика: своя шапка — плавающую кнопку не показываем */
  const hideFloatingBurgerOnWhatsApp = location.pathname === '/whatsapp';
  const hideFloatingBurgerOnAnalytics = location.pathname === '/analytics';
  const hideBurgerInChat = location.pathname === '/whatsapp' && (mobileWhatsApp?.isMobileWhatsAppChatOpen ?? false);
  const hideFloatingBurger =
    hideFloatingBurgerOnWhatsApp || hideFloatingBurgerOnAnalytics;
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isApprovedEmail, setIsApprovedEmail] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const [pinned, setPinned] = useState<boolean>(() => {
    return localStorage.getItem(SIDEBAR_PINNED_KEY) === 'true';
  });
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const hoverCollapseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const { canAccess } = useCurrentCompanyUser();
  const unapprovedCount = useUnapprovedCount();
  const { isMenuVisible } = useMenuVisibility();
  const whatsAppBadge = useWhatsAppFloatingButtonState(true);
  const whatsAppBadgeCount = whatsAppBadge.unreadChatsCount + whatsAppBadge.awaitingReplyChatsCount;

  useEffect(() => {
    const checkAdminStatus = async () => {
      const current = auth.currentUser;
      if (current) {
        setUserEmail(current.email ?? null);

        const userDoc = await getDoc(doc(db, 'users', current.uid));
        if (userDoc.exists()) {
          setIsAdmin(userDoc.data().role === 'global_admin');
        }

        const approved = (import.meta.env.VITE_APPROVED_EMAILS || '')
          .split(',')
          .map((e: string) => e.trim().toLowerCase())
          .filter(Boolean);
        setIsApprovedEmail(
          !!current.email && approved.includes(current.email.toLowerCase())
        );
      } else {
        setUserEmail(null);
        setIsApprovedEmail(false);
      }
    };

    checkAdminStatus();
  }, []);

  const toggleSidebar = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    if (newState) setPinned(false);
    localStorage.setItem('sidebar-collapsed', newState.toString());
    if (newState) localStorage.setItem(SIDEBAR_PINNED_KEY, 'false');
  };

  const togglePinned = () => {
    const newPinned = !pinned;
    setPinned(newPinned);
    localStorage.setItem(SIDEBAR_PINNED_KEY, newPinned.toString());
    if (newPinned) {
      setCollapsed(false);
      localStorage.setItem('sidebar-collapsed', 'false');
    }
  };

  const handleDesktopSidebarMouseEnter = () => {
    if (hoverCollapseTimerRef.current) {
      clearTimeout(hoverCollapseTimerRef.current);
      hoverCollapseTimerRef.current = null;
    }
    setHoverExpanded(true);
  };

  const handleDesktopSidebarMouseLeave = () => {
    hoverCollapseTimerRef.current = setTimeout(() => setHoverExpanded(false), HOVER_COLLAPSE_DELAY_MS);
  };

  React.useEffect(() => {
    return () => {
      if (hoverCollapseTimerRef.current) clearTimeout(hoverCollapseTimerRef.current);
    };
  }, []);

  const desktopExpanded = pinned || !collapsed || hoverExpanded;

  const allMenuItems: MenuItem[] = [
    { icon: <ArrowLeftRight size={20} />, label: 'Транзакции', path: '/transactions', sectionId: 'transactions', isActive: location.pathname === '/transactions' },
    { icon: <ScrollText size={20} />, label: 'Лента', path: '/feed', sectionId: 'feed', isActive: location.pathname === '/feed' },
    { icon: <Users size={20} />, label: 'Клиенты', path: '/clients', sectionId: 'clients', isActive: location.pathname === '/clients' },
    { icon: <Warehouse className="w-5 h-5" />, label: 'Склад', path: '/warehouse', sectionId: 'warehouse', isActive: location.pathname === '/warehouse' },
    { icon: <Calculator className="w-5 h-5" />, label: 'Калькулятор', path: '/calculator', sectionId: 'calculator', isActive: location.pathname === '/calculator' },
    { icon: <Folder size={20} />, label: 'Файлы клиентов', path: '/client-files', sectionId: 'clientFiles', isActive: location.pathname === '/client-files' || (location.pathname.includes('/clients/') && location.pathname.includes('/files')) },
    { icon: <FileText className="w-5 h-5" />, label: 'Шаблоны договоров', path: '/templates', sectionId: 'templates', isActive: location.pathname === '/templates' },
    { icon: <Package className="w-5 h-5" />, label: 'Товары и цены', path: '/products', sectionId: 'products', isActive: location.pathname === '/products' },
    { icon: <Users className="w-5 h-5" />, label: 'Сотрудники', path: '/employees', sectionId: 'employees', isActive: location.pathname === '/employees' },
    { icon: <MessageSquare className="w-5 h-5" />, label: 'Чаты', path: '/whatsapp', sectionId: 'whatsapp', isActive: location.pathname === '/whatsapp', badgeCount: whatsAppBadgeCount > 0 ? whatsAppBadgeCount : undefined },
    { icon: <Shield className="w-5 h-5" />, label: 'AI База знаний', path: '/settings/knowledge', sectionId: 'knowledgeBase', isActive: location.pathname === '/settings/knowledge' },
    { icon: <MessageSquare className="w-5 h-5" />, label: 'Быстрые ответы', path: '/settings/quick-replies', sectionId: 'quickReplies', isActive: location.pathname === '/settings/quick-replies' },
    { icon: <Plug className="w-5 h-5" />, label: 'Интеграции', path: '/settings/integrations', sectionId: 'integrations', isActive: location.pathname === '/settings/integrations' },
    { icon: <Bot className="w-5 h-5" />, label: 'Автоворонки', path: '/autovoronki', sectionId: 'autovoronki', isActive: location.pathname === '/autovoronki' || location.pathname.startsWith('/autovoronki/') },
    { icon: <Activity className="w-5 h-5" />, label: 'AI-контроль', path: '/ai-control', sectionId: 'autovoronki', isActive: location.pathname === '/ai-control' || location.pathname.startsWith('/ai-control/') },
    { icon: <Building2 className="w-5 h-5" />, label: 'Сделки', path: '/deals', sectionId: 'deals', isActive: location.pathname === '/deals' || location.pathname.startsWith('/deals/') },
    { icon: <BarChart3 className="w-5 h-5" />, label: 'Аналитика', path: '/analytics', sectionId: 'analytics', isActive: location.pathname === '/analytics' },
  ];
  const menuItems = allMenuItems.filter((item) => canAccess(item.sectionId));

  const handleMenuItemClick = (item: MenuItem) => {
    navigate(item.path);
    const pageKey = item.path.replace('/', '') || 'transactions';
    if (pageKey === 'client-files') {
      onPageChange('clients');
    } else {
      onPageChange(pageKey as any);
    }
    setMobileMenuOpenFalse();
  };

  return (
    <>
      {/* Кнопка ☰: при ширине < 1280px; на странице WhatsApp скрыта (бургер в шапке страницы) */}
      <button
        onClick={toggleMobileMenu}
        className={`menu-toggle fixed top-4 left-4 z-[60] xl:hidden bg-white p-2 rounded-lg shadow-lg mt-2 hover:bg-gray-50 transition-all duration-200 border border-gray-200 ${
          !isMenuVisible || hideBurgerInChat || hideFloatingBurger ? 'opacity-0 pointer-events-none' : 'opacity-100'
        } ${hideBurgerInChat || hideFloatingBurger ? 'invisible' : ''}`}
        aria-label="Открыть меню"
      >
        {isMobileMenuOpen ? (
          <X className="w-6 h-6 text-gray-600" />
        ) : (
          <Menu className="w-6 h-6 text-gray-600" />
        )}
      </button>

      {/* Подложка при открытом меню (на WhatsApp странице бургер в шапке, overlay всё равно нужен при открытии) */}
      {isMobileMenuOpen && !hideBurgerInChat && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[45] xl:hidden backdrop-blur-sm transition-opacity duration-300"
          onClick={setMobileMenuOpenFalse}
        />
      )}

      {/* Боковое меню (overlay при < 1280px; в открытом чате скрыто) */}
      {isMobileMenuOpen && !hideBurgerInChat && (
        <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl z-[50] transform transition-all duration-300 ease-in-out xl:hidden border-r border-gray-100">
          <div className="flex flex-col h-full">
            <div className="h-20" />
            {userEmail && (
              <div className="px-4 pt-2 pb-3 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center gap-2 text-gray-500 text-sm min-w-0">
                  <User className="w-4 h-4 shrink-0 text-gray-400" />
                  <span className="truncate">{userEmail}</span>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto py-4 px-2">
              {menuItems.map((item, index) => (
                <MenuItemComponent
                  key={index}
                  item={item}
                  onClick={() => handleMenuItemClick(item)}
                  collapsed={false}
                />
              ))}
            </div>
            
            {/* Нижняя секция для мобильного */}
            <div className="border-t border-gray-100 p-4 bg-gray-50 bg-opacity-50 backdrop-blur-sm">
              <div className="flex flex-col space-y-3">
                {isAdmin && (
                  <button
                    onClick={() => {
                      navigate('/admin');
                      setMobileMenuOpenFalse();
                    }}
                    className={`w-full flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 group relative ${
                      location.pathname === '/admin'
                        ? 'text-emerald-600 bg-emerald-50 shadow-sm'
                        : 'text-gray-600 hover:text-emerald-600 hover:bg-white'
                    }`}
                  >
                    <Shield className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
                    <span className="ml-3">Администратор</span>
                    {unapprovedCount > 0 && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center animate-pulse">
                        {unapprovedCount}
                      </span>
                    )}
                  </button>
                )}
                
                <button
                  onClick={() => {
                    navigate('/profile');
                    setMobileMenuOpenFalse();
                  }}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600 hover:bg-white rounded-lg transition-all duration-200 group px-4 py-2"
                >
                  <User className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                  <span>Сменить пароль</span>
                </button>
                
                <button
                  onClick={() => {
                    auth.signOut();
                    setMobileMenuOpenFalse();
                  }}
                  className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200 group px-4 py-2"
                >
                  <LogOut className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                  <span>Выйти</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Десктопный Sidebar: только при ширине ≥ 1280px; hover раскрывает при свёрнутом */}
      <aside
        onMouseEnter={handleDesktopSidebarMouseEnter}
        onMouseLeave={handleDesktopSidebarMouseLeave}
        className={`hidden xl:flex flex-col bg-white shadow-xl border-r border-gray-100 transition-[width] duration-200 ease-out ${
          desktopExpanded ? 'w-64' : 'w-16'
        }`}
      >
        {/* Кнопки: свернуть и закрепить (закрепить видна только когда раскрыто) */}
        <div className={`flex items-center shrink-0 ${desktopExpanded ? 'justify-between' : 'justify-center'} p-2 gap-0.5`}>
          {desktopExpanded && (
            <button
              onClick={togglePinned}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-gray-500 hover:text-gray-700"
              title={pinned ? 'Открепить меню' : 'Закрепить меню открытым'}
              aria-label={pinned ? 'Открепить' : 'Закрепить'}
            >
              {pinned ? <PinOff size={18} /> : <Pin size={18} />}
            </button>
          )}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-gray-600 hover:text-gray-800"
            title={desktopExpanded ? 'Свернуть меню' : 'Развернуть меню'}
            aria-label={desktopExpanded ? 'Свернуть' : 'Развернуть'}
          >
            {desktopExpanded ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {/* Компактный user-chip над меню */}
          {userEmail && (
            <div
              className={`flex items-center cursor-default transition-colors duration-150 mb-1 ${
                !desktopExpanded ? 'justify-center px-2 py-1' : 'px-3 py-1.5'
              } hover:bg-gray-100 rounded-md`}
              style={{ minHeight: 32 }}
              title={!desktopExpanded ? userEmail : undefined}
            >
              <div
                className="flex items-center justify-center rounded-full font-semibold"
                style={{
                  width: 20,
                  height: 20,
                  backgroundColor: '#1890FF',
                  color: '#FFFFFF',
                  fontSize: 11
                }}
                title={desktopExpanded ? undefined : userEmail}
              >
                {userEmail.charAt(0).toUpperCase()}
              </div>
              {desktopExpanded && (
                <div className="flex items-center gap-1 ml-2 min-w-0">
                  <span
                    className="truncate"
                    style={{
                      maxWidth: 120,
                      fontSize: 12,
                      fontWeight: 500,
                      color: '#595959'
                    }}
                    title={userEmail}
                  >
                    {userEmail}
                  </span>
                  {isApprovedEmail && (
                    <span
                      className="text-[12px]"
                      style={{ color: '#52C41A' }}
                      title="Администратор"
                    >
                      ✓
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          {menuItems.map((item, index) => (
            <MenuItemComponent
              key={index}
              item={item}
              onClick={() => handleMenuItemClick(item)}
              collapsed={!desktopExpanded}
            />
          ))}
        </div>
        
        {/* Нижняя секция */}
        <div className="border-t border-gray-100 p-4 bg-gray-50 bg-opacity-50 backdrop-blur-sm">
          <div className="flex flex-col space-y-3">
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={() => {
                    navigate('/admin');
                    setMobileMenuOpenFalse();
                  }}
                  className={`w-full flex items-center py-2 text-sm font-medium rounded-lg transition-all duration-200 group relative ${
                    location.pathname === '/admin'
                      ? 'text-emerald-600 bg-emerald-50 shadow-sm'
                      : 'text-gray-600 hover:text-emerald-600 hover:bg-white'
                  } ${!desktopExpanded ? 'justify-center px-2' : 'px-4'}`}
                >
                  <Shield className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
                  {desktopExpanded && <span className="ml-3">Администратор</span>}
                  {unapprovedCount > 0 && desktopExpanded && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center animate-pulse">
                      {unapprovedCount}
                    </span>
                  )}
                  {unapprovedCount > 0 && !desktopExpanded && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                      {unapprovedCount}
                    </span>
                  )}
                  
                  {/* Tooltip для collapsed режима */}
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 px-2 py-1 bg-gray-900 text-white text-sm rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-95 transition-opacity duration-200">
                    Администратор
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                  </div>
                </button>
              </div>
            )}
            
            <div className="relative">
              <button
                onClick={() => {
                  navigate('/profile');
                  setMobileMenuOpenFalse();
                }}
                className={`flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600 hover:bg-white rounded-lg transition-all duration-200 group ${
                  !desktopExpanded ? 'justify-center p-2' : 'px-4 py-2'
                }`}
              >
                <User className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                {desktopExpanded && <span>Сменить пароль</span>}
                
                {/* Tooltip для collapsed режима */}
                {!desktopExpanded && (
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 px-2 py-1 bg-gray-900 text-white text-sm rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-95 transition-opacity duration-200">
                    Сменить пароль
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                  </div>
                )}
              </button>
            </div>
            
            <div className="relative">
              <button
                onClick={() => auth.signOut()}
                className={`flex items-center gap-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200 group ${
                  !desktopExpanded ? 'justify-center p-2' : 'px-4 py-2'
                }`}
              >
                <LogOut className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                {desktopExpanded && <span>Выйти</span>}
                
                {/* Tooltip для collapsed режима */}
                {!desktopExpanded && (
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 px-2 py-1 bg-gray-900 text-white text-sm rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-95 transition-opacity duration-200">
                    Выйти
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};