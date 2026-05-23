/**
 * 브라우저 Web Speech TTS — 상담사 성별에 맞는 ko-KR 음성
 */
import {
  COUNSELOR_BROWSER_VOICE_GENDER,
  type CounselorName,
} from '../core/counselor-config';

function counselorKoVoiceStorageKey(counselorName: string): string {
  return `saju_counselor_voice_uri_v1_${counselorName}`;
}

function inferBrowserKoVoiceGender(v: SpeechSynthesisVoice): 'male' | 'female' | 'unknown' {
  const blob = `${v.name}\t${v.voiceURI}`.toLowerCase();
  if (/\binjoon\b|injoon|남성|\bmale\b|hyunsu|hyun-su|민상|석준|태준|준영/i.test(blob)) return 'male';
  if (/\bheami\b|heami|yuna|유나|여성|\bfemale\b|hyeri|혜리|소연|하음/i.test(blob)) return 'female';
  return 'unknown';
}

function rankKoVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return [...voices].sort((a, b) => {
    const score = (n: string) => (/Google|Natural|Microsoft/i.test(n) ? 0 : 1);
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

/** Chrome 등: 첫 사용자 제스처에서 voices 목록 로드 */
export function primeBrowserTtsVoices(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.getVoices();
}

export function speakWithBrowserTts(
  text: string,
  counselorName: string,
  signal?: AbortSignal,
): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };

    const run = () => {
      const voice = pickCounselorKoVoice(synth, counselorName);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.95;
      if (voice) utterance.voice = voice;

      const timer = window.setTimeout(() => {
        synth.cancel();
        finish();
      }, text.length * 280 + 4000);

      utterance.onstart = () => window.clearTimeout(timer);
      utterance.onend = () => {
        window.clearTimeout(timer);
        finish();
      };
      utterance.onerror = () => {
        window.clearTimeout(timer);
        finish();
      };

      signal?.addEventListener(
        'abort',
        () => {
          window.clearTimeout(timer);
          synth.cancel();
          finish();
        },
        { once: true },
      );

      synth.speak(utterance);
    };

    if (synth.getVoices().length > 0) {
      run();
      return;
    }

    const onVoices = () => {
      synth.removeEventListener('voiceschanged', onVoices);
      run();
    };
    synth.addEventListener('voiceschanged', onVoices);
    window.setTimeout(() => {
      synth.removeEventListener('voiceschanged', onVoices);
      if (!done) run();
    }, 400);
  });
}
