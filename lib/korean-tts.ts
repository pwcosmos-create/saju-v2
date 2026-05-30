import {
  COUNSELOR_BROWSER_VOICE_GENDER,
  type CounselorName,
} from '../core/counselor-config';

const TTS_HARD_SENTENCE_CAP = 1600;
const TTS_INTER_SENTENCE_PAUSE_MS = 580;
export const TTS_RATE = 0.93;
export const TTS_PITCH = 1.02;

/** 한자·마크다운 제거 — TTS 전용 */
export function stripHanjaForSpeech(text: string): string {
  return text
    .replace(/\([^)]*[\u4E00-\u9FFF\u3400-\u4DBF][^)]*\)/g, '')
    .replace(/[\u4E00-\u9FFF\u3400-\u4DBF]/g, '')
    .replace(/[*#\-_>`]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function splitIntoSentences(normalized: string): string[] {
  const blocks = normalized.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const out: string[] = [];
  for (const block of blocks) {
    const parts = block
      .split(/(?<=[.!?。！？…])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) out.push(...parts);
    else out.push(block);
  }
  return out.length ? out : normalized ? [normalized] : [];
}

function splitOversizedSentence(sentence: string): string[] {
  if (sentence.length <= TTS_HARD_SENTENCE_CAP) return [sentence];
  const out: string[] = [];
  for (let i = 0; i < sentence.length; i += TTS_HARD_SENTENCE_CAP) {
    out.push(sentence.slice(i, i + TTS_HARD_SENTENCE_CAP));
  }
  return out;
}

function splitTtsChunks(text: string): string[] {
  const normalized = stripHanjaForSpeech(text).replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const flat: string[] = [];
  for (const s of splitIntoSentences(normalized)) {
    flat.push(...splitOversizedSentence(s));
  }
  return flat;
}

let speakKoreanSessionId = 0;
let voiceWaitReg: { onVoices: () => void; timer: number } | null = null;

function clearVoiceWaitRegistration(synth: SpeechSynthesis) {
  if (!voiceWaitReg) return;
  synth.removeEventListener('voiceschanged', voiceWaitReg.onVoices);
  window.clearTimeout(voiceWaitReg.timer);
  voiceWaitReg = null;
}

function counselorKoVoiceStorageKey(counselorName: string): string {
  return `saju_chat_counselor_voice_uri_v1_${counselorName}`;
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

function pickCounselorKoVoice(synth: SpeechSynthesis, counselorName: string): SpeechSynthesisVoice | undefined {
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
    /* ignore */
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

export function stopKoreanSpeech() {
  speakKoreanSessionId += 1;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  clearVoiceWaitRegistration(synth);
  synth.cancel();
}

/** iOS/WebView: 사용자 제스처 직후 호출하면 이후 speechSynthesis·Audio 재생 허용에 도움 */
export async function primeSpeechAudio() {
  if (typeof window === 'undefined') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AnyWin = window as any;
    const AC = window.AudioContext || AnyWin.webkitAudioContext;
    if (AC) {
      const ctx = new AC();
      await ctx.resume();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      const frames = Math.max(1, Math.floor(0.03 * ctx.sampleRate));
      const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(gain);
      src.start();
      src.stop(ctx.currentTime + 0.03);
      await new Promise<void>((r) => window.setTimeout(r, 50));
      await ctx.close();
    }
  } catch {
    /* noop */
  }
  if (window.speechSynthesis) {
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      u.lang = 'ko-KR';
      window.speechSynthesis.speak(u);
      window.speechSynthesis.cancel();
    } catch {
      /* noop */
    }
  }
}

export function speakKoreanQueued(
  text: string,
  options: {
    counselorName?: string;
    interSentencePauseMs?: number;
    onDone?: () => void;
    onChunkError?: () => void;
  },
) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    options.onDone?.();
    return;
  }
  const chunks = splitTtsChunks(text);
  if (!chunks.length) {
    options.onDone?.();
    return;
  }

  speakKoreanSessionId += 1;
  const sessionId = speakKoreanSessionId;
  const counselorName = options.counselorName ?? '도화';
  const pauseMs = options.interSentencePauseMs ?? TTS_INTER_SENTENCE_PAUSE_MS;

  const synth = window.speechSynthesis;
  clearVoiceWaitRegistration(synth);
  if (synth.speaking) synth.cancel();
  try {
    if (synth.paused) synth.resume();
  } catch {
    /* noop */
  }

  const runQueue = (koVoice: SpeechSynthesisVoice | undefined) => {
    const speakAt = (idx: number) => {
      if (sessionId !== speakKoreanSessionId) return;
      if (idx >= chunks.length) {
        options.onDone?.();
        return;
      }
      const utt = new SpeechSynthesisUtterance(chunks[idx]);
      if (koVoice) utt.voice = koVoice;
      utt.lang = 'ko-KR';
      utt.rate = TTS_RATE;
      utt.pitch = TTS_PITCH;
      utt.onend = () => {
        const next = idx + 1;
        if (next >= chunks.length) {
          options.onDone?.();
          return;
        }
        window.setTimeout(() => speakAt(next), pauseMs);
      };
      utt.onerror = () => {
        options.onChunkError?.();
        const next = idx + 1;
        if (next >= chunks.length) {
          options.onDone?.();
          return;
        }
        window.setTimeout(() => speakAt(next), pauseMs);
      };
      window.setTimeout(() => {
        if (sessionId === speakKoreanSessionId) synth.speak(utt);
      }, 0);
    };
    speakAt(0);
  };

  if (synth.getVoices().length === 0) {
    let started = false;
    const start = () => {
      if (sessionId !== speakKoreanSessionId || started) return;
      started = true;
      clearVoiceWaitRegistration(synth);
      runQueue(pickCounselorKoVoice(synth, counselorName));
    };
    const onVoices = () => start();
    const fallbackTimer = window.setTimeout(() => start(), 800);
    voiceWaitReg = { onVoices, timer: fallbackTimer };
    synth.addEventListener('voiceschanged', onVoices);
    return;
  }

  runQueue(pickCounselorKoVoice(synth, counselorName));
}
