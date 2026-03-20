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
  CrmDlyaMalogoBiznesaPage,
  CrmDlyaProdazhPage,
  WhatsAppCrmPage,
  VozmozhnostiPage,
  CenyPage,
  FaqPage,
  UpravlenieKlientamiPage,
  AnalitikaProdazhPage,
  KontrolMenedzherovPage,
  UpravlenieZayavkamiPage,
  KlientyPage,
  WhatsAppChatyPage,
  SdelkiVoronkaPage,
  BystryeOtvetyPage,
  AnalitikaPage,
  TranzakciiFinansyPage,
  SkladMaterialyPage,
  RoliPravaPage,
  WhatsAppDlyaOtdelaProdazhPage,
  EdinayaBazaKlientovPage,
  UchetKlientovPage,
  CrmDlyaKomandyPage,
  CrmDlyaStroitelnoiKompaniiPage,
  CrmDlyaProizvodstvaPage,
  CrmDlyaUslugPage,
  ChtoTakoeCrmPage,
  KakVybratCrmPage,
  ZachemNuzhnaCrmPage,
  CrmIliExcelPage,
  CrmDlyaKaspiPage,
  CrmTwilioTelefoniyaPage,
} from '../../pages/landing';

const PUBLIC_PATHS = [
  '/',
  '/crm-dlya-biznesa',
  '/crm-dlya-kaspi',
  '/crm-dlya-malogo-biznesa',
  '/crm-dlya-prodazh',
  '/whatsapp-crm',
  '/crm-twilio',
  '/vozmozhnosti',
  '/ceny',
  '/faq',
  '/upravlenie-klientami',
  '/analitika-prodazh',
  '/kontrol-menedzherov',
  '/upravlenie-zayavkami',
  '/klienty',
  '/whatsapp-i-chaty',
  '/sdelki-i-voronka',
  '/bystrye-otvety',
  '/analitika',
  '/tranzakcii-i-finansy',
  '/sklad-i-materialy',
  '/roli-i-prava',
  '/whatsapp-dlya-otdela-prodazh',
  '/edinaya-baza-klientov',
  '/uchet-klientov',
  '/crm-dlya-komandy',
  '/crm-dlya-stroitelnoi-kompanii',
  '/crm-dlya-proizvodstva',
  '/crm-dlya-uslug',
  '/chto-takoe-crm',
  '/kak-vybrat-crm',
  '/zachem-nuzhna-crm',
  '/crm-ili-excel',
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
          <Route path="/crm-dlya-malogo-biznesa" element={<CrmDlyaMalogoBiznesaPage />} />
          <Route path="/crm-dlya-prodazh" element={<CrmDlyaProdazhPage />} />
          <Route path="/whatsapp-crm" element={<WhatsAppCrmPage />} />
          <Route path="/crm-twilio" element={<CrmTwilioTelefoniyaPage />} />
          <Route path="/vozmozhnosti" element={<VozmozhnostiPage />} />
          <Route path="/ceny" element={<CenyPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/upravlenie-klientami" element={<UpravlenieKlientamiPage />} />
          <Route path="/analitika-prodazh" element={<AnalitikaProdazhPage />} />
          <Route path="/kontrol-menedzherov" element={<KontrolMenedzherovPage />} />
          <Route path="/upravlenie-zayavkami" element={<UpravlenieZayavkamiPage />} />
          <Route path="/klienty" element={<KlientyPage />} />
          <Route path="/whatsapp-i-chaty" element={<WhatsAppChatyPage />} />
          <Route path="/sdelki-i-voronka" element={<SdelkiVoronkaPage />} />
          <Route path="/bystrye-otvety" element={<BystryeOtvetyPage />} />
          <Route path="/analitika" element={<AnalitikaPage />} />
          <Route path="/tranzakcii-i-finansy" element={<TranzakciiFinansyPage />} />
          <Route path="/sklad-i-materialy" element={<SkladMaterialyPage />} />
          <Route path="/roli-i-prava" element={<RoliPravaPage />} />
          <Route path="/whatsapp-dlya-otdela-prodazh" element={<WhatsAppDlyaOtdelaProdazhPage />} />
          <Route path="/edinaya-baza-klientov" element={<EdinayaBazaKlientovPage />} />
          <Route path="/uchet-klientov" element={<UchetKlientovPage />} />
          <Route path="/crm-dlya-komandy" element={<CrmDlyaKomandyPage />} />
          <Route path="/crm-dlya-stroitelnoi-kompanii" element={<CrmDlyaStroitelnoiKompaniiPage />} />
          <Route path="/crm-dlya-proizvodstva" element={<CrmDlyaProizvodstvaPage />} />
          <Route path="/crm-dlya-uslug" element={<CrmDlyaUslugPage />} />
          <Route path="/chto-takoe-crm" element={<ChtoTakoeCrmPage />} />
          <Route path="/kak-vybrat-crm" element={<KakVybratCrmPage />} />
          <Route path="/zachem-nuzhna-crm" element={<ZachemNuzhnaCrmPage />} />
          <Route path="/crm-ili-excel" element={<CrmIliExcelPage />} />
          <Route path="/crm-dlya-kaspi" element={<CrmDlyaKaspiPage />} />
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