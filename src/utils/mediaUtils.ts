/**
 * Сжатие изображения для отправки в мессенджер (mobile-quality).
 * Ограничение размера по стороне и по размеру файла.
 */
const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.85;
const TARGET_MAX_BYTES = 800 * 1024; // 800 KB

function drawImageToCanvas(
  img: HTMLImageElement,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2d not available');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

/**
 * Сжимает изображение: уменьшает размер до MAX_DIMENSION по большей стороне,
 * конвертирует в JPEG с заданным качеством, при необходимости понижает качество
 * до достижения TARGET_MAX_BYTES.
 */
export function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w <= MAX_DIMENSION && h <= MAX_DIMENSION) {
        w = img.naturalWidth;
        h = img.naturalHeight;
      } else if (w >= h) {
        w = MAX_DIMENSION;
        h = Math.round((img.naturalHeight * MAX_DIMENSION) / img.naturalWidth);
      } else {
        h = MAX_DIMENSION;
        w = Math.round((img.naturalWidth * MAX_DIMENSION) / img.naturalHeight);
      }
      const canvas = drawImageToCanvas(img, w, h);
      let quality = JPEG_QUALITY;

      const tryBlob = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            if (blob.size <= TARGET_MAX_BYTES || quality <= 0.3) {
              const name = file.name.replace(/\.[^.]+$/i, '') + '.jpg';
              resolve(new File([blob], name, { type: 'image/jpeg' }));
              return;
            }
            quality = Math.max(0.3, quality - 0.15);
            tryBlob();
          },
          'image/jpeg',
          quality
        );
      };
      tryBlob();
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };
    img.src = objectUrl;
  });
}

/** Проверка, что файл — видео и не превышает лимит размера (байты). */
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
