import React, { useEffect, useState } from 'react';
import { useLocation, Routes, Route } from 'react-router-dom';
import { auth } from '../../lib/firebase/auth';
import { LoginForm } from './LoginForm';
import { LoadingSpinner } from '../LoadingSpinner';
import { RegisterCompany } from '../../pages/RegisterCompany';
import { AcceptInvitePage } from '../../pages/AcceptInvitePage';
import {
  LandingPage,
  CrmDlyaBiznesaPage,
  CrmDlyaProdazhPage,
  WhatsAppCrmPage,
  VozmozhnostiPage,
  CenyPage,
  FaqPage,
} from '../../pages/landing';

const PUBLIC_PATHS = ['/', '/crm-dlya-biznesa', '/crm-dlya-prodazh', '/whatsapp-crm', '/vozmozhnosti', '/ceny', '/faq'];

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    if (location.pathname === '/accept-invite') {
      return <AcceptInvitePage onSuccess={() => setIsAuthenticated(true)} />;
    }
    if (location.pathname === '/register' || location.pathname === '/register-company') {
      return <RegisterCompany />;
    }
    if (PUBLIC_PATHS.includes(location.pathname)) {
      return (
        <Routes>
          <Route path="/" element={<LandingPage onLoginSuccess={() => setIsAuthenticated(true)} />} />
          <Route path="/crm-dlya-biznesa" element={<CrmDlyaBiznesaPage />} />
          <Route path="/crm-dlya-prodazh" element={<CrmDlyaProdazhPage />} />
          <Route path="/whatsapp-crm" element={<WhatsAppCrmPage />} />
          <Route path="/vozmozhnosti" element={<VozmozhnostiPage />} />
          <Route path="/ceny" element={<CenyPage />} />
          <Route path="/faq" element={<FaqPage />} />
        </Routes>
      );
    }
    return (
      <LoginForm
        onSuccess={() => setIsAuthenticated(true)}
      />
    );
  }

  return <>{children}</>;
};