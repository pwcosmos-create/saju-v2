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
  if (!cleaned) return '';
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

function estimateBrowserSpeechMs(text: string): number {
  const chunks = splitTtsChunks(text);
  if (!chunks.length) return 0;
  const cps = SPEECH_BASE_CHARS_PER_SEC * TTS_RATE;
  let ms = 0;
  for (let i = 0; i < chunks.length; i++) {
    ms += (chunks[i].length / cps) * 1000;
    if (i < chunks.length - 1) ms += TTS_INTER_SENTENCE_PAUSE_MS;
  }
  return ms;
}

function estimateServerSpeechMs(text: string): number {
  const chunks = splitForServerTts(text);
  if (!chunks.length) return 0;
  const cps = SPEECH_BASE_CHARS_PER_SEC * TTS_RATE * SERVER_SPEECH_CPS_FACTOR;
  const gap = SERVER_TTS_INTER_CHUNK_MS + 72;
  let ms = 0;
  for (let i = 0; i < chunks.length; i++) {
    ms += (chunks[i].length / cps) * 1000;
    if (i < chunks.length - 1) ms += gap;
  }
  return ms;
}

/** 답변 전체 표시 시간 ≈ 선택 모드의 예상 음성 재생 시간 */
function typeIntervalMsForSpeechSync(text: string, mode: 'browser' | 'server'): number {
  const n = text.length;
  if (n <= 0) return 48;
  const total = mode === 'browser' ? estimateBrowserSpeechMs(text) : estimateServerSpeechMs(text);
  const perChar = total / n;
  return Math.round(Math.min(220, Math.max(22, perChar)));
}

const TTS_OUTPUT_MODE_KEY = 'saju_chat_tts_output_mode';

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
  options: { counselorName: string; onDone?: () => void; onChunkError?: () => void },
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
      utt.rate = TTS_RATE;
      utt.pitch = TTS_PITCH;
      utt.onend = () => {
        const next = idx + 1;
        if (next >= chunks.length) {
          options?.onDone?.();
          return;
        }
        window.setTimeout(() => speakAt(next), TTS_INTER_SENTENCE_PAUSE_MS);
      };
      // 일부 브라우저에서 중간 오류가 나도 다음 조각으로 이어서 읽는다.
      utt.onerror = () => {
        options?.onChunkError?.();
        const next = idx + 1;
        if (next >= chunks.length) {
          options?.onDone?.();
          return;
        }
        window.setTimeout(() => speakAt(next), TTS_INTER_SENTENCE_PAUSE_MS);
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
const SESSION_SECONDS = 30 * 60;
const MAX_SESSION_SECONDS = 120 * 60;
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
const PAYMENT_EXEMPT_BIRTHDAYS = new Set([
  '1974-3-10',
  '1975-6-13',
  '1976-4-25',
]);
const miniInputStyle = {
  background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 8,
  padding: '8px 10px',
  color: '#e8e8e8',
  fontSize: '.78rem',
  outline: 'none',
};
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

function typeEffect(
  text: string,
  charIntervalMs: number,
  onUpdate: (t: string) => void,
  onDone?: () => void,
) {
  let index = 0;
  const timer = setInterval(() => {
    if (index < text.length) {
      onUpdate(text.slice(0, index + 1));
      index++;
    } else {
      clearInterval(timer);
      if (onDone) onDone();
    }
  }, charIntervalMs);
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

async function streamChat(
  messages: { role: string; content: string }[],
  sajuContext: string,
  options: { chatMode: 'single' | 'compatibility'; compareSajuContext?: string; counselorName: string },
  onChunk: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
) {
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? '';
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        sajuContext,
        chatMode: options.chatMode,
        compareSajuContext: options.compareSajuContext ?? '',
        counselorName: options.counselorName,
      }),
    });
    if (!res.ok || !res.body) { onError('연결 실패'); return; }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of dec.decode(value, { stream: true }).split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') { onDone(); return; }
        try {
          const text = JSON.parse(raw).choices?.[0]?.delta?.content;
          if (text) onChunk(text);
        } catch { /* skip */ }
      }
    }
    onDone();
  } catch (e) {
    onError(String(e));
  }
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

function isPaymentExemptTarget(r: SajuResult | null): boolean {
  if (!r) return false;
  return PAYMENT_EXEMPT_BIRTHDAYS.has(`${r.input.year}-${r.input.month}-${r.input.day}`);
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
  hour: string;
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
  const [isPaid, setIsPaid]     = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [compareForm, setCompareForm] = useState<CompareForm>({
    year: '',
    month: '',
    day: '',
    hour: '',
    gender: '여',
  });
  const [compareResult, setCompareResult] = useState<SajuResult | null>(null);
  const [compareError, setCompareError] = useState('');
  const [showCompareForm, setShowCompareForm] = useState(false);
  const [previewUsed, setPreviewUsed] = useState(false);
  const [previewUnlocked, setPreviewUnlocked] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const paypalRef = useRef<HTMLDivElement>(null);
  const paypalExtendRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** 정지·새 재생 시 이전 비동기 TTS 루프 무효화 */
  const speakGenRef = useRef(0);
  const wakeLockRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef  = useRef<any>(null);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [progressHintIdx, setProgressHintIdx] = useState(0);
  const [replyTyping, setReplyTyping] = useState(false);
  /** 1~3: 스트림·검토 연출, 4: 타이핑 출력 (사주 페이지 AI 풀이 단계와 동일 흐름) */
  const [chatLoadingStep, setChatLoadingStep] = useState(0);
  const ttsPrimedRef = useRef(false);
  const isExemptUser = isPaymentExemptTarget(result);
  const targetKey = getTargetKey(result);
  const canStartCounseling = Boolean(result && (aiSummaryReady || isExemptUser));
  const [wakeLockEnabled, setWakeLockEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedCounselor, setSelectedCounselor] = useState<string>('도화');
  const [introSpoken, setIntroSpoken] = useState(false);
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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

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

  /** 전송/패널 열기 같은 사용자 제스처 안에서 호출 — 이후 비동기 TTS·오디오 정책 완화에 도움 */
  async function primeMediaForTts() {
    if (typeof window === 'undefined' || ttsPrimedRef.current) return;
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
        await new Promise<void>((r) => setTimeout(r, 50));
        await ctx.close();
      }
    } catch {
      /* noop */
    } finally {
      ttsPrimedRef.current = true;
    }
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
      setIsPaid(false);
      setExpiresAt(null);
      setTimeLeft(null);
      return;
    }
    if (isExemptUser) return;

    const sessionTarget = localStorage.getItem('saju_chat_session_target');
    if (sessionTarget !== targetKey) {
      setIsPaid(false);
      setExpiresAt(null);
      setTimeLeft(null);
      localStorage.removeItem('saju_chat_paid_at');
      localStorage.removeItem('saju_chat_expires_at');
      return;
    }

    const expires = localStorage.getItem('saju_chat_expires_at');
    if (expires) {
      const exp = parseInt(expires, 10);
      if (exp > Date.now()) {
        setExpiresAt(exp);
        setIsPaid(true);
        setTimeLeft(Math.floor((exp - Date.now()) / 1000));
        return;
      }
    }
    const paidAt = localStorage.getItem('saju_chat_paid_at');
    if (paidAt) {
      const diff = Date.now() - parseInt(paidAt, 10);
      const limit = SESSION_SECONDS * 1000;
      if (diff < limit) {
        const exp = Date.now() + (limit - diff);
        setExpiresAt(exp);
        setIsPaid(true);
        setTimeLeft(Math.floor((limit - diff) / 1000));
        localStorage.setItem('saju_chat_expires_at', String(exp));
        return;
      }
    }

    setIsPaid(false);
    setExpiresAt(null);
    setTimeLeft(null);
    localStorage.removeItem('saju_chat_paid_at');
    localStorage.removeItem('saju_chat_expires_at');
  }, [result, isExemptUser, targetKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !result) {
      setPreviewUsed(false);
      setPreviewUnlocked(false);
      setIntroSpoken(false);
      return;
    }
    const previewKey = `saju_chat_preview_used_${result.input.year}-${result.input.month}-${result.input.day}-${result.input.gender}`;
    setPreviewUsed(sessionStorage.getItem(previewKey) === '1');
    setPreviewUnlocked(false);
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

  // Timer for remaining time
  useEffect(() => {
    if (!isPaid || !expiresAt) return;
    const timer = setInterval(() => {
      const remain = Math.floor((expiresAt - Date.now()) / 1000);
      if (remain <= 0) {
        setTimeLeft(0);
        setIsPaid(false);
        setExpiresAt(null);
        localStorage.removeItem('saju_chat_paid_at');
        localStorage.removeItem('saju_chat_expires_at');
        return;
      }
      setTimeLeft(remain);
    }, 1000);
    return () => clearInterval(timer);
  }, [isPaid, expiresAt]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  function analyzeCompareTarget() {
    if (!compareForm.year || !compareForm.month || !compareForm.day) {
      setCompareError('비교 대상의 생년월일(양력)을 입력해 주세요.');
      return;
    }
    const y = Number(compareForm.year);
    const m = Number(compareForm.month);
    const d = Number(compareForm.day);
    if (!y || !m || !d || y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
      setCompareError('비교 대상 날짜가 올바르지 않습니다.');
      return;
    }
    const hourTotalMin = compareForm.hour === '' ? -1 : Number(compareForm.hour) * 60;
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

  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{
        role: 'assistant',
        content: result
          ? `안녕하세요! AI 심층 상담입니다.\n이번 세션의 배정 상담사는 『${selectedCounselor}』입니다. 생년월일·성별 조합이 같은 동안은 같은 분이 끝까지 해설해 드려요.\n${result.input.year}년생 ${result.input.gender}성분의 사주를 분석했습니다.\n질문은 텍스트·음성 모두 가능해요. 음성은 마이크 버튼을 누른 뒤 말씀해 주세요.\n${isExemptUser ? '결제 예외 대상이므로 바로 상담을 이용하실 수 있습니다. 😊' : 'AI 심층 상담은 1,000원(이벤트가, 정상가 30,000원) 결제 후 이용 가능합니다. 결제 후 궁금하신 점을 무엇이든 물어보세요. 🎯'}`
          : '안녕하세요! 먼저 위에서 사주 분석을 완료해주세요.',
      }]);
    }
  }, [open, result, isExemptUser, selectedCounselor]);

  useEffect(() => {
    if (!open || !result || introSpoken || !canStartCounseling) return;
    const intro = `${selectedCounselor} 상담사가 이 세션 내내 함께합니다. 궁금한 점을 편하게 물어보세요.`;
    void speakWithPreferredMode(intro, selectedCounselor);
    setIntroSpoken(true);
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

  useEffect(() => {
    if (!isExemptUser) return;
    setIsPaid(true);
    setTimeLeft(null);
    setExpiresAt(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('saju_chat_paid_at');
      localStorage.removeItem('saju_chat_expires_at');
      localStorage.removeItem('saju_chat_session_target');
    }
  }, [isExemptUser]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!open || isPaid || isExemptUser || !result || !w.paypal || !paypalRef.current || paypalRef.current.innerHTML !== '') return;
    w.paypal.Buttons({
      createOrder: (_data: any, actions: any) => actions.order.create({
        purchase_units: [{
          description: "AI 사주 상담 1회 이용권",
          amount: { currency_code: "KRW", value: "1000" }
        }]
      }),
      onApprove: async (_data: any, actions: any) => {
        const order = await actions.order.capture();
        if (order.status === 'COMPLETED') {
          const exp = Date.now() + (SESSION_SECONDS * 1000);
          setIsPaid(true);
          setExpiresAt(exp);
          setTimeLeft(SESSION_SECONDS);
          localStorage.setItem('saju_chat_paid_at', Date.now().toString());
          localStorage.setItem('saju_chat_expires_at', String(exp));
          localStorage.setItem('saju_chat_session_target', targetKey);
          setMsgs(prev => [...prev, { role: 'assistant', content: '결제가 완료되었습니다! 30분간 자유롭게 상담하실 수 있습니다. 😊' }]);
        }
      },
      onError: (err: any) => {
        console.error('PayPal Error:', err);
        alert('결제 중 오류가 발생했습니다. 다시 시도해 주세요.');
      }
    }).render(paypalRef.current);
  }, [open, isPaid, result, isExemptUser, targetKey]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!open || !isPaid || !result || !w.paypal || !paypalExtendRef.current || paypalExtendRef.current.innerHTML !== '') return;
    w.paypal.Buttons({
      createOrder: (_data: any, actions: any) => actions.order.create({
        purchase_units: [{
          description: "AI 사주 상담 시간 30분 연장권",
          amount: { currency_code: "KRW", value: "1000" }
        }]
      }),
      onApprove: async (_data: any, actions: any) => {
        const order = await actions.order.capture();
        if (order.status === 'COMPLETED') {
          const currentRemain = Math.max(0, Math.floor(((expiresAt ?? Date.now()) - Date.now()) / 1000));
          const nextRemain = Math.min(currentRemain + SESSION_SECONDS, MAX_SESSION_SECONDS);
          const nextExp = Date.now() + nextRemain * 1000;
          setExpiresAt(nextExp);
          setTimeLeft(nextRemain);
          localStorage.setItem('saju_chat_expires_at', String(nextExp));
          setMsgs(prev => [...prev, { role: 'assistant', content: '연장 결제가 완료되었습니다! 상담 시간이 30분 늘어났습니다. ⏱️' }]);
        }
      },
      onError: (err: any) => {
        console.error('PayPal Extend Error:', err);
        alert('연장 결제 중 오류가 발생했습니다. 다시 시도해 주세요.');
      }
    }).render(paypalExtendRef.current);
  }, [open, isPaid, result, expiresAt]);

  async function send(text: string = input) {
    const trimmed = text.trim();
    if (!trimmed || loading || !result) return;
    void primeMediaForTts();
    if (!isPaid && !isExemptUser && !previewUnlocked) {
      setMsgs(prev => [...prev, {
        role: 'assistant',
        content: '무료 미리보기 1회를 먼저 시작하거나 결제를 진행해 주세요.',
      }]);
      return;
    }
    if (chatMode === 'compatibility' && !compareResult) {
      setMsgs(prev => [...prev, {
        role: 'assistant',
        content: '궁합/비교 모드를 사용하려면 먼저 비교 대상 1명을 추가해 주세요.',
      }]);
      return;
    }
    setVoiceNote(null);
    const userMsg: Msg = { role: 'user', content: trimmed };
    const newMsgs = [...msgs, userMsg];
    setMsgs([...newMsgs, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);
    setChatLoadingStep(1);

    const sajuContext = buildChatContext(result);
    const compareSajuContext = compareResult ? buildCompatibilityContext(result, compareResult) : undefined;
    let buffer = '';
    let streamFinished = false;

    const t1 = window.setTimeout(() => {
      if (!streamFinished) setChatLoadingStep(2);
    }, CHAT_STEP_ADVANCE_MS[0]);
    const t2 = window.setTimeout(() => {
      if (!streamFinished) setChatLoadingStep(3);
    }, CHAT_STEP_ADVANCE_MS[1]);

    await streamChat(
      newMsgs.map(m => ({ role: m.role, content: m.content })),
      sajuContext,
      {
        chatMode,
        compareSajuContext,
        counselorName: selectedCounselor,
      },
      (chunk) => {
        buffer += chunk;
        if (buffer.length % 500 === 0 && !streamFinished) setChatLoadingStep(2);
      },
      () => {
        streamFinished = true;
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        setChatLoadingStep(3);

        setTimeout(() => {
          setLoading(false);
          const userTurn = newMsgs.filter((m) => m.role === 'user').length;
          const finalized = addFollowUpPrompt(finalizeKoreanAnswer(buffer), userTurn);
          setChatLoadingStep(4);
          setReplyTyping(true);
          const syncMs = typeIntervalMsForSpeechSync(finalized, ttsOutputMode);
          if (finalized) void speakWithPreferredMode(finalized, selectedCounselor);
          typeEffect(finalized, syncMs, (typed) => {
            setMsgs((prev) => {
              const u = [...prev];
              u[u.length - 1] = { role: 'assistant', content: typed };
              return u;
            });
          }, () => {
            setReplyTyping(false);
            setChatLoadingStep(0);
            if (!isPaid && !isExemptUser && previewUnlocked) {
              const key = `saju_chat_preview_used_${result.input.year}-${result.input.month}-${result.input.day}-${result.input.gender}`;
              setPreviewUnlocked(false);
              setPreviewUsed(true);
              if (typeof window !== 'undefined') sessionStorage.setItem(key, '1');
            }
          });
        }, VERIFY_PAUSE_MS);
      },
      (err) => {
        streamFinished = true;
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        setChatLoadingStep(0);
        setMsgs(prev => {
          const u = [...prev];
          u[u.length - 1] = { role: 'assistant', content: `오류가 발생했습니다: ${err}` };
          return u;
        });
        setLoading(false);
        setReplyTyping(false);
      },
    );
  }

  function toggleVoice() {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setVoiceNote('이 브라우저는 음성 입력을 지원하지 않습니다. Chrome 또는 Edge(데스크톱)를 사용해 주세요.');
      return;
    }
    if (!window.isSecureContext) {
      setVoiceNote('음성 입력은 보안 연결(HTTPS)에서만 동작합니다.');
      return;
    }
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      setVoiceNote(null);
      return;
    }
    if (loading) {
      setVoiceNote('답변을 받는 중입니다. 잠시 후 다시 눌러 주세요.');
      return;
    }
    if (!result) return;
    if (!isPaid && !isExemptUser && !previewUnlocked) {
      setVoiceNote('무료 미리보기를 시작하거나 결제 후 음성 질문을 사용할 수 있어요.');
      return;
    }
    setVoiceNote(null);
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
        void send(t);
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
    speakGenRef.current += 1;
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setIsSpeaking(false);
    releaseWakeLock();
  }

  async function fetchServerTtsPayload(
    chunkText: string,
    counselorName: string,
  ): Promise<{ mimeType: string; audioBase64: string } | null> {
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE ?? '';
      const res = await fetch(`${base}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chunkText, counselorName }),
      });
      if (!res.ok) return null;
      const data = await res.json() as { audioBase64?: string; mimeType?: string; error?: string };
      if (data.error || !data.audioBase64 || !data.mimeType) return null;
      return { mimeType: data.mimeType, audioBase64: data.audioBase64 };
    } catch {
      return null;
    }
  }

  async function playServerTtsPayload(payload: { mimeType: string; audioBase64: string }): Promise<boolean> {
    try {
      const audio = new Audio(`data:${payload.mimeType};base64,${payload.audioBase64}`);
      audioRef.current = audio;
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
    }
  }

  async function speakWithPreferredMode(text: string, counselorName: string) {
    if (!text) return;
    if (isSpeaking) stopTTS();

    const gen = ++speakGenRef.current;
    setIsSpeaking(true);
    await requestWakeLock();

    const done = () => {
      if (gen !== speakGenRef.current) return;
      setIsSpeaking(false);
      releaseWakeLock();
    };

    const runBrowserTts = () => {
      speakKoreanQueued(text, {
        counselorName,
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

    const chunks = splitForServerTts(text);
    if (!chunks.length) {
      done();
      return;
    }

    let serverOk = true;
    let pendingPayload = fetchServerTtsPayload(chunks[0], counselorName);
    for (let i = 0; i < chunks.length; i++) {
      if (gen !== speakGenRef.current) return;
      // eslint-disable-next-line no-await-in-loop
      const payload = await pendingPayload;
      pendingPayload = i + 1 < chunks.length
        ? fetchServerTtsPayload(chunks[i + 1], counselorName)
        : Promise.resolve(null);
      if (!payload) {
        serverOk = false;
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      const ok = await playServerTtsPayload(payload);
      if (!ok) {
        serverOk = false;
        break;
      }
      if (i < chunks.length - 1 && gen === speakGenRef.current) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((r) => window.setTimeout(r, SERVER_TTS_INTER_CHUNK_MS));
      }
    }

    if (gen !== speakGenRef.current) return;

    if (!serverOk) {
      runBrowserTts();
      return;
    }

    done();
  }

  function usePreviewOnce() {
    if (!result || previewUsed) return;
    void primeMediaForTts();
    setPreviewUnlocked(true);
    setMsgs(prev => [...prev, {
      role: 'assistant',
      content: '무료 미리보기 1회가 시작되었습니다. 궁금한 점을 1개 질문해 주세요.',
    }]);
  }

  return (
    <>
      {/* Chat Panel */}
      <div className="saju-chat-layer" style={{
        position: 'fixed', bottom: open ? 0 : '-75vh', right: 0, left: 0,
        maxWidth: 480, margin: '0 auto', height: '72vh',
        background: '#0d0b1e', border: '1px solid rgba(255,255,255,.12)',
        borderBottom: 'none', borderRadius: '20px 20px 0 0',
        display: 'flex', flexDirection: 'column',
        transition: 'bottom .3s ease', zIndex: 1000, overflow: 'hidden',
        boxShadow: '0 -8px 32px rgba(0,0,0,.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', background: 'linear-gradient(135deg, #8b6fc6, #6b52a3)',
          borderBottom: '1px solid rgba(255,255,255,.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,.2)',
        }}>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#e8c97e', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2L12L9.6 9.6L12 2Z" fill="#e8c97e" />
              </svg>
              AI 심층 상담
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,.8)', marginTop: 2 }}>
              {isExemptUser
                ? '결제 예외 대상 - 바로 상담 가능합니다'
                : !canStartCounseling
                  ? '먼저 AI 풀이 받기를 완료해 주세요'
                : isPaid && timeLeft !== null
                  ? `남은 상담 시간: ${formatTime(timeLeft)} · 상담 진행 중`
                  : '상담 이용 가능 · AI 심층 풀이 기반 텍스트·음성 맞춤 상담'}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,.62)', marginTop: 2 }}>
              타이핑·음성 속도 자동 맞춤(답변 길이·고품질/기기음성 기준) · 읽기 배속 ×{TTS_RATE.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,.55)', marginTop: 1 }}>
              읽기: {ttsOutputMode === 'server' ? '서버 고품질 (실패 시 기기 음성)' : '기기 내장 음성만'} · 화면 꺼짐 방지 {wakeLockEnabled ? 'ON' : 'OFF'}
            </div>
            <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,.55)', marginTop: 1 }}>
              배정 상담사(세션 고정): {selectedCounselor}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
            <button type="button" onClick={stopTTS} title="음성 중지" style={{
              background: 'none', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8,
              color: 'rgba(255,255,255,.5)', fontSize: '.8rem', cursor: 'pointer', padding: '4px 8px',
            }}>🔇</button>
            <button type="button" onClick={() => setOpen(false)} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,.5)',
              fontSize: '1.2rem', cursor: 'pointer', padding: '4px 8px',
            }}>✕</button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isPaid && result && (
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

          {isPaid && chatMode === 'compatibility' && showCompareForm && (
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                <input placeholder="년" value={compareForm.year} onChange={e => setCompareForm(v => ({ ...v, year: e.target.value }))} style={{ ...miniInputStyle }} />
                <input placeholder="월" value={compareForm.month} onChange={e => setCompareForm(v => ({ ...v, month: e.target.value }))} style={{ ...miniInputStyle }} />
                <input placeholder="일" value={compareForm.day} onChange={e => setCompareForm(v => ({ ...v, day: e.target.value }))} style={{ ...miniInputStyle }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <input placeholder="시(0~23, 선택)" value={compareForm.hour} onChange={e => setCompareForm(v => ({ ...v, hour: e.target.value }))} style={{ ...miniInputStyle }} />
                <select value={compareForm.gender} onChange={e => setCompareForm(v => ({ ...v, gender: e.target.value as '남' | '여' }))} style={{ ...miniInputStyle }}>
                  <option value="남">남성</option>
                  <option value="여">여성</option>
                </select>
              </div>
              {compareError && <div style={{ fontSize: '.74rem', color: '#ff8080' }}>{compareError}</div>}
              <button onClick={analyzeCompareTarget} style={miniActionBtnStyle}>비교 대상 분석하기</button>
            </div>
          )}

          {isPaid && chatMode === 'compatibility' && compareResult && (
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

          {msgs.map((m, i) => {
            const isLast = i === msgs.length - 1;
            const showStepBubble = m.role === 'assistant' && loading && isLast && chatLoadingStep >= 1 && chatLoadingStep <= 3;
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
                    : (loading && isLast && m.role === 'assistant'
                      ? <span className="chat-typing-cursor">연결 중… ▌</span>
                      : '')}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input or Payment */}
        {!canStartCounseling ? (
          <div style={{
            padding: '20px', borderTop: '1px solid rgba(255,255,255,.08)',
            textAlign: 'center', background: 'rgba(255,255,255,.02)',
          }}>
            <div style={{ color: '#e8c97e', fontSize: '.85rem', marginBottom: '10px', fontWeight: 700 }}>
              AI 풀이 받기 완료 후 심층 상담을 시작할 수 있습니다
            </div>
            <div style={{ color: 'rgba(255,255,255,.72)', fontSize: '.76rem', lineHeight: 1.5 }}>
              먼저 AI 풀이를 읽어본 뒤 질문하면 더 정확하고 깊은 상담을 받을 수 있어요.
            </div>
          </div>
        ) : !isPaid && result && !isExemptUser && !previewUnlocked ? (
          <div style={{
            padding: '20px', borderTop: '1px solid rgba(255,255,255,.08)',
            textAlign: 'center', background: 'rgba(255,255,255,.02)',
          }}>
            <div style={{ color: '#e8c97e', fontSize: '.85rem', marginBottom: '15px', fontWeight: 600 }}>
              심층 풀이 기반 AI 상담은 1,000원(이벤트가, 정상가 30,000원) 결제 후 이용 가능합니다
            </div>
            {!previewUsed && (
              <button
                type="button"
                onClick={usePreviewOnce}
                style={{
                  marginBottom: 12,
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(139,111,198,.45)',
                  background: 'rgba(139,111,198,.16)',
                  color: '#d9c9ff',
                  fontSize: '.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                무료 미리보기 1회 받기
              </button>
            )}
            {previewUsed && (
              <div style={{ color: 'rgba(255,255,255,.72)', fontSize: '.76rem', marginBottom: 10 }}>
                무료 미리보기 1회를 사용했습니다. 계속 상담하려면 결제를 진행해 주세요.
              </div>
            )}
            <div ref={paypalRef} />
          </div>
        ) : (
          <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.02)' }}>
            {isPaid && timeLeft !== null && (
              <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                <div style={{ fontSize: '.74rem', color: 'rgba(255,255,255,.78)', marginBottom: 6 }}>
                  {timeLeft <= 300 ? '상담 시간이 곧 만료됩니다. 지금 연장할 수 있어요.' : '연장 모드: 필요 시 상담 시간을 30분 추가할 수 있어요.'}
                </div>
                <div ref={paypalExtendRef} />
              </div>
            )}

            {voiceNote && (
              <div style={{
                padding: '8px 12px 0',
                fontSize: '.74rem',
                color: '#ffb3a0',
                lineHeight: 1.45,
              }}>
                {voiceNote}
              </div>
            )}

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
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder={result ? (chatMode === 'compatibility' ? '궁합/비교 질문을 입력하세요...' : '질문을 입력하세요...') : '사주 분석 먼저 해주세요'}
                disabled={loading || !result || (!isPaid && !previewUnlocked)}
                style={{
                  flex: 1, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)',
                  borderRadius: 10, padding: '9px 12px', color: '#e8e8e8', fontSize: '.87rem', outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={toggleVoice}
                disabled={loading}
                title={loading ? '답변 수신 중' : listening ? '녹음 중지' : '음성 입력'}
                style={{
                  padding: '9px 11px',
                  background: listening ? 'rgba(220,50,50,.25)' : 'rgba(255,255,255,.06)',
                  border: `1px solid ${listening ? 'rgba(220,80,80,.5)' : 'rgba(255,255,255,.12)'}`,
                  borderRadius: 10, color: listening ? '#ff6b6b' : 'rgba(255,255,255,.55)',
                  cursor: loading ? 'not-allowed' : 'pointer', fontSize: '1rem',
                  opacity: loading ? 0.45 : 1,
                  animation: listening ? 'pulse 1s infinite, micGlow 1.2s ease-in-out infinite' : 'micGlowIdle 2.2s ease-in-out infinite',
                  boxShadow: listening ? '0 0 14px rgba(255,107,107,.55)' : '0 0 10px rgba(139,111,198,.35)',
                }}
              >🎤</button>
              <button onClick={() => send()} disabled={loading || !input.trim() || !result || (!isPaid && !previewUnlocked)} style={{
                padding: '9px 14px',
                background: 'rgba(232,201,126,.18)', border: '1px solid rgba(232,201,126,.3)',
                borderRadius: 10, color: '#e8c97e', cursor: 'pointer', fontWeight: 700, fontSize: '.87rem',
                opacity: loading || !input.trim() || !result || (!isPaid && !previewUnlocked) ? 0.45 : 1,
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
            setOpen((o) => {
              if (!o) void primeMediaForTts();
              return !o;
            });
          }}
          style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #8b6fc6, #6b4fa6)',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 8px 32px rgba(139,111,198,0.4)',
            cursor: 'pointer', fontSize: '1.4rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff',
            opacity: canStartCounseling ? 1 : 0.8,
            transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          title="AI 심층 상담"
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
