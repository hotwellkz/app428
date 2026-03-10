import React from 'react';
import { useCompanyContext } from '../../contexts/CompanyContext';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { Ban } from 'lucide-react';
import { LoadingSpinner } from '../LoadingSpinner';

interface CompanyBlockedGuardProps {
  children: React.ReactNode;
}

/** Показывает loading пока companyId не загружен; экран «Компания заблокирована» при block; иначе children. */
export const CompanyBlockedGuard: React.FC<CompanyBlockedGuardProps> = ({ children }) => {
  const { companyId, companyBlocked, loading } = useCompanyContext();
  const { isAdmin } = useIsAdmin();

  if (loading || companyId === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    );
  }
  if (companyBlocked && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Ban className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Компания заблокирована</h2>
          <p className="text-gray-600">
            Доступ к вашей компании приостановлен или компания деактивирована. Обратитесь к администратору платформы.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
