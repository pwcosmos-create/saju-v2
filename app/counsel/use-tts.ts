'use client';
/**
 * useTts — AI 상담 응답 음성 재생 훅 (v2 - 모바일 대응)
 *
 * iOS Safari 정책:
 *   AudioContext는 사용자 제스처(터치/클릭) 없이 resume() 불가.
 *   → AudioContext를 최초 send 클릭 시 "primeAudio()"로 잠금 해제.
 *   → 이후 응답이 오면 이미 unlocked된 ctx를 재사용 → 자동재생 가능.
 */
import { useState, useRef, useCallback } from 'react';

/**
 * TTS 청크 크기: 작을수록 첩 첩크의 Gemini TTS 응답이 빠름.
 * 150자 ≈ 2만 여 가 → 첫 음성이 빨리 도착하면서 나머지는 백그라운드 fetch.
 */
const TTS_MAX = 150;

function chunkText(text: string): string[] {
  const cleaned = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .trim();

  // 한국어 종결 부호 + 영문 + 줄바꽔 연속된 문자열로 연달 (여백 포함)
  const sentences = cleaned.split(/((?<=[.!?。！？다요죠네니])[\s]*)/);
  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if ((current + ' ' + trimmed).length > TTS_MAX && current) {
      chunks.push(current.trim());
      current = trimmed;
    } else {
      current = current ? current + ' ' + trimmed : trimmed;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(c => c.length > 0);
}

export function useTts(counselor: string) {
  const [playing, setPlaying] = useState(false);
  const [enabled, setEnabled] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  /** 전역 단일 AudioContext — 최초 사용자 클릭에서 생성·unlock 후 재사용 */
  const audioCtxRef = useRef<AudioContext | null>(null);
  const primedRef = useRef(false);

  /**
   * 사용자 클릭 이벤트 핸들러 안에서 호출 → iOS 잠금 해제.
   * 무음 버퍼 재생으로 iOS Safari AudioContext를 완전히 unlock.
   */
  const primeAudio = useCallback(async () => {
    if (primedRef.current) return;
    primedRef.current = true;
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      // iOS Safari: 무음 버퍼 재생으로 완전 unlock
      const silentBuf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = silentBuf;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      primedRef.current = false; // 실패 시 재시도 허용
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPlaying(false);
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!enabled || !text.trim()) return;
    stop();

    const ac = new AbortController();
    abortRef.current = ac;
    setPlaying(true);

    // AudioContext 재사용 (closed면 새로 생성)
    let ctx = audioCtxRef.current;
    if (!ctx || ctx.state === 'closed') {
      ctx = new AudioContext();
      audioCtxRef.current = ctx;
    }
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch { setPlaying(false); return; }
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) { setPlaying(false); return; }

    const useWebSpeechForFirst = typeof window !== 'undefined' && 'speechSynthesis' in window;

    /**
     * 병렬 fetch: 모든 청크를 동시에 요청하고 Promise 배열로 관리.
     * 단, 첫 번째 청크는 Web Speech API를 쓸 경우 서버 요청 생략.
     */
    const fetchPromises = chunks.map((chunk, i) => {
      if (i === 0 && useWebSpeechForFirst) return Promise.resolve(null);
      return fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chunk, counselorName: counselor }),
        signal: ac.signal,
      })
        .then(r => r.ok ? r.json() as Promise<{ audioBase64?: string; mimeType?: string }> : null)
        .catch(() => null);
    });

    const ctxRef = ctx; // closure 용
    try {
      for (let i = 0; i < chunks.length; i++) {
        if (ac.signal.aborted) break;

        const chunk = chunks[i];

        // 1. 첫 번째 문장: Web Speech API로 대기 시간 0초 (즉시 재생)
        if (i === 0 && useWebSpeechForFirst) {
          await new Promise<void>((resolve) => {
            const utterance = new SpeechSynthesisUtterance(chunk);
            utterance.lang = 'ko-KR';
            utterance.rate = 1.0;
            
            // 모바일 백그라운드 정책 등으로 음성 시작이 막히면 3초 후 다음(Gemini)으로 강제 스킵
            const fallbackTimer = setTimeout(() => {
                window.speechSynthesis.cancel();
                resolve();
            }, 3000);

            utterance.onstart = () => clearTimeout(fallbackTimer);
            utterance.onend = () => { clearTimeout(fallbackTimer); resolve(); };
            utterance.onerror = () => { clearTimeout(fallbackTimer); resolve(); };
            
            ac.signal.addEventListener('abort', () => {
              clearTimeout(fallbackTimer);
              window.speechSynthesis.cancel();
              resolve();
            }, { once: true });
            
            window.speechSynthesis.speak(utterance);
          });
          continue; // Web Speech 끝나면 바로 다음 문장(Gemini) 재생으로 넘어감
        }

        // 2. 나머지 문장: 고품질 Gemini TTS
        const data = await fetchPromises[i];
        
        // 데이터가 없거나 서버 에러여도 break 하지 않고 다음 문장으로 스킵 (continue)
        if (!data?.audioBase64 || ac.signal.aborted) continue;

        const binary = atob(data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);

        let audioBuffer: AudioBuffer;
        try {
          audioBuffer = await ctxRef.decodeAudioData(bytes.buffer.slice(0));
        } catch { continue; } // 디코딩 실패해도 끊기지 않게 continue
        
        if (ac.signal.aborted) break;

        await new Promise<void>((resolve) => {
          const source = ctxRef.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctxRef.destination);
          source.onended = () => resolve();
          source.start();
          ac.signal.addEventListener('abort', () => {
            try { source.stop(); } catch { /* noop */ }
            resolve();
          }, { once: true });
        });
      }
    } finally {
      if (!ac.signal.aborted) setPlaying(false);
    }
  }, [enabled, counselor, stop]);


  return { playing, enabled, setEnabled, speak, stop, primeAudio };
}
