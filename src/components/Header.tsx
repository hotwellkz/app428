import React from 'react';
import { StickyNavigation } from './StickyNavigation';

interface HeaderProps {
  onPageChange: (page: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onPageChange }) => {
  return <StickyNavigation onNavigate={onPageChange} />;
};