/**
 * Запись голосового сообщения в OGG/WebM (Opus) для WhatsApp.
 * — Усиленные constraints микрофона (шумодав, эхоподавление, AGC, mono).
 * — Опционально: Web Audio (high-pass + лёгкий compressor) поверх потока браузера.
 */

function getVoicePaths() {
  if (typeof window === 'undefined') return { worker: '', wasm: '' };
  const base = `${window.location.origin}/voice`;
  return { worker: `${base}/encoderWorker.umd.js`, wasm: `${base}/OggOpusEncoder.wasm` };
}

export function isOggOpusSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    MediaRecorder.isTypeSupported('audio/ogg; codecs=opus') ||
    MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
  );
}

/** Логируем, что реально применилось к треку (только development). */
function logAudioTrackSettings(track: MediaStreamTrack, label: string) {
  if (process.env.NODE_ENV !== 'development' || !track?.getSettings) return;
  try {
    const settings = track.getSettings();
    const caps = track.getCapabilities?.();
    console.info(`[voice] ${label} getSettings()`, {
      echoCancellation: settings.echoCancellation,
      noiseSuppression: settings.noiseSuppression,
      autoGainControl: settings.autoGainControl,
      channelCount: settings.channelCount,
      sampleRate: settings.sampleRate,
      sampleSize: settings.sampleSize,
    });
    if (caps && Object.keys(caps).length)
      console.info(`[voice] ${label} capabilities (subset)`, {
        echoCancellation: caps.echoCancellation,
        noiseSuppression: caps.noiseSuppression,
        autoGainControl: caps.autoGainControl,
        channelCount: caps.channelCount,
      });
  } catch (e) {
    console.warn('[voice] log settings failed', e);
  }
}

async function tryApplySpeechConstraints(track: MediaStreamTrack): Promise<void> {
  try {
    await track.applyConstraints({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    } as MediaTrackConstraints);
    logAudioTrackSettings(track, 'after applyConstraints');
  } catch {
    try {
      await track.applyConstraints({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } as MediaTrackConstraints);
    } catch {
      /* браузер не даёт — оставляем как есть */
    }
  }
}

export type VoiceStreamHandle = {
  /** Поток для MediaRecorder (сырой или после Web Audio) */
  stream: MediaStream;
  /** Остановить микрофон и закрыть AudioContext — вызывать после окончания записи */
  release: () => void;
};

/**
 * Микрофон с максимально «речевыми» настройками + мягкая обработка через Web Audio.
 * Fallback по шагам, если constraint не поддержан.
 */
export async function acquireVoiceStream(): Promise<VoiceStreamHandle> {
  const audioIdeal: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 48000,
    sampleSize: 16,
  };
  const audioStrong: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
  };
  const audioBasic: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };

  let stream: MediaStream | null = null;
  for (const audio of [audioIdeal, audioStrong, audioBasic, true as const]) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: audio === true ? true : audio,
      });
      break;
    } catch {
      stream = null;
    }
  }
  if (!stream) {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }

  const rawTrack = stream.getAudioTracks()[0];
  if (rawTrack) {
    logAudioTrackSettings(rawTrack, 'raw after getUserMedia');
    await tryApplySpeechConstraints(rawTrack);
  }

  let audioContext: AudioContext | null = null;
  let release: () => void = () => {
    stream.getTracks().forEach((t) => t.stop());
  };

  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx || !rawTrack) throw new Error('no webaudio');

    audioContext = new Ctx({ sampleRate: rawTrack.getSettings().sampleRate || 48000 });
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const source = audioContext.createMediaStreamSource(stream);
    // Срез низов (~80 Hz) — гул, не голос
    const hp = audioContext.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 85;
    hp.Q.value = 0.7;

    const comp = audioContext.createDynamicsCompressor();
    comp.threshold.value = -22;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;

    const gain = audioContext.createGain();
    gain.gain.value = 1;

    const dest = audioContext.createMediaStreamDestination();
    source.connect(hp);
    hp.connect(comp);
    comp.connect(gain);
    gain.connect(dest);

    const processed = dest.stream;
    release = () => {
      try {
        source.disconnect();
        hp.disconnect();
        comp.disconnect();
        gain.disconnect();
      } catch {
        /* */
      }
      stream.getTracks().forEach((t) => t.stop());
      audioContext?.close().catch(() => {});
    };

    return { stream: processed, release };
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[voice] Web Audio pipeline skipped, using raw mic', e);
    }
    return { stream, release };
  }
}

/**
 * Создаёт рекордер. После stop вызывается release() — остановка микрофона и закрытие AudioContext.
 */
export async function createVoiceRecorder(
  stream: MediaStream,
  onStop: (blob: Blob) => void,
  release?: () => void
): Promise<{ start: () => void; stop: () => void } | null> {
  const finish = () => {
    try {
      release?.();
    } catch {
      stream.getTracks().forEach((t) => t.stop());
    }
  };

  const pickMime = (): string => {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
    if (MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')) return 'audio/ogg; codecs=opus';
    if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
    return 'audio/webm';
  };

  if (MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')) {
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/ogg; codecs=opus' });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    recorder.onstop = () => {
      finish();
      const blob = new Blob(chunks, { type: 'audio/ogg' });
      onStop(blob);
    };
    return {
      start: () => {
        chunks.length = 0;
        recorder.start(200);
      },
      stop: () => recorder.state !== 'inactive' && recorder.stop(),
    };
  }

  try {
    const OpusMediaRecorder = (await import('opus-media-recorder')).default;
    const isOgg = OpusMediaRecorder.isTypeSupported('audio/ogg');
    const mimeType = isOgg ? 'audio/ogg' : 'audio/webm';
    const { worker, wasm } = getVoicePaths();
    const workerOptions = {
      encoderWorkerFactory: () => new Worker(worker),
      OggOpusEncoderWasmPath: wasm,
    };
    const recorder = new OpusMediaRecorder(stream, { mimeType }, workerOptions);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    recorder.onstop = () => {
      finish();
      const type = mimeType === 'audio/ogg' ? 'audio/ogg' : 'audio/webm';
      const blob = new Blob(chunks, { type });
      onStop(blob);
    };
    return {
      start: () => {
        chunks.length = 0;
        recorder.start(200);
      },
      stop: () => recorder.state !== 'inactive' && recorder.stop(),
    };
  } catch (e) {
    console.warn('opus-media-recorder failed, using native MediaRecorder', e);
    const mime = pickMime();
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    recorder.onstop = () => {
      finish();
      const blob = new Blob(chunks, { type: mime.split(';')[0] });
      onStop(blob);
    };
    return {
      start: () => {
        chunks.length = 0;
        recorder.start(200);
      },
      stop: () => recorder.state !== 'inactive' && recorder.stop(),
    };
  }
}
