import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, MapPin, RefreshCw, RotateCcw, Loader2 } from 'lucide-react';

const GPS_URL = 'https://gps.garage-gps.com';

type PanelMode = 'loading' | 'iframe' | 'fallback';

export const GarageGpsEmbedPanel: React.FC = () => {
  const [mode, setMode] = useState<PanelMode>('loading');
  const [retryKey, setRetryKey] = useState(0);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimeoutIfAny = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startLoading = useCallback(() => {
    clearTimeoutIfAny();
    setMode('loading');
    timeoutRef.current = setTimeout(() => {
      setMode((prev) => (prev === 'loading' ? 'fallback' : prev));
    }, 7000);
  }, [clearTimeoutIfAny]);

  useEffect(() => {
    startLoading();
    return () => clearTimeoutIfAny();
  }, [retryKey, startLoading, clearTimeoutIfAny]);

  const handleIframeLoad = useCallback(() => {
    // Если внешняя система не запрещает встраивание, браузер успевает отрисовать iframe.
    // Если блокирует, может сработать onError/или сработает timeout fallback.
    setMode((prev) => {
      if (prev !== 'loading') return prev;
      clearTimeoutIfAny();
      return 'iframe';
    });
  }, [clearTimeoutIfAny]);

  const handleIframeError = useCallback(() => {
    clearTimeoutIfAny();
    setMode('fallback');
  }, [clearTimeoutIfAny]);

  const openNewTab = useCallback(() => {
    window.open(GPS_URL, '_blank', 'noopener,noreferrer');
  }, []);

  const refresh = useCallback(() => {
    setRetryKey((k) => k + 1);
  }, []);

  const retryInline = useCallback(() => {
    refresh();
  }, [refresh]);

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 border-b border-gray-100 bg-white">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            Garage GPS
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Встроенный просмотр
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openNewTab}
            className="h-10 px-3 rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="text-sm font-medium">Открыть в новой вкладке</span>
          </button>
          <button
            type="button"
            onClick={refresh}
            className="h-10 px-3 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm font-medium">Обновить страницу GPS</span>
          </button>
        </div>
      </div>

      {/* Body */}
      {mode === 'iframe' || mode === 'loading' ? (
        <div className="relative w-full min-h-[70vh] md:h-[calc(100vh-180px)] md:min-h-0 overflow-hidden bg-white">
          {/* UX-страховка: при нестабильном входе внутрь iframe пользователь не остается один на один с ошибкой. */}
          <div className="absolute left-3 right-3 top-3 z-10">
            <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 shadow-sm backdrop-blur-sm">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 h-2.5 w-2.5 rounded-full bg-amber-500" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-amber-900">
                    Вход во встроенном режиме может быть нестабильным
                  </div>
                  <div className="text-xs text-amber-800 mt-0.5">
                    Если при вводе появляется ошибка, откройте Garage GPS в новой вкладке, войдите и затем нажмите
                    «Обновить страницу GPS».
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Встроенный iframe */}
          <iframe
            key={retryKey}
            src={GPS_URL}
            title="Garage GPS"
            className="w-full h-full"
            style={{ border: 0 }}
            loading="lazy"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />

          {/* Статус/лейаут поверх iframe в процессе загрузки */}
          {mode === 'loading' && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
              <div className="flex items-center gap-3 text-gray-700">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                <div>
                  <div className="text-sm font-semibold">Подключаем Garage GPS...</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Если встраивание будет заблокировано или вход во встроенном режиме не сработает, вы увидите заглушку.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full min-h-[70vh] md:h-[calc(100vh-180px)] md:min-h-0 p-6 sm:p-10 flex flex-col items-center justify-center text-center bg-white">
          <div className="w-full max-w-xl">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <MapPin className="w-8 h-8 text-emerald-600" />
            </div>

            <h2 className="mt-5 text-xl sm:text-2xl font-semibold text-gray-900">
              Не удалось выполнить вход во встроенном режиме
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Встроенный просмотр Garage GPS открывается, но авторизация внутри может не завершаться. Откройте
              систему в новой вкладке и войдите один раз.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-center">
              <a
                href={GPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors px-4 font-medium"
              >
                Открыть Garage GPS
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={retryInline}
                className="h-11 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors px-4 font-medium text-gray-700"
              >
                <RotateCcw className="w-4 h-4" />
                Попробовать встроить снова
              </button>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              Подсказка: если вы уже авторизованы в Garage GPS, вход через новую вкладку будет быстрее. После входа вернитесь в CRM и нажмите «Обновить встроенный просмотр».
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

