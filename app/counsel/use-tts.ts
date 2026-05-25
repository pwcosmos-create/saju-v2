'use client';
/**
 * useTts — 브라우저 Web Speech, 문장·단락마다 끊어 읽기
 */
import { useState, useRef, useCallback } from 'react';
import { prepareTextForTts } from '../../lib/prepare-text-for-tts';
import { primeBrowserTtsVoices, speakPausedBrowserReading } from '../../lib/browser-tts-voice';
import { splitForPausedReading } from '../../lib/tts-paused-reading';

export function useTts(counselor: string) {
  const [playing, setPlaying] = useState(false);
  const [enabled, setEnabled] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const counselorRef = useRef(counselor);
  counselorRef.current = counselor;

  const primeAudio = useCallback(async () => {
    primeBrowserTtsVoices();
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlaying(false);
  }, []);

  const speak = useCallback(async (text: string) => {
    const ttsText = prepareTextForTts(text);
    if (!enabled || !ttsText) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    stop();

    const units = splitForPausedReading(ttsText);
    if (units.length === 0) return;

    const ac = new AbortController();
    abortRef.current = ac;
    setPlaying(true);

    try {
      await speakPausedBrowserReading(units, counselorRef.current, ac.signal);
    } finally {
      if (!ac.signal.aborted) setPlaying(false);
    }
  }, [enabled, stop]);

  return { playing, enabled, setEnabled, speak, stop, primeAudio };
}
