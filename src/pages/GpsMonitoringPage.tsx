import React from 'react';
import { GarageGpsEmbedPanel } from '../components/gps/GarageGpsEmbedPanel';
import { PageMetadata } from '../components/PageMetadata';

export const GpsMonitoringPage: React.FC = () => {
  return (
    <div className="p-4 md:p-6">
      <PageMetadata
        title="GPS-мониторинг транспорта"
        description="Быстрый доступ к Garage GPS для проверки местоположения и маршрутов"
      />

      <div className="max-w-5xl mx-auto">
        <header className="mb-4 md:mb-6">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
            GPS-мониторинг транспорта
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Быстрый доступ к Garage GPS для проверки местоположения и маршрутов
          </p>
        </header>

        <GarageGpsEmbedPanel />
      </div>
    </div>
  );
};

