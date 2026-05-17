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

const TTS_MAX = 470;

function chunkText(text: string): string[] {
  const cleaned = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .trim();

  const sentences = cleaned.split(/(?<=[.!?。！？\n])\s*/);
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

    /**
     * 병렬 fetch: 모든 청크를 동시에 요청하고 Promise 배열로 관리.
     * → 첫 청크가 도착하면 즉시 재생 시작, 그 사이 다음 청크들은 이미 받아지는 중.
     * → 순차 방식 대비 대기 시간 = 첫 청크 1회분만 발생.
     */
    const fetchPromises = chunks.map(chunk =>
      fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chunk, counselorName: counselor }),
        signal: ac.signal,
      })
        .then(r => r.ok ? r.json() as Promise<{ audioBase64?: string; mimeType?: string }> : null)
        .catch(() => null),
    );

    const ctxRef = ctx; // closure 용
    try {
      for (const fetchPromise of fetchPromises) {
        if (ac.signal.aborted) break;

        const data = await fetchPromise; // 이 청크만 기다림 (나머지는 백그라운드에서 계속 fetch 중)
        if (!data?.audioBase64 || ac.signal.aborted) break;

        const binary = atob(data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        let audioBuffer: AudioBuffer;
        try {
          audioBuffer = await ctxRef.decodeAudioData(bytes.buffer.slice(0));
        } catch { break; }
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
