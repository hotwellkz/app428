import React, { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { pdfjs } from '../../lib/pdfjs';

const THUMB_SCALE = 0.4;
const THUMB_MAX_WIDTH = 160;
const THUMB_MAX_HEIGHT = 120;

interface PdfThumbnailProps {
  url: string;
  className?: string;
  /** Если true, не показывать плейсхолдер при загрузке/ошибке, только иконку */
  compact?: boolean;
}

/**
 * Рендерит превью первой страницы PDF через PDF.js.
 * При ошибке (CORS, не PDF) показывает иконку файла.
 */
export const PdfThumbnail: React.FC<PdfThumbnailProps> = ({ url, className = '', compact }) => {
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!url?.trim()) {
      setLoading(false);
      setError(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    setPreviewDataUrl(null);

    const load = async () => {
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error('Fetch failed');
        const buf = await res.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: buf });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        const page = await pdf.getPage(1);
        const vp1 = page.getViewport({ scale: 1 });
        const scale = Math.min(
          THUMB_MAX_WIDTH / vp1.width,
          THUMB_MAX_HEIGHT / vp1.height,
          THUMB_SCALE
        );
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas context');
        await page.render({
          canvasContext: ctx,
          viewport
        }).promise;
        if (cancelled) return;
        setPreviewDataUrl(canvas.toDataURL('image/jpeg', 0.85));
      } catch (e) {
        if (!cancelled) {
          setError(true);
          if (import.meta.env.DEV) {
            console.warn('[PdfThumbnail]', e);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading && !compact) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 rounded border border-gray-200 ${className}`}
        style={{ minWidth: THUMB_MAX_WIDTH, minHeight: 80 }}
      >
        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !previewDataUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 rounded border border-gray-200 text-gray-400 ${className}`}
        style={{ minWidth: compact ? 48 : THUMB_MAX_WIDTH, minHeight: compact ? 48 : 80 }}
      >
        <FileText className="w-8 h-8" />
      </div>
    );
  }

  return (
    <img
      src={previewDataUrl}
      alt=""
      className={`rounded border border-gray-200 bg-white object-contain ${className}`}
      style={{ maxWidth: THUMB_MAX_WIDTH, maxHeight: THUMB_MAX_HEIGHT }}
    />
  );
};
