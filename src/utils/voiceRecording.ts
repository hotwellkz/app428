/**
 * Запись голосового сообщения в OGG (Opus) для отправки в WhatsApp как voice message.
 * Использует opus-media-recorder при наличии, иначе нативный MediaRecorder (Firefox даёт audio/ogg).
 */

function getVoicePaths() {
  if (typeof window === 'undefined') return { worker: '', wasm: '' };
  const base = `${window.location.origin}/voice`;
  return { worker: `${base}/encoderWorker.umd.js`, wasm: `${base}/OggOpusEncoder.wasm` };
}

/** Проверяет, поддерживается ли OGG/Opus через opus-media-recorder (или нативно). */
export function isOggOpusSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    MediaRecorder.isTypeSupported('audio/ogg; codecs=opus') ||
    MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
  );
}

/**
 * Создаёт рекордер для записи в OGG/Opus.
 * При успехе возвращает объект с start/stop; при ошибке — null.
 */
export async function createVoiceRecorder(
  stream: MediaStream,
  onStop: (blob: Blob) => void
): Promise<{ start: () => void; stop: () => void } | null> {
  if (MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')) {
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/ogg; codecs=opus' });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: 'audio/ogg' });
      onStop(blob);
    };
    return {
      start: () => {
        chunks.length = 0;
        recorder.start(200);
      },
      stop: () => recorder.state !== 'inactive' && recorder.stop()
    };
  }

  try {
    const OpusMediaRecorder = (await import('opus-media-recorder')).default;
    const isOgg = OpusMediaRecorder.isTypeSupported('audio/ogg');
    const mimeType = isOgg ? 'audio/ogg' : 'audio/webm';
    const { worker, wasm } = getVoicePaths();
    const workerOptions = {
      encoderWorkerFactory: () => new Worker(worker),
      OggOpusEncoderWasmPath: wasm
    };
    const recorder = new OpusMediaRecorder(stream, { mimeType }, workerOptions);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const type = mimeType === 'audio/ogg' ? 'audio/ogg' : 'audio/webm';
      const blob = new Blob(chunks, { type });
      onStop(blob);
    };
    return {
      start: () => {
        chunks.length = 0;
        recorder.start(200);
      },
      stop: () => recorder.state !== 'inactive' && recorder.stop()
    };
  } catch (e) {
    console.warn('opus-media-recorder failed, using native MediaRecorder', e);
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: mime });
      onStop(blob);
    };
    return {
      start: () => {
        chunks.length = 0;
        recorder.start(200);
      },
      stop: () => recorder.state !== 'inactive' && recorder.stop()
    };
  }
}
