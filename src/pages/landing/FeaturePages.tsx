import React from 'react';
import { FeaturePage } from './FeaturePage';
import { FEATURE_PAGES } from './featurePagesConfig';

export const KlientyPage: React.FC = () => <FeaturePage config={FEATURE_PAGES.klienty} />;
export const WhatsAppChatyPage: React.FC = () => <FeaturePage config={FEATURE_PAGES['whatsapp-i-chaty']} />;
export const SdelkiVoronkaPage: React.FC = () => <FeaturePage config={FEATURE_PAGES['sdelki-i-voronka']} />;
export const BystryeOtvetyPage: React.FC = () => <FeaturePage config={FEATURE_PAGES['bystrye-otvety']} />;
export const AnalitikaPage: React.FC = () => <FeaturePage config={FEATURE_PAGES.analitika} />;
export const TranzakciiFinansyPage: React.FC = () => <FeaturePage config={FEATURE_PAGES['tranzakcii-i-finansy']} />;
export const SkladMaterialyPage: React.FC = () => <FeaturePage config={FEATURE_PAGES['sklad-i-materialy']} />;
export const RoliPravaPage: React.FC = () => <FeaturePage config={FEATURE_PAGES['roli-i-prava']} />;
