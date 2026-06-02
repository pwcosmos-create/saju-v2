'use client';
/**
 * useStt — 음성 입력(STT) 훅
 *
 * Web Speech API (SpeechRecognition) 사용.
 * - Chrome/Edge: window.SpeechRecognition
 * - Safari (iOS 14.5+, macOS): window.webkitSpeechRecognition
 * - 지원 안 되면 supported = false 반환 → UI에서 버튼 숨김.
 */
import { useState, useRef, useCallback, useEffect } from 'react';

type SpeechRecognitionEvent = {
  results: SpeechRecognitionResultList;
  resultIndex: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySR = any;

export function useStt(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: AnySR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  const start = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: AnySR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;

    // 이미 듣는 중이면 중단
    if (recRef.current) {
      recRef.current.stop();
      recRef.current = null;
      setListening(false);
      return;
    }

    const rec = new SR();
    rec.lang = 'ko-KR';
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => setListening(true);

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results)
        .slice(e.resultIndex)
        .filter(r => r.isFinal)
        .map(r => r[0].transcript)
        .join('');
      if (transcript.trim()) onResult(transcript.trim());
    };

    rec.onerror = () => {
      setListening(false);
      recRef.current = null;
    };

    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };

    recRef.current = rec;
    rec.start();
  }, [onResult]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  }, []);

  return { listening, supported, start, stop };
}
