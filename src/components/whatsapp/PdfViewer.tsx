import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Download, ZoomIn, ZoomOut, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import { pdfjs } from '../../lib/pdfjs';

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

interface PdfViewerProps {
  url: string;
  fileName?: string;
  onClose: () => void;
  /** Кнопки в шапке (например закрыть) рендерятся снаружи; здесь только контент и тулбар */
  toolbar?: boolean;
}

/**
 * Встроенный просмотрщик PDF на базе PDF.js: листание страниц, zoom, fullscreen, скачивание.
 */
export const PdfViewer: React.FC<PdfViewerProps> = ({
  url,
  fileName,
  onClose,
  toolbar = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const pdfDocRef = useRef<{ numPages: number } | null>(null);
  const canvasRefsRef = useRef<Map<number, HTMLCanvasElement>>(new Map());

  const loadPdf = useCallback(async () => {
    if (!url) {
      setError('Нет ссылки на файл');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[PdfViewer] fetch', { url: url.slice(0, 80), status: res.status, contentType: res.headers.get('Content-Type'), disposition: res.headers.get('Content-Disposition') });
      }
      if (!res.ok) throw new Error('Не удалось загрузить PDF');
      const buf = await res.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: buf });
      const pdf = await loadingTask.promise;
      pdfDocRef.current = pdf;
      setNumPages(pdf.numPages);
    } catch (e) {
      setError(
        import.meta.env.DEV ? String(e) : 'Не удалось открыть PDF. Попробуйте скачать или открыть в новой вкладке.'
      );
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    loadPdf();
    return () => {
      pdfDocRef.current = null;
    };
  }, [loadPdf]);

  // Рендер страниц при смене scale или numPages
  useEffect(() => {
    const pdf = pdfDocRef.current;
    if (!pdf || numPages === 0) return;

    const renderAll = async () => {
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRefsRef.current.get(i);
        if (!canvas) continue;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({
          canvasContext: ctx,
          viewport
        }).promise;
      }
    };
    renderAll();
  }, [numPages, scale]);

  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP));
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP));

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleDownload = useCallback(async () => {
    if (!url) return;
    setDownloadLoading(true);
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error('Fetch failed');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || 'document.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    } finally {
      setDownloadLoading(false);
    }
  }, [url, fileName]);

  const openInNewTab = () => window.open(url, '_blank', 'noopener,noreferrer');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-[200px] text-gray-300">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm">Загрузка PDF…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-[200px] text-gray-300 p-4">
        <p className="text-sm text-center mb-4">{error}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openInNewTab}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            Открыть в новой вкладке
          </button>
          <a
            href={url}
            download={fileName}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Скачать
          </a>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col flex-1 min-h-0 bg-gray-900">
      {toolbar && (
        <div className="flex-shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-700 bg-gray-800/80">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={zoomOut}
              className="p-2 rounded hover:bg-gray-600 text-white"
              aria-label="Уменьшить"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <span className="text-xs text-gray-300 min-w-[4rem] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={zoomIn}
              className="p-2 rounded hover:bg-gray-600 text-white"
              aria-label="Увеличить"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 rounded hover:bg-gray-600 text-white"
              aria-label={isFullscreen ? 'Выйти из полноэкранного режима' : 'Полный экран'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openInNewTab}
              className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-gray-300 hover:bg-gray-600 hover:text-white"
            >
              <ExternalLink className="w-4 h-4" />
              В новой вкладке
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloadLoading}
              className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-gray-300 hover:bg-gray-600 hover:text-white disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Скачать
            </button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto p-4 flex flex-col items-center gap-4">
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
          <canvas
            key={pageNum}
            ref={(el) => {
              if (el) canvasRefsRef.current.set(pageNum, el);
            }}
            className="shadow-lg bg-white"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        ))}
      </div>
    </div>
  );
};
