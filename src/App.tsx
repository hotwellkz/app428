import React, { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthGuard } from './components/auth/AuthGuard';
import { CompanyBlockedGuard } from './components/auth/CompanyBlockedGuard';
import { AdminRoute } from './components/auth/AdminRoute';
import { ApprovalGuard } from './components/auth/ApprovalGuard';
import { MenuAccessGuard } from './components/auth/MenuAccessGuard';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LoadingSpinner } from './components/LoadingSpinner';
import { Toaster } from 'react-hot-toast';
import './styles/animations.css';
import { MenuVisibilityProvider } from './contexts/MenuVisibilityContext';
import { MobileSidebarProvider } from './contexts/MobileSidebarContext';
import { MobileWhatsAppChatProvider } from './contexts/MobileWhatsAppChatContext';
import { CompanyProvider } from './contexts/CompanyContext';
import { ChatProvider } from './context/ChatContext';
import { ErrorBoundary } from './components/ErrorBoundary';

// Ключ для однократной перезагрузки при ошибке загрузки чанка (после деплоя старые хеши 404)
const CHUNK_RELOAD_KEY = 'app_chunk_reload';

function isChunkLoadError(err: unknown): boolean {
  const msg = String(err && typeof err === 'object' && 'message' in err ? (err as Error).message : err);
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module')
  );
}

/** Оборачивает динамический import: при 404 чанка (после деплоя) делает одну перезагрузку страницы. */
function withChunkErrorRecovery<T>(importFn: () => Promise<T>): () => Promise<T> {
  return () =>
    importFn().catch((err) => {
      if (isChunkLoadError(err)) {
        if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
          window.location.reload();
          return new Promise(() => {}); // не резолвим — страница перезагрузится
        }
      }
      throw err;
    });
}

// Типы для безопасного lazy loading
type LazyComponent<T> = React.LazyExoticComponent<React.ComponentType<T>>;

// Вспомогательная функция для безопасного lazy import с именованным экспортом
function lazyNamed<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ [key: string]: T }>,
  exportName: string
): LazyComponent<any> {
  return lazy(
    withChunkErrorRecovery(async () => {
      const module = await importFn();
      if (!module[exportName]) {
        console.error(`[LazyImport] Export ${exportName} not found in module`, Object.keys(module));
        throw new Error(`Export ${exportName} not found`);
      }
      return { default: module[exportName] };
    })
  );
}

// Lazy loading для тяжелых страниц (withChunkErrorRecovery — перезагрузка при 404 чанка после деплоя)
const Feed = lazy(withChunkErrorRecovery(() => import('./pages/Feed').then(module => ({ default: module.Feed }))));
const DailyReport = lazy(withChunkErrorRecovery(() => import('./pages/DailyReport')));
const Clients = lazy(withChunkErrorRecovery(() => import('./pages/Clients').then(module => ({ default: module.Clients }))));
const Admin = lazy(withChunkErrorRecovery(() => import('./pages/Admin').then(module => ({ default: module.Admin }))));
const AdminCompanies = lazy(withChunkErrorRecovery(() => import('./pages/AdminCompanies').then(module => ({ default: module.AdminCompanies }))));
const ContractTemplates = lazy(withChunkErrorRecovery(() => import('./pages/ContractTemplates').then(module => ({ default: module.ContractTemplates }))));
const Products = lazy(withChunkErrorRecovery(() => import('./pages/Products').then(module => ({ default: module.Products }))));
const Transactions = lazy(withChunkErrorRecovery(() => import('./pages/Transactions').then(module => ({ default: module.Transactions }))));
const WarehouseProducts = lazy(withChunkErrorRecovery(() => import('./pages/warehouse/products/WarehouseProducts').then(module => ({ default: module.WarehouseProducts }))));
const Employees = lazy(withChunkErrorRecovery(() => import('./pages/Employees').then(module => ({ default: module.Employees }))));
const FolderProducts = lazy(withChunkErrorRecovery(() => import('./pages/warehouse/products/FolderProducts').then(module => ({ default: module.FolderProducts }))));
const ProductDetails = lazy(withChunkErrorRecovery(() => import('./pages/warehouse/products/ProductDetails').then(module => ({ default: module.ProductDetails }))));
const Calculator = lazy(withChunkErrorRecovery(() => import('./pages/Calculator').then(module => ({ default: module.Calculator }))));
const Documents = lazy(withChunkErrorRecovery(() => import('./pages/warehouse/Documents').then(module => ({ default: module.Documents }))));
const ClientFiles = lazyNamed(() => import('./pages/ClientFiles'), 'ClientFiles');
const AllClientFiles = lazyNamed(() => import('./pages/AllClientFiles'), 'AllClientFiles');
const Warehouse = lazy(withChunkErrorRecovery(() => import('./pages/Warehouse').then(module => ({ default: module.Warehouse }))));
const NewIncome = lazyNamed(() => import('./pages/warehouse/NewIncome'), 'NewIncome');
const NewExpense = lazyNamed(() => import('./pages/warehouse/NewExpense'), 'NewExpense');
const TransactionHistoryPage = lazy(withChunkErrorRecovery(() => import('./pages/TransactionHistoryPage')));
const TransactionEditHistoryPage = lazy(withChunkErrorRecovery(() => import('./pages/TransactionEditHistoryPage').then(module => ({ default: module.TransactionEditHistoryPage }))));
const OptimizedTransactionHistoryPage = lazy(withChunkErrorRecovery(() => import('./pages/OptimizedTransactionHistoryPage').then(module => ({ default: module.OptimizedTransactionHistoryPage }))));
const Profile = lazy(withChunkErrorRecovery(() => import('./pages/Profile').then(module => ({ default: module.Profile }))));
const WhatsAppChat = lazy(withChunkErrorRecovery(() => import('./pages/WhatsAppChat')));
const CreateTemplate = lazy(withChunkErrorRecovery(() => import('./pages/CreateTemplate').then(m => ({ default: m.CreateTemplate }))));
const EditTemplate = lazy(withChunkErrorRecovery(() => import('./pages/EditTemplate').then(m => ({ default: m.EditTemplate }))));
const CreateContractWithAdditionalWorks = lazy(withChunkErrorRecovery(() => import('./pages/CreateContractWithAdditionalWorks').then(m => ({ default: m.CreateContractWithAdditionalWorks }))));
const FinishingMaterialsManager = lazy(withChunkErrorRecovery(() => import('./components/materials/FinishingMaterialsManager').then(module => ({ default: module.FinishingMaterialsManager }))));
const DealsPage = lazy(withChunkErrorRecovery(() => import('./pages/DealsPage')));
const DealsTrashPage = lazy(withChunkErrorRecovery(() => import('./pages/DealsTrashPage')));
const AnalyticsPage = lazy(withChunkErrorRecovery(() => import('./pages/AnalyticsPage')));
const KnowledgeBaseSettings = lazy(withChunkErrorRecovery(() => import('./pages/KnowledgeBaseSettings')));
const QuickRepliesSettings = lazy(withChunkErrorRecovery(() => import('./pages/QuickRepliesSettings')));
const IntegrationsSettings = lazy(withChunkErrorRecovery(() => import('./pages/IntegrationsSettings').then(m => ({ default: m.IntegrationsSettings }))));

// Fallback компонент для Suspense
const PageLoader = () => (
  <div className="flex items-center justify-center h-full">
    <LoadingSpinner />
  </div>
);

type Page = 'dashboard' | 'transactions' | 'feed' | 'daily-report' | 'clients' | 'templates' | 
  'products' | 'employees' | 'projects' | 'calculator' | 'warehouse' | 'chat' | 'finishing-materials' | 'deals';

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('transactions');
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const navigate = useNavigate();

  // Логирование времени загрузки приложения
  useEffect(() => {
    console.time('app-bootstrap');
    console.log('[PERF] App started loading');
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    return () => {
      console.timeEnd('app-bootstrap');
      console.log('[PERF] App finished loading');
    };
  }, []);

  // Слушаем изменения в localStorage для синхронизации состояния collapsed
  useEffect(() => {
    const handleStorageChange = () => {
      setCollapsed(localStorage.getItem('sidebar-collapsed') === 'true');
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Также слушаем изменения внутри того же окна
    const checkCollapsedState = () => {
      const currentState = localStorage.getItem('sidebar-collapsed') === 'true';
      if (currentState !== collapsed) {
        setCollapsed(currentState);
      }
    };

    const interval = setInterval(checkCollapsedState, 100);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [collapsed]);

  return (
    <MobileSidebarProvider>
    <MobileWhatsAppChatProvider>
    <div className="flex w-full h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar onPageChange={setCurrentPage} currentPage={currentPage} />
      
      {/* Основной контент */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-x-hidden transition-all duration-300">
        <Header 
          onPageChange={(page) => {
            navigate(`/${page}`);
            setCurrentPage(page as Page);
          }} 
        />
        <div className="flex-1 overflow-auto overflow-x-hidden min-h-0 min-w-0">
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <MenuAccessGuard>
              <Routes>
            <Route path="/" element={<Navigate to="/transactions" replace />} />
            <Route path="/admin" element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            } />
            <Route path="/admin/companies" element={
              <AdminRoute>
                <AdminCompanies />
              </AdminRoute>
            } />
            <Route path="/daily-report" element={<DailyReport />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/client-files" element={<AllClientFiles />} />
            <Route path="/clients/:clientId/files" element={<ClientFiles />} />
            <Route path="/transactions" element={
              <ApprovalGuard>
                <Transactions />
              </ApprovalGuard>
            } />
            <Route path="/transactions/history/:id" element={
              <ApprovalGuard>
                <OptimizedTransactionHistoryPage />
              </ApprovalGuard>
            } />
            <Route path="/transaction-history/:id" element={
              <ApprovalGuard>
                <TransactionEditHistoryPage />
              </ApprovalGuard>
            } />
            <Route path="/feed" element={
              <ApprovalGuard>
                <Feed />
              </ApprovalGuard>
            } />
            <Route path="/templates" element={
              <ApprovalGuard>
                <ContractTemplates />
              </ApprovalGuard>
            } />
            <Route path="/templates/create" element={<CreateTemplate />} />
            <Route path="/templates/:id/edit" element={<EditTemplate />} />
            <Route path="/templates/:id/create-with-additional" element={<CreateContractWithAdditionalWorks />} />
            <Route path="/products" element={
              <ApprovalGuard>
                <Products />
              </ApprovalGuard>
            } />
            <Route path="/warehouse/products" element={
              <ApprovalGuard>
                <WarehouseProducts />
              </ApprovalGuard>
            } />
            <Route path="/warehouse/products/:folderId" element={
              <ApprovalGuard>
                <FolderProducts />
              </ApprovalGuard>
            } />
            <Route path="/warehouse/product/:id" element={
              <ApprovalGuard>
                <ProductDetails />
              </ApprovalGuard>
            } />
            <Route path="/warehouse/products/:folderId/:productId" element={
              <ApprovalGuard>
                <ProductDetails />
              </ApprovalGuard>
            } />
            <Route path="/employees" element={
              <ApprovalGuard>
                <Employees />
              </ApprovalGuard>
            } />
            <Route path="/calculator" element={
              <ApprovalGuard>
                <Calculator />
              </ApprovalGuard>
            } />
            <Route path="/warehouse" element={
              <ApprovalGuard>
                <Warehouse />
              </ApprovalGuard>
            } />
            <Route path="/warehouse/income/new" element={
              <ApprovalGuard>
                <NewIncome />
              </ApprovalGuard>
            } />
            <Route path="/warehouse/expense/new" element={
              <ApprovalGuard>
                <NewExpense />
              </ApprovalGuard>
            } />
            <Route path="/deals" element={
              <ApprovalGuard>
                <DealsPage />
              </ApprovalGuard>
            } />
            <Route path="/deals/trash" element={
              <ApprovalGuard>
                <DealsTrashPage />
              </ApprovalGuard>
            } />
            <Route path="/analytics" element={
              <ApprovalGuard>
                <AnalyticsPage />
              </ApprovalGuard>
            } />
            <Route path="/warehouse/documents" element={
              <ApprovalGuard>
                <Documents />
              </ApprovalGuard>
            } />
            <Route path="/warehouse/transactions/:productId" element={
              <ApprovalGuard>
                <TransactionHistoryPage />
              </ApprovalGuard>
            } />
            <Route path="/whatsapp" element={
              <ApprovalGuard>
                <WhatsAppChat />
              </ApprovalGuard>
            } />
            <Route path="/settings/knowledge" element={
              <ApprovalGuard>
                <KnowledgeBaseSettings />
              </ApprovalGuard>
            } />
            <Route path="/settings/quick-replies" element={
              <ApprovalGuard>
                <QuickRepliesSettings />
              </ApprovalGuard>
            } />
            <Route path="/settings/integrations" element={
              <ApprovalGuard>
                <IntegrationsSettings />
              </ApprovalGuard>
            } />
            <Route path="/finishing-materials" element={
              <ApprovalGuard>
                <FinishingMaterialsManager />
              </ApprovalGuard>
            } />
            <Route path="/profile" element={<Profile />} />
              </Routes>
              </MenuAccessGuard>
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
    </div>
    </MobileWhatsAppChatProvider>
    </MobileSidebarProvider>
  );
};

const App = () => {
  return (
    <HelmetProvider>
      <Router>
        <CompanyProvider>
        <AuthGuard>
          <ChatProvider>
          <CompanyBlockedGuard>
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#ffffff',
                color: '#1f2937',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                padding: '0.75rem 1rem',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                fontSize: '0.875rem',
              },
              success: {
                style: {
                  background: '#f0fdf4',
                  border: '1px solid #dcfce7',
                  color: '#166534',
                },
                iconTheme: {
                  primary: '#22c55e',
                  secondary: '#ffffff',
                },
              },
              error: {
                style: {
                  background: '#fef2f2',
                  border: '1px solid #fee2e2',
                  color: '#991b1b',
                },
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#ffffff',
                },
                duration: 4000,
              },
            }}
          />
          <MenuVisibilityProvider>
            <AppContent />
          </MenuVisibilityProvider>
          </CompanyBlockedGuard>
          </ChatProvider>
        </AuthGuard>
        </CompanyProvider>
      </Router>
    </HelmetProvider>
  );
};

export default App;