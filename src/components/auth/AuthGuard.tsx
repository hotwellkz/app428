import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { auth } from '../../lib/firebase/auth';
import { LoginForm } from './LoginForm';
import { LoadingSpinner } from '../LoadingSpinner';
import { RegisterCompany } from '../../pages/RegisterCompany';
import { AcceptInvitePage } from '../../pages/AcceptInvitePage';

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
    return (
      <LoginForm
        onSuccess={() => setIsAuthenticated(true)}
      />
    );
  }

  return <>{children}</>;
};