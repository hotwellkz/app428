/**
 * Сжатие изображений под отправку в чат (как в мессенджерах).
 * Canvas → JPEG без EXIF. Цель ~100–400 KB при нормальном виде.
 */
const MAX_W = 1280;
const MAX_H = 1280;
const TARGET_MAX_BYTES = 450 * 1024; // ~450 KB целевой потолок

function drawToCanvas(img: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2d not available');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

function scaleDimensions(nw: number, nh: number, maxSide: number): { w: number; h: number } {
  if (nw <= maxSide && nh <= maxSide) return { w: nw, h: nh };
  if (nw >= nh) {
    return { w: maxSide, h: Math.round((nh * maxSide) / nw) };
  }
  return { w: Math.round((nw * maxSide) / nh), h: maxSide };
}

function toBlobPromise(canvas: HTMLCanvasElement, type: string, q: number): Promise<Blob> {
  return new Promise((res, rej) => {
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), type, q);
  });
}

/**
 * JPEG, max 1280px, quality 0.7 → >1MB → 0.55 → >2MB меньше сторона → цель ~450KB.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('load'));
      i.src = url;
    });
    let maxSide = 1280;
    let quality = 0.7;
    const name = (file.name.replace(/\.[^.]+$/i, '') || 'photo') + '.jpg';
    for (let pass = 0; pass < 10; pass++) {
      const { w, h } = scaleDimensions(img.naturalWidth, img.naturalHeight, maxSide);
      const canvas = drawToCanvas(img, w, h);
      const blob = await toBlobPromise(canvas, 'image/jpeg', quality);
      const out = new File([blob], name, { type: 'image/jpeg' });
      if (out.size <= TARGET_MAX_BYTES) return out;
      if (out.size > 2 * 1024 * 1024 && maxSide > 720) {
        maxSide = Math.max(720, maxSide - 320);
        continue;
      }
      if (out.size > 1024 * 1024 && quality > 0.5) {
        quality = 0.55;
        continue;
      }
      if (quality > 0.42) {
        quality = Math.max(0.4, quality - 0.08);
        continue;
      }
      if (maxSide > 640) {
        maxSide = 640;
        continue;
      }
      return out;
    }
    const { w, h } = scaleDimensions(img.naturalWidth, img.naturalHeight, 640);
    const blob = await toBlobPromise(drawToCanvas(img, w, h), 'image/jpeg', 0.4);
    return new File([blob], name, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

const VIDEO_MAX_DURATION_SEC = 60;
const VIDEO_WARN_LARGE_BYTES = 8 * 1024 * 1024;

export type VideoCheckResult =
  | { ok: true; durationSec: number }
  | { ok: false; error: string };

/** Длительность видео (метаданные). */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const d = v.duration;
      if (!Number.isFinite(d) || d <= 0) {
        reject(new Error('duration'));
        return;
      }
      resolve(d);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('video metadata'));
    };
    v.src = url;
  });
}

export async function validateVideoForChat(
  file: File,
  maxBytes: number
): Promise<VideoCheckResult> {
  if (!file.type.startsWith('video/')) {
    return { ok: false, error: 'Неверный тип файла' };
  }
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return {
      ok: false,
      error: `Видео больше ${mb} МБ. Сожмите или обрежьте и попробуйте снова.`
    };
  }
  try {
    const durationSec = await getVideoDuration(file);
    if (durationSec > VIDEO_MAX_DURATION_SEC) {
      return {
        ok: false,
        error: 'Видео слишком длинное (максимум 60 сек). Обрежьте и отправьте снова.'
      };
    }
    return { ok: true, durationSec };
  } catch {
    // Не смогли прочитать длительность — не блокируем (редкие контейнеры)
    return { ok: true, durationSec: 0 };
  }
}

/** Для UX: крупное видео без перекодирования в браузере */
export function isLargeVideo(file: File): boolean {
  return file.type.startsWith('video/') && file.size >= VIDEO_WARN_LARGE_BYTES;
}

/** Старый API — размер только */
export function validateVideoFile(file: File, maxBytes: number): { ok: boolean; error?: string } {
  if (!file.type.startsWith('video/')) {
    return { ok: false, error: 'Неверный тип файла' };
  }
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return { ok: false, error: `Видео слишком большое. Максимум ${mb} МБ.` };
  }
  return { ok: true };
}
