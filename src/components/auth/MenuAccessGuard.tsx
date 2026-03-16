import React, { useMemo } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useCurrentCompanyUser } from '../../hooks/useCurrentCompanyUser';
import { getSectionByPath, MENU_SECTIONS, DEFAULT_MENU_ACCESS } from '../../types/menuAccess';
import { canAccessSection } from '../../types/menuAccess';
import toast from 'react-hot-toast';

const FALLBACK_PATH = '/transactions';

export const MenuAccessGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { menuAccess, loading } = useCurrentCompanyUser();

  const { allowed, sectionId } = useMemo(() => {
    const section = getSectionByPath(location.pathname);
    if (!section) return { allowed: true, sectionId: null as string | null };
    const allowed = canAccessSection(menuAccess, section);
    return { allowed, sectionId: section };
  }, [location.pathname, menuAccess]);

  const firstAllowedPath = useMemo(() => {
    const access = menuAccess ?? DEFAULT_MENU_ACCESS;
    const first = MENU_SECTIONS.find((s) => access[s.id]);
    const path = first?.path ?? FALLBACK_PATH;
    return typeof path === 'string' ? path : FALLBACK_PATH;
  }, [menuAccess]);

  if (loading) return <>{children}</>;
  if (!allowed && sectionId) {
    if (sectionId === 'analytics') {
      toast.error('У вас нет доступа к разделу Analytics.');
      return <Navigate to="/deals" replace />;
    }
    toast.error('У вас нет доступа к этому разделу');
    return <Navigate to={String(firstAllowedPath)} replace />;
  }

  return <>{children}</>;
};
