/**
 * 브라우저 Web Speech TTS — 상담사 성별에 맞는 ko-KR 음성
 */
import {
  COUNSELOR_BROWSER_VOICE_GENDER,
  type CounselorName,
} from '../core/counselor-config';

export type PausedReadUnit = { text: string; pauseAfterMs: number };

function counselorKoVoiceStorageKey(counselorName: string): string {
  return `saju_counselor_voice_uri_v1_${counselorName}`;
}

function inferBrowserKoVoiceGender(v: SpeechSynthesisVoice): 'male' | 'female' | 'unknown' {
  const blob = `${v.name}\t${v.voiceURI}`.toLowerCase();
  if (/\binjoon\b|injoon|남성|\bmale\b|hyunsu|hyun-su|민상|석준|태준|준영/i.test(blob)) return 'male';
  if (/\bheami\b|heami|yuna|유나|여성|\bfemale\b|hyeri|혜리|소연|하음|siri/i.test(blob)) return 'female';
  return 'unknown';
}

function rankKoVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return [...voices].sort((a, b) => {
    const score = (n: string) => (/Google|Natural|Microsoft|Siri/i.test(n) ? 0 : 1);
    const d = score(a.name) - score(b.name);
    if (d !== 0) return d;
    return a.name.localeCompare(b.name, 'ko');
  });
}

export function pickCounselorKoVoice(
  synth: SpeechSynthesis,
  counselorName: string,
): SpeechSynthesisVoice | undefined {
  const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith('ko'));
  if (!voices.length) return undefined;

  const slotKey = counselorKoVoiceStorageKey(counselorName);
  try {
    const savedUri = localStorage.getItem(slotKey);
    if (savedUri) {
      const again = voices.find((v) => v.voiceURI === savedUri);
      if (again) return again;
    }
  } catch {
    /* private mode */
  }

  const want =
    counselorName in COUNSELOR_BROWSER_VOICE_GENDER
      ? COUNSELOR_BROWSER_VOICE_GENDER[counselorName as CounselorName]
      : 'female';
  const byGender = voices.filter((v) => inferBrowserKoVoiceGender(v) === want);
  const unknown = voices.filter((v) => inferBrowserKoVoiceGender(v) === 'unknown');
  const pool = byGender.length ? byGender : unknown.length ? unknown : voices;
  const chosen = rankKoVoices(pool)[0];
  if (!chosen) return undefined;
  try {
    localStorage.setItem(slotKey, chosen.voiceURI);
  } catch {
    /* noop */
  }
  return chosen;
}

/** Chrome/iOS: 첫 사용자 제스처에서 voices 목록 로드 */
export function primeBrowserTtsVoices(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.getVoices();
}

function waitForVoices(synth: SpeechSynthesis, ms = 600): Promise<void> {
  if (synth.getVoices().length > 0) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      synth.removeEventListener('voiceschanged', onVoices);
      resolve();
    };
    const onVoices = () => finish();
    synth.addEventListener('voiceschanged', onVoices);
    window.setTimeout(finish, ms);
  });
}

/**
 * 문장·단락 단위 끊어 읽기.
 * iOS Safari: utterance 체인 + resume keep-alive (타임아웃 cancel 제거).
 */
export function speakPausedBrowserReading(
  units: PausedReadUnit[],
  counselorName: string,
  signal?: AbortSignal,
): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis || units.length === 0) {
    return Promise.resolve();
  }

  const synth = window.speechSynthesis;

  return waitForVoices(synth).then(() => new Promise<void>((resolve) => {
    let finished = false;
    let pauseTimer: number | undefined;
    let keepAlive: number | undefined;

    const finishAll = () => {
      if (finished) return;
      finished = true;
      if (pauseTimer) window.clearTimeout(pauseTimer);
      if (keepAlive) window.clearInterval(keepAlive);
      resolve();
    };

    const abort = () => {
      if (pauseTimer) window.clearTimeout(pauseTimer);
      synth.cancel();
      finishAll();
    };

    signal?.addEventListener('abort', abort, { once: true });

    // iOS: 긴 읽기 중 speechSynthesis가 멈추는 버그 완화
    keepAlive = window.setInterval(() => {
      if (signal?.aborted) return;
      if (synth.speaking || synth.pending) {
        try { synth.resume(); } catch { /* noop */ }
      }
    }, 7000);

    const speakAt = (i: number) => {
      if (signal?.aborted || finished || i >= units.length) {
        finishAll();
        return;
      }

      const { text, pauseAfterMs } = units[i];
      const voice = pickCounselorKoVoice(synth, counselorName);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.95;
      if (voice) utterance.voice = voice;

      utterance.onend = () => {
        if (signal?.aborted || finished) return;
        const next = i + 1;
        if (next >= units.length) {
          finishAll();
          return;
        }
        if (pauseAfterMs > 0) {
          pauseTimer = window.setTimeout(() => speakAt(next), pauseAfterMs);
        } else {
          speakAt(next);
        }
      };

      utterance.onerror = () => {
        if (signal?.aborted || finished) return;
        speakAt(i + 1);
      };

      synth.speak(utterance);
    };

    speakAt(0);
  }));
}
