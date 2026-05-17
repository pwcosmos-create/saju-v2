'use client';
/**
 * useTts — AI 상담 응답 음성 재생 훅
 *
 * /api/tts 는 최대 520자 제한이 있으므로 텍스트를 문장 단위로 청크 분할 후
 * AudioContext 로 순차 재생한다.
 */
import { useState, useRef, useCallback } from 'react';

const TTS_MAX = 470; // 서버 제한 520 보다 여유 두기

/** 문장 경계로 텍스트를 ≤ TTS_MAX 자 청크로 분할 */
function chunkText(text: string): string[] {
  // 마크다운 기호 제거
  const cleaned = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .trim();

  // 문장 분리 (마침표·느낌표·물음표·줄바꿈 뒤)
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
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    try { audioCtxRef.current?.close(); } catch { /* noop */ }
    audioCtxRef.current = null;
    setPlaying(false);
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!enabled || !text.trim()) return;
    stop();

    const ac = new AbortController();
    abortRef.current = ac;
    setPlaying(true);

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    // iOS / Safari: AudioContext 가 suspended 상태면 resume
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    try {
      for (const chunk of chunkText(text)) {
        if (ac.signal.aborted) break;

        let data: { audioBase64?: string; mimeType?: string };
        try {
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: chunk, counselorName: counselor }),
            signal: ac.signal,
          });
          if (!res.ok || ac.signal.aborted) break;
          data = await res.json() as typeof data;
        } catch {
          break; // 네트워크 오류·abort
        }

        if (!data.audioBase64 || ac.signal.aborted) break;

        // base64 → ArrayBuffer
        const binary = atob(data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        let audioBuffer: AudioBuffer;
        try {
          audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
        } catch {
          break; // 디코딩 실패
        }
        if (ac.signal.aborted) break;

        // 재생 후 다음 청크로
        await new Promise<void>((resolve) => {
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
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
      try { ctx.close(); } catch { /* noop */ }
    }
  }, [enabled, counselor, stop]);

  return { playing, enabled, setEnabled, speak, stop };
}
