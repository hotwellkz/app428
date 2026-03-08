import React from 'react';

interface ApprovalGuardProps {
  children: React.ReactNode;
}

/** SaaS: доступ после регистрации сразу. Оборачивает контент без проверки подтверждения. */
export const ApprovalGuard: React.FC<ApprovalGuardProps> = ({ children }) => {
  return <>{children}</>;
};
