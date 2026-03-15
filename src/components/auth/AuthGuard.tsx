import React, { useEffect, useState } from 'react';
import { useLocation, Routes, Route } from 'react-router-dom';
import { auth } from '../../lib/firebase/auth';
import { LoginForm } from './LoginForm';
import { LoadingSpinner } from '../LoadingSpinner';
import { CrmNoIndex } from '../seo/CrmNoIndex';
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
  KlientyPage,
  WhatsAppChatyPage,
  SdelkiVoronkaPage,
  BystryeOtvetyPage,
  AnalitikaPage,
  TranzakciiFinansyPage,
  SkladMaterialyPage,
  RoliPravaPage,
} from '../../pages/landing';

const PUBLIC_PATHS = [
  '/',
  '/crm-dlya-biznesa',
  '/crm-dlya-prodazh',
  '/whatsapp-crm',
  '/vozmozhnosti',
  '/ceny',
  '/faq',
  '/klienty',
  '/whatsapp-i-chaty',
  '/sdelki-i-voronka',
  '/bystrye-otvety',
  '/analitika',
  '/tranzakcii-i-finansy',
  '/sklad-i-materialy',
  '/roli-i-prava',
];

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
          <Route path="/klienty" element={<KlientyPage />} />
          <Route path="/whatsapp-i-chaty" element={<WhatsAppChatyPage />} />
          <Route path="/sdelki-i-voronka" element={<SdelkiVoronkaPage />} />
          <Route path="/bystrye-otvety" element={<BystryeOtvetyPage />} />
          <Route path="/analitika" element={<AnalitikaPage />} />
          <Route path="/tranzakcii-i-finansy" element={<TranzakciiFinansyPage />} />
          <Route path="/sklad-i-materialy" element={<SkladMaterialyPage />} />
          <Route path="/roli-i-prava" element={<RoliPravaPage />} />
        </Routes>
      );
    }
    return (
      <LoginForm
        onSuccess={() => setIsAuthenticated(true)}
      />
    );
  }

  return (
    <>
      <CrmNoIndex />
      {children}
    </>
  );
};