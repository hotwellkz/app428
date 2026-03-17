import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionErrorCode =
  | 'no-speech'
  | 'audio-capture'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'network'
  | 'aborted'
  | 'language-not-supported'
  | string;

interface UseSpeechToTextOptions {
  lang?: string;
}

interface UseSpeechToTextState {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

type SpeechRecognitionConstructor =
  | (new () => SpeechRecognition)
  | (new () => webkitSpeechRecognition);

declare global {
  interface Window {
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}

export const useSpeechToText = (options?: UseSpeechToTextOptions): UseSpeechToTextState => {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | webkitSpeechRecognition | null>(null);

  const getConstructor = useCallback((): SpeechRecognitionConstructor | null => {
    if (typeof window === 'undefined') return null;
    const AnyWindow = window as typeof window & {
      webkitSpeechRecognition?: typeof SpeechRecognition;
    };
    return (AnyWindow.SpeechRecognition || AnyWindow.webkitSpeechRecognition) ?? null;
  }, []);

  useEffect(() => {
    const Ctor = getConstructor();
    setIsSupported(!!Ctor);
  }, [getConstructor]);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const mapError = (code: SpeechRecognitionErrorCode): string => {
    switch (code) {
      case 'not-allowed':
      case 'service-not-allowed':
        return 'Нет доступа к микрофону';
      case 'no-speech':
        return 'Не удалось распознать речь';
      case 'audio-capture':
        return 'Микрофон недоступен';
      case 'network':
        return 'Ошибка сети при распознавании речи';
      case 'language-not-supported':
        return 'Язык распознавания не поддерживается';
      default:
        return 'Ошибка голосовой диктовки';
    }
  };

  const start = useCallback(() => {
    const Ctor = getConstructor();
    if (!Ctor) {
      setIsSupported(false);
      setError('Голосовая диктовка не поддерживается в этом браузере');
      return;
    }

    // Если уже слушаем — остановим и перезапустим
    if (recognitionRef.current) {
      stop();
    }

    reset();

    try {
      const recognition = new Ctor();
      recognition.lang = options?.lang ?? 'ru-RU';
      // Включаем непрерывный режим, чтобы движок дольше ждал продолжения речи
      // и не обрывал диктовку при коротких паузах
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += result[0].transcript;
          }
        }
        if (finalText.trim()) {
          setTranscript((prev) => (prev ? `${prev} ${finalText.trim()}` : finalText.trim()));
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setError(mapError(event.error));
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      setError('Не удалось запустить голосовую диктовку');
      setIsListening(false);
      recognitionRef.current = null;
    }
  }, [getConstructor, options?.lang, reset, stop]);

  useEffect(
    () => () => {
      // cleanup on unmount
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
    },
    []
  );

  return {
    isSupported,
    isListening,
    transcript,
    error,
    start,
    stop,
    reset
  };
};

