'use client';
/**
 * useTts — 비활성 (제품에서 TTS 미사용)
 * 훅 시그니처만 유지해 기존 import 깨짐을 방지합니다.
 */
export function useTts(_counselor: string) {
  return {
    playing: false,
    enabled: false,
    setEnabled: (_v: boolean) => {},
    speak: async (_text: string, _options?: { manual?: boolean }) => {},
    stop: () => {},
    primeAudio: async () => {},
  };
}
