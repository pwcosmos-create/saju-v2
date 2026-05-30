/** 서버 TTS base64 → WebView에서 안정적으로 재생 */
export function base64ToObjectUrl(audioBase64: string, mimeType: string): string {
  const bin = atob(audioBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

const AUDIO_LOAD_TIMEOUT_MS = 12_000;

export async function playServerTtsAudio(
  payload: { mimeType: string; audioBase64: string },
  options?: {
    audioRef?: { current: HTMLAudioElement | null };
    shouldContinue?: () => boolean;
    playbackRate?: number;
  },
): Promise<boolean> {
  let objectUrl: string | null = null;
  try {
    if (options?.shouldContinue && !options.shouldContinue()) return false;

    const prev = options?.audioRef?.current;
    if (prev) {
      prev.pause();
      prev.src = '';
    }

    objectUrl = base64ToObjectUrl(payload.audioBase64, payload.mimeType);
    const audio = options?.audioRef?.current ?? new Audio();
    audio.setAttribute('playsinline', 'true');
    audio.preload = 'auto';
    const rate = options?.playbackRate ?? 1;
    if (rate > 0 && Number.isFinite(rate)) {
      audio.playbackRate = rate;
    }
    audio.src = objectUrl;
    if (options?.audioRef) options.audioRef.current = audio;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        audio.removeEventListener('canplaythrough', finish);
        audio.removeEventListener('loadeddata', finish);
        audio.removeEventListener('error', fail);
        resolve();
      };
      const fail = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        audio.removeEventListener('canplaythrough', finish);
        audio.removeEventListener('loadeddata', finish);
        audio.removeEventListener('error', fail);
        reject(new Error('audio load failed'));
      };
      const timer = window.setTimeout(() => {
        if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) finish();
        else fail();
      }, AUDIO_LOAD_TIMEOUT_MS);

      if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        finish();
        return;
      }
      audio.addEventListener('canplaythrough', finish, { once: true });
      audio.addEventListener('loadeddata', finish, { once: true });
      audio.addEventListener('error', fail, { once: true });
      audio.load();
    });

    if (options?.shouldContinue && !options.shouldContinue()) return false;

    try {
      await audio.play();
    } catch {
      return false;
    }

    const finishedOk = await new Promise<boolean>((resolve) => {
      audio.onended = () => resolve(true);
      audio.onerror = () => resolve(false);
    });
    return finishedOk;
  } catch {
    return false;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
