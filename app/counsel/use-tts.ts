'use client';
/**
 * useTts — 브라우저 Web Speech, 문장·단락마다 끊어 읽기
 *
 * 토스 WebView(APPS_IN_TOSS) 환경에서는 브라우저 speechSynthesis 대신
 * 서버 사이드 Gemini TTS 브릿지(tossTts + playServerTtsAudio)를 사용해 소리를 재생합니다.
 */
import { useState, useRef, useCallback } from 'react';
import { prepareTextForTts } from '../../lib/prepare-text-for-tts';
import { primeBrowserTtsVoices, speakPausedBrowserReading } from '../../lib/browser-tts-voice';
import { splitForPausedReading } from '../../lib/tts-paused-reading';
import { tossTts } from '../../lib/toss-http';
import { playServerTtsAudio } from '../../lib/server-tts-playback';
import { splitUnitForApi, SERVER_TTS_PLAYBACK_RATE } from '../../lib/natural-server-tts';

const APPS_IN_TOSS = process.env.NEXT_PUBLIC_APPS_IN_TOSS === '1';

export function useTts(counselor: string) {
  const [playing, setPlaying] = useState(false);
  const [enabled, setEnabled] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const counselorRef = useRef(counselor);
  counselorRef.current = counselor;

  const primeAudio = useCallback(async () => {
    primeBrowserTtsVoices();
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    
    // Stop server TTS audio if playing
    const audio = audioRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.src = '';
      } catch { /* noop */ }
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlaying(false);
  }, []);

  const speak = useCallback(async (text: string) => {
    const ttsText = prepareTextForTts(text);
    if (!enabled || !ttsText) return;
    if (typeof window === 'undefined') return;
    if (!APPS_IN_TOSS && !window.speechSynthesis) return;
    stop();

    const units = splitForPausedReading(ttsText);
    if (units.length === 0) return;

    const ac = new AbortController();
    abortRef.current = ac;
    setPlaying(true);

    try {
      if (APPS_IN_TOSS) {
        let allOk = true;
        for (let ui = 0; ui < units.length; ui++) {
          if (ac.signal.aborted) {
            allOk = false;
            break;
          }
          const unit = units[ui];
          const apiChunks = splitUnitForApi(unit.text);
          for (const chunk of apiChunks) {
            if (ac.signal.aborted) {
              allOk = false;
              break;
            }
            let bridged = await tossTts(chunk, counselorRef.current);
            if (!bridged.ok) {
              await new Promise<void>((r) => window.setTimeout(r, 400));
              if (ac.signal.aborted) {
                allOk = false;
                break;
              }
              bridged = await tossTts(chunk, counselorRef.current);
            }
            if (!bridged.ok || ac.signal.aborted) {
              allOk = false;
              break;
            }
            const ok = await playServerTtsAudio(
              { mimeType: bridged.mimeType, audioBase64: bridged.audioBase64 },
              {
                audioRef,
                shouldContinue: () => !ac.signal.aborted,
                playbackRate: SERVER_TTS_PLAYBACK_RATE,
              },
            );
            if (!ok || ac.signal.aborted) {
              allOk = false;
              break;
            }
          }
          if (!allOk || ac.signal.aborted) break;
          if (unit.pauseAfterMs > 0 && ui < units.length - 1) {
            await new Promise<void>((resolve, reject) => {
              const timer = window.setTimeout(resolve, unit.pauseAfterMs);
              ac.signal.addEventListener('abort', () => {
                window.clearTimeout(timer);
                reject(new DOMException('Aborted', 'AbortError'));
              }, { once: true });
            });
          }
        }
      } else {
        await speakPausedBrowserReading(units, counselorRef.current, ac.signal);
      }
    } catch {
      // ignore abort or other silent errors
    } finally {
      if (abortRef.current === ac) {
        setPlaying(false);
        abortRef.current = null;
      }
    }
  }, [enabled, stop]);

  return { playing, enabled, setEnabled, speak, stop, primeAudio };
}
