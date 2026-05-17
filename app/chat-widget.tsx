/**
 * SAJU-V2 CHAT WIDGET
 * Version: 2.0.3 (Draft-Review-Type & Premium Theme)
 * Last Updated: 2026-05-08
 */
'use client';
import { useState, useRef, useEffect } from 'react';
import {
  COUNSELOR_BROWSER_VOICE_GENDER,
  COUNSELOR_NAMES,
  type CounselorName,
} from '../core/counselor-config';
import {
  SUPPORT_ACCOUNT_HOLDER,
  SUPPORT_ACCOUNT_NO,
  SUPPORT_BANK,
  formatAccountForDisplay,
  supportAccountDigits,
  supportAccountManualCopyHint,
} from '../lib/support-account';

// 한자·괄호 한자 제거 — TTS 전용
function stripHanja(text: string): string {
  return text
    .replace(/\([^)]*[\u4E00-\u9FFF\u3400-\u4DBF][^)]*\)/g, '') // (한자) 괄호째 제거
    .replace(/[\u4E00-\u9FFF\u3400-\u4DBF]/g, '')                // 남은 한자 제거
    .replace(/[*#\-_>`]/g, '')                                  // 마크다운 기호 제거
    .replace(/\s{2,}/g, ' ')                                      // 공백 정리
    .trim();
}

function finalizeKoreanAnswer(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const cleaned = t
    .replace(/[,\-:;~\s]+$/g, '')
    .replace(/(그리고|또한|다만|특히|예를 들면|예를 들어|즉|및)$/g, '')
    .trim();
  if (!cleaned) return t;
  if (/[.!?…]$/.test(cleaned)) return cleaned;
  /** 이미 완결된 어미 — 마침표만 없으면 추가. 불완전 스트림 끝(예: …마음먹)에 억지로 「입니다」를 붙이면 비문이 됨 */
  if (
    /(입니다|입니까|합니다|됩니다|있습니다|없습니다|보입니다|가능합니다|필요합니다|드립니다|맞습니다|같습니다)$/.test(cleaned)
    || /(해요|예요|애요|세요|죠|지요|까요|네요|어요|아요|돼요|ㄹ게요|을게요|할게요|ㄴ데요|거예요|거죠|펼쳐져요|있어요|없어요|같아요|좋아요|맞아요|할 수 있어요|경향이 있어요)$/.test(
      cleaned,
    )
  ) {
    return `${cleaned}.`;
  }
  return cleaned;
}

function addFollowUpPrompt(text: string, userTurn: number): string {
  const normalized = text.trim();
  if (!normalized) return normalized;
  const prompts = [
    '추가로 궁금한 점이 있으면 이어서 물어봐 주세요.',
    '원하시면 연애·직업·재물 중 한 가지를 더 깊게 봐드릴게요.',
    '다른 질문도 괜찮아요. 편하게 이어가세요.',
    '음성으로 질문하려면 마이크 버튼을 누른 뒤 말씀해 주세요.',
  ];
  const prompt = prompts[userTurn % prompts.length];
  return `${normalized}\n\n${prompt}`;
}

/** 한 문장이 이보다 길면 쉼표 등으로 나눈 뒤에만 글자 단위 분할 */
const TTS_HARD_SENTENCE_CAP = 1600;
/** 브라우저 음성: 완성된 문장 단위 재생 후 다음 문장으로 넘어가기 전 멈춤 */
const TTS_INTER_SENTENCE_PAUSE_MS = 1000;
const TTS_RATE = 0.93;
const TTS_PITCH = 1.02;
/** 궁합·관계 모드 기기음성 — 속도를 낮추고 피치는 중립에 가깝게 */
const TTS_RATE_COMPATIBILITY = 0.88;
const TTS_PITCH_COMPATIBILITY = 1.0;
const TTS_INTER_SENTENCE_PAUSE_COMPAT_MS = 1150;
/** 서버 고품질 WAV 재생 미세 감속(차분하게) */
const SERVER_TTS_PLAYBACK_RATE_COMPATIBILITY = 0.94;

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

/** 초장문만 쉼표 단위 → 그래도 길면 글자로 분할(최후 수단). 문장 중간에서 잘리지 않게 우선 시도 */
function splitOversizedSentence(sentence: string): string[] {
  if (sentence.length <= TTS_HARD_SENTENCE_CAP) return [sentence];
  const clauses = sentence.split(/(?<=[,，])\s*/).map((c) => c.trim()).filter(Boolean);
  if (clauses.length > 1) {
    const out: string[] = [];
    let cur = '';
    for (const c of clauses) {
      const joined = cur ? `${cur} ${c}` : c;
      if (joined.length <= TTS_HARD_SENTENCE_CAP) {
        cur = joined;
        continue;
      }
      if (cur) out.push(cur);
      if (c.length <= TTS_HARD_SENTENCE_CAP) {
        cur = c;
        continue;
      }
      for (let i = 0; i < c.length; i += TTS_HARD_SENTENCE_CAP) {
        out.push(c.slice(i, i + TTS_HARD_SENTENCE_CAP));
      }
      cur = '';
    }
    if (cur) out.push(cur);
    return out.length ? out : [sentence.slice(0, TTS_HARD_SENTENCE_CAP)];
  }
  const out: string[] = [];
  for (let i = 0; i < sentence.length; i += TTS_HARD_SENTENCE_CAP) {
    out.push(sentence.slice(i, i + TTS_HARD_SENTENCE_CAP));
  }
  return out;
}

/** 문장(과 초장문 조각)마다 따로 읽고 문장 사이에는 TTS_INTER_SENTENCE_PAUSE_MS 만큼 쉼 */
function splitTtsChunks(text: string): string[] {
  const normalized = stripHanja(text).replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const flat: string[] = [];
  for (const s of splitIntoSentences(normalized)) {
    flat.push(...splitOversizedSentence(s));
  }
  return flat.filter(Boolean);
}

/** 서버 /api/tts 요청당 글자 상한 — 한 요청에는 가능하면 완결된 한 문장만 */
const SERVER_TTS_CHUNK_CHARS = 520;
/** 문장(청크) 단위 재생이 끝난 뒤 다음 요청까지 대기 */
const SERVER_TTS_INTER_CHUNK_MS = 1000;

/** 긴 한 문장만 API 글자 상한 이하로 나눔(쉼표·공백 우선, 마지막만 고정 길이) */
function splitLongSentenceForServer(sentence: string): string[] {
  const max = SERVER_TTS_CHUNK_CHARS;
  const trimmed = sentence.trim();
  if (!trimmed) return [];
  if (trimmed.length <= max) return [trimmed];

  const clauses = trimmed.split(/(?<=[,，])\s*/).map((c) => c.trim()).filter(Boolean);
  if (clauses.length > 1) {
    const out: string[] = [];
    let cur = '';
    for (const c of clauses) {
      const joined = cur ? `${cur} ${c}` : c;
      if (joined.length <= max) {
        cur = joined;
        continue;
      }
      if (cur) out.push(cur);
      if (c.length <= max) {
        cur = c;
        continue;
      }
      out.push(...sliceByWordBoundaryForTts(c, max));
      cur = '';
    }
    if (cur) out.push(cur);
    return out.length ? out : sliceByWordBoundaryForTts(trimmed, max);
  }
  return sliceByWordBoundaryForTts(trimmed, max);
}

function sliceByWordBoundaryForTts(text: string, max: number): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf(' ', max);
    if (cut < Math.floor(max * 0.45)) cut = max;
    const piece = rest.slice(0, cut).trim();
    if (piece) out.push(piece);
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out.filter(Boolean);
}

function splitForServerTts(text: string): string[] {
  const normalized = stripHanja(text).replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  if (normalized.length <= SERVER_TTS_CHUNK_CHARS) return [normalized];

  const sentences = splitIntoSentences(normalized);
  const chunks: string[] = [];
  for (const s of sentences) {
    chunks.push(...splitLongSentenceForServer(s));
  }
  return chunks.filter(Boolean);
}

/** 한글 낭독 가정(배속 1.0 기준 글자/초) — 타이핑 간격을 음성 길이에 맞출 때 사용 */
const SPEECH_BASE_CHARS_PER_SEC = 10.8;
/** 서버 합성음은 브라우저 내장음과 미세하게 다른 경우가 있어 보정 */
const SERVER_SPEECH_CPS_FACTOR = 1.02;

function estimateBrowserSpeechMs(text: string, compatibilityMode = false): number {
  const chunks = splitTtsChunks(text);
  if (!chunks.length) return 0;
  const rate = compatibilityMode ? TTS_RATE_COMPATIBILITY : TTS_RATE;
  const pauseBetween = compatibilityMode ? TTS_INTER_SENTENCE_PAUSE_COMPAT_MS : TTS_INTER_SENTENCE_PAUSE_MS;
  const cps = SPEECH_BASE_CHARS_PER_SEC * rate;
  let ms = 0;
  for (let i = 0; i < chunks.length; i++) {
    ms += (chunks[i].length / cps) * 1000;
    if (i < chunks.length - 1) ms += pauseBetween;
  }
  return ms;
}

function estimateServerSpeechMs(text: string, compatibilityMode = false): number {
  const chunks = splitForServerTts(text);
  if (!chunks.length) return 0;
  const rate = compatibilityMode ? TTS_RATE_COMPATIBILITY : TTS_RATE;
  const cps = SPEECH_BASE_CHARS_PER_SEC * rate * SERVER_SPEECH_CPS_FACTOR;
  const gap = SERVER_TTS_INTER_CHUNK_MS + 72;
  let ms = 0;
  for (let i = 0; i < chunks.length; i++) {
    ms += (chunks[i].length / cps) * 1000;
    if (i < chunks.length - 1) ms += gap;
  }
  if (compatibilityMode && SERVER_TTS_PLAYBACK_RATE_COMPATIBILITY > 0) {
    ms /= SERVER_TTS_PLAYBACK_RATE_COMPATIBILITY;
  }
  return ms;
}

/** 답변 전체 표시 시간 ≈ 선택 모드의 예상 음성 재생 시간 */
function typeIntervalMsForSpeechSync(text: string, mode: 'browser' | 'server', compatibilityMode = false): number {
  const n = text.length;
  if (n <= 0) return 48;
  const total = mode === 'browser'
    ? estimateBrowserSpeechMs(text, compatibilityMode)
    : estimateServerSpeechMs(text, compatibilityMode);
  const perChar = total / n;
  return Math.round(Math.min(220, Math.max(22, perChar)));
}

const TTS_OUTPUT_MODE_KEY = 'saju_chat_tts_output_mode';

/** 무음 WAV — 사용자 탭 직후 play()로 iOS·Android 오디오 잠금 해제 */
const SILENT_WAV_DATA_URL =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';

function isIosLikeDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function hasWebSpeechRecognition(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

function configureMobilePlaybackAudio(el: HTMLAudioElement) {
  el.setAttribute('playsinline', '');
  el.setAttribute('webkit-playsinline', 'true');
  el.preload = 'auto';
}

/** iPhone·iPad 등 — Web Speech 인식 미지원 → 서버 STT(녹음 업로드) */
function shouldUseServerStt(): boolean {
  return isIosLikeDevice();
}

function pickRecordingMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/aac',
  ];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

function hasMediaRecorderStt(): boolean {
  return typeof navigator !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia)
    && typeof MediaRecorder !== 'undefined'
    && Boolean(pickRecordingMimeType());
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result ?? '');
      const comma = dataUrl.indexOf(',');
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

/** iPhone Safari — stop() 직후 첫 dataavailable 전에 끊기면 빈 녹음이 됨 */
const MIN_MEDIA_RECORD_MS = 550;
const MIN_RECORD_BLOB_BYTES = 400;
const MIN_RECORD_BLOB_BYTES_IOS = 180;

type VoiceActivity = {
  phase: 'recording' | 'transcribing' | 'sending';
  detail?: string;
};

function formatVoiceSendingLabel(text: string): string {
  const t = text.trim();
  const shown = t.length > 28 ? `${t.slice(0, 28)}…` : t;
  return `「${shown}」 전송 중…`;
}

function voiceActivityBannerText(activity: VoiceActivity): string {
  if (activity.phase === 'recording') {
    return '🎤 녹음 중 — 1초 이상 말한 뒤 마이크를 다시 눌러 전송하세요';
  }
  if (activity.phase === 'transcribing') {
    return '🔄 음성을 글자로 바꾸는 중…';
  }
  if (activity.detail?.trim()) {
    return formatVoiceSendingLabel(activity.detail);
  }
  return '질문을 전송하는 중…';
}

/** 연속 speak 호출 시 이전 voiceschanged 대기만 무효화 — 안 하면 큐가 두 개 동시에 재생됨 */
let speakKoreanSessionId = 0;
let voiceWaitReg: {
  onVoices: () => void;
  timer: number;
} | null = null;

function clearVoiceWaitRegistration(synth: SpeechSynthesis) {
  if (!voiceWaitReg) return;
  synth.removeEventListener('voiceschanged', voiceWaitReg.onVoices);
  window.clearTimeout(voiceWaitReg.timer);
  voiceWaitReg = null;
}

/** 상담사별 기기 음성 URI — 브라우저마다 목록이 달라 한 번 고르면 localStorage 에 고정 */
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
    /* 사파리 비공개 등 */
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

function speakKoreanQueued(
  text: string,
  options: {
    counselorName: string;
    onDone?: () => void;
    onChunkError?: () => void;
    rate?: number;
    pitch?: number;
    interSentencePauseMs?: number;
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

  const utterRate = options.rate ?? TTS_RATE;
  const utterPitch = options.pitch ?? TTS_PITCH;
  const sentencePause = options.interSentencePauseMs ?? TTS_INTER_SENTENCE_PAUSE_MS;

  speakKoreanSessionId += 1;
  const sessionId = speakKoreanSessionId;

  const synth = window.speechSynthesis;
  clearVoiceWaitRegistration(synth);
  // 새 응답 시작 시에만 이전 발화를 정리한다.
  if (synth.speaking) synth.cancel();
  // Chrome 등에서 큐가 paused로 남아 무음이 되는 경우 방지
  try {
    if (synth.paused) synth.resume();
  } catch {
    /* noop */
  }

  const runQueue = (koVoice: SpeechSynthesisVoice | undefined) => {
    const speakAt = (idx: number) => {
      if (idx >= chunks.length) {
        options?.onDone?.();
        return;
      }
      const utt = new SpeechSynthesisUtterance(chunks[idx]);
      if (koVoice) utt.voice = koVoice;
      utt.lang = 'ko-KR';
      utt.rate = utterRate;
      utt.pitch = utterPitch;
      utt.onend = () => {
        const next = idx + 1;
        if (next >= chunks.length) {
          options?.onDone?.();
          return;
        }
        window.setTimeout(() => speakAt(next), sentencePause);
      };
      // 일부 브라우저에서 중간 오류가 나도 다음 조각으로 이어서 읽는다.
      utt.onerror = () => {
        options?.onChunkError?.();
        const next = idx + 1;
        if (next >= chunks.length) {
          options?.onDone?.();
          return;
        }
        window.setTimeout(() => speakAt(next), sentencePause);
      };
      // cancel 직후 첫 speak가 무시되는 Chrome 동작 회피
      const run = () => {
        synth.speak(utt);
      };
      if (idx === 0) window.setTimeout(run, 0);
      else window.setTimeout(run, 0);
    };
    speakAt(0);
  };

  // 첫 로드 시 getVoices()가 빈 배열인 브라우저(Chrome 등) 대비 (중복 리스너 시 두 목소리 동시 재생 방지)
  if (synth.getVoices().length === 0) {
    let started = false;
    const start = () => {
      if (sessionId !== speakKoreanSessionId || started) return;
      started = true;
      clearVoiceWaitRegistration(synth);
      runQueue(pickCounselorKoVoice(synth, options.counselorName));
    };
    const onVoices = () => start();
    const fallbackTimer = window.setTimeout(() => start(), 800);
    voiceWaitReg = { onVoices, timer: fallbackTimer };
    synth.addEventListener('voiceschanged', onVoices);
    return;
  }

  runQueue(pickCounselorKoVoice(synth, options.counselorName));
}
import { calculate, type SajuResult } from '../core/pillar-calc/main-calculator';
import {
  STEMS, BRANCHES, STEMS_H, BRANCHES_H,
  STEM_ELEM, BRANCH_ELEM, ELEM_NAMES,
} from '../core/pillar-calc/korean-calendar-engine';
import { classifyElements } from '../core/daily-fortune/classifier';

const GENERATES = [1, 2, 3, 4, 0];
/** 스트림 종료 후 검토 연출 — 사주 페이지 askAI(2000ms)와 동일 */
const VERIFY_PAUSE_MS = 2000;
/** 상담 스트리밍 단계 라벨 — AI 심층 풀이 버튼 연출과 통일 */
const CHAT_AI_STEPS = [
  '운명의 기운을 읽는 중...',
  '답변 초안을 작성하는 중...',
  '초안을 검토하고 다듬는 중...',
  '검토를 마치고 화면에 순서대로 보여드리는 중...',
] as const;
const CHAT_STEP_ADVANCE_MS = [3000, 7000] as const; // 2단계, 3단계 진입 타이밍 (askAI 와 동일)
/** 열린 패널 — 하단 FAB 위·상단 여백 (모바일 채팅·입력창 노출) */
const CHAT_PANEL_TOP_OPEN = 'max(4dvh, env(safe-area-inset-top, 0px))';
const CHAT_PANEL_BOTTOM_OPEN = 'calc(92px + env(safe-area-inset-bottom, 0px))';
/** 스트리밍/API 대기 중 — 주기적으로 바뀌며 ‘정지 아님’ 안내 */
const WAIT_CHAT_HINTS = [
  '정지된 것이 아니에요. 사주 맥락을 함께 읽으며 답을 준비하고 있습니다.',
  '답이 길수록 시간이 더 걸릴 수 있어요. 창을 닫지 말고 조금만 기다려 주세요.',
  '연결이 살아 있으면 아래 안내 문구가 가끔 바뀝니다. 그대로 두셔도 됩니다.',
  '보통 수십 초 안에 글이 나오기 시작해요. 첫 글자가 뜰 때까지 잠시만요.',
  '사람이 타이핑하는 속도가 아니라 AI 생성이라 간헐적으로 텀이 길 수 있어요.',
] as const;
/** 타이핑 효과로 글자 찍는 동안 */
const REPLY_TYPING_HINTS = [
  '이번 답변 길이와 고품질/기기 음성 설정을 기준으로 타이핑 간격을 잡았어요. 합성 엔진·브라우저마다 실제 길이는 조금 달라질 수 있어요.',
  '긴 답변은 표시에 시간이 걸려요. 스크롤해 천천히 읽으셔도 돼요.',
  '거의 다 나왔을 거예요. 잠시만 기다려 주세요.',
] as const;
const miniInputStyle = {
  background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 8,
  padding: '8px 10px',
  color: '#e8e8e8',
  fontSize: '.78rem',
  outline: 'none',
};
const miniSelectStyle = {
  ...miniInputStyle,
  cursor: 'pointer' as const,
};

/** 양력 month(1–12)의 말일 */
function daysInSolarMonth(year: number, month: number): number {
  if (!Number.isFinite(year) || month < 1 || month > 12) return 31;
  return new Date(year, month, 0).getDate();
}

const COMPARE_HOUR_VALUES = Array.from({ length: 24 }, (_, i) => i);
const COMPARE_MINUTE_VALUES = Array.from({ length: 60 }, (_, i) => i);
const miniActionBtnStyle = {
  background: 'rgba(232,201,126,.18)',
  border: '1px solid rgba(232,201,126,.32)',
  borderRadius: 8,
  padding: '8px 10px',
  color: '#e8c97e',
  fontSize: '.78rem',
  fontWeight: 700,
  cursor: 'pointer',
};

/** 녹음 재탭 안내까지 대기(ms) — 재생 중단 직후 바로 녹음하면 에코가 나기 쉬워 짧게 띄움 */
const VOICE_SECOND_MIC_HINT_DELAY_MS = 1600;

function typeEffect(
  text: string,
  charIntervalMs: number,
  onUpdate: (t: string) => void,
  onDone?: () => void,
): () => void {
  let index = 0;
  let cancelled = false;
  const timer = setInterval(() => {
    if (cancelled) return;
    if (index < text.length) {
      onUpdate(text.slice(0, index + 1));
      index++;
    } else {
      clearInterval(timer);
      if (!cancelled && onDone) onDone();
    }
  }, charIntervalMs);
  return () => {
    cancelled = true;
    clearInterval(timer);
  };
}

function buildChatContext(r: SajuResult): string {
  const [yp, mp, dp, hp] = r.pillars;
  const ds = dp?.s ?? 0;
  const de = STEM_ELEM[ds];
  const ps = (p: { s: number; b: number } | null) =>
    p ? `${STEMS[p.s]}${BRANCHES[p.b]}(${STEMS_H[p.s]}${BRANCHES_H[p.b]})` : '미입력';

  const weighted = [
    yp && { e: STEM_ELEM[yp.s], w: 1 }, yp && { e: BRANCH_ELEM[yp.b], w: 1 },
    mp && { e: STEM_ELEM[mp.s], w: 1 }, mp && { e: BRANCH_ELEM[mp.b], w: 3 },
    dp && { e: BRANCH_ELEM[dp.b], w: 2 },
    hp && { e: STEM_ELEM[hp.s], w: 1 }, hp && { e: BRANCH_ELEM[hp.b], w: 1 },
  ].filter(Boolean) as { e: number; w: number }[];
  let sup = 0, drn = 0;
  for (const { e, w } of weighted) {
    if (e === de || GENERATES[e] === de) sup += w; else drn += w;
  }
  const isWeak = sup - drn <= 0;
  const cls = classifyElements(ds, isWeak, r.ohaeng.counts);
  const daeun = r.daeun.pillars.slice(0, 5)
    .map((p, i) => `${r.daeun.startAge + i * 10}세: ${STEMS[p.s]}${BRANCHES[p.b]}`).join(' / ');

  return `생년월일: ${r.input.year}년 ${r.input.month}월 ${r.input.day}일 (${r.input.gender}성)
사주: 연주 ${ps(yp)} | 월주 ${ps(mp)} | 일주 ${ps(dp)} | 시주 ${ps(hp)}
일간: ${ELEM_NAMES[de]}(${STEMS[ds]}) | ${isWeak ? '신약(身弱)' : '신강(身强)'}
오행: ${r.ohaeng.counts.map((c, i) => `${ELEM_NAMES[i]} ${c}개`).join(' · ')}
용신(用神): ${ELEM_NAMES[cls.yongsin]}
희신(喜神): ${cls.huisin.map(i => ELEM_NAMES[i]).join('·') || '없음'}
기신(忌神): ${cls.gisin.map(i => ELEM_NAMES[i]).join('·') || '없음'}
대운: ${daeun} (${r.daeun.forward ? '순행' : '역행'})`;
}

function isAbortError(e: unknown): boolean {
  return (
    e instanceof DOMException && e.name === 'AbortError'
  ) || (e instanceof Error && e.name === 'AbortError');
}

const CHAT_PANEL_INTRO_PREFIX = '안녕하세요! AI 심층 상담입니다';

function messagesForChatApi(messages: { role: string; content: string }[]): { role: string; content: string }[] {
  return messages.filter((m) => typeof m.content === 'string' && m.content.trim().length > 0);
}

/** UI 인트로 말풍선은 API에 넣지 않음 — 스트림 실패·토큰 낭비 방지 */
function snapshotToApiMessages(messages: { role: string; content: string }[]): { role: string; content: string }[] {
  return messagesForChatApi(messages).filter(
    (m) => !(m.role === 'assistant' && m.content.startsWith(CHAT_PANEL_INTRO_PREFIX)),
  );
}

/** fortune-stream 과 같은 prefix 우선 — chat/consult 는 차단 목록에 걸리기 쉬움 */
const CONSULT_API_PATHS = ['/api/fortune-reply', '/api/saju-counsel', '/api/consult'] as const;
const CONSULT_FETCH_MS = 90_000;

function parseConsultResponseBody(raw: string, contentType: string): string {
  if (contentType.includes('text/event-stream') || raw.trimStart().startsWith('data:')) {
    let combined = '';
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.replace(/^data:\s*/, '').trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
        };
        const part = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content ?? '';
        if (typeof part === 'string' && part) combined += part;
      } catch {
        /* skip malformed chunk */
      }
    }
    return combined;
  }
  const data = JSON.parse(raw) as { content?: string; error?: string };
  if (data.error) throw new Error(data.error);
  return typeof data.content === 'string' ? data.content : '';
}

async function fetchConsultOnce(
  apiPath: string,
  apiMessages: { role: string; content: string }[],
  sajuContext: string,
  options: { chatMode: 'single' | 'compatibility'; compareSajuContext?: string; counselorName: string },
  signal?: AbortSignal,
): Promise<string> {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? '';
  const res = await fetch(`${base}${apiPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    cache: 'no-store',
    credentials: 'same-origin',
    signal,
    body: JSON.stringify({
      messages: apiMessages,
      sajuContext,
      chatMode: options.chatMode,
      compareSajuContext: options.compareSajuContext ?? '',
      counselorName: options.counselorName,
      stream: false,
    }),
  });

  const raw = await res.text();
  const contentType = res.headers.get('content-type') ?? '';
  if (!res.ok) {
    try {
      const errJson = JSON.parse(raw) as { error?: string };
      throw new Error(errJson.error ?? `연결 실패 (${res.status})`);
    } catch (e) {
      if (e instanceof Error && e.message && !e.message.startsWith('연결 실패')) throw e;
      throw new Error(`연결 실패 (${res.status})`);
    }
  }

  const text = parseConsultResponseBody(raw, contentType);
  if (!text.trim()) throw new Error('빈 응답');
  return text;
}

async function fetchChatComplete(
  apiMessages: { role: string; content: string }[],
  sajuContext: string,
  options: { chatMode: 'single' | 'compatibility'; compareSajuContext?: string; counselorName: string },
  signal?: AbortSignal,
): Promise<string> {
  if (!apiMessages.length) throw new Error('보낼 메시지가 없습니다');

  let lastErr: Error | null = null;
  for (const apiPath of CONSULT_API_PATHS) {
    try {
      return await fetchConsultOnce(apiPath, apiMessages, sajuContext, options, signal);
    } catch (e) {
      if (signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) throw e;
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }

  const blockedHint = lastErr instanceof TypeError
    ? ' (광고·추적 차단 확장 프로그램이 요청을 막았을 수 있습니다.)'
    : '';
  throw new Error((lastErr?.message ?? '상담 서버에 연결하지 못했습니다') + blockedHint);
}

function buildCompatibilityContext(primary: SajuResult, compare: SajuResult): string {
  return `비교 모드(궁합/관계) 분석입니다.

【A 대상(기준 사용자)】
${buildChatContext(primary)}

【B 대상(비교 사용자)】
${buildChatContext(compare)}

아래 항목 중심으로 비교 분석:
- 관계 강점 3가지
- 충돌 패턴 3가지
- 소통 방식 차이와 보완 팁
- 현실 적용 조언(연애/결혼/업무 협업 관점)`;
}

function getTargetKey(r: SajuResult | null): string {
  if (!r) return 'unknown';
  return `${r.input.year}-${r.input.month}-${r.input.day}-${r.input.gender}`;
}

interface Msg { role: 'user' | 'assistant'; content: string; }
interface CompareForm {
  year: string;
  month: string;
  day: string;
  /** '' = 출생 시각 모름 → calculate 에 hourTotalMin -1 */
  hour: string;
  /** 시를 알 때만 사용; 빈 문자열이면 0분으로 간주 */
  minute: string;
  gender: '남' | '여';
}

export default function ChatWidget({
  result,
  aiSummaryReady,
}: {
  result: SajuResult | null;
  aiSummaryReady: boolean;
}) {
  const [open, setOpen]       = useState(false);
  const [msgs, setMsgs]       = useState<Msg[]>([]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [chatMode, setChatMode] = useState<'single' | 'compatibility'>('single');
  const [compareForm, setCompareForm] = useState<CompareForm>({
    year: '',
    month: '',
    day: '',
    hour: '',
    minute: '',
    gender: '여',
  });
  const [compareResult, setCompareResult] = useState<SajuResult | null>(null);
  const [compareError, setCompareError] = useState('');
  const [showCompareForm, setShowCompareForm] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  /** 서버 TTS 재생용 — 사용자 제스처로 한 번 unlock 후 동일 요소 재사용(iOS 필수) */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsBlobUrlRef = useRef<string | null>(null);
  /** 정지·새 재생 시 이전 비동기 TTS 루프 무효화 */
  const speakGenRef = useRef(0);
  const ttsFetchAbortRef = useRef<AbortController | null>(null);
  const introTtsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLockRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef  = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStartedAtRef = useRef(0);
  const recordStopDelayTimerRef = useRef<number | null>(null);
  const recordMaxTimerRef = useRef<number | null>(null);
  /** 타이핑 연출 중단 시 interval 해제 */
  const typeCancelRef = useRef<(() => void) | null>(null);
  /** 타이핑 중단 시 마지막 메시지를 전체 본문으로 복구 */
  const pendingAssistantFullRef = useRef<string | null>(null);
  const voiceSecondMicHintTimerRef = useRef<number | null>(null);
  /** 인터럽트 직후 🔁 마지막 답변 버튼용 본문 — msgs 와 동기화해 폴백 */
  const msgsRef = useRef<Msg[]>([]);
  const replayLastAnswerPayloadRef = useRef<string | null>(null);
  const [replayOffered, setReplayOffered] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [voiceActivity, setVoiceActivity] = useState<VoiceActivity | null>(null);
  const [sttTranscribing, setSttTranscribing] = useState(false);
  /** iPhone 등 자동 재생 실패 시 「답변 듣기」용 */
  const [answerPlayOffer, setAnswerPlayOffer] = useState<string | null>(null);
  const [progressHintIdx, setProgressHintIdx] = useState(0);
  const [replyTyping, setReplyTyping] = useState(false);
  /** 1~3: 스트림·검토 연출, 4: 타이핑 출력 (사주 페이지 AI 풀이 단계와 동일 흐름) */
  const [chatLoadingStep, setChatLoadingStep] = useState(0);
  /** 새 전송 시 이전 스트림·연출 무시 */
  const chatTurnGenRef = useRef(0);
  const chatStreamAbortRef = useRef<AbortController | null>(null);
  /** 스트리밍 중 마지막 assistant 버블과 동기화(중단 시 부분 본문 밀봉) */
  const chatStreamingDraftRef = useRef('');
  const chatStepTimersRef = useRef<{ t1: number | null; t2: number | null }>({ t1: null, t2: null });
  const verifyPauseTimerRef = useRef<number | null>(null);

  function clearChatStepTimers() {
    const { t1, t2 } = chatStepTimersRef.current;
    if (t1 != null) window.clearTimeout(t1);
    if (t2 != null) window.clearTimeout(t2);
    chatStepTimersRef.current = { t1: null, t2: null };
  }

  function clearVerifyPauseTimer() {
    if (verifyPauseTimerRef.current != null) {
      window.clearTimeout(verifyPauseTimerRef.current);
      verifyPauseTimerRef.current = null;
    }
  }

  const ttsPrimedRef = useRef(false);
  const targetKey = getTargetKey(result);
  const canStartCounseling = Boolean(result && aiSummaryReady);
  const [wakeLockEnabled, setWakeLockEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedCounselor, setSelectedCounselor] = useState<string>('도화');
  const [introSpoken, setIntroSpoken] = useState(false);
  const [supportCopyFeedback, setSupportCopyFeedback] = useState<'idle' | 'ok' | 'err'>('idle');
  const supportCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 서버 Gemini 음성 우선 — 실패 시에만 브라우저로 폴백 */
  const [ttsOutputMode, setTtsOutputMode] = useState<'server' | 'browser'>(() => {
    if (typeof window === 'undefined') return 'server';
    try {
      const v = localStorage.getItem(TTS_OUTPUT_MODE_KEY);
      return v === 'browser' ? 'browser' : 'server';
    } catch {
      return 'server';
    }
  });

  const compareYearParsed = Number(compareForm.year);
  const compareMonthParsed = Number(compareForm.month);
  const compareSolarMaxDay =
    Number.isInteger(compareYearParsed) && compareYearParsed >= 1900 && compareYearParsed <= 2100
    && Number.isInteger(compareMonthParsed) && compareMonthParsed >= 1 && compareMonthParsed <= 12
      ? daysInSolarMonth(compareYearParsed, compareMonthParsed)
      : 31;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  useEffect(() => {
    if (voiceActivity || voiceNote) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [voiceActivity, voiceNote]);

  useEffect(() => {
    msgsRef.current = msgs;
  }, [msgs]);

  /** AI 심층 풀이가 초기화되면 상담 패널·대화를 닫아 다시 풀이 완료 후에만 이용하도록 함 */
  useEffect(() => {
    if (!aiSummaryReady) {
      chatStreamAbortRef.current?.abort();
      chatStreamAbortRef.current = null;
      setOpen(false);
      setIntroSpoken(false);
      setMsgs([]);
      setReplayOffered(false);
      replayLastAnswerPayloadRef.current = null;
      setLoading(false);
      setReplyTyping(false);
    }
  }, [aiSummaryReady]);

  useEffect(() => {
    if (!open) {
      setReplayOffered(false);
      replayLastAnswerPayloadRef.current = null;
    }
  }, [open]);

  useEffect(() => () => {
    if (supportCopyTimerRef.current) clearTimeout(supportCopyTimerRef.current);
    if (voiceSecondMicHintTimerRef.current) {
      clearTimeout(voiceSecondMicHintTimerRef.current);
      voiceSecondMicHintTimerRef.current = null;
    }
    typeCancelRef.current?.();
    typeCancelRef.current = null;
    chatStreamAbortRef.current?.abort();
    chatStreamAbortRef.current = null;
    clearChatStepTimers();
    clearVerifyPauseTimer();
    if (introTtsTimerRef.current) {
      clearTimeout(introTtsTimerRef.current);
      introTtsTimerRef.current = null;
    }
    ttsFetchAbortRef.current?.abort();
    ttsFetchAbortRef.current = null;
  }, []);

  useEffect(() => {
    if (!loading && !replyTyping) return;
    setProgressHintIdx(0);
    const id = window.setInterval(() => {
      setProgressHintIdx((n) => n + 1);
    }, 5200);
    return () => window.clearInterval(id);
  }, [loading, replyTyping]);

  async function requestWakeLock() {
    if (!wakeLockEnabled || typeof window === 'undefined') return;
    try {
      const w = window as any;
      if (!w.navigator?.wakeLock?.request) return;
      wakeLockRef.current = await w.navigator.wakeLock.request('screen');
      wakeLockRef.current?.addEventListener?.('release', () => {
        wakeLockRef.current = null;
      });
    } catch {
      // 권한/브라우저 제한은 무시하고 진행
    }
  }

  async function releaseWakeLock() {
    try {
      await wakeLockRef.current?.release?.();
    } catch {
      // noop
    } finally {
      wakeLockRef.current = null;
    }
  }

  function getOrCreatePlaybackAudio(): HTMLAudioElement {
    if (!audioRef.current) {
      const a = new Audio();
      configureMobilePlaybackAudio(a);
      audioRef.current = a;
    }
    return audioRef.current;
  }

  function revokeTtsBlobUrl() {
    if (ttsBlobUrlRef.current) {
      URL.revokeObjectURL(ttsBlobUrlRef.current);
      ttsBlobUrlRef.current = null;
    }
  }

  /** 전송·패널 열기·마이크 탭 등 사용자 제스처 안에서 호출 — 모바일 TTS 재생 잠금 해제 */
  async function primeMediaForTts() {
    if (typeof window === 'undefined') return;
    const audio = getOrCreatePlaybackAudio();
    try {
      revokeTtsBlobUrl();
      audio.src = SILENT_WAV_DATA_URL;
      const prevVol = audio.volume;
      audio.volume = 0.01;
      audio.currentTime = 0;
      await audio.play();
      audio.pause();
      audio.volume = prevVol > 0 ? prevVol : 1;
    } catch {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const AnyWin = window as any;
        const AC = window.AudioContext || AnyWin.webkitAudioContext;
        if (AC) {
          const ctx = new AC();
          await ctx.resume();
          await ctx.close();
        }
      } catch {
        /* noop */
      }
    }
    ttsPrimedRef.current = true;
  }

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && isSpeaking && wakeLockEnabled) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isSpeaking, wakeLockEnabled]);

  useEffect(() => {
    if (!wakeLockEnabled) {
      releaseWakeLock();
      return;
    }
    if (isSpeaking) requestWakeLock();
    return () => { releaseWakeLock(); };
  }, [wakeLockEnabled, isSpeaking]);

  useEffect(() => {
    if (typeof window === 'undefined' || !result) {
      setIntroSpoken(false);
      return;
    }
    setIntroSpoken(false);

    const counselorKey = `saju_chat_counselor_${targetKey}`;
    const saved = localStorage.getItem(counselorKey);
    if (saved && (COUNSELOR_NAMES as readonly string[]).includes(saved)) {
      setSelectedCounselor(saved);
    } else {
      const counselor = COUNSELOR_NAMES[Math.floor(Math.random() * COUNSELOR_NAMES.length)];
      localStorage.setItem(counselorKey, counselor);
      setSelectedCounselor(counselor);
    }
  }, [result, targetKey]);

  function analyzeCompareTarget() {
    if (!compareForm.year || !compareForm.month || !compareForm.day) {
      setCompareError('비교 대상의 생년월일(양력)을 입력해 주세요.');
      return;
    }
    const y = Number(compareForm.year);
    const m = Number(compareForm.month);
    const d = Number(compareForm.day);
    if (!Number.isInteger(y) || y < 1900 || y > 2100 || !Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(d) || d < 1) {
      setCompareError('비교 대상 날짜가 올바르지 않습니다.');
      return;
    }
    const maxDay = daysInSolarMonth(y, m);
    if (d > maxDay) {
      setCompareError(`${y}년 ${m}월은 ${maxDay}일까지 있습니다. 날짜를 확인해 주세요.`);
      return;
    }

    let hourTotalMin = -1;
    if (compareForm.hour !== '') {
      const h = Number(compareForm.hour);
      const mi = compareForm.minute === '' ? 0 : Number(compareForm.minute);
      if (
        !Number.isInteger(h) || h < 0 || h > 23
        || !Number.isInteger(mi) || mi < 0 || mi > 59
      ) {
        setCompareError('태어난 시·분을 확인해 주세요.');
        return;
      }
      hourTotalMin = h * 60 + mi;
    }
    try {
      const r = calculate({
        year: y,
        month: m,
        day: d,
        hourTotalMin,
        gender: compareForm.gender,
      });
      setCompareResult(r);
      setCompareError('');
      setShowCompareForm(false);
      setMsgs(prev => [...prev, {
        role: 'assistant',
        content: `${y}년생 ${compareForm.gender}성 비교 대상이 추가되었습니다. 이제 궁합/비교 질문을 해주세요.`,
      }]);
    } catch {
      setCompareError('비교 대상 분석 중 오류가 발생했습니다.');
    }
  }

  async function copySupportAccountNumber() {
    const digits = supportAccountDigits(SUPPORT_ACCOUNT_NO);
    if (!digits) return;
    if (supportCopyTimerRef.current) clearTimeout(supportCopyTimerRef.current);
    try {
      await navigator.clipboard.writeText(digits);
      setSupportCopyFeedback('ok');
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = digits;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const execOk = document.execCommand('copy');
        document.body.removeChild(ta);
        if (execOk) {
          setSupportCopyFeedback('ok');
        } else {
          setSupportCopyFeedback('err');
          window.alert(supportAccountManualCopyHint(digits));
        }
      } catch {
        setSupportCopyFeedback('err');
        window.alert(supportAccountManualCopyHint(digits));
      }
    }
    supportCopyTimerRef.current = setTimeout(() => {
      setSupportCopyFeedback('idle');
      supportCopyTimerRef.current = null;
    }, 2400);
  }

  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{
        role: 'assistant',
        content: result
          ? `안녕하세요! AI 심층 상담입니다.\n이번 세션의 배정 상담사는 『${selectedCounselor}』입니다. 생년월일·성별 조합이 같은 동안은 같은 분이 끝까지 해설해 드려요.\n${result.input.year}년생 ${result.input.gender}성분의 사주를 분석했습니다.\n질문은 텍스트·음성 모두 가능해요. 마이크로 말해 질문할 수 있습니다(iPhone·iPad는 말한 뒤 마이크를 다시 눌러 전송). 답변은 음성으로 들을 수 있으며, 소리가 없으면 「🔊 답변 듣기」를 눌러 주세요.\nAI 심층 풀이가 모두 표시된 뒤부터 바로 상담을 이용하실 수 있습니다.\n서버·운영 비용은 채팅 상단 안내에 따라 선택 후원으로 도와주실 수 있어요. 후원 없이도 상담 이용에는 제한이 없습니다.`
          : '안녕하세요! 먼저 위에서 사주 분석을 완료해주세요.',
      }]);
    }
  }, [open, result, selectedCounselor]);

  useEffect(() => {
    if (!open || !result || introSpoken || !canStartCounseling) return;
    setIntroSpoken(true);
    /** iOS는 useEffect 시점에 오디오 정책이 막혀 인트로 TTS가 실패하는 경우가 많아 생략 */
    if (isIosLikeDevice()) return;
    if (introTtsTimerRef.current) clearTimeout(introTtsTimerRef.current);
    introTtsTimerRef.current = setTimeout(() => {
      introTtsTimerRef.current = null;
      if (!open) return;
      const intro = `${selectedCounselor} 상담사가 이 세션 내내 함께합니다. 궁금한 점을 편하게 물어보세요.`;
      void speakWithPreferredMode(intro, selectedCounselor);
    }, 1800);
    return () => {
      if (introTtsTimerRef.current) {
        clearTimeout(introTtsTimerRef.current);
        introTtsTimerRef.current = null;
      }
    };
  }, [open, result, canStartCounseling, introSpoken, selectedCounselor]);

  useEffect(() => {
    if (chatMode === 'single') return;
    if (compareResult) return;
    setShowCompareForm(true);
  }, [chatMode, compareResult]);

  useEffect(() => {
    if (chatMode === 'single') {
      setCompareError('');
    }
  }, [chatMode]);

  function setAssistantError(content: string) {
    setMsgs((prev) => {
      const u = [...prev];
      if (u.length && u[u.length - 1].role === 'assistant') {
        u[u.length - 1] = { role: 'assistant', content };
      }
      return u;
    });
  }

  function applyConsultReply(
    assistantText: string,
    turnGen: number,
    snapshotForStream: Msg[],
  ) {
    if (turnGen !== chatTurnGenRef.current) return;

    setLoading(false);
    setVoiceActivity(null);
    setVoiceNote(null);
    setChatLoadingStep(0);
    clearVerifyPauseTimer();

    const streamed = assistantText.trim();
    if (!streamed) {
      setAssistantError('답변을 불러오지 못했습니다. 다시 질문해 주세요.');
      setReplyTyping(false);
      return;
    }

    const userTurn = snapshotForStream.filter((m) => m.role === 'user').length;
    const finalized = addFollowUpPrompt(
      finalizeKoreanAnswer(streamed) || streamed,
      userTurn,
    );
    if (!finalized.trim()) {
      setAssistantError('답변을 불러오지 못했습니다. 다시 질문해 주세요.');
      setReplyTyping(false);
      return;
    }

    pendingAssistantFullRef.current = finalized;
    const shortReply = finalized.length > 0 && finalized.length <= 320;

    if (isIosLikeDevice()) {
      setAnswerPlayOffer(finalized);
      void primeMediaForTts().then(() => {
        void speakWithPreferredMode(finalized, selectedCounselor);
      });
    } else {
      void speakWithPreferredMode(finalized, selectedCounselor);
    }

    typeCancelRef.current?.();
    typeCancelRef.current = null;

    if (shortReply) {
      setMsgs((prev) => {
        const u = [...prev];
        if (u.length && u[u.length - 1].role === 'assistant') {
          u[u.length - 1] = { role: 'assistant', content: finalized };
        }
        return u;
      });
      setReplyTyping(false);
      pendingAssistantFullRef.current = null;
      return;
    }

    setReplyTyping(true);
    const syncMs = typeIntervalMsForSpeechSync(
      finalized,
      ttsOutputMode,
      chatMode === 'compatibility',
    );
    typeCancelRef.current = typeEffect(finalized, syncMs, (typed) => {
      if (turnGen !== chatTurnGenRef.current) return;
      setMsgs((prev) => {
        const u = [...prev];
        if (u.length && u[u.length - 1].role === 'assistant') {
          u[u.length - 1] = { role: 'assistant', content: typed };
        }
        return u;
      });
    }, () => {
      if (turnGen !== chatTurnGenRef.current) return;
      setReplyTyping(false);
      typeCancelRef.current = null;
      pendingAssistantFullRef.current = null;
    });
  }

  async function send(text: string = input, options?: { fromVoice?: boolean }) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!result) {
      setVoiceNote('먼저 사주 분석을 완료해 주세요.');
      setVoiceActivity(null);
      return;
    }
    if (!aiSummaryReady) {
      setVoiceNote('먼저 AI 심층 풀이를 끝까지 확인한 뒤 상담을 이용할 수 있어요.');
      setVoiceActivity(null);
      return;
    }
    void primeMediaForTts();
    if (chatMode === 'compatibility' && !compareResult) {
      setMsgs(prev => [...prev, {
        role: 'assistant',
        content: '궁합/비교 모드를 사용하려면 먼저 비교 대상 1명을 추가해 주세요.',
      }]);
      return;
    }

    chatTurnGenRef.current += 1;
    const turnGen = chatTurnGenRef.current;

    const sealPartial = chatStreamingDraftRef.current.trim();
    chatStreamingDraftRef.current = '';

    chatStreamAbortRef.current?.abort();
    const ac = new AbortController();
    chatStreamAbortRef.current = ac;

    clearVerifyPauseTimer();
    clearChatStepTimers();
    if (introTtsTimerRef.current) {
      clearTimeout(introTtsTimerRef.current);
      introTtsTimerRef.current = null;
    }

    stopTTS();
    typeCancelRef.current?.();
    typeCancelRef.current = null;

    const finalizeTyping = pendingAssistantFullRef.current;
    pendingAssistantFullRef.current = null;
    setReplyTyping(false);

    if (options?.fromVoice) {
      const sendingLabel = formatVoiceSendingLabel(trimmed);
      setVoiceNote(sendingLabel);
      setVoiceActivity({ phase: 'sending', detail: trimmed });
    } else {
      setVoiceNote(null);
      setVoiceActivity(null);
    }
    if (voiceSecondMicHintTimerRef.current) {
      clearTimeout(voiceSecondMicHintTimerRef.current);
      voiceSecondMicHintTimerRef.current = null;
    }
    setReplayOffered(false);
    replayLastAnswerPayloadRef.current = null;
    setAnswerPlayOffer(null);

    const userMsg: Msg = { role: 'user', content: trimmed };

    let snapshotForStream: Msg[] = [];
    setMsgs((prev): Msg[] => {
      let base: Msg[] = [...prev];
      const last = base[base.length - 1];
      if (finalizeTyping !== null && last?.role === 'assistant') {
        base = [...base.slice(0, -1), { role: 'assistant', content: finalizeTyping }];
      } else if (last?.role === 'assistant') {
        const trimmedLast = last.content.trim();
        if (sealPartial) {
          base = [...base.slice(0, -1), { role: 'assistant', content: finalizeKoreanAnswer(sealPartial) }];
        } else if (!trimmedLast) {
          base = base.slice(0, -1);
        }
      }
      const next: Msg[] = [...base, userMsg, { role: 'assistant', content: '' }];
      snapshotForStream = next;
      return next;
    });

    if (!snapshotForStream.length) {
      setLoading(false);
      setChatLoadingStep(0);
      return;
    }

    setInput('');
    setLoading(true);
    setChatLoadingStep(1);
    if (options?.fromVoice) {
      setVoiceNote(formatVoiceSendingLabel(trimmed));
    }

    const sajuContext = buildChatContext(result);
    const compareSajuContext = compareResult ? buildCompatibilityContext(result, compareResult) : undefined;
    const apiMessages = snapshotToApiMessages(
      snapshotForStream.map((m) => ({ role: m.role, content: m.content })),
    );
    if (!apiMessages.length) {
      setLoading(false);
      setChatLoadingStep(0);
      setMsgs((prev) => {
        const u = [...prev];
        if (u.length && u[u.length - 1].role === 'assistant') {
          u[u.length - 1] = {
            role: 'assistant',
            content: '보낼 메시지가 없습니다. 다시 입력해 주세요.',
          };
        }
        return u;
      });
      return;
    }
    let streamFinished = false;

    chatStepTimersRef.current.t1 = window.setTimeout(() => {
      if (turnGen !== chatTurnGenRef.current || streamFinished) return;
      setChatLoadingStep(2);
    }, CHAT_STEP_ADVANCE_MS[0]);
    chatStepTimersRef.current.t2 = window.setTimeout(() => {
      if (turnGen !== chatTurnGenRef.current || streamFinished) return;
      setChatLoadingStep(3);
    }, CHAT_STEP_ADVANCE_MS[1]);

    const consultTimeoutId = window.setTimeout(() => {
      if (!ac.signal.aborted) ac.abort();
    }, CONSULT_FETCH_MS);
    let assistantText = '';
    try {
      assistantText = await fetchChatComplete(
        apiMessages,
        sajuContext,
        {
          chatMode,
          compareSajuContext,
          counselorName: selectedCounselor,
        },
        ac.signal,
      );
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (turnGen === chatTurnGenRef.current) {
        streamFinished = true;
        clearChatStepTimers();
        clearVerifyPauseTimer();
        setChatLoadingStep(0);
        setLoading(false);
        setVoiceActivity(null);
        setVoiceNote(null);
        setReplyTyping(false);
        typeCancelRef.current = null;
        pendingAssistantFullRef.current = null;
        if (isAbort) {
          setAssistantError('요청 시간이 초과되었거나 중단되었습니다. 다시 질문해 주세요.');
        } else {
          const errorDetail = err instanceof Error ? err.message : String(err);
          setAssistantError(`오류가 발생했습니다: ${errorDetail}`);
        }
      }
      return;
    } finally {
      window.clearTimeout(consultTimeoutId);
    }

    streamFinished = true;
    chatStreamingDraftRef.current = '';
    clearChatStepTimers();
    applyConsultReply(assistantText, turnGen, snapshotForStream);
  }

  function stopRecordingTracks() {
    recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordStreamRef.current = null;
  }

  function clearRecordStopDelayTimer() {
    if (recordStopDelayTimerRef.current != null) {
      window.clearTimeout(recordStopDelayTimerRef.current);
      recordStopDelayTimerRef.current = null;
    }
  }

  function finishMediaRecording() {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== 'recording') return;
    try {
      mr.requestData();
    } catch {
      /* noop */
    }
    try {
      mr.stop();
    } catch {
      /* noop */
    }
  }

  function abortMediaRecording() {
    clearRecordStopDelayTimer();
    if (recordMaxTimerRef.current != null) {
      window.clearTimeout(recordMaxTimerRef.current);
      recordMaxTimerRef.current = null;
    }
    try {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    } catch {
      /* noop */
    }
    mediaRecorderRef.current = null;
    recordChunksRef.current = [];
    recordStartedAtRef.current = 0;
    stopRecordingTracks();
  }

  async function transcribeAudioOnServer(audioBase64: string, mimeType: string): Promise<string> {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? '';
    const res = await fetch(`${base}/api/stt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, mimeType }),
    });
    const data = await res.json() as { transcript?: string; error?: string };
    if (!res.ok) throw new Error(data.error ?? 'STT 실패');
    return (data.transcript ?? '').trim().replace(/^["'「]|["'」]$/g, '');
  }

  async function onMediaRecordingStopped(mimeType: string) {
    stopRecordingTracks();
    setListening(false);
    mediaRecorderRef.current = null;

    const chunks = recordChunksRef.current;
    recordChunksRef.current = [];
    if (!chunks.length) {
      setVoiceActivity(null);
      setVoiceNote('녹음된 소리가 없습니다. 마이크를 누른 뒤 1초 이상 말하고 다시 눌러 주세요.');
      return;
    }

    const blob = new Blob(chunks, { type: mimeType });
    const actualMime = (blob.type || mimeType).trim() || mimeType;
    const minBytes = isIosLikeDevice() ? MIN_RECORD_BLOB_BYTES_IOS : MIN_RECORD_BLOB_BYTES;
    if (blob.size < minBytes) {
      setVoiceActivity(null);
      setVoiceNote('말씀이 너무 짧게 녹음되었습니다. 마이크를 누른 뒤 1초 정도 말하고 다시 눌러 전송해 주세요.');
      return;
    }

    setSttTranscribing(true);
    setVoiceActivity({ phase: 'transcribing' });
    setVoiceNote('말씀을 글자로 바꾸는 중…');
    try {
      const audioBase64 = await blobToBase64(blob);
      const transcript = await transcribeAudioOnServer(audioBase64, actualMime);
      if (transcript) {
        setInput(transcript);
        void send(transcript, { fromVoice: true });
      } else {
        setVoiceActivity(null);
        setVoiceNote('인식된 말이 없습니다. 마이크를 누른 뒤 1초 정도 말하고 다시 눌러 전송해 주세요.');
      }
    } catch (e) {
      setVoiceActivity(null);
      const msg = e instanceof Error ? e.message : '';
      setVoiceNote(
        msg.includes('한도')
          ? msg
          : '음성 인식에 실패했습니다. 네트워크를 확인하고 다시 시도해 주세요.',
      );
    } finally {
      setSttTranscribing(false);
    }
  }

  async function startMediaRecording() {
    const mimeType = pickRecordingMimeType();
    if (!mimeType) {
      setVoiceNote('이 기기에서는 마이크 녹음을 지원하지 않습니다.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      recordChunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        window.setTimeout(() => {
          void onMediaRecordingStopped(mimeType);
        }, isIosLikeDevice() ? 120 : 40);
      };
      mr.onerror = () => {
        abortMediaRecording();
        setListening(false);
        setVoiceNote('녹음 중 오류가 발생했습니다. 다시 시도해 주세요.');
      };
      recordStartedAtRef.current = Date.now();
      if (isIosLikeDevice()) {
        mr.start();
      } else {
        mr.start(200);
      }
      setListening(true);
      setVoiceActivity({ phase: 'recording' });
      setVoiceNote('🎤 녹음 중 — 1초 이상 말한 뒤 마이크를 다시 눌러 전송하세요.');
      recordMaxTimerRef.current = window.setTimeout(() => {
        recordMaxTimerRef.current = null;
        finishMediaRecording();
      }, 60_000);
    } catch {
      abortMediaRecording();
      setListening(false);
      setVoiceNote('마이크 사용이 거부되었습니다. 설정에서 마이크를 허용해 주세요.');
    }
  }

  function handleVoiceInterruptWhilePlaying() {
    if (voiceSecondMicHintTimerRef.current) {
      clearTimeout(voiceSecondMicHintTimerRef.current);
      voiceSecondMicHintTimerRef.current = null;
    }
    stopTTS();
    typeCancelRef.current?.();
    typeCancelRef.current = null;
    const full = pendingAssistantFullRef.current;
    pendingAssistantFullRef.current = null;
    if (full !== null) {
      setMsgs((prev) => {
        const u = [...prev];
        if (u.length && u[u.length - 1].role === 'assistant') {
          u[u.length - 1] = { role: 'assistant', content: full };
        }
        return u;
      });
    }
    let replayText = '';
    if (full !== null) replayText = full.trim();
    else {
      const lastAsst = [...msgsRef.current].reverse().find(m => m.role === 'assistant');
      replayText = (lastAsst?.content ?? '').trim();
    }
    replayLastAnswerPayloadRef.current = replayText || null;
    setReplayOffered(Boolean(replayText));
    setReplyTyping(false);
    setChatLoadingStep(0);
    setVoiceNote(null);
    voiceSecondMicHintTimerRef.current = window.setTimeout(() => {
      voiceSecondMicHintTimerRef.current = null;
      setVoiceNote(
        '재생을 멈췄어요. 다른 질문은 마이크를 다시 눌러 말씀해 주세요. 질문이 없으면 상단 「🔁 마지막 답변」버튼으로 이어 들을 수 있어요.',
      );
    }, VOICE_SECOND_MIC_HINT_DELAY_MS);
  }

  function toggleVoice() {
    if (typeof window === 'undefined') return;
    void primeMediaForTts();
    if (!window.isSecureContext) {
      setVoiceNote('음성 입력은 보안 연결(HTTPS)에서만 동작합니다.');
      return;
    }
    if (sttTranscribing) return;
    if (loading) {
      setVoiceNote('답변을 받는 중입니다. 잠시 후 다시 눌러 주세요.');
      return;
    }
    if (!result) return;
    if (!aiSummaryReady) {
      setVoiceNote('먼저 AI 심층 풀이를 끝까지 확인한 뒤 음성 질문을 사용할 수 있어요.');
      return;
    }
    if (isSpeaking || replyTyping) {
      handleVoiceInterruptWhilePlaying();
      return;
    }

    if (shouldUseServerStt() && hasMediaRecorderStt()) {
      if (listening) {
        if (recordMaxTimerRef.current != null) {
          window.clearTimeout(recordMaxTimerRef.current);
          recordMaxTimerRef.current = null;
        }
        const elapsed = Date.now() - recordStartedAtRef.current;
        const waitMs = MIN_MEDIA_RECORD_MS - elapsed;
        if (mediaRecorderRef.current?.state === 'recording' && waitMs > 0) {
          setVoiceActivity({ phase: 'recording' });
          setVoiceNote('조금만 더 말씀해 주세요… 곧 전송합니다.');
          clearRecordStopDelayTimer();
          recordStopDelayTimerRef.current = window.setTimeout(() => {
            recordStopDelayTimerRef.current = null;
            finishMediaRecording();
          }, waitMs);
          return;
        }
        if (mediaRecorderRef.current?.state === 'recording') {
          finishMediaRecording();
        } else {
          abortMediaRecording();
          setListening(false);
        }
        return;
      }
      if (voiceSecondMicHintTimerRef.current) {
        clearTimeout(voiceSecondMicHintTimerRef.current);
        voiceSecondMicHintTimerRef.current = null;
      }
      void startMediaRecording();
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR || !hasWebSpeechRecognition()) {
      if (hasMediaRecorderStt()) {
        void startMediaRecording();
        return;
      }
      setVoiceNote('이 브라우저는 음성 입력을 지원하지 않습니다. Android는 Chrome, PC는 Chrome·Edge를 사용해 주세요.');
      return;
    }
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      setVoiceNote(null);
      return;
    }

    setVoiceNote(null);
    if (voiceSecondMicHintTimerRef.current) {
      clearTimeout(voiceSecondMicHintTimerRef.current);
      voiceSecondMicHintTimerRef.current = null;
    }
    const recog = new SR();
    recog.lang = 'ko-KR';
    recog.continuous = false;
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.onresult = (e: any) => {
      const t = String(e.results?.[0]?.[0]?.transcript ?? '').trim();
      setListening(false);
      setVoiceNote(null);
      if (t) {
        void send(t, { fromVoice: true });
      } else {
        setVoiceNote('인식된 말이 없습니다. 마이크 버튼을 누른 뒤 잠시 기다렸다가 말씀해 주세요.');
      }
    };
    recog.onerror = (ev: any) => {
      const code = String(ev?.error ?? '');
      const hints: Record<string, string> = {
        'not-allowed': '마이크 사용이 거부되었습니다. 주소창 자물쇠에서 마이크를 허용해 주세요.',
        'no-speech': '말씀이 감지되지 않았습니다. 버튼을 누른 뒤 1초 정도 기다렸다가 말해 보세요.',
        'audio-capture': '마이크를 사용할 수 없습니다. 다른 앱이 마이크를 점유 중인지 확인해 주세요.',
        network: '음성 인식 서버에 연결하지 못했습니다. 네트워크를 확인하거나 잠시 후 다시 시도해 주세요.',
        aborted: '',
        'service-not-allowed': '음성 인식 서비스를 사용할 수 없습니다. 브라우저 설정이나 네트워크를 확인해 주세요.',
      };
      const msg = hints[code] ?? (code ? `음성 인식 오류: ${code}` : '음성 인식 중 오류가 발생했습니다.');
      if (msg) setVoiceNote(msg);
      setListening(false);
    };
    recog.onend = () => setListening(false);
    recogRef.current = recog;
    try {
      recog.start();
      setListening(true);
      setVoiceNote('듣고 있어요. 말씀하신 뒤 자동으로 전송됩니다. (조금 길게 말해도 괜찮아요)');
    } catch {
      setVoiceNote('음성 입력을 시작할 수 없습니다. 잠시 후 다시 눌러 주세요.');
      setListening(false);
    }
  }

  function stopTTS() {
    ttsFetchAbortRef.current?.abort();
    ttsFetchAbortRef.current = null;
    speakKoreanSessionId += 1;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      clearVoiceWaitRegistration(window.speechSynthesis);
      window.speechSynthesis.cancel();
    }
    speakGenRef.current += 1;
    revokeTtsBlobUrl();
    if (audioRef.current) {
      audioRef.current.pause();
      try {
        audioRef.current.currentTime = 0;
      } catch {
        /* noop */
      }
    }
    setIsSpeaking(false);
    void releaseWakeLock();
  }

  /** 패널 종료 시 — 채팅 스트림·타이머·녹음·타이핑·TTS 즉시 중단 */
  function closePanelAndStopAll() {
    chatTurnGenRef.current += 1;
    chatStreamAbortRef.current?.abort();
    chatStreamAbortRef.current = null;
    clearChatStepTimers();
    clearVerifyPauseTimer();
    if (voiceSecondMicHintTimerRef.current != null) {
      window.clearTimeout(voiceSecondMicHintTimerRef.current);
      voiceSecondMicHintTimerRef.current = null;
    }
    chatStreamingDraftRef.current = '';
    pendingAssistantFullRef.current = null;
    typeCancelRef.current?.();
    typeCancelRef.current = null;
    try {
      recogRef.current?.stop();
    } catch {
      /* noop */
    }
    recogRef.current = null;
    abortMediaRecording();
    setSttTranscribing(false);
    setVoiceActivity(null);
    setAnswerPlayOffer(null);
    setListening(false);
    setLoading(false);
    setReplyTyping(false);
    setChatLoadingStep(0);
    setVoiceNote(null);
    revokeTtsBlobUrl();
    ttsPrimedRef.current = false;
    stopTTS();
    setOpen(false);
  }

  async function fetchServerTtsPayload(
    chunkText: string,
    counselorName: string,
    ttsContext: 'single' | 'compatibility',
    signal?: AbortSignal,
  ): Promise<{ mimeType: string; audioBase64: string } | null> {
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE ?? '';
      const body: Record<string, string> = { text: chunkText, counselorName };
      if (ttsContext === 'compatibility') body.ttsContext = 'compatibility';
      const res = await fetch(`${base}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal,
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      const data = await res.json() as { audioBase64?: string; mimeType?: string; error?: string };
      if (data.error || !data.audioBase64 || !data.mimeType) return null;
      return { mimeType: data.mimeType, audioBase64: data.audioBase64 };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return null;
      return null;
    }
  }

  async function playServerTtsPayload(
    payload: { mimeType: string; audioBase64: string },
    playbackRate = 1,
  ): Promise<boolean> {
    revokeTtsBlobUrl();
    try {
      const binary = atob(payload.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: payload.mimeType });
      const url = URL.createObjectURL(blob);
      ttsBlobUrlRef.current = url;

      const audio = getOrCreatePlaybackAudio();
      configureMobilePlaybackAudio(audio);
      audio.playbackRate = playbackRate;
      audio.src = url;
      try {
        await audio.play();
      } catch {
        revokeTtsBlobUrl();
        return false;
      }
      const finishedOk = await new Promise<boolean>((resolve) => {
        const onEnd = () => {
          audio.removeEventListener('ended', onEnd);
          audio.removeEventListener('error', onErr);
          resolve(true);
        };
        const onErr = () => {
          audio.removeEventListener('ended', onEnd);
          audio.removeEventListener('error', onErr);
          resolve(false);
        };
        audio.addEventListener('ended', onEnd);
        audio.addEventListener('error', onErr);
      });
      revokeTtsBlobUrl();
      return finishedOk;
    } catch {
      revokeTtsBlobUrl();
      return false;
    }
  }

  async function speakWithPreferredMode(text: string, counselorName: string) {
    if (!text) return;
    /** isSpeaking 상태가 늦게 반영되면 stopTTS 가 스킵되어 이전 HTMLAudio 가 고아로 재생될 수 있음(궁합 등 연속 답변에서 겹침) */
    stopTTS();
    const ttsAc = new AbortController();
    ttsFetchAbortRef.current = ttsAc;
    const gen = speakGenRef.current;

    setIsSpeaking(true);
    await requestWakeLock();

    const refinedCompat = chatMode === 'compatibility';

    const done = () => {
      if (gen !== speakGenRef.current) return;
      setIsSpeaking(false);
      releaseWakeLock();
    };

    const runBrowserTts = () => {
      speakKoreanQueued(text, {
        counselorName,
        rate: refinedCompat ? TTS_RATE_COMPATIBILITY : undefined,
        pitch: refinedCompat ? TTS_PITCH_COMPATIBILITY : undefined,
        interSentencePauseMs: refinedCompat ? TTS_INTER_SENTENCE_PAUSE_COMPAT_MS : undefined,
        onDone: () => {
          if (gen !== speakGenRef.current) return;
          done();
        },
        onChunkError: () => {},
      });
    };

    if (ttsOutputMode === 'browser') {
      runBrowserTts();
      return;
    }

    const ttsContext: 'single' | 'compatibility' = refinedCompat ? 'compatibility' : 'single';
    const serverPlaybackRate = refinedCompat ? SERVER_TTS_PLAYBACK_RATE_COMPATIBILITY : 1;

    const chunks = splitForServerTts(text);
    if (!chunks.length) {
      done();
      return;
    }

    let serverOk = true;
    let pendingPayload = fetchServerTtsPayload(chunks[0], counselorName, ttsContext, ttsAc.signal);
    for (let i = 0; i < chunks.length; i++) {
      if (gen !== speakGenRef.current || ttsAc.signal.aborted) return;
      // eslint-disable-next-line no-await-in-loop
      const payload = await pendingPayload;
      pendingPayload = i + 1 < chunks.length
        ? fetchServerTtsPayload(chunks[i + 1], counselorName, ttsContext, ttsAc.signal)
        : Promise.resolve(null);
      if (!payload) {
        serverOk = false;
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      const ok = await playServerTtsPayload(payload, serverPlaybackRate);
      if (!ok) {
        serverOk = false;
        setVoiceNote(
          isIosLikeDevice()
            ? '답변 음성 재생에 실패했습니다. 마이크 또는 전송 버튼을 한 번 누른 뒤 다시 질문해 주세요. 계속 안 되면 상단 「📱 기기음성」으로 바꿔 보세요.'
            : '답변 음성 재생에 실패했습니다. 화면을 한 번 터치한 뒤 다시 시도해 주세요.',
        );
        break;
      }
      if (i < chunks.length - 1 && gen === speakGenRef.current) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((r) => window.setTimeout(r, SERVER_TTS_INTER_CHUNK_MS));
      }
    }

    if (gen !== speakGenRef.current || ttsAc.signal.aborted) return;
    if (ttsFetchAbortRef.current === ttsAc) ttsFetchAbortRef.current = null;

    if (!serverOk) {
      runBrowserTts();
      return;
    }

    done();
  }

  /** iOS 첫 방문 시 서버 TTS 대신 기기 음성이 더 잘 나오는 경우가 많음 */
  useEffect(() => {
    if (typeof window === 'undefined' || !isIosLikeDevice()) return;
    try {
      const v = localStorage.getItem(TTS_OUTPUT_MODE_KEY);
      if (v) return;
      localStorage.setItem(TTS_OUTPUT_MODE_KEY, 'browser');
      setTtsOutputMode('browser');
    } catch {
      setTtsOutputMode('browser');
    }
  }, []);

  async function playOfferedAnswer() {
    const text = answerPlayOffer?.trim();
    if (!text || loading) return;
    void primeMediaForTts();
    await speakWithPreferredMode(text, selectedCounselor);
  }

  /** 재생 인터럽트 후 — 같은 본문으로 TTS만 처음부터 다시 재생 */
  async function replayLastInterruptedAnswer() {
    const text = replayLastAnswerPayloadRef.current?.trim();
    if (!text || loading) return;
    void primeMediaForTts();
    await speakWithPreferredMode(text, selectedCounselor);
  }

  return (
    <>
      {/* Chat Panel */}
      <div className="saju-chat-layer" style={{
        position: 'fixed',
        top: open ? CHAT_PANEL_TOP_OPEN : undefined,
        bottom: open ? CHAT_PANEL_BOTTOM_OPEN : '-80dvh',
        right: 0,
        left: 0,
        maxWidth: 480,
        margin: '0 auto',
        height: open ? undefined : '72vh',
        background: '#0d0b1e',
        border: '1px solid rgba(255,255,255,.12)',
        borderBottom: 'none',
        borderRadius: '20px 20px 0 0',
        display: 'flex',
        flexDirection: 'column',
        transition: 'bottom .3s ease, top .3s ease',
        zIndex: 1000,
        overflow: 'hidden',
        boxShadow: '0 -8px 32px rgba(0,0,0,.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '10px 14px 12px', background: 'linear-gradient(135deg, #8b6fc6, #6b52a3)',
          borderBottom: '1px solid rgba(255,255,255,.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          boxShadow: '0 2px 10px rgba(0,0,0,.2)', gap: 8, flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#e8c97e', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2L12L9.6 9.6L12 2Z" fill="#e8c97e" />
              </svg>
              AI 심층 상담
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,.8)', marginTop: 1 }}>
              {!canStartCounseling
                ? 'AI 심층 풀이가 화면에 모두 표시된 뒤 상담을 이용할 수 있습니다'
                : '심층 풀이 완료 후 텍스트·음성 상담 이용 가능'}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,.62)', marginTop: 1 }}>
              타이핑·음성 속도 자동 맞춤(답변 길이·고품질/기기음성 기준) · 일반 상담 읽기 배속 ×{TTS_RATE.toFixed(2)}
              {chatMode === 'compatibility' ? (
                <span style={{ color: 'rgba(232,201,126,.75)' }}>
                  {' '}· 궁합 모드는 음색·속도·쉼을 조금 더 차분하게 맞춤
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,.55)', marginTop: 0 }}>
              읽기: {ttsOutputMode === 'server' ? '서버 고품질 (실패 시 기기 음성)' : '기기 내장 음성만'} · 화면 꺼짐 방지 {wakeLockEnabled ? 'ON' : 'OFF'}
            </div>
            <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,.55)', marginTop: 0 }}>
              배정 상담사(세션 고정): {selectedCounselor}
            </div>
            {false && SUPPORT_BANK && SUPPORT_ACCOUNT_NO ? (
              <div style={{
                marginTop: 4,
                paddingTop: 4,
                borderTop: '1px solid rgba(255,255,255,.14)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 8,
                maxWidth: 'min(340px, 100%)',
              }}>
                <div style={{ fontSize: '.62rem', fontWeight: 700, color: '#e8c97e', letterSpacing: '-0.02em' }}>
                  운영 후원 안내 (선택)
                </div>
                <p style={{
                  margin: 0,
                  fontSize: '.62rem',
                  lineHeight: 1.5,
                  color: 'rgba(255,255,255,.78)',
                }}>
                  서버비·운영비 등 비용 명목으로 소액 후원을 받고 있습니다. 후원 여부와 관계없이 상담을 이용하실 수 있습니다.
                </p>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '6px 10px',
                  width: '100%',
                }}>
                <span style={{ fontSize: '.62rem', color: 'rgba(255,255,255,.58)', whiteSpace: 'nowrap' }}>
                  입금 계좌
                </span>
                <span style={{ fontSize: '.65rem', color: '#f0e8d8', fontWeight: 700 }}>{SUPPORT_BANK}</span>
                <span style={{
                  fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
                  fontSize: '.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: '#fff',
                  textShadow: '0 1px 10px rgba(0,0,0,.35)',
                  wordBreak: 'break-all',
                }}>
                  {formatAccountForDisplay(SUPPORT_ACCOUNT_NO)}
                </span>
                {SUPPORT_ACCOUNT_HOLDER ? (
                  <span style={{ fontSize: '.62rem', color: 'rgba(255,255,255,.72)' }}>
                    예금주 {SUPPORT_ACCOUNT_HOLDER}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => void copySupportAccountNumber()}
                  aria-label="계좌번호 복사"
                  title="숫자만 클립보드에 복사"
                  style={{
                    borderRadius: 6,
                    border: '1px solid rgba(232,201,126,.42)',
                    background: supportCopyFeedback === 'ok'
                      ? 'rgba(72,160,110,.38)'
                      : 'rgba(0,0,0,.22)',
                    color: '#fff6dd',
                    fontSize: '.6rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {supportCopyFeedback === 'ok' ? '복사됨' : '번호 복사'}
                </button>
                </div>
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', alignSelf: 'flex-start', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => {
                setTtsOutputMode((prev) => {
                  const next = prev === 'server' ? 'browser' : 'server';
                  try {
                    localStorage.setItem(TTS_OUTPUT_MODE_KEY, next);
                  } catch {
                    /* noop */
                  }
                  return next;
                });
              }}
              title={ttsOutputMode === 'server' ? 'Gemini 고품질 음성 — 네트워크 사용' : '브라우저 내장 음성만 — 데이터 절약'}
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8,
                color: ttsOutputMode === 'server' ? '#e8c97e' : 'rgba(255,255,255,.55)', fontSize: '.68rem', cursor: 'pointer', padding: '4px 8px',
              }}
            >{ttsOutputMode === 'server' ? '🔊 고품질' : '📱 기기음성'}</button>
            <button type="button" onClick={() => setWakeLockEnabled(v => !v)} title="화면 꺼짐 방지" style={{
              background: 'none', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8,
              color: wakeLockEnabled ? '#e8c97e' : 'rgba(255,255,255,.5)', fontSize: '.72rem', cursor: 'pointer', padding: '4px 8px',
            }}>{wakeLockEnabled ? '🔒' : '🔓'}</button>
            {replayOffered ? (
              <button
                type="button"
                onClick={() => void replayLastInterruptedAnswer()}
                disabled={loading || listening}
                title="멈춘 답변을 처음부터 다시 들려 드립니다"
                style={{
                  background: 'rgba(232,201,126,.14)', border: '1px solid rgba(232,201,126,.38)', borderRadius: 8,
                  color: '#f5d78a', fontSize: '.68rem', cursor: loading || listening ? 'not-allowed' : 'pointer',
                  padding: '4px 8px', fontWeight: 700, opacity: loading || listening ? 0.45 : 1,
                }}
              >🔁 마지막 답변</button>
            ) : null}
            <button type="button" onClick={stopTTS} title="음성 중지" style={{
              background: 'none', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8,
              color: 'rgba(255,255,255,.5)', fontSize: '.8rem', cursor: 'pointer', padding: '4px 8px',
            }}>🔇</button>
            <button type="button" onClick={() => closePanelAndStopAll()} title="닫기 · 음성·응답 수신·녹음 중단" aria-label="상담 패널 닫기" style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,.5)',
              fontSize: '1.2rem', cursor: 'pointer', padding: '4px 8px',
            }}>✕</button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {canStartCounseling && result && (
            <div
              role="note"
              style={{
                flexShrink: 0,
                background: 'linear-gradient(145deg, rgba(45,38,82,.95), rgba(22,18,44,.98))',
                border: '1px solid rgba(232,201,126,.42)',
                borderRadius: 14,
                padding: '12px 14px',
                fontSize: '.74rem',
                lineHeight: 1.55,
                color: 'rgba(255,248,236,.96)',
                boxShadow: '0 6px 22px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.06)',
              }}
            >
              <div style={{ fontWeight: 800, color: '#f5d78a', marginBottom: 8, fontSize: '.82rem', letterSpacing: '-0.02em' }}>
                운영 후원 안내 (선택)
              </div>
              <div style={{ color: 'rgba(255,255,255,.88)', marginBottom: 12, fontSize: '.73rem' }}>
                서버비·운영비 등 비용 명목으로 소액 후원을 받고 있습니다. 후원 여부와 관계없이 상담을 이용하실 수 있습니다.
              </div>
              {SUPPORT_BANK && SUPPORT_ACCOUNT_NO ? (
                <div
                  style={{
                    background: 'rgba(0,0,0,.28)',
                    border: '1px solid rgba(232,201,126,.22)',
                    borderRadius: 11,
                    padding: '11px 12px',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontWeight: 800, color: '#ffecc8', fontSize: '.8rem' }}>{SUPPORT_BANK}</span>
                    {SUPPORT_ACCOUNT_HOLDER ? (
                      <span style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.72)' }}>
                        예금주 <strong style={{ color: '#f0e6ff', fontWeight: 700 }}>{SUPPORT_ACCOUNT_HOLDER}</strong>
                      </span>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        flex: '1 1 140px',
                        fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
                        fontSize: 'clamp(.95rem, 3.8vw, 1.08rem)',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        color: '#fff',
                        wordBreak: 'break-all',
                        textShadow: '0 1px 12px rgba(232,201,126,.25)',
                      }}
                    >
                      {formatAccountForDisplay(SUPPORT_ACCOUNT_NO)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void copySupportAccountNumber()}
                      aria-label="계좌번호 복사"
                      style={{
                        flexShrink: 0,
                        borderRadius: 10,
                        border: '1px solid rgba(232,201,126,.45)',
                        background: supportCopyFeedback === 'ok'
                          ? 'rgba(72,160,110,.35)'
                          : 'linear-gradient(180deg, rgba(232,201,126,.28), rgba(139,111,198,.22))',
                        color: '#fff6dd',
                        fontWeight: 800,
                        fontSize: '.76rem',
                        padding: '9px 14px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 10px rgba(0,0,0,.25)',
                      }}
                    >
                      {supportCopyFeedback === 'ok' ? '복사 완료' : supportCopyFeedback === 'err' ? '다시 시도' : '계좌번호 복사'}
                    </button>
                  </div>
                  <div style={{ marginTop: 8, fontSize: '.68rem', color: 'rgba(255,230,190,.62)', lineHeight: 1.45 }}>
                    버튼을 누르면 숫자만 클립보드에 복사되어 이체 앱에 바로 붙여넣기 할 수 있어요.
                  </div>
                </div>
              ) : (
                <div style={{ color: 'rgba(255,255,255,.58)' }}>
                  후원 계좌 정보를 불러오지 못했습니다. 공지 또는 안내 페이지를 참고해 주세요.
                </div>
              )}
            </div>
          )}

          {canStartCounseling && result && (
            <div style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 12,
              padding: 8,
            }}>
              <button
                onClick={() => setChatMode('single')}
                style={{
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,.15)',
                  background: chatMode === 'single' ? 'rgba(232,201,126,.22)' : 'rgba(255,255,255,.05)',
                  color: chatMode === 'single' ? '#e8c97e' : 'rgba(255,255,255,.85)',
                  padding: '6px 10px',
                  fontSize: '.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                일반 상담
              </button>
              <button
                onClick={() => setChatMode('compatibility')}
                style={{
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,.15)',
                  background: chatMode === 'compatibility' ? 'rgba(232,201,126,.22)' : 'rgba(255,255,255,.05)',
                  color: chatMode === 'compatibility' ? '#e8c97e' : 'rgba(255,255,255,.85)',
                  padding: '6px 10px',
                  fontSize: '.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                궁합/비교 모드
              </button>
              {chatMode === 'compatibility' && (
                <button
                  onClick={() => setShowCompareForm(v => !v)}
                  style={{
                    marginLeft: 'auto',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,.15)',
                    background: 'rgba(255,255,255,.05)',
                    color: 'rgba(255,255,255,.85)',
                    padding: '6px 10px',
                    fontSize: '.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {compareResult ? '비교 대상 수정' : '비교 대상 추가'}
                </button>
              )}
            </div>
          )}

          {canStartCounseling && chatMode === 'compatibility' && showCompareForm && (
            <div style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 12,
              padding: 10,
              display: 'grid',
              gap: 8,
            }}>
              <div style={{ fontSize: '.77rem', color: '#e8c97e', fontWeight: 700 }}>
                비교 대상 1명 (양력 기준)
              </div>
              <div style={{ fontSize: '.68rem', color: 'rgba(255,255,255,.55)', lineHeight: 1.35 }}>
                연도는 숫자만 입력 · 월·일은 목록에서 선택 (말일 자동 반영)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                <input
                  placeholder="연도"
                  inputMode="numeric"
                  autoComplete="bday-year"
                  aria-label="비교 대상 출생 연도"
                  value={compareForm.year}
                  onChange={(e) => {
                    const year = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setCompareForm((v) => {
                      const y = Number(year);
                      const m = Number(v.month);
                      let day = v.day;
                      if (
                        year.length >= 4 && Number.isInteger(y) && y >= 1900 && y <= 2100
                        && Number.isInteger(m) && m >= 1 && m <= 12 && day
                      ) {
                        const max = daysInSolarMonth(y, m);
                        const dn = Number(day);
                        if (dn > max) day = String(max);
                      }
                      return { ...v, year, day };
                    });
                  }}
                  style={{ ...miniInputStyle }}
                />
                <select
                  aria-label="비교 대상 출생 월"
                  value={compareForm.month}
                  onChange={(e) => {
                    const month = e.target.value;
                    setCompareForm((v) => {
                      const y = Number(v.year);
                      const m = Number(month);
                      let day = v.day;
                      if (
                        v.year.length >= 4 && Number.isInteger(y) && y >= 1900 && y <= 2100
                        && month && Number.isInteger(m) && m >= 1 && m <= 12 && day
                      ) {
                        const max = daysInSolarMonth(y, m);
                        const dn = Number(day);
                        if (dn > max) day = String(max);
                      }
                      return { ...v, month, day };
                    });
                  }}
                  style={{ ...miniSelectStyle }}
                >
                  <option value="">월</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => (
                    <option key={mo} value={String(mo)}>{mo}월</option>
                  ))}
                </select>
                <select
                  aria-label="비교 대상 출생 일"
                  value={compareForm.day}
                  onChange={(e) => setCompareForm((v) => ({ ...v, day: e.target.value }))}
                  style={{ ...miniSelectStyle }}
                >
                  <option value="">일</option>
                  {Array.from({ length: compareSolarMaxDay }, (_, i) => i + 1).map((dy) => (
                    <option key={dy} value={String(dy)}>{dy}일</option>
                  ))}
                </select>
              </div>
              <div style={{ fontSize: '.68rem', color: 'rgba(255,255,255,.55)', lineHeight: 1.35 }}>
                출생 시각을 알면 선택해 주세요. 모르면 시를 「모름」으로 두면 됩니다.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                <select
                  aria-label="비교 대상 출생 시"
                  value={compareForm.hour}
                  onChange={(e) => {
                    const hour = e.target.value;
                    setCompareForm((v) => ({
                      ...v,
                      hour,
                      minute: hour === '' ? '' : (v.minute === '' ? '0' : v.minute),
                    }));
                  }}
                  style={{ ...miniSelectStyle }}
                >
                  <option value="">모름</option>
                  {COMPARE_HOUR_VALUES.map((h) => (
                    <option key={h} value={String(h)}>{h}시</option>
                  ))}
                </select>
                <select
                  aria-label="비교 대상 출생 분"
                  disabled={compareForm.hour === ''}
                  value={compareForm.hour === '' ? '' : (compareForm.minute === '' ? '0' : compareForm.minute)}
                  onChange={(e) => setCompareForm((v) => ({ ...v, minute: e.target.value }))}
                  style={{
                    ...miniSelectStyle,
                    opacity: compareForm.hour === '' ? 0.45 : 1,
                  }}
                >
                  {compareForm.hour === '' ? (
                    <option value="">분</option>
                  ) : (
                    COMPARE_MINUTE_VALUES.map((mi) => (
                      <option key={mi} value={String(mi)}>
                        {String(mi).padStart(2, '0')}분
                      </option>
                    ))
                  )}
                </select>
                <select
                  value={compareForm.gender}
                  onChange={(e) => setCompareForm((v) => ({ ...v, gender: e.target.value as '남' | '여' }))}
                  style={{ ...miniSelectStyle }}
                  aria-label="비교 대상 성별"
                >
                  <option value="남">남성</option>
                  <option value="여">여성</option>
                </select>
              </div>
              {compareError && <div style={{ fontSize: '.74rem', color: '#ff8080' }}>{compareError}</div>}
              <button onClick={analyzeCompareTarget} style={miniActionBtnStyle}>비교 대상 분석하기</button>
            </div>
          )}

          {canStartCounseling && chatMode === 'compatibility' && compareResult && (
            <div style={{
              fontSize: '.76rem',
              color: 'rgba(255,255,255,.82)',
              background: 'rgba(232,201,126,.12)',
              border: '1px solid rgba(232,201,126,.28)',
              borderRadius: 10,
              padding: '8px 10px',
            }}>
              비교 대상 적용됨: {compareResult.input.year}년생 {compareResult.input.gender}성
            </div>
          )}

          {voiceActivity && (
            <div
              role="status"
              aria-live="polite"
              style={{
                alignSelf: 'center',
                width: '100%',
                padding: '12px 14px',
                borderRadius: 12,
                background: 'rgba(232,201,126,.2)',
                border: '1px solid rgba(232,201,126,.5)',
                color: '#f5d78a',
                fontSize: '.86rem',
                fontWeight: 700,
                textAlign: 'center',
                lineHeight: 1.55,
                boxShadow: '0 4px 18px rgba(0,0,0,.25)',
              }}
            >
              {voiceActivityBannerText(voiceActivity)}
            </div>
          )}

          {msgs.map((m, i) => {
            const isLast = i === msgs.length - 1;
            const showStepBubble = m.role === 'assistant' && loading && isLast
              && chatLoadingStep >= 1 && chatLoadingStep <= 3 && !m.content.trim();
            const displayMain = m.role === 'user'
              ? m.content
              : showStepBubble
                ? `${CHAT_AI_STEPS[chatLoadingStep - 1]}\n\n— ${selectedCounselor} 상담사 · 심층 상담 —\n\n화면 아래 안내도 함께 바뀝니다. 검토가 끝나면 글이 한 글자씩 올라오며 음성으로도 들려 드려요.`
                : m.content;
            const isLastAssistantWait = m.role === 'assistant' && isLast && (loading || replyTyping);
            const rotatingHint = (loading ? WAIT_CHAT_HINTS : REPLY_TYPING_HINTS)[progressHintIdx % (loading ? WAIT_CHAT_HINTS.length : REPLY_TYPING_HINTS.length)];
            return (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '82%', padding: '10px 14px',
                  borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: m.role === 'user' ? 'rgba(232,201,126,.15)' : 'rgba(255,255,255,.07)',
                  border: `1px solid ${m.role === 'user' ? 'rgba(232,201,126,.3)' : 'rgba(255,255,255,.1)'}`,
                  color: '#e0e0e0', fontSize: '.87rem', lineHeight: 1.65, whiteSpace: 'pre-wrap',
                }}>
                  {displayMain
                    ? (
                      <>
                        {displayMain}
                        {isLastAssistantWait && (
                          <div style={{
                            marginTop: 10,
                            paddingTop: 10,
                            borderTop: '1px solid rgba(255,255,255,.1)',
                            fontSize: '.78rem',
                            color: 'rgba(255,224,190,.88)',
                            lineHeight: 1.55,
                          }}>
                            <span aria-hidden>💬 </span>
                            {rotatingHint}
                          </div>
                        )}
                      </>
                      )
                    : (m.role === 'assistant' && isLast && (loading || replyTyping)
                      ? <span className="chat-typing-cursor">{loading ? '답변 준비 중… ▌' : '답변 표시 중… ▌'}</span>
                      : (m.role === 'assistant' && isLast && !m.content.trim()
                        ? <span style={{ color: 'rgba(255,200,180,.85)' }}>답변을 불러오지 못했습니다. 다시 질문해 주세요.</span>
                        : ''))}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* 입력 영역 */}
        {!canStartCounseling ? (
          <div style={{
            padding: '20px', borderTop: '1px solid rgba(255,255,255,.08)',
            textAlign: 'center', background: 'rgba(255,255,255,.02)', flexShrink: 0,
          }}>
            <div style={{ color: '#e8c97e', fontSize: '.85rem', marginBottom: '10px', fontWeight: 700 }}>
              AI 심층 풀이를 모두 확인한 뒤 심층 상담을 이용할 수 있습니다
            </div>
            <div style={{ color: 'rgba(255,255,255,.72)', fontSize: '.76rem', lineHeight: 1.5 }}>
              AI 심층 풀이가 모두 표시된 뒤 상담 버튼이 활성화됩니다.
            </div>
          </div>
        ) : (
          <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.02)', flexShrink: 0 }}>
            {voiceNote && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  margin: '8px 12px 0',
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'rgba(232,201,126,.16)',
                  border: '1px solid rgba(232,201,126,.42)',
                  fontSize: '.82rem',
                  fontWeight: 700,
                  color: '#f5d78a',
                  lineHeight: 1.5,
                }}
              >
                {voiceNote}
              </div>
            )}

            {answerPlayOffer && isIosLikeDevice() && !loading && !isSpeaking ? (
              <div style={{ padding: '6px 12px 2px' }}>
                <button
                  type="button"
                  onClick={() => void playOfferedAnswer()}
                  style={{
                    width: '100%',
                    borderRadius: 10,
                    border: '1px solid rgba(232,201,126,.45)',
                    background: 'rgba(232,201,126,.16)',
                    color: '#f5d78a',
                    fontSize: '.82rem',
                    fontWeight: 700,
                    padding: '10px 12px',
                    cursor: 'pointer',
                  }}
                >
                  🔊 답변 듣기
                </button>
              </div>
            ) : null}

            {(loading || replyTyping) && (
              <div style={{
                padding: '6px 12px 2px',
                fontSize: '.72rem',
                color: 'rgba(232,201,126,.88)',
                lineHeight: 1.45,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span className="chat-rotating-star" aria-hidden style={{ fontSize: '.85rem' }}>✦</span>
                <span>
                  {loading ? (
                    <>
                      <span style={{ color: 'rgba(255,255,255,.72)' }}>
                        {chatLoadingStep >= 1 ? CHAT_AI_STEPS[chatLoadingStep - 1] : '상담사 답변을 준비 중이에요.'}
                      </span>
                      {' '}
                      <span style={{ color: 'rgba(255,255,255,.55)' }}>멈춘 상태가 아니에요.</span>
                    </>
                  ) : (
                    <>
                      <span style={{ color: 'rgba(255,255,255,.72)' }}>{CHAT_AI_STEPS[3]}</span>
                      {' '}
                      <span style={{ color: 'rgba(255,255,255,.55)' }}>음성과 함께 재생 중일 수 있어요.</span>
                    </>
                  )}
                </span>
              </div>
            )}

            <div style={{
              padding: '10px 12px',
              display: 'flex', gap: 7,
            }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (canStartCounseling && input.trim()) void send();
                  }
                }}
                placeholder={result ? (chatMode === 'compatibility' ? '궁합/비교 질문을 입력하세요...' : '질문을 입력하세요...') : '사주 분석 먼저 해주세요'}
                disabled={!result || !canStartCounseling}
                style={{
                  flex: 1, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)',
                  borderRadius: 10, padding: '9px 12px', color: '#e8e8e8', fontSize: '.87rem', outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={toggleVoice}
                disabled={loading || sttTranscribing}
                title={
                  sttTranscribing ? '음성 인식 중'
                    : loading ? '답변 수신 중'
                      : listening
                        ? (shouldUseServerStt() ? '말씀 후 다시 눌러 전송' : '녹음 중지')
                        : (isSpeaking || replyTyping) ? '재생·타이핑 멈추기 — 잠시 후 마이크를 다시 눌러 질문'
                          : '음성 입력'
                }
                style={{
                  padding: '9px 11px',
                  background: listening ? 'rgba(220,50,50,.25)' : 'rgba(255,255,255,.06)',
                  border: `1px solid ${listening ? 'rgba(220,80,80,.5)' : 'rgba(255,255,255,.12)'}`,
                  borderRadius: 10, color: listening ? '#ff6b6b' : 'rgba(255,255,255,.55)',
                  cursor: loading || sttTranscribing ? 'not-allowed' : 'pointer', fontSize: '1rem',
                  opacity: loading || sttTranscribing ? 0.45 : 1,
                  animation: listening ? 'pulse 1s infinite, micGlow 1.2s ease-in-out infinite' : 'micGlowIdle 2.2s ease-in-out infinite',
                  boxShadow: listening ? '0 0 14px rgba(255,107,107,.55)' : '0 0 10px rgba(139,111,198,.35)',
                }}
              >🎤</button>
              <button onClick={() => send()} disabled={!input.trim() || !result || !canStartCounseling} style={{
                padding: '9px 14px',
                background: 'rgba(232,201,126,.18)', border: '1px solid rgba(232,201,126,.3)',
                borderRadius: 10, color: '#e8c97e', cursor: 'pointer', fontWeight: 700, fontSize: '.87rem',
                opacity: !input.trim() || !result || !canStartCounseling ? 0.45 : 1,
              }}>전송</button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Button */}
      <div className="saju-chat-layer" style={{
        position: 'fixed',
        bottom: 24,
        right: 20,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        {!open && (
          <div className="chat-fab-label" style={{
            background: 'rgba(13,11,30,0.92)',
            border: '1px solid rgba(255,255,255,0.16)',
            borderRadius: 999,
            padding: '7px 11px',
            color: '#e8c97e',
            fontSize: '.76rem',
            fontWeight: 700,
            boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
            whiteSpace: 'nowrap',
          }}>
            <span className="chat-fab-label-desktop">AI 심층 상담</span>
            <span className="chat-fab-label-mobile">AI 상담</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            if (open) {
              closePanelAndStopAll();
              return;
            }
            if (!canStartCounseling) return;
            void primeMediaForTts();
            setOpen(true);
          }}
          style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #8b6fc6, #6b4fa6)',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 8px 32px rgba(139,111,198,0.4)',
            cursor: canStartCounseling ? 'pointer' : 'not-allowed', fontSize: '1.4rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff',
            opacity: canStartCounseling ? 1 : 0.45,
            transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          }}
          onMouseEnter={(e) => {
            if (!canStartCounseling) return;
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title={
            open
              ? '닫기 · 음성·응답 수신·녹음 중단'
              : canStartCounseling
                  ? 'AI 심층 상담'
                  : 'AI 심층 풀이를 완료한 뒤 이용할 수 있습니다'
          }
          aria-label={open ? '상담 패널 닫기 · 재생 및 수신 중단' : 'AI 심층 상담 열기'}
        >
          {open ? '✕' : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L13.5 9L21 10.5L13.5 12L12 19L10.5 12L3 10.5L10.5 9L12 2Z" fill="currentColor"/>
              <path d="M18.5 15.5L19.5 18L22 19L19.5 20L18.5 22.5L17.5 20L15 19L17.5 18L18.5 15.5Z" fill="#fff" fillOpacity="0.8"/>
            </svg>
          )}
        </button>
      </div>
      <style>{`
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.8; transform: scale(0.98); } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 5px rgba(232,201,126,0.2); } 50% { box-shadow: 0 0 15px rgba(232,201,126,0.5); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes micGlowIdle { 0%, 100% { box-shadow: 0 0 8px rgba(139,111,198,.28); } 50% { box-shadow: 0 0 14px rgba(139,111,198,.45); } }
        @keyframes micGlow { 0%, 100% { box-shadow: 0 0 10px rgba(255,107,107,.35); } 50% { box-shadow: 0 0 18px rgba(255,107,107,.7); } }
        .chat-rotating-star { display: inline-block; animation: rotate 2s linear infinite; vertical-align: middle; }
        .chat-typing-cursor { color: #e8c97e; font-weight: 700; animation: blink 0.8s infinite; margin-left: 2px; }
        .chat-fab-label-mobile { display: none; }
        @media (max-width: 600px) {
          .chat-fab-label-desktop { display: none; }
          .chat-fab-label-mobile { display: inline; }
          .chat-fab-label { padding: 6px 10px; font-size: .72rem; }
        }
      `}</style>
    </>
  );
}
