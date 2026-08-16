'use client';
/**
 * AI Saju Analytics Platform - v2.0.3
 * 
 * 주요 변경 사항:
 * - Draft-Review-Type 워크플로우 도입 (전체 생성 후 검토 및 타이핑)
 * - 단계별 로딩 상태 애니메이션 최적화
 * - 스트리밍 데이터 누락 방지 로직 강화
 */

import Link from 'next/link';
import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { SiteNav } from '../site-chrome';
import { calculate, SajuResult } from '../../core/pillar-calc/main-calculator';
import { readSajuFormFromDom, readInitialSajuForm } from '../../lib/toss-form-read';
import { consumePendingResult, consumePendingForm } from '../../lib/toss-standalone-analyze';
import { primeSpeechAudio, speakKoreanQueued, stopKoreanSpeech } from '../../lib/korean-tts';
import { tossTts } from '../../lib/toss-http';
import { playServerTtsAudio } from '../../lib/server-tts-playback';
import {
  buildNaturalTtsUnits,
  SERVER_TTS_PLAYBACK_RATE,
  splitUnitForApi,
} from '../../lib/natural-server-tts';
import {
  STEMS, BRANCHES, STEMS_H, BRANCHES_H, ZODIAC,
  STEM_ELEM, BRANCH_ELEM, ELEM_NAMES, ELEM_NAMES_H, ELEM_COLORS,
  getPillarIdx, Pillar,
} from '../../core/pillar-calc/korean-calendar-engine';
import {
  IJ60_DESC, KEYWORDS_BY_STEM, SCORES_BY_STEM,
  JOBS_BY_STEM, F2026_BY_STEM, getIljooDesc,
} from '../../core/interpretation-db/matcher';
import { buildPrompt } from '../../core/ai-templates/blueprints';
import {
  fortuneSectionNumberedLabel,
  fortuneSectionSortIndex,
} from '../../core/gemma24/fortune-display-order';
import { fetchStream } from '../../core/http-client/stream-fetcher';
import { dailyFortune } from '../../core/daily-fortune';
import type { DailyFortuneResult } from '../../core/daily-fortune';
import {
  buildDailyLuckyNumbersLines,
  parseKstDateString,
  STEM_KO_LABELS,
  YONGSIN_ELEM_CHARS,
} from '../../core/daily-fortune/lucky-numbers';
import { calcStrength, getSipsin, classifyElements } from '../../core/daily-fortune/classifier';
import { buildMonthlyBriefs } from '../../core/daily-fortune/monthly-brief';
import type { MonthlyBrief } from '../../core/daily-fortune/monthly-brief';
import type { OhaengResult } from '../../core/pillar-calc/five-phase-breakdown';
import type { DaeunResult } from '../../core/pillar-calc/grand-fortune';
import type { Shinsal } from '../../core/pillar-calc/celestial-relations';
import { preloadSajuRewardedAd, showSajuRewardedAd } from '../../lib/toss-rewarded-ad';
import CounselPanel from '../counsel/CounselPanel';
import StickyBannerAd from '../components/sticky-banner-ad';
import SajuRealtimeChat from '../components/saju-realtime-chat';

// 음력 변환 (클라이언트 전용)
type MsLib = { lunarToSolar: (y:number,m:number,d:number,leap:boolean)=>{year:number,month:number,day:number} };
let _ms: MsLib | null = null;
if (typeof window !== 'undefined') {
  import('manseryeok').then(mod => { _ms = mod as unknown as MsLib; }).catch(() => {});
}

const THIS_YEAR = new Date().getFullYear();
const APPS_IN_TOSS = true; // 토스 미니앱 전용으로 상시 켜짐

function initTossFormValue<T>(pick: (f: NonNullable<ReturnType<typeof readInitialSajuForm>>) => T, fallback: T): T {
  if (typeof window === 'undefined' || !APPS_IN_TOSS) return fallback;
  const init = readInitialSajuForm();
  return init ? pick(init) : fallback;
}

function showFormError(setter: (msg: string) => void, msg: string) {
  setter(msg);
  if (!APPS_IN_TOSS) alert(msg);
}
// 간지 연도: 갑자(甲子) = 1984 기준
function yearGanji(y: number): { s: number; b: number } {
  return { s: ((y - 4) % 10 + 10) % 10, b: ((y - 4) % 12 + 12) % 12 };
}
const ZODIAC_EMOJI = ['🐭','🐮','🐯','🐰','🐲','🐍','🐎','🐑','🐒','🐓','🐕','🐷'];

const SI_NAMES = ['자시(子時)','축시(丑時)','인시(寅時)','묘시(卯時)','진시(辰時)','사시(巳時)',
                  '오시(午時)','미시(未時)','신시(申時)','유시(酉時)','술시(戌時)','해시(亥時)'];
const fmt = (hh:number,mm:number) => `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
// 00:00~00:30 부터 23:30~00:00 까지 48슬롯, 자시 23:30~01:30 기준
const HOUR_OPTIONS: {v:number; label:string}[] = [{ v:-1, label:'모름 / 미입력' }];
for (let i = 0; i < 48; i++) {
  const totalMin = i * 30; // 0, 30, 60, ..., 1410(23:30)
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  const endMin = totalMin + 30, eh = Math.floor(endMin / 60) % 24, em = endMin % 60;
  const si = SI_NAMES[Math.floor((totalMin + 30) / 120) % 12];
  HOUR_OPTIONS.push({ v: totalMin, label: `${fmt(h,m)}~${fmt(eh,em)} — ${si}` });
}

const TAB_NAMES = ['성격','운세','신살','대운','월별','직업','건강'] as const;
type TabName = typeof TAB_NAMES[number];
const STEM_ICONS = ['🌳','🌿','☀️','🕯️','⛰️','🌾','🪨','💎','🌊','🌧️'];

// 오행 배지 색상 — 목:초록 화:빨강 토:황금 금:은회색 수:딥네이비(검정물)
const ELEM_BADGE = [
  { bg:'rgba(34,160,60,.20)',   border:'rgba(34,160,60,.50)',   text:'#5dce70' }, // 목
  { bg:'rgba(220,50,50,.20)',   border:'rgba(220,50,50,.50)',   text:'#ff7070' }, // 화
  { bg:'rgba(200,150,0,.20)',   border:'rgba(200,150,0,.50)',   text:'#e8c840' }, // 토
  { bg:'rgba(200,200,200,.12)', border:'rgba(200,200,200,.40)', text:'#e0e0e0' }, // 금
  { bg:'rgba(8,16,40,.88)',     border:'rgba(80,120,220,.50)',  text:'#90b8f0' }, // 수
] as const;

// ─── 스타일 헬퍼 ───
const inputStyle: React.CSSProperties = {
  background:'rgba(255,255,255,.06)', border:'1px solid var(--border)',
  borderRadius:10, padding:'11px 13px', color:'var(--text)',
  fontSize:'.92rem', width:'100%', outline:'none',
};
const selectStyle: React.CSSProperties = { ...inputStyle, appearance:'none', WebkitAppearance:'none' as 'none' };
const gBtnStyle: React.CSSProperties = {
  flex:1, padding:11, border:'1px solid var(--border)', borderRadius:10,
  background:'rgba(255,255,255,.05)', color:'var(--muted)', fontSize:'.88rem', fontWeight:700, cursor:'pointer',
};
const calBtnStyle: React.CSSProperties = {
  padding:'5px 14px', borderRadius:100, border:'1px solid var(--border)',
  background:'rgba(255,255,255,.05)', color:'var(--muted)', fontSize:'.78rem', fontWeight:700, cursor:'pointer',
};
const cardStyle: React.CSSProperties = {
  background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:22, marginBottom:16,
};

function Field({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <label style={{ fontSize:'.75rem', fontWeight:700, color:'var(--muted)' }}>{label}</label>
      {children}
    </div>
  );
}

function ElemBadge({ idx }: { idx:number }) {
  const { bg, border, text } = ELEM_BADGE[idx];
  return (
    <span style={{ background:bg, border:`1px solid ${border}`, color:text,
      borderRadius:100, padding:'2px 9px', fontSize:'.72rem', fontWeight:700,
      display:'inline-block', whiteSpace:'nowrap' }}>
      {ELEM_NAMES[idx]}({ELEM_NAMES_H[idx]})
    </span>
  );
}

export default function Home() {
  const [year,   setYear]   = useState(() => initTossFormValue((f) => f.year, ''));
  const [month,  setMonth]  = useState(() => initTossFormValue((f) => f.month, ''));
  const [day,    setDay]    = useState(() => initTossFormValue((f) => f.day, ''));
  const [hour,   setHour]   = useState(() => initTossFormValue((f) => f.hour, '-1'));
  const [name,   setName]   = useState(() => initTossFormValue((f) => f.name, ''));
  const [gender, setGender] = useState<'남'|'여'>(() => initTossFormValue((f) => f.gender, '남'));
  const [lunar,  setLunar]  = useState(() => initTossFormValue((f) => f.lunar, false));
  const [leapM,  setLeapM]  = useState(() => initTossFormValue((f) => f.leapM, false));

  const [result,        setResult]        = useState<SajuResult | null>(null);
  const [fortuneResult, setFortuneResult] = useState<DailyFortuneResult | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [calcTick, setCalcTick] = useState(0);
  const [tab,      setTab]      = useState<TabName>('성격');
  const [aiText,   setAiText]   = useState('');
  /** 스트림 수신 + AI 풀이 화면 표시까지 끝난 뒤 true — 그때부터 AI 심층 상담 이용 */
  const [aiFortuneComplete, setAiFortuneComplete] = useState(false);
  const [aiLoading, setAiLoad] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [waitTick, setWaitTick] = useState(0);
  const steps = [
    "운명의 기운을 읽는 중...", 
    "AI 분석 초안을 작성하는 중...", 
    "내용의 정확도를 최종 검토 중...", 
    "전문적인 조언을 정성껏 작성 중..."
  ];
  /** API 응답 완료 후 풀이 본문을 한 번에 표시하기까지 대기 */
  const AI_RESULT_REVEAL_DELAY_MS = 5000;
  const WAIT_FACT_INTERVAL_MS = 1200;
  const TTS_AFTER_REVEAL_MS = 2000;
  const [showFb,   setShowFb]   = useState(false);
  const [fbDone,   setFbDone]   = useState(false);
  const [comment,  setComment]  = useState('');
  const [copied,        setCopied]        = useState(false);
  const [formError,     setFormError]     = useState('');
  const [adGateOpen,   setAdGateOpen]   = useState(false);
  const lastResult = useRef<SajuResult | null>(null);
  const aiTypeTimerRef = useRef<number | null>(null);
  const aiSpeakDelayRef = useRef<number | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const doAnalyzeRef = useRef<() => void>(() => {});
  const analyzeBusyRef = useRef(false);

  async function runWithTossRewardedAd(): Promise<boolean> {
    if (!APPS_IN_TOSS) return true;
    try {
      await showSajuRewardedAd();
    } catch (err) {
      console.warn('Toss rewarded ad failed or closed:', err);
    }
    return true;
  }

  useEffect(() => {
    doAnalyzeRef.current = doAnalyze;
  });

  useLayoutEffect(() => {
    if (!APPS_IN_TOSS) return;
    const dom = readSajuFormFromDom();
    if (!dom?.year || !dom.month || !dom.day) return;
    setYear(dom.year);
    setMonth(dom.month);
    setDay(dom.day);
    setHour(dom.hour);
    setName(dom.name);
    setGender(dom.gender);
    setLunar(dom.lunar);
    setLeapM(dom.leapM);
  }, []);

  useEffect(() => {
    if (!APPS_IN_TOSS) return;
    const w = window as Window & { __SAJU_ANALYZE__?: () => void; __SAJU_JS_OK__?: boolean };
    w.__SAJU_ANALYZE__ = () => doAnalyzeRef.current();
    w.__SAJU_JS_OK__ = true;
    const wait = document.getElementById('saju-js-wait');
    if (wait) wait.style.display = 'none';
    void preloadSajuRewardedAd();
    return () => {
      delete w.__SAJU_ANALYZE__;
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      setCalcTick(0);
      return;
    }
    const id = setInterval(() => setCalcTick(t => t + 1), 900);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (!aiLoading) {
      setWaitTick(0);
      return;
    }
    const id = setInterval(() => setWaitTick(t => t + 1), 1200);
    return () => clearInterval(id);
  }, [aiLoading]);

  useEffect(() => {
    if (APPS_IN_TOSS) return;
    localStorage.removeItem('saju_year');
    localStorage.removeItem('saju_month');
    localStorage.removeItem('saju_day');
    localStorage.removeItem('saju_hour');
    localStorage.removeItem('saju_name');
    localStorage.removeItem('saju_gender');
    localStorage.removeItem('saju_lunar');
  }, []);

  function save() {
    try {
      localStorage.setItem('saju_year',  year);
      localStorage.setItem('saju_month', month);
      localStorage.setItem('saju_day',   day);
      localStorage.setItem('saju_hour',  hour);
      localStorage.setItem('saju_name',  name);
      localStorage.setItem('saju_gender',gender);
      localStorage.setItem('saju_lunar', lunar?'1':'0');
    } catch {
      /* WebView 저장소 제한 시 무시 */
    }
  }

  function applyPendingResult() {
    const form = consumePendingForm();
    if (form) {
      setYear(form.year);
      setMonth(form.month);
      setDay(form.day);
      setHour(form.hour);
      setName(form.name);
      setGender(form.gender);
      setLunar(form.lunar);
      setLeapM(form.leapM);
    }
    const pending = consumePendingResult();
    if (!pending) return;
    lastResult.current = pending;
    setResult(pending);
    setLoading(false);
    setFormError('');
    try { setFortuneResult(dailyFortune(pending)); } catch { setFortuneResult(null); }
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }

  useEffect(() => {
    if (!APPS_IN_TOSS) return;
    applyPendingResult();
    const onPending = () => applyPendingResult();
    window.addEventListener('saju:pending-result', onPending);
    return () => window.removeEventListener('saju:pending-result', onPending);
  }, []);

  async function doAnalyze() {
    if (analyzeBusyRef.current) return;
    analyzeBusyRef.current = true;
    setFormError('');
    let yStr = year;
    let mStr = month;
    let dStr = day;
    let hStr = hour;
    let g: '남' | '여' = gender;
    let isLunar = lunar;
    let isLeap = leapM;

    if (APPS_IN_TOSS) {
      const dom = readSajuFormFromDom();
      if (dom) {
        yStr = dom.year;
        mStr = dom.month;
        dStr = dom.day;
        hStr = dom.hour;
        g = dom.gender;
        isLunar = dom.lunar;
        isLeap = dom.leapM;
        setYear(yStr);
        setMonth(mStr);
        setDay(dStr);
        setHour(hStr);
        setName(dom.name);
        setGender(g);
        setLunar(isLunar);
        setLeapM(isLeap);
      }
    }

    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const d = parseInt(dStr, 10);
    if (!y || !m || !d) {
      showFormError(setFormError, '생년월일을 모두 입력해주세요.');
      analyzeBusyRef.current = false;
      return;
    }
    if (y < 1900 || y > THIS_YEAR) {
      showFormError(setFormError, `년도는 1900~${THIS_YEAR} 사이로 입력해주세요.`);
      analyzeBusyRef.current = false;
      return;
    }
    let sy = y, sm = m, sd = d;
    if (isLunar) {
      if (!_ms) {
        showFormError(setFormError, '음력 변환 로딩 중입니다. 잠시 후 다시 시도해주세요.');
        analyzeBusyRef.current = false;
        return;
      }
      try {
        const sol = _ms.lunarToSolar(y, m, d, isLeap);
        sy = sol.year; sm = sol.month; sd = sol.day;
      } catch {
        showFormError(setFormError, '음력 날짜 변환 실패. 날짜를 다시 확인해주세요.');
        analyzeBusyRef.current = false;
        return;
      }
    }
    if (!(await runWithTossRewardedAd())) {
      analyzeBusyRef.current = false;
      return;
    }
    save();
    setLoading(true);
    setResult(null);
    setFortuneResult(null);
    setAiText('');
    setAiFortuneComplete(false);
    setShowFb(false);
    setFbDone(false);

    setTimeout(() => {
      try {
        const r = calculate({ year: sy, month: sm, day: sd, hourTotalMin: parseInt(hStr, 10), gender: g });
        lastResult.current = r;
        setResult(r);
        try { setFortuneResult(dailyFortune(r)); } catch { setFortuneResult(null); }
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        askAI();
      } catch (e) {
        const msg = e instanceof Error ? e.message : '사주 계산 중 오류가 발생했습니다.';
        showFormError(setFormError, msg);
      } finally {
        setLoading(false);
        analyzeBusyRef.current = false;
      }
    }, 600);
  }


  async function speakAiFortune(text: string) {
    if (!text.trim()) return;
    stopKoreanSpeech();
    await primeSpeechAudio();

    const units = buildNaturalTtsUnits(text, { counselAnswer: false });
    if (!units.length) return;

    if (APPS_IN_TOSS) {
      let allOk = true;
      for (let ui = 0; ui < units.length; ui++) {
        const unit = units[ui];
        const apiChunks = splitUnitForApi(unit.text);
        for (const chunk of apiChunks) {
          let bridged = await tossTts(chunk, '도화');
          if (!bridged.ok) {
            await new Promise<void>((r) => window.setTimeout(r, 400));
            bridged = await tossTts(chunk, '도화');
          }
          if (!bridged.ok) {
            allOk = false;
            break;
          }
          const ok = await playServerTtsAudio(
            { mimeType: bridged.mimeType, audioBase64: bridged.audioBase64 },
            { playbackRate: SERVER_TTS_PLAYBACK_RATE },
          );
          if (!ok) {
            allOk = false;
            break;
          }
        }
        if (!allOk) break;
        if (unit.pauseAfterMs > 0 && ui < units.length - 1) {
          await new Promise<void>((r) => window.setTimeout(r, unit.pauseAfterMs));
        }
      }
      if (allOk) return;
    }

    const prepared = units.map((u) => u.text).join('\n\n');
    speakKoreanQueued(prepared, {
      counselorName: '도화',
      onChunkError: () => {},
    });
  }

  function clearAiTypeTimer() {
    if (aiTypeTimerRef.current) {
      clearInterval(aiTypeTimerRef.current);
      aiTypeTimerRef.current = null;
    }
  }

  function clearAiSpeakDelay() {
    if (aiSpeakDelayRef.current) {
      clearTimeout(aiSpeakDelayRef.current);
      aiSpeakDelayRef.current = null;
    }
  }

  function clearAiTypingTimers() {
    clearAiTypeTimer();
    clearAiSpeakDelay();
  }

  async function askAI() {
    if (!lastResult.current || aiLoading) return;
    if (!(await runWithTossRewardedAd())) return;
    clearAiTypingTimers();
    stopKoreanSpeech();
    void primeSpeechAudio();
    setAiLoad(true);
    setAiText('');
    setAiFortuneComplete(false);
    setShowFb(false);
    setFbDone(false);
    setLoadingStep(1); // 기운 읽는 중

    let fullText = '';
    let isFinished = false;
    let reviewTimer: ReturnType<typeof setTimeout> | null = null;

    const enterStep3 = () => {
      if (isFinished) return;
      setLoadingStep(3);
    };

    /** 응답 수신 후 5초 뒤 풀이 전체 표시 */
    const scheduleRevealFortune = (show: () => void) => {
      enterStep3();
      reviewTimer = setTimeout(show, AI_RESULT_REVEAL_DELAY_MS);
    };

    // 단계별 메시지 연출 (AI가 깊이 분석하는 느낌)
    const t1 = setTimeout(() => { if (!isFinished) setLoadingStep(2); }, 3000); // 초안 작성 중
    const t2 = setTimeout(() => { if (!isFinished) enterStep3(); }, 7000); // 검토 중
    const tSlow = setTimeout(() => {
      if (!isFinished) setFormError('AI 응답 생성 중입니다. 최대 1~2분 걸릴 수 있어요.');
    }, 25_000);

    const finishAi = (text: string, complete: boolean) => {
      isFinished = true;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(tSlow);
      if (reviewTimer) clearTimeout(reviewTimer);
      setFormError('');
      revealAiFortune(text, complete);
    };

    fetchStream(buildPrompt(lastResult.current), {
      onChunk: t => {
        fullText += t;
        setAiText(fullText);
        if (fullText.length % 500 === 0) {
           setLoadingStep(2); 
        }
      },
      onDone: () => {
        const trimmed = fullText.trim();
        const overload = /확인중입니다|잠시만 기다리세요|한도 초과|혼잡/.test(trimmed);
        if (overload || !trimmed) {
          scheduleRevealFortune(() => {
            finishAi(
              'AI 서버가 혼잡합니다. 1~2분 후 「✦ AI 풀이 받기」를 다시 눌러 주세요.',
              false,
            );
          });
          return;
        }
        finishAi(trimmed, true);
      },
      onError: (err) => {
        console.error('AI Stream Error:', err);
        const errMsg = err.message || '';
        const msg = fullText.trim()
          ? `AI 분석 중 연결이 끊겼습니다. 작성된 내용까지 보여드릴게요.\n\n${fullText}`
          : errMsg.includes('초과') || errMsg.includes('혼잡') || errMsg.includes('받지 못')
            ? `${errMsg}\n\n잠시 후 「✦ AI 풀이 받기」를 다시 눌러 주세요.`
            : 'AI 분석 중 연결이 끊겼습니다. 잠시 후 다시 시도해 주세요.';
        finishAi(msg, Boolean(fullText.trim()));
      },
    });
  }

  async function handleAdditionalQuestion(customPrompt: string) {
    if (!lastResult.current || aiLoading) return;
    setAiLoad(true);
    const prevContext = aiText;
    const promptPayload = `[추가 상담 질문]\n${customPrompt}\n\n[내담자 사주 명식 및 이전 풀이]\n${buildPrompt(lastResult.current)}\n${prevContext.slice(0, 1500)}`;
    
    let chunkAccum = '';
    fetchStream(promptPayload, {
      onChunk: t => {
        chunkAccum += t;
        setAiText(prev => prev + t);
      },
      onDone: () => {
        setAiLoad(false);
      },
      onError: (err) => {
        console.error('Additional question stream error:', err);
        setAiLoad(false);
      }
    });
  }

  const waitFacts = useMemo(() => {
    if (!result) return [];
    const dpLocal = result.pillars[2];
    if (!dpLocal) return [];
    const dayStemIdx = dpLocal.s;
    const dayElemIdx = STEM_ELEM[dayStemIdx];
    const strength = calcStrength(result.pillars, dayElemIdx);
    const cls = classifyElements(dayStemIdx, strength.isWeak, result.ohaeng.counts);
    const elemName = (i: number) => ELEM_NAMES[i] + `(${ELEM_NAMES_H[i]})`;
    const yongsin = elemName(cls.yongsin);
    const huisin = cls.huisin.length ? cls.huisin.map(elemName).join(' · ') : '없음';
    const gisin = cls.gisin.length ? cls.gisin.map(elemName).join(' · ') : '없음';
    const dom = result.ohaeng.counts
      .map((c, i) => ({ c, i }))
      .filter(x => x.c >= 2)
      .sort((a, b) => b.c - a.c)
      .slice(0, 2)
      .map(x => `${elemName(x.i)} ${x.c}개`)
      .join(', ') || '없음';
    const lack = result.ohaeng.counts
      .map((c, i) => ({ c, i }))
      .filter(x => x.c === 0)
      .map(x => elemName(x.i))
      .join(', ') || '없음';

    return [
      `일간은 ${STEMS[dayStemIdx]}(${STEMS_H[dayStemIdx]})이고, 전체 균형은 ${strength.isWeak ? '신약(身弱)' : '신강(身强)'} 쪽이에요.`,
      `오행 분포에서 지배 오행은 ${dom}, 부족 오행은 ${lack}로 잡혔어요.`,
      `용신(用神)은 ${yongsin}이고, 희신(喜神)은 ${huisin}이에요.`,
      `기신(忌神)은 ${gisin}로 분류돼요. 이 관점으로 전 항목이 일관되게 써져요.`,
    ];
  }, [result]);

  const calcSteps = useMemo(() => ([
    '만세력 기준으로 연·월·일·시 간지를 계산하는 중...',
    '오행 분포와 음양 균형을 정리하는 중...',
    '신강·신약을 가중치로 판정하는 중...',
    '용신·희신·기신 분류 규칙을 적용하는 중...',
    '신살과 대운 흐름을 매핑하는 중...',
  ]), []);

  /** 완료 후 대기가 끝나면 풀이 전체를 한 번에 표시 */
  function revealAiFortune(text: string, complete: boolean) {
    clearAiTypingTimers();
    setAiLoad(false);
    setShowFb(true);
    setLoadingStep(0);
    setAiText(text);
    setAiFortuneComplete(complete);

    if (text.trim()) {
      // 음성으로 읽어 주는 기능 끄기 (사용자 요청)
      // aiSpeakDelayRef.current = window.setTimeout(() => {
      //   aiSpeakDelayRef.current = null;
      //   void speakAiFortune(text);
      // }, TTS_AFTER_REVEAL_MS);
    }
  }


  function copyResult() {
    if (!result) return;
    const r = result;
    const pillarLabels = ['연주','월주','일주','시주'];
    const pillarText = r.pillars.map((p, i) =>
      p ? `${pillarLabels[i]}: ${STEMS[p.s]}${BRANCHES[p.b]}` : `${pillarLabels[i]}: 미입력`
    ).join(' | ');
    const yb = r.pillars[0]?.b ?? 0;
    const lines = [
      `■ ${name||'사주'} 님의 사주팔자 분석`,
      `생년월일: ${r.input.year}년 ${r.input.month}월 ${r.input.day}일 (${r.input.gender}성)`,
      ``,
      `[사주팔자]`,
      pillarText,
      ``,
      `띠: ${ZODIAC[yb]}띠 | 일간 오행: ${ELEM_NAMES[STEM_ELEM[r.pillars[2]?.s??0]]}`,
      ``,
      `[오행 분포]`,
      r.ohaeng.counts.map((c,i)=>`${ELEM_NAMES[i]} ${c}개`).join(' · '),
      `보완 오행: ${ELEM_NAMES[r.ohaeng.weakest]}`,
      ...(aiText ? [``, `[AI 심층 풀이]`, aiText] : []),
      ``,
      `— saju.coupax.co.kr`,
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function shareResult() {
    if (!result) return;
    const r = result;
    const dp = r.pillars[2];
    const ds = dp?.s ?? 0;
    const iljoo = dp ? `${STEMS[ds]}${BRANCHES[dp.b]}` : '';
    const ohStr = r.ohaeng.counts.map((c,i)=>`${ELEM_NAMES[i]}${c}`).join('');
    const params = new URLSearchParams({
      name: name || '나의',
      iljoo,
      year: r.input.year.toString(),
      oh: ohStr,
      gender: r.input.gender
    });
    const shareUrl = `https://saju.coupax.co.kr/saju?${params.toString()}`;
    const shareText = `[✦ AI 사주] ${name||'나'}의 사주 정밀 분석 결과!\n\n일주: ${iljoo}일주\n\n지금 바로 소름돋는 상세 풀이를 확인해보세요 👇`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: '✦ AI 사주 정밀 분석',
          text: shareText,
          url: shareUrl
        });
      } catch (err) {
        console.warn('Share failed:', err);
      }
    } else {
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        alert('링크가 복사되었습니다. 카카오톡이나 원하는 곳에 붙여넣기 해주세요!');
      });
    }
  }

  function sendFeedback(rating:number) {
    if (!lastResult.current) return;
    const r = lastResult.current;
    const p0 = r.pillars[0];
    const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '';
    fetch(`${apiBase}/api/feedback`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        saju: p0 ? `${STEMS[p0.s]}${BRANCHES[p0.b]}` : '',
        year:r.input.year, month:r.input.month, day:r.input.day, gender:r.input.gender,
        prompt:buildPrompt(r), response:aiText, rating, comment,
      }),
    }).catch(()=>{});
    setFbDone(true);
  }

  const dp = result?.pillars[2] ?? null;
  const ds = dp?.s ?? 0;

  const yearBranch = result?.pillars[0]?.b ?? 0;

  return (
    <div className="saju-page-root">
      {result && !loading && <ZodiacBackground branch={yearBranch} />}
      <div style={{ position:'relative', zIndex:1, maxWidth:'100%', overflowX:'clip' }}>
      {/* ── Header ── */}
      <SiteNav variant="saju" />

      {/* ── Hero / Form ── */}
      <section className="hero-section">
            <div style={{
              display: 'inline-block', marginBottom: 20,
              padding: '6px 20px', borderRadius: 100,
              background: 'rgba(232, 201, 126, 0.15)',
              border: '1px solid rgba(232, 201, 126, 0.4)',
              fontSize: '.82rem', fontWeight: 700, color: '#e8c97e',
            }}>
              ✦ 무료 사주팔자 정밀 분석
            </div>
        <h1 style={{ fontSize:'clamp(1.8rem,5vw,2.8rem)', fontWeight:900, letterSpacing:-1, lineHeight:1.2, marginBottom:14 }}>
          나의 <span style={{ color:'var(--gold)' }}>사주팔자</span>를<br/>알아보세요
        </h1>
        <p style={{ color:'var(--muted)', fontSize:'.95rem', marginBottom:20 }}>
          생년월일·시간으로 60갑자 일주, 오행, 신살, 대운, {THIS_YEAR}년 운세를 상세하게 분석합니다.
        </p>



        <div className="form-card" style={{ background:'var(--card2)', border:'1px solid var(--border)',
          borderRadius:16, ...(process.env.NEXT_PUBLIC_APPS_IN_TOSS === '1' ? {} : { backdropFilter:'blur(20px)' }), textAlign:'left' }}>
          <div style={{ fontSize:'.9rem', fontWeight:700, color:'var(--gold)', marginBottom:20 }}>☽ 생년월일 입력</div>

          <div className="form-grid">
            <Field label="이름 (선택)">
              <input style={inputStyle} placeholder="홍길동" maxLength={10}
                value={name} onChange={e=>setName(e.target.value)} />
            </Field>
            <Field label="성별">
              <div style={{ display:'flex', gap:8 }}>
                {(['남','여'] as const).map(g=>(
                  <button key={g} onClick={()=>setGender(g)}
                    style={{ ...gBtnStyle, ...(gender===g?{borderColor:'var(--cta)',background:'rgba(184,134,11,.15)',color:'var(--cta)'}:{}) }}>
                    {g}성
                  </button>
                ))}
              </div>
            </Field>

            <div style={{ gridColumn:'1/-1' }}>
              <div style={{ fontSize:'.75rem', fontWeight:700, color:'var(--muted)', marginBottom:6 }}>생년월일</div>
              <div style={{ display:'flex', gap:6, marginBottom:8, alignItems:'center' }}>
                {[false,true].map(isL=>(
                  <button key={String(isL)} onClick={()=>setLunar(isL)}
                    style={{ ...calBtnStyle, ...(lunar===isL?{borderColor:'var(--cta)',background:'rgba(184,134,11,.15)',color:'var(--cta)'}:{}) }}>
                    {isL?'음력':'양력'}
                  </button>
                ))}
                {lunar&&(
                  <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:'.75rem', color:'var(--muted)', marginLeft:4, cursor:'pointer' }}>
                    <input type="checkbox" checked={leapM} onChange={e=>setLeapM(e.target.checked)} style={{ accentColor:'var(--cta)' }} />
                    윤달
                  </label>
                )}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <input type="number" placeholder="년도 (예: 1990)" min={1900} max={THIS_YEAR}
                  value={year} onChange={e=>setYear(e.target.value)} style={{ ...inputStyle, flex:2 }} />
                <select
                  aria-label="월"
                  value={month}
                  onChange={e=>setMonth(e.target.value)}
                  style={{ ...selectStyle, flex:1, cursor:'pointer' }}
                >
                  <option value="">월</option>
                  {Array.from({ length: 12 }, (_, i) => {
                    const v = String(i + 1);
                    return <option key={v} value={v}>{v}월</option>;
                  })}
                </select>
                <select
                  aria-label="일"
                  value={day}
                  onChange={e=>setDay(e.target.value)}
                  style={{ ...selectStyle, flex:1, cursor:'pointer' }}
                >
                  <option value="">일</option>
                  {Array.from({ length: 31 }, (_, i) => {
                    const v = String(i + 1);
                    return <option key={v} value={v}>{v}일</option>;
                  })}
                </select>
              </div>
            </div>

            <div style={{ gridColumn:'1/-1' }}>
              <div style={{ fontSize:'.75rem', fontWeight:700, color:'var(--muted)', marginBottom:6 }}>태어난 시간 (선택 · 30분 단위)</div>
              <select value={hour} onChange={e=>setHour(e.target.value)} style={selectStyle}>
                {HOUR_OPTIONS.map(o=><option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {APPS_IN_TOSS && (
            <p id="saju-js-wait" style={{
              display: 'none', marginTop: 12, padding: '10px 12px', borderRadius: 10,
              background: 'rgba(232,201,126,.12)', border: '1px solid rgba(232,201,126,.35)',
              color: '#f4d889', fontSize: '.85rem', fontWeight: 600,
            }}>
              앱을 불러오는 중이에요. 잠시 후 다시 눌러주세요.
            </p>
          )}
          {formError && (
            <p role="alert" style={{
              marginTop: 12, padding: '10px 12px', borderRadius: 10,
              background: 'rgba(224,85,85,.15)', border: '1px solid rgba(224,85,85,.4)',
              color: '#ff8a8a', fontSize: '.88rem', fontWeight: 600,
            }}>
              {formError}
            </p>
          )}
          <button type="button" data-saju-analyze onClick={doAnalyze} disabled={loading} style={{
            width:'100%', marginTop: formError ? 12 : 20, padding:15,
            background:'var(--cta)', border:'none',
            borderRadius:10, color:'#fff', fontSize:'.98rem', fontWeight:700,
            cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
            animation: loading ? 'none' : 'ctaPulse 2s ease-in-out infinite',
            boxShadow: '0 4px 15px rgba(184,134,11,.2)',
          }}>✦ 운명의 통제권 확보하기</button>
        </div>

      </section>

      {/* ── Loading ── */}
      {loading&&(
        <div style={{ textAlign:'center', padding:'48px 0' }}>
          <div style={{ width:46, height:46, border:'3px solid rgba(255,255,255,.1)',
            borderTopColor:'var(--gold)', borderRadius:'50%',
            animation:'spin .8s linear infinite', margin:'0 auto 14px' }} />
          <p style={{ color:'var(--muted)', fontSize:'.88rem' }}>사주를 정밀 분석 중입니다...</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

          <div style={{
            marginTop: 16,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 14,
            padding: '14px 16px',
            maxWidth: 760,
            marginLeft: 'auto',
            marginRight: 'auto',
            textAlign: 'left',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 800, fontSize: '.88rem' }}>지금 사주 원국을 계산하고 있어요</div>
              <div style={{ fontSize: '.74rem', color: 'var(--muted)' }}>잠시만 기다려주세요</div>
            </div>

            <div style={{ height: 10 }} />

            <div style={{ display: 'grid', gap: 8 }}>
              {calcSteps.slice(0, Math.min(calcSteps.length, Math.max(1, calcTick))).map((t, i) => (
                <div key={i} style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(0,0,0,0.18)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <span className="rotating-star" style={{ marginTop: 1, fontSize: '.9rem', lineHeight: 1 }}>✦</span>
                  <div style={{ fontSize: '.84rem', color: 'rgba(248,246,255,.92)', lineHeight: 1.75 }}>
                    {t}
                  </div>
                </div>
              ))}

              {calcTick < calcSteps.length && (
                <div className="ai-wait-skeleton" style={{
                  height: 44,
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(0,0,0,0.18)',
                  overflow: 'hidden',
                }} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 전역 애니메이션 스타일 (항상 렌더링) ── */}
      <style>{`
        @keyframes btnRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes btnPulse  { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.85; transform: scale(0.97); } }
        @keyframes btnGlow   { 0%, 100% { box-shadow: 0 0 6px rgba(107,79,160,0.5), 0 0 12px rgba(58,123,213,0.3); }
                               50%      { box-shadow: 0 0 22px rgba(107,79,160,0.9), 0 0 36px rgba(58,123,213,0.6); } }
        @keyframes btnShine  { to { left: 110%; } }
        @keyframes blink     { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .analyzing-btn  { animation: btnPulse 1.8s ease-in-out infinite, btnGlow 2.5s ease-in-out infinite !important; }
        .rotating-star  { display: inline-block; animation: btnRotate 1.2s linear infinite; filter: drop-shadow(0 0 4px rgba(255,255,255,0.8)); }
        .btn-shine      { position: absolute; top: 0; left: -110%; width: 60%; height: 100%;
                          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
                          animation: btnShine 1.4s ease-in-out infinite; pointer-events: none; }
        .typing-cursor  { color: #e8c97e; font-weight: 700; animation: blink 0.8s infinite; margin-left: 2px; }
      `}</style>


      {/* ── Results ── */}
      {result&&!loading&&(
        <div ref={resultsRef} className="results-section">
          <div style={{ textAlign:'center', paddingTop:52, marginBottom:28 }}>
            <div style={{ fontSize:'.82rem', color:'var(--muted)', marginBottom:6 }}>{(name||'당신')} 님의 사주 정밀 분석</div>
            <h2 style={{ fontSize:'1.4rem', fontWeight:800 }}>
              <span style={{ color:'var(--gold)' }}>{dp&&STEMS[dp.s]}{dp&&BRANCHES[dp.b]}일주</span>
              {dp&&` — ${getIljooDesc(dp).split('.')[0]}`}
            </h2>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center', marginTop:14 }}>


              <button onClick={copyResult} style={{
                padding:'7px 18px',
                background: copied ? 'rgba(76,190,130,.2)' : 'rgba(255,255,255,.07)',
                border: `1px solid ${copied ? 'rgba(76,190,130,.5)' : 'var(--border)'}`,
                borderRadius:100, color: copied ? '#4cbe82' : 'var(--muted)',
                fontSize:'.8rem', fontWeight:700, cursor:'pointer', transition:'all .25s',
              }}>
                {copied ? '✓ 복사됨!' : '📋 내용 복사'}
              </button>
            </div>
          </div>

          <PillarGrid pillars={result.pillars} />
          <ScoreCards ds={ds} />
          {fortuneResult && <DailyFortuneCard fortune={fortuneResult} dayStemIdx={ds} />}
          {dp&&<IljooCard dp={dp} yearBranch={result.pillars[0]?.b ?? 0} />}
          <OhaengCard ohaeng={result.ohaeng} />


          {/* 탭 */}
          <div style={{ display:'flex', gap:7, marginBottom:16, flexWrap:'wrap' }}>
            {TAB_NAMES.map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{
                padding:'7px 15px', borderRadius:100, cursor:'pointer', fontSize:'.82rem', fontWeight:600,
                border:`1px solid ${tab===t?'var(--cta)':'var(--border)'}`,
                background: tab===t?'rgba(184,134,11,.15)':'var(--card)',
                color: tab===t?'var(--cta)':'var(--muted)',
              }}>{t}</button>
            ))}
          </div>

          <div style={cardStyle}>
            {tab==='성격'&&dp&&<TabSung ds={ds} dp={dp} />}
            {tab==='운세'&&<TabFortune ds={ds} />}
            {tab==='신살'&&<TabShinsal shinsal={result.shinsal} />}
            {tab==='대운'&&<TabDaeun daeun={result.daeun} birthYear={result.input.year} />}
            {tab==='월별'&&<TabMonthly ds={ds} />}
            {tab==='직업'&&<TabJob ds={ds} />}
            {tab==='건강'&&<TabHealth ds={ds} />}
          </div>

          {/* 1:1 대화형 실시간 AI 사주 풀이 (하이브리드 0원 스트리머) */}
          <div style={{ margin:'28px 0' }}>
            <SajuRealtimeChat
              result={result}
              streamText={aiText}
              isStreaming={aiLoading}
              onSendAdditionalPrompt={handleAdditionalQuestion}
            />

            {showFb&&!fbDone&&(
              <div style={{ marginTop:20, padding:'16px 20px', background:'rgba(255,255,255,.03)', borderRadius:14, border:'1px solid rgba(255,255,255,.07)' }}>
                <p style={{ fontSize:'.82rem', color:'var(--muted)', marginBottom:10 }}>이 실시간 사주 풀이가 도움이 되셨나요?</p>
                <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                  <button onClick={()=>sendFeedback(1)} style={{ background:'rgba(76,190,130,.15)',border:'1px solid rgba(76,190,130,.4)',borderRadius:8,color:'#4cbe82',padding:'7px 18px',cursor:'pointer',fontSize:'.85rem',flexShrink:0 }}>👍 도움됐어요</button>
                  <button onClick={()=>sendFeedback(-1)} style={{ background:'rgba(224,85,85,.15)',border:'1px solid rgba(224,85,85,.4)',borderRadius:8,color:'#e05555',padding:'7px 18px',cursor:'pointer',fontSize:'.85rem',flexShrink:0 }}>👎 별로예요</button>
                  <input placeholder="한마디 남겨주세요 (선택)" value={comment} onChange={e=>setComment(e.target.value)}
                    style={{ flex:1,minWidth:160,background:'rgba(255,255,255,.06)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 12px',color:'var(--text)',fontSize:'.85rem',outline:'none' }} />
                </div>
                <p style={{ fontSize:'.75rem', color:'#e05555', marginTop:10, wordBreak:'keep-all', fontWeight:500 }}>
                  * 피드백 데이터는 AI 품질 개선 목적으로만 익명 수집됩니다. 개인정보는 입력하지 마세요.
                </p>
              </div>
            )}
            {fbDone&&<p style={{ marginTop:10, fontSize:'.82rem', color:'#4cbe82', textAlign:'center' }}>✓ 소중한 피드백이 저장되었습니다. 감사합니다!</p>}
          </div>
        </div>
      )}

      <footer className="saju-page-footer" style={{ textAlign:'center', paddingTop:36, paddingLeft:20, paddingRight:20, color:'var(--muted)', fontSize:'.78rem', borderTop:'1px solid var(--border)', marginTop:40 }}>
        <p>사주팔자 무료 정밀 분석 | 본 결과는 전통 동양 철학 기반 참고용 정보입니다.</p>
        <p style={{ marginTop:8, fontSize:'.72rem', opacity:.6 }}>
          이 서비스는{' '}
          <a href="https://github.com/rath/orrery" target="_blank" rel="noopener noreferrer"
            style={{ color:'var(--muted)', textDecoration:'underline' }}>@orrery/core (AGPL-3.0)</a>
          를 사용합니다.{' '}
          <a href="https://github.com/pwcosmos-create/saju-v2" target="_blank" rel="noopener noreferrer"
            style={{ color:'var(--muted)', textDecoration:'underline' }}>소스코드 공개</a>
          {' | '}
          <a href="/privacy" style={{ color:'var(--muted)', textDecoration:'underline' }}>개인정보처리방침</a>
        </p>
      </footer>
      <CounselPanel
        result={result}
        aiSummaryReady={APPS_IN_TOSS ? Boolean(result) : aiFortuneComplete}
      />
      <StickyBannerAd visible={Boolean(result)} />
      </div>{/* /z-index wrapper */}
    </div>
  );
}

// ─── 사주팔자 그리드 ───
function PillarGrid({ pillars }: { pillars:(Pillar|null)[] }) {
  const labels = ['연주 年柱','월주 月柱','일주 日柱','시주 時柱'];
  const sG = ['linear-gradient(135deg,#4cbe82,#2a8c58)','linear-gradient(135deg,#e05555,#b03030)','linear-gradient(135deg,#e8c46a,#c09030)','linear-gradient(135deg,#4a9eff,#2060cc)'];
  const bG = ['linear-gradient(135deg,#3a9e72,#1e7a48)','linear-gradient(135deg,#c04040,#8c2020)','linear-gradient(135deg,#d4b050,#a07820)','linear-gradient(135deg,#3080e0,#1a50b0)'];
  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'26px 20px 22px', marginBottom:16 }}>
      <div style={{ fontSize:'.72rem', fontWeight:700, color:'var(--muted)', textAlign:'center', marginBottom:18, letterSpacing:'.08em' }}>사주팔자 (四柱八字)</div>
      <div className="pillar-grid">
        {pillars.map((p,i)=>(
          <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
            <div style={{ fontSize:'.65rem', color:'var(--muted)', fontWeight:600, marginBottom:2 }}>{labels[i]}</div>
            {p?(
              <>
                <div style={{ width:54,height:54,borderRadius:11,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.35rem',fontWeight:900,background:sG[i],margin:'2px auto' }}>{STEMS_H[p.s]}</div>
                <div style={{ width:54,height:54,borderRadius:11,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.35rem',fontWeight:900,background:bG[i],margin:'2px auto' }}>{BRANCHES_H[p.b]}</div>
                <div style={{ fontSize:'.72rem',color:'var(--muted)' }}>{STEMS[p.s]}{BRANCHES[p.b]}</div>
                <div style={{ display:'flex',gap:3,flexWrap:'wrap',justifyContent:'center' }}>
                  <ElemBadge idx={STEM_ELEM[p.s]} />
                  <ElemBadge idx={BRANCH_ELEM[p.b]} />
                </div>
              </>
            ):(
              <>
                <div style={{ width:54,height:54,borderRadius:11,background:'rgba(255,255,255,.05)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)',margin:'2px auto' }}>?</div>
                <div style={{ width:54,height:54,borderRadius:11,background:'rgba(255,255,255,.05)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)',margin:'2px auto' }}>?</div>
                <div style={{ fontSize:'.72rem',color:'var(--muted)',opacity:.4 }}>미입력</div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreCards({ ds }: { ds:number }) {
  const sc = SCORES_BY_STEM[ds];
  type ScoreKey = keyof typeof sc;
  const cats: {k:ScoreKey; icon:string; color:string}[] = [
    {k:'재물',icon:'💰',color:'#e8c46a'},{k:'연애',icon:'❤️',color:'#e05555'},
    {k:'건강',icon:'🌿',color:'#4cbe82'},{k:'직업',icon:'💼',color:'#4a9eff'},
  ];
  return (
    <div className="score-grid">
      {cats.map(c=>(
        <div key={c.k} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px 12px', textAlign:'center' }}>
          <div style={{ fontSize:'1.3rem', marginBottom:6 }}>{c.icon}</div>
          <div style={{ fontSize:'.68rem', color:'var(--muted)', fontWeight:600, marginBottom:8 }}>{c.k}운</div>
          <div style={{ fontSize:'1.6rem', fontWeight:900, color:'var(--gold)', lineHeight:1 }}>{sc[c.k]}</div>
          <div style={{ height:5,background:'rgba(255,255,255,.08)',borderRadius:100,overflow:'hidden',marginTop:8 }}>
            <div style={{ height:'100%',borderRadius:100,background:c.color,width:`${sc[c.k]}%`,transition:'width 1.2s' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function IljooCard({ dp, yearBranch }: { dp:Pillar; yearBranch:number }) {
  const ds=dp.s, idx=getPillarIdx(dp.s,dp.b);
  return (
    <div className="iljoo-inner" style={{ background:'linear-gradient(135deg,rgba(184,134,11,.12),rgba(173,216,230,.08))',border:'1px solid rgba(184,134,11,.25)',borderRadius:16,padding:22,marginBottom:16 }}>
      <div style={{ fontSize:'2rem',fontWeight:900,color:'var(--gold)',minWidth:70,textAlign:'center',lineHeight:1 }}>
        {STEM_ICONS[ds]}<small style={{ display:'block',fontSize:'.68rem',color:'var(--muted)',marginTop:3 }}>{STEMS[ds]}{BRANCHES[dp.b]}일주</small>
      </div>
      <div>
        <h3 style={{ fontSize:'1rem',fontWeight:800,marginBottom:6 }}>{STEMS[ds]}{BRANCHES[dp.b]}일주 · 띠: {ZODIAC[yearBranch]}띠 · 일간 오행: {ELEM_NAMES[STEM_ELEM[ds]]}</h3>
        <p style={{ fontSize:'.85rem',color:'rgba(240,238,255,.85)',lineHeight:1.75 }}>{IJ60_DESC[idx]}</p>
        <div style={{ display:'flex',flexWrap:'wrap',gap:5,marginTop:10 }}>
          {KEYWORDS_BY_STEM[ds].map(k=>(
            <span key={k} style={{ background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.12)',borderRadius:100,padding:'3px 11px',fontSize:'.72rem',color:'var(--muted)' }}>{k}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function OhaengCard({ ohaeng }: { ohaeng:OhaengResult }) {
  const total=ohaeng.counts.reduce((a,b)=>a+b,0)||1;
  return (
    <div style={cardStyle}>
      <div style={{ fontSize:'.72rem',fontWeight:700,color:'var(--muted)',letterSpacing:'.07em',marginBottom:16 }}>오행 분석 (五行)</div>
      {ohaeng.counts.map((cnt,i)=>(
        <div key={i} style={{ display:'flex',alignItems:'center',gap:10,marginBottom:11 }}>
          <div style={{ minWidth:80 }}><ElemBadge idx={i} /></div>
          <div style={{ flex:1,height:7,background:'rgba(255,255,255,.08)',borderRadius:100,overflow:'hidden' }}>
            <div style={{ height:'100%',borderRadius:100,background:ELEM_COLORS[i],width:`${Math.round(cnt/total*100)}%`,transition:'width 1s' }} />
          </div>
          <div style={{ fontSize:'.8rem',fontWeight:700,minWidth:18,color:ELEM_COLORS[i] }}>{cnt}개</div>
        </div>
      ))}
      <div style={{ marginTop:10,fontSize:'.8rem',background:'rgba(232,196,106,.1)',border:'1px solid rgba(232,196,106,.3)',color:'var(--gold)',padding:'5px 13px',borderRadius:100,display:'inline-block' }}>
        ✦ 보완 필요 오행: <strong>{ELEM_NAMES[ohaeng.weakest]}({ELEM_NAMES_H[ohaeng.weakest]})</strong>
      </div>
      <div style={{ marginTop:14,paddingTop:14,borderTop:'1px solid var(--border)' }}>
        <p style={{ fontSize:'.83rem',color:'var(--muted)',lineHeight:1.7 }}>{ohaeng.detail}</p>
      </div>
    </div>
  );
}

function DailyFortuneCard({ fortune, dayStemIdx }: { fortune: DailyFortuneResult; dayStemIdx: number }) {
  const levelColors: Record<string, string> = {
    '매우 좋음': '#4cbe82', '좋음': '#82d9a8', '보통': '#e8c46a', '주의': '#e09050', '매우 주의': '#e05555',
  };
  const levelDots: Record<string, number> = {
    '매우 좋음': 5, '좋음': 4, '보통': 3, '주의': 2, '매우 주의': 1,
  };
  const color = levelColors[fortune.level] ?? 'var(--muted)';
  const dots  = levelDots[fortune.level] ?? 3;
  const cls   = fortune.classification;
  const luckyLines = useMemo(() => {
    const yongsinElem = YONGSIN_ELEM_CHARS[cls.yongsin] ?? '토';
    const stemKo = STEM_KO_LABELS[dayStemIdx] ?? null;
    return buildDailyLuckyNumbersLines(yongsinElem, stemKo, parseKstDateString(fortune.date));
  }, [cls.yongsin, dayStemIdx, fortune.date]);

  return (
    <div style={{ background:'linear-gradient(135deg,rgba(173,216,230,.08),rgba(184,134,11,.08))',
      border:'1px solid rgba(173,216,230,.25)', borderRadius:16, padding:22, marginBottom:16 }}>
      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14, flexWrap:'wrap', gap:8 }}>
        <div>
          <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:4 }}>오늘의 운세 · {fortune.date}</div>
          <div style={{ fontSize:'1.1rem', fontWeight:800 }}>
            {STEMS_H[fortune.dayGanji.s]}{BRANCHES_H[fortune.dayGanji.b]}일
            <span style={{ fontSize:'.82rem', color:'var(--muted)', fontWeight:400, marginLeft:6 }}>
              ({STEMS[fortune.dayGanji.s]}{BRANCHES[fortune.dayGanji.b]})
            </span>
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:'1.1rem', letterSpacing:2, color }}>
            {'●'.repeat(dots)}<span style={{ opacity:.25 }}>{'●'.repeat(5 - dots)}</span>
          </div>
          <div style={{ fontSize:'.82rem', fontWeight:700, color }}>{fortune.level}</div>
        </div>
      </div>

      {/* 배경 십신 */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
        {([
          { label:'대운', val:fortune.background.daewoonSipsin },
          { label:'세운', val:fortune.background.yearSipsin },
          { label:'월운', val:fortune.background.monthSipsin },
        ] as const).map(({ label, val }) => (
          <div key={label} style={{ background:'rgba(255,255,255,.06)', border:'1px solid var(--border)',
            borderRadius:8, padding:'4px 10px', fontSize:'.75rem' }}>
            <span style={{ color:'var(--muted)' }}>{label} </span>
            <span style={{ fontWeight:700 }}>{val}</span>
          </div>
        ))}
      </div>

      {/* 일진 십신 + 행동 가이드 */}
      <div style={{ background:'rgba(255,255,255,.04)', border:'1px solid var(--border)',
        borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
        <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:4 }}>일진 십신 · 행동 가이드</div>
        <div style={{ display:'flex', alignItems:'baseline', gap:10, flexWrap:'wrap' }}>
          <span style={{ fontSize:'1rem', fontWeight:800, color }}>{fortune.sipsin}</span>
          <span style={{ fontSize:'.85rem', color:'var(--muted)' }}>{fortune.action}</span>
        </div>
      </div>

      {/* 이벤트 뱃지 */}
      {fortune.events.length > 0 && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
          {fortune.events.map((e, i) => {
            const bad = e.type === 'chung' || e.type === 'hyeong';
            const bg  = e.weakened ? 'rgba(255,255,255,.05)' : bad ? 'rgba(224,85,85,.15)' : 'rgba(76,190,130,.15)';
            const bd  = e.weakened ? '1px solid rgba(255,255,255,.15)' : bad ? '1px solid rgba(224,85,85,.4)' : '1px solid rgba(76,190,130,.4)';
            const tc  = e.weakened ? 'var(--muted)' : bad ? '#e05555' : '#4cbe82';
            const lbl = e.type === 'chung' ? '충(沖)' : e.type === 'yughap' ? '육합' : e.type === 'samhap' ? '삼합' : '형(刑)';
            return (
              <span key={i} style={{ background:bg, border:bd, borderRadius:100, padding:'3px 10px',
                fontSize:'.72rem', color:tc, textDecoration:e.weakened?'line-through':'none', opacity:e.weakened?.6:1 }}>
                {lbl}{e.hwaCandidate ? '·합화?' : ''}
              </span>
            );
          })}
        </div>
      )}

      {/* 한줄 요약 */}
      <div style={{ fontSize:'.83rem', color:'var(--muted)', borderTop:'1px solid var(--border)', paddingTop:10, lineHeight:1.6 }}>
        {fortune.oneLiner}
      </div>

      {/* 용신/기신 태그 */}
      <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:10, alignItems:'center' }}>
        <span style={{ fontSize:'.7rem', color:'var(--muted)' }}>용신</span>
        <ElemBadge idx={cls.yongsin} />
        <span style={{ fontSize:'.7rem', color:'var(--muted)', marginLeft:4 }}>기신</span>
        {cls.gisin.map(e => <ElemBadge key={e} idx={e} />)}
      </div>

      {/* 오늘의 추천 숫자 — AI 심층 풀이 10번과 동일 형식 */}
      {luckyLines.length > 0 && (
        <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--border)' }}>
          {renderFortuneLines(luckyLines)}
        </div>
      )}
    </div>
  );
}

function TabSung({ ds, dp }: { ds:number; dp:Pillar }) {
  const el=STEM_ELEM[ds];
  const elemChars=['목(木)의 기운은 봄처럼 새로운 시작과 성장을 상징합니다.','화(火)의 기운은 태양처럼 밝음과 열정을 상징합니다.','토(土)의 기운은 대지처럼 안정과 포용을 상징합니다.','금(金)의 기운은 가을처럼 결실과 결단을 상징합니다.','수(水)의 기운은 물처럼 지혜와 유연함을 상징합니다.'];
  return (
    <div>
      <h3 style={{ fontSize:'.98rem',fontWeight:700,marginBottom:12,color:'var(--gold)' }}>{STEM_ICONS[ds]} {STEMS[ds]}일간 성격 상세 분석</h3>
      <p style={{ fontSize:'.87rem',color:'rgba(240,238,255,.85)',lineHeight:1.8,marginBottom:14 }}>{IJ60_DESC[getPillarIdx(dp.s,dp.b)]}</p>
      <div className="tab-grid-2">
        {[
          {ico:'💼',t:'직업 적성',txt:`${ELEM_NAMES[el]}(${ELEM_NAMES_H[el]}) 기운: ${elemChars[el]}`},
          {ico:'❤️',t:'연애 스타일',txt:ds<5?'한번 마음을 주면 깊게 헌신하는 타입입니다. 내면은 따뜻하고 진지합니다.':'감성적이고 섬세한 사랑을 추구합니다. 공감 능력이 뛰어납니다.'},
          {ico:'💰',t:'재물 성향',txt:el%2===0?'재물을 체계적으로 모으는 능력이 뛰어납니다. 안정적인 저축과 투자를 선호합니다.':'재물 기회가 많지만 지출도 많습니다. 꼼꼼한 수입·지출 관리가 필요합니다.'},
          {ico:'🌿',t:'건강 주의',txt:['관절·근육·간 건강에 유의하세요.','심장·혈액·혈압에 유의하세요.','소화기·위장에 유의하세요.','폐·기관지·피부에 유의하세요.','신장·방광·뼈에 유의하세요.'][el]},
        ].map(c=>(
          <div key={c.t} style={{ background:'rgba(255,255,255,.04)',border:'1px solid var(--border)',borderRadius:10,padding:14 }}>
            <div style={{ fontSize:'.72rem',fontWeight:700,color:'var(--muted)',marginBottom:5 }}>{c.ico} {c.t}</div>
            <p style={{ fontSize:'.8rem',color:'var(--muted)',lineHeight:1.6 }}>{c.txt}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabFortune({ ds }: { ds:number }) {
  const yg = yearGanji(THIS_YEAR);
  const yearTitle = `${THIS_YEAR} ${STEMS[yg.s]}${BRANCHES[yg.b]}년(${STEMS_H[yg.s]}${BRANCHES_H[yg.b]}年)`;
  return (
    <div>
      <h3 style={{ fontSize:'.98rem',fontWeight:700,marginBottom:12,color:'var(--gold)' }}>{ZODIAC_EMOJI[yg.b]} {yearTitle} 운세</h3>
      <p style={{ fontSize:'.87rem',color:'rgba(240,238,255,.85)',lineHeight:1.8 }}>{F2026_BY_STEM[ds]}</p>
    </div>
  );
}

function TabShinsal({ shinsal }: { shinsal:Shinsal[] }) {
  return (
    <div>
      <h3 style={{ fontSize:'.98rem',fontWeight:700,marginBottom:12,color:'var(--gold)' }}>✦ 신살 분석 (神殺)</h3>
      {shinsal.length===0
        ?<p style={{ fontSize:'.85rem',color:'var(--muted)',textAlign:'center',padding:'20px 0' }}>🔍 강하게 발현된 신살이 없습니다.</p>
        :shinsal.map(s=>(
          <div key={s.name} style={{ background:'rgba(255,255,255,.04)',border:'1px solid var(--border)',borderRadius:10,padding:16,marginBottom:10 }}>
            <div style={{ fontSize:'.88rem',fontWeight:700,marginBottom:6,color:'var(--gold)' }}>{s.icon} {s.name}</div>
            <div style={{ fontSize:'.82rem',color:'var(--muted)',lineHeight:1.7 }}>{s.desc}</div>
          </div>
        ))
      }
    </div>
  );
}

function TabDaeun({ daeun, birthYear }: { daeun:DaeunResult; birthYear:number }) {
  const thisYear=THIS_YEAR, dir=daeun.forward?'순행(順行)':'역행(逆行)';
  return (
    <div>
      <h3 style={{ fontSize:'.98rem',fontWeight:700,marginBottom:6,color:'var(--gold)' }}>🔄 대운 흐름 (大運)</h3>
      <p style={{ fontSize:'.83rem',color:'var(--muted)',marginBottom:16 }}>방향: <strong style={{ color:'var(--gold)' }}>{dir}</strong></p>
      <div style={{ display:'flex',gap:8,overflowX:'auto',paddingBottom:8 }}>
        {daeun.pillars.map((p,i)=>{
          const age=daeun.startAge+i*10, startY=birthYear+age, endY=startY+9;
          const isCur=thisYear>=startY&&thisYear<=endY;
          const ec=ELEM_COLORS[STEM_ELEM[p.s]];
          return (
            <div key={i} style={{ minWidth:80,border:`1px solid ${isCur?'var(--gold)':'var(--border)'}`,background:isCur?'rgba(232,196,106,.08)':'rgba(255,255,255,.04)',borderRadius:10,padding:'12px 8px',textAlign:'center',flexShrink:0 }}>
              <div style={{ fontSize:'.65rem',color:'var(--muted)',marginBottom:6 }}>{age}세<br/><span style={{ fontSize:'.6rem' }}>{startY}~{endY}</span></div>
              <div style={{ fontSize:'1.1rem',fontWeight:800,color:ec }}>{STEMS_H[p.s]}</div>
              <div style={{ fontSize:'1.1rem',fontWeight:800,color:ELEM_COLORS[BRANCH_ELEM[p.b]] }}>{BRANCHES_H[p.b]}</div>
              <div style={{ fontSize:'.68rem',color:'var(--muted)',marginTop:3 }}>{STEMS[p.s]}{BRANCHES[p.b]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabMonthly({ ds }: { ds:number }) {
  const el=STEM_ELEM[ds];
  const words=['활기찬 시작','안정적 성장','도약의 기회','새로운 전환','기회 포착','신중한 판단','힘찬 전진','활발한 소통','결실의 수확','인내와 다짐','반전의 기운','마무리와 준비'];
  const stars=[4,3,5,4,5,3,4,4,3,4,5,4];
  return (
    <div>
      <h3 style={{ fontSize:'.98rem',fontWeight:700,marginBottom:16,color:'var(--gold)' }}>📅 {THIS_YEAR}년 월별 운세</h3>
      <div className="monthly-grid">
        {Array.from({length:12},(_,i)=>{
          const v=Math.min(5,Math.max(1,((stars[i]+el+i)%3)+3));
          return (
            <div key={i} style={{ background:'rgba(255,255,255,.04)',border:'1px solid var(--border)',borderRadius:10,padding:'13px 10px' }}>
              <div style={{ fontSize:'.7rem',color:'var(--muted)',marginBottom:4,fontWeight:600 }}>{i+1}월</div>
              <div style={{ fontSize:'.68rem',color:'var(--gold)',marginBottom:4 }}>{'★'.repeat(v)}{'☆'.repeat(5-v)}</div>
              <div style={{ fontSize:'.82rem',fontWeight:700,marginBottom:4 }}>{words[(i+el)%12]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabJob({ ds }: { ds:number }) {
  return (
    <div>
      <h3 style={{ fontSize:'.98rem',fontWeight:700,marginBottom:12,color:'var(--gold)' }}>💼 적합 직업 & 진로</h3>
      <div style={{ marginBottom:16 }}>
        {JOBS_BY_STEM[ds].map(j=>(
          <span key={j} style={{ display:'inline-block',background:'rgba(184,134,11,.12)',border:'1px solid rgba(184,134,11,.25)',borderRadius:100,padding:'4px 13px',margin:3,fontSize:'.82rem',color:'var(--cta)' }}>{j}</span>
        ))}
      </div>
      <div style={{ borderTop:'1px solid var(--border)',paddingTop:14,marginTop:6 }}>
        <div style={{ fontSize:'.82rem',fontWeight:700,color:'var(--muted)',marginBottom:6 }}>⚠️ 직업 선택 시 유의점</div>
        <p style={{ fontSize:'.82rem',color:'var(--muted)',lineHeight:1.7,marginBottom:14 }}>
          {['강한 독립심이 장점이지만 팀워크 환경에서는 마찰이 생길 수 있습니다. 리더 역할을 맡되 타인의 의견을 경청하는 자세가 중요합니다.','강한 독립심이 장점이지만 팀워크 환경에서는 마찰이 생길 수 있습니다. 리더 역할을 맡되 타인의 의견을 경청하는 자세가 중요합니다.','에너지를 다방면에 분산하는 경향이 있습니다. 커리어 목표를 명확히 설정하고 핵심 역량을 집중 개발하세요.','에너지를 다방면에 분산하는 경향이 있습니다. 커리어 목표를 명확히 설정하고 핵심 역량을 집중 개발하세요.','안정을 추구하는 성향이 도전을 가로막을 수 있습니다. 계획된 범위 내에서의 도전도 성장의 기회입니다.','안정을 추구하는 성향이 도전을 가로막을 수 있습니다. 계획된 범위 내에서의 도전도 성장의 기회입니다.','완벽주의로 인해 의사결정이 지연될 수 있습니다. 80점의 빠른 실행이 100점의 늦은 실행보다 나을 때가 많습니다.','완벽주의로 인해 의사결정이 지연될 수 있습니다. 80점의 빠른 실행이 100점의 늦은 실행보다 나을 때가 많습니다.','감정 기복이 업무 집중력에 영향을 줄 수 있습니다. 루틴을 만들어 감정과 업무를 분리하는 훈련이 도움이 됩니다.','감정 기복이 업무 집중력에 영향을 줄 수 있습니다. 루틴을 만들어 감정과 업무를 분리하는 훈련이 도움이 됩니다.'][ds]}
        </p>
        <div style={{ fontSize:'.82rem',fontWeight:700,color:'var(--muted)',marginBottom:6 }}>🤝 궁합 좋은 띠</div>
        <p style={{ fontSize:'.82rem',color:'var(--muted)',lineHeight:1.7 }}>
          {['원숭이(신)띠, 용(진)띠, 쥐(자)띠와 궁합이 좋습니다.','을목(乙): 개(술)띠, 말(오)띠, 돼지(해)띠와 궁합이 좋습니다.','호랑이(인)띠, 말(오)띠, 개(술)띠와 궁합이 좋습니다.','말(오)띠, 개(술)띠, 호랑이(인)띠와 궁합이 좋습니다.','닭(유)띠, 뱀(사)띠, 소(축)띠와 궁합이 좋습니다.','닭(유)띠, 뱀(사)띠, 소(축)띠와 궁합이 좋습니다.','뱀(사)띠, 닭(유)띠, 소(축)띠와 궁합이 좋습니다.','뱀(사)띠, 닭(유)띠, 소(축)띠와 궁합이 좋습니다.','원숭이(신)띠, 쥐(자)띠, 용(진)띠와 궁합이 좋습니다.','토끼(묘)띠, 돼지(해)띠, 양(미)띠와 궁합이 좋습니다.'][ds]}
        </p>
      </div>
    </div>
  );
}

const HEALTH_BY_STEM: {organ:string; tip:string; food:string; exercise:string}[] = [
  { organ:'간·담낭·근육·눈',  tip:'봄철 피로와 눈 충혈에 주의. 스트레스가 간에 직접 영향을 줍니다.',         food:'부추·쑥·녹색채소·신맛 음식',   exercise:'스트레칭·요가·등산' },
  { organ:'간·담낭·신경·관절', tip:'과로와 음주를 삼가고, 규칙적인 수면이 특히 중요합니다.',                 food:'결명자·오미자·신맛 식품',       exercise:'필라테스·자전거·수영' },
  { organ:'심장·소장·혈관·혀', tip:'여름철 열사병·고혈압에 주의. 흥분과 과로를 피하세요.',                   food:'토마토·수박·붉은 팥·쓴맛 식품', exercise:'걷기·수영·태극권' },
  { organ:'심장·혈압·망막·혀', tip:'감정 기복이 심할수록 심혈관에 부담. 명상과 휴식이 보약입니다.',          food:'산사·홍삼·오메가3',             exercise:'저강도 유산소·명상' },
  { organ:'비장·위장·근육·입', tip:'소화 불량과 과식에 주의. 습하고 차가운 음식을 줄이세요.',               food:'황색 곡물·호박·고구마·단맛 자제',exercise:'빠른 걷기·등산·복근 운동' },
  { organ:'비위·췌장·림프·입', tip:'당뇨와 부종에 취약. 단 음식 과다 섭취를 삼가세요.',                     food:'현미·보리·잡곡·쓴맛 채소',     exercise:'스쿼트·수영·필라테스' },
  { organ:'폐·대장·피부·코',   tip:'가을철 건조함과 호흡기 질환에 주의. 금연·금주가 필수입니다.',             food:'배·무·도라지·매운맛 식품 절제', exercise:'달리기·등산·심호흡' },
  { organ:'폐·기관지·피부·코', tip:'알레르기·피부 트러블에 민감. 실내 공기 관리를 철저히 하세요.',           food:'생강차·도라지·연근',            exercise:'걷기·호흡 운동·수영' },
  { organ:'신장·방광·뼈·귀',   tip:'겨울철 체력 저하와 요통에 주의. 과로와 냉기 노출을 피하세요.',           food:'검은콩·검은깨·해산물·짠맛 절제',exercise:'수영·자전거·코어 강화' },
  { organ:'신장·생식기·뼈·귀', tip:'냉증과 호르몬 불균형에 취약. 따뜻하게 하체를 보호하세요.',               food:'흑임자죽·우엉·마·굴',           exercise:'요가·걷기·반신욕' },
];

function TabHealth({ ds }: { ds:number }) {
  const h = HEALTH_BY_STEM[ds];
  const items = [
    { icon:'🫁', label:'주의 장기', value:h.organ },
    { icon:'⚠️', label:'건강 포인트', value:h.tip },
    { icon:'🥗', label:'좋은 음식', value:h.food },
    { icon:'🏃', label:'추천 운동', value:h.exercise },
  ];
  return (
    <div>
      <h3 style={{ fontSize:'.98rem',fontWeight:700,marginBottom:14,color:'var(--gold)' }}>🌿 건강 분석 & 관리법</h3>
      <div className="tab-grid-2">
        {items.map(it=>(
          <div key={it.label} style={{ background:'rgba(76,190,130,.07)',border:'1px solid rgba(76,190,130,.2)',borderRadius:10,padding:14 }}>
            <div style={{ fontSize:'.72rem',fontWeight:700,color:'#4cbe82',marginBottom:5 }}>{it.icon} {it.label}</div>
            <p style={{ fontSize:'.82rem',color:'var(--muted)',lineHeight:1.65 }}>{it.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// 12간지 동물 SVG 실선 경로 (viewBox 0 0 100 100)
const ZODIAC_SVG_PATHS: string[] = [
  // 0: 쥐
  `<ellipse cx="50" cy="60" rx="28" ry="22"/><circle cx="50" cy="34" r="20"/>
   <circle cx="34" cy="18" r="12"/><circle cx="66" cy="18" r="12"/>
   <circle cx="43" cy="30" r="3"/><circle cx="57" cy="30" r="3"/>
   <circle cx="50" cy="40" r="2.5"/>
   <line x1="22" y1="37" x2="46" y2="40"/><line x1="22" y1="43" x2="46" y2="43"/>
   <line x1="78" y1="37" x2="54" y2="40"/><line x1="78" y1="43" x2="54" y2="43"/>
   <path d="M78 66 Q95 60 90 46 Q87 36 98 28"/>
   <ellipse cx="36" cy="80" rx="12" ry="7"/><ellipse cx="64" cy="80" rx="12" ry="7"/>`,
  // 1: 소
  `<rect x="22" y="52" width="56" height="36" rx="10"/><rect x="28" y="22" width="44" height="36" rx="12"/>
   <path d="M32 28 Q14 12 8 22 Q10 32 22 28"/><path d="M68 28 Q86 12 92 22 Q90 32 78 28"/>
   <circle cx="40" cy="36" r="3.5"/><circle cx="60" cy="36" r="3.5"/>
   <ellipse cx="50" cy="50" rx="12" ry="7"/>
   <line x1="45" y1="55" x2="42" y2="62"/><line x1="55" y1="55" x2="58" y2="62"/>
   <line x1="32" y1="88" x2="32" y2="100"/><line x1="44" y1="88" x2="44" y2="100"/>
   <line x1="56" y1="88" x2="56" y2="100"/><line x1="68" y1="88" x2="68" y2="100"/>`,
  // 2: 호랑이
  `<ellipse cx="50" cy="62" rx="32" ry="26"/><circle cx="50" cy="30" r="24"/>
   <path d="M32 16 Q28 6 35 10"/><path d="M68 16 Q72 6 65 10"/>
   <circle cx="40" cy="26" r="4"/><circle cx="60" cy="26" r="4"/>
   <path d="M42 38 Q46 42 50 40 Q54 42 58 38"/>
   <line x1="18" y1="32" x2="44" y2="36"/><line x1="18" y1="38" x2="44" y2="40"/>
   <line x1="82" y1="32" x2="56" y2="36"/><line x1="82" y1="38" x2="56" y2="40"/>
   <line x1="35" y1="54" x2="65" y2="54"/><line x1="38" y1="63" x2="62" y2="63"/>
   <line x1="33" y1="72" x2="67" y2="72"/>
   <line x1="38" y1="88" x2="36" y2="100"/><line x1="62" y1="88" x2="64" y2="100"/>`,
  // 3: 토끼
  `<ellipse cx="50" cy="66" rx="30" ry="24"/><circle cx="50" cy="40" r="20"/>
   <path d="M36 22 Q30 2 34 0 Q40 -2 40 18"/><path d="M64 22 Q70 2 66 0 Q60 -2 60 18"/>
   <circle cx="42" cy="37" r="3.5"/><circle cx="58" cy="37" r="3.5"/>
   <circle cx="50" cy="46" r="4"/>
   <line x1="26" y1="44" x2="46" y2="46"/><line x1="26" y1="49" x2="46" y2="48"/>
   <line x1="74" y1="44" x2="54" y2="46"/><line x1="74" y1="49" x2="54" y2="48"/>
   <circle cx="80" cy="66" r="9"/>
   <line x1="38" y1="90" x2="36" y2="100"/><line x1="62" y1="90" x2="64" y2="100"/>`,
  // 4: 용
  `<path d="M15 85 Q20 68 34 56 Q46 44 56 36 Q68 26 80 18" stroke-width="3"/>
   <circle cx="82" cy="16" r="13"/>
   <path d="M74 7 Q68 0 74 3"/><path d="M90 7 Q96 0 90 4"/>
   <circle cx="77" cy="13" r="3"/><circle cx="87" cy="13" r="3"/>
   <path d="M76 22 Q73 27 77 26"/><path d="M88 22 Q91 27 87 26"/>
   <path d="M44 44 Q37 32 45 27 Q52 34 44 44"/>
   <path d="M60 36 Q54 24 63 19 Q68 27 60 36"/>
   <path d="M15 85 Q5 90 12 97 Q20 103 26 94"/>
   <path d="M12 76 Q2 79 6 89"/>
   <path d="M34 56 Q29 67 38 72 Q43 62 34 56"/>`,
  // 5: 뱀
  `<path d="M10 20 Q22 30 17 46 Q12 62 30 72 Q50 84 62 72 Q78 60 72 44 Q66 30 84 22" stroke-width="4.5"/>
   <ellipse cx="9" cy="17" rx="10" ry="7" transform="rotate(-20,9,17)"/>
   <circle cx="5" cy="13" r="2.5"/><circle cx="13" cy="12" r="2.5"/>
   <path d="M9 22 Q5 28 3 25 M9 22 Q13 28 16 25"/>`,
  // 6: 말
  `<path d="M28 95 L28 62 Q28 44 46 38 L58 36 Q72 36 72 52 L72 68 Q80 76 82 95"/>
   <path d="M46 38 Q44 22 38 14 Q50 8 56 20 L58 36"/>
   <path d="M38 14 Q30 8 26 16 Q30 22 38 14"/>
   <circle cx="42" cy="20" r="2.5"/><circle cx="50" cy="18" r="2.5"/>
   <path d="M36 24 Q32 28 34 32 Q38 30 36 24"/>
   <path d="M72 52 Q84 46 86 36 Q80 30 74 40"/>
   <line x1="28" y1="95" x2="28" y2="102"/><line x1="38" y1="93" x2="38" y2="102"/>
   <line x1="72" y1="95" x2="72" y2="102"/><line x1="82" y1="95" x2="82" y2="102"/>`,
  // 7: 양
  `<ellipse cx="50" cy="66" rx="32" ry="24"/><circle cx="50" cy="36" r="22"/>
   <path d="M34 22 Q26 8 34 14 Q40 20 34 22"/><path d="M66 22 Q74 8 66 14 Q60 20 66 22"/>
   <circle cx="42" cy="32" r="3.5"/><circle cx="58" cy="32" r="3.5"/>
   <path d="M44 46 Q50 52 56 46"/><path d="M46 52 Q50 56 54 52"/>
   <path d="M46 40 Q50 44 54 40"/>
   <ellipse cx="50" cy="60" rx="8" ry="5"/>
   <line x1="36" y1="90" x2="34" y2="100"/><line x1="48" y1="90" x2="46" y2="100"/>
   <line x1="52" y1="90" x2="54" y2="100"/><line x1="64" y1="90" x2="66" y2="100"/>`,
  // 8: 원숭이
  `<ellipse cx="50" cy="64" rx="26" ry="20"/><circle cx="50" cy="36" r="22"/>
   <circle cx="34" cy="32" r="11"/><circle cx="66" cy="32" r="11"/>
   <ellipse cx="50" cy="42" rx="15" ry="10"/>
   <circle cx="43" cy="30" r="3.5"/><circle cx="57" cy="30" r="3.5"/>
   <circle cx="50" cy="39" r="2.5"/>
   <path d="M46 44 Q50 50 54 44"/>
   <line x1="26" y1="64" x2="10" y2="78"/><line x1="74" y1="64" x2="90" y2="78"/>
   <line x1="38" y1="84" x2="36" y2="100"/><line x1="62" y1="84" x2="64" y2="100"/>
   <path d="M64 84 Q78 92 80 80 Q80 68 68 72"/>`,
  // 9: 닭
  `<ellipse cx="42" cy="62" rx="26" ry="22"/><circle cx="42" cy="34" r="18"/>
   <path d="M36 18 Q32 6 38 4 Q46 2 44 16"/>
   <path d="M44 28 Q52 24 56 18 Q58 28 50 32"/>
   <path d="M34 46 Q26 50 24 45 Q26 40 34 43"/>
   <circle cx="36" cy="29" r="3.5"/><circle cx="48" cy="30" r="3.5"/>
   <path d="M38 42 Q42 46 46 42"/>
   <path d="M68 52 Q84 36 90 44 Q88 56 78 58"/>
   <path d="M68 60 Q86 54 90 64 Q88 74 76 72"/>
   <path d="M68 70 Q84 66 86 78 Q80 88 70 82"/>
   <line x1="36" y1="84" x2="34" y2="100"/><line x1="50" y1="84" x2="52" y2="100"/>`,
  // 10: 개
  `<ellipse cx="50" cy="64" rx="30" ry="22"/><circle cx="50" cy="36" r="22"/>
   <path d="M26 26 Q14 14 18 28 Q22 40 30 32"/><path d="M74 26 Q86 14 82 28 Q78 40 70 32"/>
   <circle cx="42" cy="32" r="3.5"/><circle cx="58" cy="32" r="3.5"/>
   <ellipse cx="50" cy="44" rx="9" ry="6"/>
   <path d="M44 48 Q50 54 56 48"/>
   <line x1="24" y1="42" x2="44" y2="44"/><line x1="24" y1="47" x2="44" y2="46"/>
   <line x1="76" y1="42" x2="56" y2="44"/><line x1="76" y1="47" x2="56" y2="46"/>
   <path d="M80 58 Q92 52 94 44 Q90 40 86 50"/>
   <line x1="36" y1="86" x2="34" y2="100"/><line x1="64" y1="86" x2="66" y2="100"/>`,
  // 11: 돼지
  `<ellipse cx="50" cy="66" rx="35" ry="26"/><circle cx="50" cy="34" r="26"/>
   <circle cx="34" cy="24" r="11"/><circle cx="66" cy="24" r="11"/>
   <ellipse cx="50" cy="48" rx="17" ry="12"/>
   <circle cx="45" cy="48" r="3"/><circle cx="55" cy="48" r="3"/>
   <circle cx="42" cy="28" r="3.5"/><circle cx="58" cy="28" r="3.5"/>
   <path d="M44 42 Q50 46 56 42"/>
   <path d="M85 58 Q96 52 94 66 Q90 78 80 70"/>
   <line x1="34" y1="90" x2="32" y2="100"/><line x1="44" y1="92" x2="42" y2="100"/>
   <line x1="56" y1="92" x2="58" y2="100"/><line x1="66" y1="90" x2="68" y2="100"/>`,
];

function makeSvgUrl(content: string, size: number, sw = 1.5): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" stroke="white" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function ZodiacBackground({ branch }: { branch: number }) {
  const content = ZODIAC_SVG_PATHS[branch];

  const leftItems = [
    { top:'4%',  size:160, sw:1.4, delay:'0s',   dur:'14s', op:0.14 },
    { top:'28%', size:110, sw:1.7, delay:'2.5s', dur:'10s', op:0.11 },
    { top:'55%', size:180, sw:1.3, delay:'1.2s', dur:'16s', op:0.13 },
    { top:'80%', size:125, sw:1.6, delay:'3.5s', dur:'12s', op:0.10 },
  ];
  const rightItems = [
    { top:'10%', size:145, sw:1.5, delay:'1.5s', dur:'13s', op:0.12 },
    { top:'36%', size:195, sw:1.2, delay:'0.5s', dur:'17s', op:0.09 },
    { top:'62%', size:120, sw:1.8, delay:'2.0s', dur:'12s', op:0.13 },
    { top:'86%', size:165, sw:1.4, delay:'0.8s', dur:'15s', op:0.11 },
  ];

  return (
    <>
      <style>{`
        @keyframes zodiacFloatL {
          0%   { transform: translate(0px, 0px)    rotate(-2deg); }
          20%  { transform: translate(18px, -14px) rotate(2deg);  }
          45%  { transform: translate(32px, -26px) rotate(4deg);  }
          65%  { transform: translate(20px, -16px) rotate(1deg);  }
          80%  { transform: translate(10px, -8px)  rotate(-1deg); }
          100% { transform: translate(0px, 0px)    rotate(-2deg); }
        }
        @keyframes zodiacFloatR {
          0%   { transform: translate(0px, 0px)     rotate(2deg);  }
          20%  { transform: translate(-18px, -14px) rotate(-2deg); }
          45%  { transform: translate(-32px, -26px) rotate(-4deg); }
          65%  { transform: translate(-20px, -16px) rotate(-1deg); }
          80%  { transform: translate(-10px, -8px)  rotate(1deg);  }
          100% { transform: translate(0px, 0px)     rotate(2deg);  }
        }
        @keyframes zodiacAppear {
          from { opacity:0; }
          to   { opacity:1; }
        }
      `}</style>
      <div style={{ position:'fixed', top:0, left:0, width:'11%', height:'100%', pointerEvents:'none', zIndex:0, overflow:'hidden' }}>
        {leftItems.map((item, i) => (
          <img key={i} src={makeSvgUrl(content, item.size, item.sw)} alt="" style={{
            position:'absolute',
            left:`-${Math.round(item.size * 0.45)}px`,
            top: item.top,
            opacity: item.op,
            filter:'drop-shadow(0 0 10px rgba(139,111,198,0.5)) drop-shadow(0 0 24px rgba(139,111,198,0.2))',
            animation:`zodiacFloatL ${item.dur} ease-in-out ${item.delay} infinite, zodiacAppear 2s ease ${item.delay} both`,
          }} />
        ))}
      </div>
      <div style={{ position:'fixed', top:0, right:0, width:'11%', height:'100%', pointerEvents:'none', zIndex:0, overflow:'hidden' }}>
        {rightItems.map((item, i) => (
          <img key={i} src={makeSvgUrl(content, item.size, item.sw)} alt="" style={{
            position:'absolute',
            right:`-${Math.round(item.size * 0.45)}px`,
            top: item.top,
            opacity: item.op,
            filter:'drop-shadow(0 0 10px rgba(232,196,106,0.5)) drop-shadow(0 0 24px rgba(232,196,106,0.2))',
            animation:`zodiacFloatR ${item.dur} ease-in-out ${item.delay} infinite, zodiacAppear 2s ease ${item.delay} both`,
          }} />
        ))}
      </div>
    </>
  );
}

// ─── 오행 레이더 차트 (오각형 SVG) ───
const ELEM_COLORS_VIZ = ['#3db550','#e03030','#d4a800','#c0c0c0','#4488cc'];
const ELEM_LABELS     = ['목(木)','화(火)','토(土)','금(金)','수(水)'];

function OhaengRadar({ counts }: { counts: number[] }) {
  const cx = 80, cy = 80, R = 58, r0 = 10;
  const max = Math.max(...counts, 1);
  const angles = [-90, -18, 54, 126, 198].map(d => d * Math.PI / 180);

  const gridPts = (ratio: number) =>
    angles.map(a => [cx + ratio * R * Math.cos(a), cy + ratio * R * Math.sin(a)] as [number,number]);

  const outerPts = gridPts(1);
  const dataPts  = angles.map((a, i) => {
    const ratio = r0/R + (1 - r0/R) * counts[i] / max;
    return [cx + ratio * R * Math.cos(a), cy + ratio * R * Math.sin(a)] as [number,number];
  });

  const toPath = (pts: [number,number][]) => pts.map((p,i) => `${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z';

  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:6, fontWeight:700 }}>오행 분포</div>
      <svg width={160} height={160} viewBox="0 0 160 160">
        {/* 그리드 */}
        {[0.25,0.5,0.75,1].map(r => (
          <polygon key={r} points={gridPts(r).map(p=>p.join(',')).join(' ')}
            fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={0.8} />
        ))}
        {outerPts.map((p,i) => (
          <line key={i} x1={cx} y1={cy} x2={p[0]} y2={p[1]}
            stroke="rgba(255,255,255,.1)" strokeWidth={0.8} />
        ))}
        {/* 데이터 영역 */}
        <path d={toPath(dataPts)} fill="rgba(139,111,198,.35)" stroke="#8b6fc6" strokeWidth={1.5} />
        {/* 점 + 값 */}
        {dataPts.map((p,i) => (
          <g key={i}>
            <circle cx={p[0]} cy={p[1]} r={3} fill={ELEM_COLORS_VIZ[i]} />
          </g>
        ))}
        {/* 레이블 */}
        {outerPts.map((_p,i) => {
          const lx = cx + (R+16) * Math.cos(angles[i]);
          const ly = cy + (R+16) * Math.sin(angles[i]);
          return (
            <text key={i} x={lx} y={ly+4} textAnchor="middle"
              fontSize={9} fontWeight={700} fill={counts[i]>0?ELEM_COLORS_VIZ[i]:'rgba(255,255,255,.3)'}>
              {ELEM_LABELS[i].split('(')[0]} {counts[i]}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ─── AI 풀이 섹션 시각 배너 SVG ───
function SectionBanner({ sectionId }: { sectionId: string }) {
  const configs: Record<string, { gradient: string; svgContent: React.ReactNode; label: string; labelColor: string }> = {
    '1': {
      gradient: 'linear-gradient(135deg, #1a0e3a 0%, #2d1b5e 50%, #0e1a3a 100%)',
      label: '일주 분석', labelColor: '#c4a8ff',
      svgContent: (
        <>
          <style>{`
            @keyframes sec1rotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
            @keyframes sec1pulse { 0%,100%{opacity:.6;r:36} 50%{opacity:1;r:40} }
            @keyframes sec1line { 0%,100%{opacity:.3} 50%{opacity:.9} }
          `}</style>
          <defs>
            <radialGradient id="sg1a" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#c4a8ff" stopOpacity="0.5"/>
              <stop offset="100%" stopColor="#4a1e8a" stopOpacity="0"/>
            </radialGradient>
          </defs>
          <circle cx="200" cy="55" r="90" fill="url(#sg1a)" style={{animation:'sec1pulse 3s ease-in-out infinite'}}/>
          {[0,36,72,108,144,180,216,252,288,324].map((deg,i)=>{
            const r1=28, r2=55, cx2=200, cy2=55;
            const a=deg*Math.PI/180;
            return <line key={i} x1={cx2+r1*Math.cos(a)} y1={cy2+r1*Math.sin(a)} x2={cx2+r2*Math.cos(a)} y2={cy2+r2*Math.sin(a)} stroke="#c4a8ff" strokeWidth="1" strokeOpacity="0.5" style={{animation:`sec1line 2s ${i*0.2}s ease-in-out infinite`}}/>;
          })}
          {['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'].map((c,i)=>{
            const a=(i*36-90)*Math.PI/180;
            return <text key={i} x={200+68*Math.cos(a)} y={55+68*Math.sin(a)+4} textAnchor="middle" fontSize="10" fill="#c4a8ff" fillOpacity="0.8" fontWeight="700">{c}</text>;
          })}
          <g style={{animation:'sec1rotate 18s linear infinite',transformOrigin:'200px 55px'}}>
            {[0,45,90,135,180,225,270,315].map((deg,i)=>{
              const a=deg*Math.PI/180;
              return <line key={i} x1={200+22*Math.cos(a)} y1={55+22*Math.sin(a)} x2={200+52*Math.cos(a)} y2={55+52*Math.sin(a)} stroke="#8b6fc6" strokeWidth="0.8" strokeOpacity="0.6"/>;
            })}
          </g>
          <circle cx="200" cy="55" r="12" fill="none" stroke="#e8c97e" strokeWidth="2"/>
          <text x="200" y="59" textAnchor="middle" fontSize="12" fill="#e8c97e" fontWeight="900">日</text>
          <line x1="10" y1="55" x2="140" y2="55" stroke="#4a1e8a" strokeWidth="0.6" strokeOpacity="0.5"/>
          <line x1="260" y1="55" x2="390" y2="55" stroke="#4a1e8a" strokeWidth="0.6" strokeOpacity="0.5"/>
        </>
      ),
    },
    '2': {
      gradient: 'linear-gradient(135deg, #0a1e3a 0%, #0e2d4a 50%, #061428 100%)',
      label: '운세 흐름', labelColor: '#90b8f0',
      svgContent: (
        <>
          <style>{`
            @keyframes sec2wave { 0%{d:path("M0,55 Q50,35 100,55 Q150,75 200,55 Q250,35 300,55 Q350,75 400,55")} 50%{d:path("M0,55 Q50,75 100,55 Q150,35 200,55 Q250,75 300,55 Q350,35 400,55")} 100%{d:path("M0,55 Q50,35 100,55 Q150,75 200,55 Q250,35 300,55 Q350,75 400,55")} }
            @keyframes sec2glow { 0%,100%{opacity:.4;r:3} 50%{opacity:1;r:5} }
          `}</style>
          <defs>
            <linearGradient id="sg2a" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#90b8f0" stopOpacity="0"/>
              <stop offset="30%" stopColor="#90b8f0" stopOpacity="0.8"/>
              <stop offset="70%" stopColor="#4a9eff" stopOpacity="0.8"/>
              <stop offset="100%" stopColor="#4a9eff" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d="M0,55 Q50,35 100,55 Q150,75 200,55 Q250,35 300,55 Q350,75 400,55" fill="none" stroke="url(#sg2a)" strokeWidth="2.5" style={{animation:'sec2wave 4s ease-in-out infinite'}}/>
          <path d="M0,55 Q50,75 100,55 Q150,35 200,55 Q250,75 300,55 Q350,35 400,55" fill="none" stroke="#4a9eff" strokeWidth="1" strokeOpacity="0.3"/>
          {[0,1,2,3,4,5,6,7].map(i=>(
            <circle key={i} cx={50*i+25} cy={i%2===0?40:70} r="3.5" fill="#90b8f0" fillOpacity="0.7" style={{animation:`sec2glow 2s ${i*0.25}s ease-in-out infinite`}}/>
          ))}
          {['大運','歲運','月運','日運'].map((t,i)=>(
            <text key={i} x={50+i*90} y="20" textAnchor="middle" fontSize="9" fill="#90b8f0" fillOpacity="0.6" fontWeight="700">{t}</text>
          ))}
        </>
      ),
    },
    '3': {
      gradient: 'linear-gradient(135deg, #1e1a0a 0%, #3a2e0a 50%, #1a1400 100%)',
      label: '오행 분석', labelColor: '#f5d67a',
      svgContent: (
        <>
          <style>{`@keyframes sec3spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes sec3pop{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}`}</style>
          <defs>
            <radialGradient id="sg3a" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#f5d67a" stopOpacity="0.25"/>
              <stop offset="100%" stopColor="#c09030" stopOpacity="0"/>
            </radialGradient>
          </defs>
          <circle cx="200" cy="55" r="80" fill="url(#sg3a)"/>
          {(['木','火','土','金','水'] as const).map((c,i)=>{
            const a=(i*72-90)*Math.PI/180;
            const cols=['#3db550','#e03030','#d4a800','#c0c0c0','#4488cc'];
            const cx2=200+60*Math.cos(a), cy2=55+60*Math.sin(a);
            return (
              <g key={i} style={{animation:`sec3pop 3s ${i*0.6}s ease-in-out infinite`,transformOrigin:`${cx2}px ${cy2}px`}}>
                <circle cx={cx2} cy={cy2} r="18" fill={cols[i]} fillOpacity="0.2" stroke={cols[i]} strokeWidth="1.5" strokeOpacity="0.7"/>
                <text x={cx2} y={cy2+5} textAnchor="middle" fontSize="13" fill={cols[i]} fontWeight="900">{c}</text>
              </g>
            );
          })}
          <g style={{animation:'sec3spin 20s linear infinite',transformOrigin:'200px 55px'}}>
            {[0,72,144,216,288].map((deg,i)=>{
              const a1=(deg-90)*Math.PI/180, a2=((deg+72)-90)*Math.PI/180;
              return <line key={i} x1={200+42*Math.cos(a1)} y1={55+42*Math.sin(a1)} x2={200+42*Math.cos(a2)} y2={55+42*Math.sin(a2)} stroke="#f5d67a" strokeWidth="0.8" strokeOpacity="0.4"/>;
            })}
          </g>
        </>
      ),
    },
    '4': {
      gradient: 'linear-gradient(135deg, #0a1e12 0%, #0e2d1a 50%, #061408 100%)',
      label: '오행 균형', labelColor: '#5dce70',
      svgContent: (
        <>
          <style>{`@keyframes sec4radar{0%,100%{opacity:.5}50%{opacity:1}} @keyframes sec4dot{0%,100%{r:3}50%{r:6}}`}</style>
          <defs>
            <radialGradient id="sg4a" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#5dce70" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="#2a8c40" stopOpacity="0"/>
            </radialGradient>
          </defs>
          {[0.25,0.5,0.75,1].map(r=>{
            const pts=[[-90,-18,54,126,198].map(d=>d*Math.PI/180).map(a=>`${200+60*r*Math.cos(a)},${55+55*r*Math.sin(a)}`).join(' ')];
            return <polygon key={r} points={pts[0]} fill="none" stroke="#5dce70" strokeWidth="0.8" strokeOpacity={r*0.4}/>;
          })}
          {[-90,-18,54,126,198].map((deg,i)=>{
            const a=deg*Math.PI/180;
            return <line key={i} x1="200" y1="55" x2={200+60*Math.cos(a)} y2={55+55*Math.sin(a)} stroke="#5dce70" strokeWidth="0.6" strokeOpacity="0.3"/>;
          })}
          <polygon points={[-90,-18,54,126,198].map(d=>d*Math.PI/180).map((a,i)=>{const r=[0.8,0.5,0.7,0.9,0.4][i];return `${200+60*r*Math.cos(a)},${55+55*r*Math.sin(a)}`;}).join(' ')} fill="#5dce70" fillOpacity="0.25" stroke="#5dce70" strokeWidth="1.5" style={{animation:'sec4radar 3s ease-in-out infinite'}}/>
          {[-90,-18,54,126,198].map((deg,i)=>{
            const a=deg*Math.PI/180, cols=['#3db550','#e03030','#d4a800','#c0c0c0','#4488cc'], r=[0.8,0.5,0.7,0.9,0.4][i];
            return <circle key={i} cx={200+60*r*Math.cos(a)} cy={55+55*r*Math.sin(a)} r="4" fill={cols[i]} style={{animation:`sec4dot 2s ${i*0.4}s ease-in-out infinite`}}/>;
          })}
        </>
      ),
    },
    '5': {
      gradient: 'linear-gradient(135deg, #1a0e2e 0%, #2a1a4a 50%, #0e0a1e 100%)',
      label: '신살 분석', labelColor: '#c4a8ff',
      svgContent: (
        <>
          <style>{`@keyframes sec5star{0%,100%{transform:scale(1) rotate(0deg);opacity:.7}50%{transform:scale(1.3) rotate(15deg);opacity:1}} @keyframes sec5orbit{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          <defs>
            <radialGradient id="sg5a" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#c4a8ff" stopOpacity="0.35"/>
              <stop offset="100%" stopColor="#4a1e8a" stopOpacity="0"/>
            </radialGradient>
          </defs>
          <circle cx="200" cy="55" r="70" fill="url(#sg5a)"/>
          {[0,45,90,135,180,225,270,315].map((deg,i)=>{
            const a=deg*Math.PI/180, r=50;
            return <circle key={i} cx={200+r*Math.cos(a)} cy={55+r*Math.sin(a)} r="2.5" fill="#c4a8ff" fillOpacity="0.6" style={{animation:`sec5star 2.5s ${i*0.3}s ease-in-out infinite`,transformOrigin:`${200+r*Math.cos(a)}px ${55+r*Math.sin(a)}px`}}/>;
          })}
          <g style={{animation:'sec5orbit 12s linear infinite',transformOrigin:'200px 55px'}}>
            <ellipse cx="200" cy="55" rx="35" ry="18" fill="none" stroke="#8b6fc6" strokeWidth="1" strokeOpacity="0.7" strokeDasharray="4 3"/>
          </g>
          <text x="200" y="51" textAnchor="middle" fontSize="11" fill="#e8c97e" fontWeight="900">天</text>
          <text x="200" y="66" textAnchor="middle" fontSize="11" fill="#e8c97e" fontWeight="900">乙</text>
          <text x="200" y="82" textAnchor="middle" fontSize="8" fill="#c4a8ff" fontWeight="700">귀인</text>
        </>
      ),
    },
    '6': {
      gradient: 'linear-gradient(135deg, #1e1400 0%, #3a2800 50%, #1a1000 100%)',
      label: '직업·적성', labelColor: '#f5d67a',
      svgContent: (
        <>
          <style>{`@keyframes sec6bar{0%{width:0}100%{width:var(--tw)}} @keyframes sec6shine{0%,100%{opacity:.3}50%{opacity:.8}}`}</style>
          {[{y:20,w:220,c:'#f5d67a'},{y:36,w:170,c:'#e8a054'},{y:52,w:240,c:'#4cbe82'},{y:68,w:150,c:'#90b8f0'},{y:84,w:200,c:'#c4a8ff'}].map((b,i)=>(
            <g key={i}>
              <rect x="30" y={b.y} width="340" height="12" rx="6" fill="rgba(255,255,255,0.05)"/>
              <rect x="30" y={b.y} width={b.w} height="12" rx="6" fill={b.c} fillOpacity="0.7" style={{animation:`sec6shine 2s ${i*0.4}s ease-in-out infinite`}}/>
            </g>
          ))}
          {['재물','명예','직업','건강','대인'].map((t,i)=>(
            <text key={i} x="18" y={26+i*16} textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.5)">{t}</text>
          ))}
        </>
      ),
    },
    '7': {
      gradient: 'linear-gradient(135deg, #0a1e2e 0%, #0e2840 50%, #060e20 100%)',
      label: '인간관계', labelColor: '#90b8f0',
      svgContent: (
        <>
          <style>{`@keyframes sec7node{0%,100%{r:8;opacity:.7}50%{r:11;opacity:1}} @keyframes sec7line{0%,100%{strokeOpacity:.2}50%{strokeOpacity:.8}}`}</style>
          {[[200,55],[130,25],[270,25],[100,70],[300,70],[150,90],[250,90]].map(([x,y],i)=>(
            <circle key={i} cx={x} cy={y} r={i===0?14:9} fill={i===0?'#e8c97e':'#90b8f0'} fillOpacity={i===0?0.8:0.5} style={{animation:`sec7node 2s ${i*0.3}s ease-in-out infinite`}}/>
          ))}
          {[[200,55,130,25],[200,55,270,25],[200,55,100,70],[200,55,300,70],[200,55,150,90],[200,55,250,90]].map(([x1,y1,x2,y2],i)=>(
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#90b8f0" strokeWidth="1.5" strokeOpacity="0.4" style={{animation:`sec7line 2.5s ${i*0.25}s ease-in-out infinite`}}/>
          ))}
        </>
      ),
    },
    '8': {
      gradient: 'linear-gradient(135deg, #0a1e0e 0%, #0e2a14 50%, #061008 100%)',
      label: '재물·금전', labelColor: '#5dce70',
      svgContent: (
        <>
          <style>{`@keyframes sec8rise{0%{transform:translateY(0) scaleY(1)}50%{transform:translateY(-6px) scaleY(1.1)}100%{transform:translateY(0) scaleY(1)}} @keyframes sec8glow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.5)}}`}</style>
          <defs>
            <linearGradient id="sg8a" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#4cbe82" stopOpacity="0.1"/>
              <stop offset="100%" stopColor="#4cbe82" stopOpacity="0.8"/>
            </linearGradient>
          </defs>
          {[{x:40,h:35,d:'0s'},{x:80,h:55,d:'0.2s'},{x:120,h:45,d:'0.4s'},{x:160,h:70,d:'0.6s'},{x:200,h:50,d:'0.8s'},{x:240,h:80,d:'1s'},{x:280,h:60,d:'1.2s'},{x:320,h:90,d:'1.4s'}].map((b,i)=>(
            <rect key={i} x={b.x} y={105-b.h} width="24" height={b.h} rx="4" fill="url(#sg8a)" style={{animation:`sec8rise 3s ${b.d} ease-in-out infinite`,transformOrigin:`${b.x+12}px 105px`}}/>
          ))}
          <path d="M40,80 Q80,70 120,75 Q160,60 200,65 Q240,55 280,48 Q320,42 360,30" fill="none" stroke="#5dce70" strokeWidth="2" strokeOpacity="0.8"/>
          <circle cx="360" cy="30" r="5" fill="#5dce70"/>
        </>
      ),
    },
    '9': {
      gradient: 'linear-gradient(135deg, #1e0a0e 0%, #3a0e18 50%, #1a0608 100%)',
      label: '월별 운세', labelColor: '#ff9a7a',
      svgContent: (
        <>
          <style>{`@keyframes sec9wave2{0%,100%{d:path("M0,65 Q33,45 66,65 Q100,85 133,65 Q167,45 200,65 Q233,85 267,65 Q300,45 333,65 Q367,85 400,65")}50%{d:path("M0,65 Q33,85 66,65 Q100,45 133,65 Q167,85 200,65 Q233,45 267,65 Q300,85 333,65 Q367,45 400,65")}}`}</style>
          <defs>
            <linearGradient id="sg9a" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff9a7a" stopOpacity="0"/>
              <stop offset="50%" stopColor="#ff9a7a" stopOpacity="0.7"/>
              <stop offset="100%" stopColor="#ff9a7a" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d="M0,65 Q33,45 66,65 Q100,85 133,65 Q167,45 200,65 Q233,85 267,65 Q300,45 333,65 Q367,85 400,65" fill="none" stroke="url(#sg9a)" strokeWidth="2.5" style={{animation:'sec9wave2 5s ease-in-out infinite'}}/>
          {Array.from({length:12},(_,i)=>(
            <g key={i}>
              <circle cx={16+i*32} cy={i%2===0?50:80} r="4" fill="#ff9a7a" fillOpacity="0.7"/>
              <text x={16+i*32} y={i%2===0?42:95} textAnchor="middle" fontSize="7.5" fill="rgba(255,255,255,0.5)">{i+1}월</text>
            </g>
          ))}
        </>
      ),
    },
    '10': {
      gradient: 'linear-gradient(135deg, #0e0e1e 0%, #1a1a3a 50%, #080818 100%)',
      label: '인생 흐름', labelColor: '#c4a8ff',
      svgContent: (
        <>
          <style>{`@keyframes sec10flow{0%{strokeDashoffset:400}100%{strokeDashoffset:0}}`}</style>
          <defs>
            <linearGradient id="sg10a" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4a9eff" stopOpacity="0.2"/>
              <stop offset="50%" stopColor="#c4a8ff" stopOpacity="0.9"/>
              <stop offset="100%" stopColor="#e8c97e" stopOpacity="0.5"/>
            </linearGradient>
          </defs>
          <path d="M20,80 Q60,30 100,55 Q140,80 180,40 Q220,10 260,45 Q300,80 340,35 Q365,15 385,30" fill="none" stroke="url(#sg10a)" strokeWidth="3" strokeDasharray="400" strokeDashoffset="0" style={{animation:'sec10flow 6s linear infinite'}}/>
          {[[20,80],[100,55],[180,40],[260,45],[340,35],[385,30]].map(([x,y],i)=>(
            <circle key={i} cx={x} cy={y} r="5" fill={i===5?'#e8c97e':'#c4a8ff'} fillOpacity={i===5?1:0.7}/>
          ))}
          {['청년기','장년기','중년기','노년기'].map((t,i)=>(
            <text key={i} x={60+i*90} y={108} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.4)">{t}</text>
          ))}
        </>
      ),
    },
  };
  const cfg = configs[sectionId] ?? configs['1'];
  return (
    <div style={{
      width:'100%', height:110, borderRadius:'12px 12px 0 0', overflow:'hidden',
      background: cfg.gradient, position:'relative', marginBottom:0,
      boxShadow:'inset 0 -1px 0 rgba(255,255,255,0.06)',
    }}>
      <svg width="400" height="110" viewBox="0 0 400 110" style={{width:'100%',height:'100%',display:'block'}}>
        {cfg.svgContent}
      </svg>
      <div style={{
        position:'absolute', bottom:8, left:16,
        fontSize:'.68rem', fontWeight:700,
        color: cfg.labelColor, letterSpacing:'.06em', opacity:0.85,
        textTransform:'uppercase',
      }}>{cfg.label}</div>
    </div>
  );
}

// ─── AI 풀이 렌더러 ───
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} style={{ color:'#ffffff', fontWeight:700 }}>{part.slice(2,-2)}</strong>
      : part
  );
}

function renderFortuneSubheader(title: string, key: number): React.ReactNode {
  const clean = title.replace(/^#+\s*/, '').replace(/^[\d.]+\s*/, '').trim();
  return (
    <div key={key} style={{ marginTop:18, marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ width:3, height:16, background:'var(--gold)', borderRadius:2, flexShrink:0 }} />
      <h3 style={{ fontSize:'.9rem', fontWeight:800, color:'var(--gold)', margin:0 }}>
        {renderInline(clean)}
      </h3>
    </div>
  );
}

function renderFortuneBullet(text: string, key: number): React.ReactNode {
  const body = text.replace(/^\*\s+/, '').trim();
  return (
    <div key={key} style={{ display:'flex', gap:8, marginBottom:6, paddingLeft:8 }}>
      <span style={{ color:'var(--purple)', flexShrink:0, fontSize:'.85rem', marginTop:2 }}>▸</span>
      <span style={{ fontSize:'.9rem', color:'rgba(248,246,255,.88)', lineHeight:1.85 }}>
        {renderInline(body)}
      </span>
    </div>
  );
}

function renderFortuneLines(lines: string[]): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let k = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^━{3,}|^---+$/.test(trimmed)) {
      nodes.push(<div key={k++} style={{ height:1, background:'rgba(255,255,255,.08)', margin:'14px 0' }} />);
      continue;
    }
    if (/^#{1,5}\s+/.test(trimmed)) {
      nodes.push(renderFortuneSubheader(trimmed, k++));
      continue;
    }
    if (trimmed.startsWith('>')) {
      nodes.push(
        <div key={k++} style={{
          margin:'10px 0 12px', padding:'10px 14px', borderRadius:10,
          background:'rgba(232,196,106,.08)', borderLeft:'3px solid var(--gold)',
          fontSize:'.88rem', color:'rgba(248,246,255,.9)', lineHeight:1.8,
        }}>
          {renderInline(trimmed.replace(/^>\s*/, ''))}
        </div>,
      );
      continue;
    }
    if (trimmed.startsWith('*')) {
      nodes.push(renderFortuneBullet(trimmed, k++));
      continue;
    }
    if (line.includes('◆')) {
      const parts = line.split(/(◆[^◆\n]+)/g);
      parts.forEach((part) => {
        if (part.startsWith('◆')) {
          nodes.push(renderFortuneSubheader(part.replace('◆', '').trim(), k++));
        } else if (part.trim()) {
          nodes.push(
            <p key={k++} style={{ fontSize:'.9rem', color:'rgba(248,246,255,.88)', lineHeight:1.85, marginBottom:10, paddingLeft:11 }}>
              {renderInline(part.trim())}
            </p>,
          );
        }
      });
      continue;
    }
    if (/^[—•]\s/.test(line)) {
      nodes.push(renderFortuneBullet(line.replace(/^[—•]\s/, ''), k++));
      continue;
    }
    if (!trimmed) {
      nodes.push(<div key={k++} style={{ height:8 }} />);
      continue;
    }
    nodes.push(
      <p key={k++} style={{ fontSize:'.9rem', color:'rgba(248,246,255,.88)', lineHeight:1.9, marginBottom:8 }}>
        {renderInline(line)}
      </p>,
    );
  }
  return nodes;
}

// ─── 월별 운세 막대 차트 ───
const LEVEL_COL: Record<string, string> = {
  '매우 좋음': '#4cbe82', '좋음': '#7ac87a',
  '보통': '#8888b0', '주의': '#e8a054', '매우 주의': '#e05555',
};
function MonthlyChart({ briefs }: { briefs: MonthlyBrief[] }) {
  const maxAbs = Math.max(...briefs.map(b => Math.abs(b.score)), 1);
  const now = new Date().getMonth() + 1;
  return (
    <div style={{ margin:'16px 0 4px', padding:'16px 18px',
      background:'rgba(0,0,0,.18)', borderRadius:10, border:'1px solid rgba(255,255,255,.07)' }}>
      <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:12,
        fontWeight:700, letterSpacing:'.06em' }}>📅 월별 운세 흐름</div>
      {briefs.map(b => {
        const pct  = (Math.abs(b.score) / maxAbs) * 100;
        const col  = LEVEL_COL[b.level] ?? '#8888b0';
        const cur  = b.month === now;
        const kw   = b.oneLiner.split('—')[0].split('·')[0].trim();
        return (
          <div key={b.month} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
            <div style={{ width:26, fontSize:'.68rem', textAlign:'right', flexShrink:0,
              color: cur ? '#ffffff' : 'var(--muted)', fontWeight: cur ? 800 : 400 }}>
              {b.month}월
            </div>
            <div style={{ flex:1, height:16, background:'rgba(255,255,255,.05)',
              borderRadius:4, overflow:'hidden', position:'relative' }}>
              <div style={{ position:'absolute', left:0, top:0, height:'100%',
                width:`${pct}%`, background:col, borderRadius:4, opacity: b.score < 0 ? 0.55 : 0.9,
                transition:'width .4s' }} />
              {cur && <div style={{ position:'absolute', inset:0, border:`1px solid ${col}`,
                borderRadius:4, boxSizing:'border-box' }} />}
            </div>
            <div style={{ width:90, fontSize:'.68rem', color: col, fontWeight:600,
              flexShrink:0, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
              {kw}
            </div>
          </div>
        );
      })}
      <div style={{ display:'flex', gap:12, marginTop:10, flexWrap:'wrap' }}>
        {Object.entries(LEVEL_COL).map(([lv, c]) => (
          <span key={lv} style={{ fontSize:'.62rem', color:c, display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:8, height:8, borderRadius:2, background:c, display:'inline-block' }}/>
            {lv}
          </span>
        ))}
      </div>
    </div>
  );
}

function AiRenderer({ text, loading, result }: {
  text: string; loading: boolean; result?: SajuResult | null;
}) {
  const ds = result?.pillars[2]?.s ?? 0;

  return (
    <div style={{
      marginTop: 20,
      padding: '22px 18px',
      background: 'linear-gradient(180deg, rgba(20, 24, 45, 0.85) 0%, rgba(13, 16, 32, 0.95) 100%)',
      borderRadius: 16,
      border: '1px solid rgba(196, 168, 255, 0.25)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      position: 'relative',
    }}>
      {/* 상단 AI 스트리밍 배지 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 14,
        marginBottom: 16,
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #c4a8ff, #7a5af8)',
            fontSize: '.85rem',
          }}>
            ✦
          </span>
          <span style={{ fontSize: '.95rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
            Gemini AI 실시간 심층 풀이
          </span>
        </div>
        {loading && (
          <span style={{
            fontSize: '.72rem',
            padding: '3px 8px',
            borderRadius: 100,
            background: 'rgba(232, 196, 106, 0.15)',
            border: '1px solid rgba(232, 196, 106, 0.4)',
            color: 'var(--gold)',
            fontWeight: 600,
          }}>
            실시간 작성 중...
          </span>
        )}
      </div>

      {/* AI 본문 실시간 텍스트 렌더링 */}
      <div style={{ fontSize: '.92rem', lineHeight: 1.85, color: 'rgba(248, 246, 255, 0.92)' }}>
        {renderFortuneLines(text.split('\n'))}
        {loading && (
          <span className="typing-cursor" style={{ color: 'var(--gold)', marginLeft: 4 }}>▌</span>
        )}
      </div>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .typing-cursor { font-weight: 700; animation: blink 0.8s infinite; }
      `}</style>
    </div>
  );
}


// ─── 7번 재물: 재성(편재·정재) 분포 ───
function WealthSipsinBar({ pillars, dayStemIdx }: { pillars: (Pillar|null)[], dayStemIdx: number }) {
  const labels = ['년','월','일','시'];
  const wealthKinds = ['편재', '정재'] as const;
  const slots = pillars.map((p, i) => {
    if (!p || i === 2) return null;
    const ss = getSipsin(dayStemIdx, p.s);
    if (!wealthKinds.includes(ss as typeof wealthKinds[number])) return null;
    return { label: labels[i], sipsin: ss, col: SIPSIN_COLORS[ss] ?? '#e8c46a' };
  }).filter(Boolean) as { label: string; sipsin: string; col: string }[];

  return (
    <div style={{ textAlign:'center', padding:'12px 14px', background:'rgba(0,0,0,.18)',
      borderRadius:10, border:'1px solid rgba(255,255,255,.07)' }}>
      <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:10, fontWeight:700, letterSpacing:'.06em' }}>
        💰 재성(財星) 배치
      </div>
      {slots.length ? (
        <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
          {slots.map((s) => (
            <div key={s.label} style={{ padding:'8px 12px', borderRadius:8,
              background:`${s.col}18`, border:`1px solid ${s.col}55` }}>
              <div style={{ fontSize:'.62rem', color:'var(--muted)', marginBottom:3 }}>{s.label}주</div>
              <div style={{ fontSize:'.82rem', fontWeight:800, color:s.col }}>{s.sipsin}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize:'.78rem', color:'rgba(248,246,255,.65)', lineHeight:1.6 }}>
          사주 원국에 편재·정재가 직접 드러나지 않아, 격국·용신 흐름으로 재물을 읽습니다.
        </div>
      )}
    </div>
  );
}

// ─── 8번 연애: 배우자궁(일지) ───
function SpousePalaceCard({ pillars, dayStemIdx }: { pillars: (Pillar|null)[], dayStemIdx: number }) {
  const dp = pillars[2];
  if (!dp) return null;
  const branch = BRANCHES[dp.b];
  const branchH = BRANCHES_H[dp.b];
  const elem = ELEM_NAMES[BRANCH_ELEM[dp.b]];
  const stem = STEMS[dayStemIdx];
  return (
    <div style={{ textAlign:'center', padding:'12px 14px', background:'rgba(0,0,0,.18)',
      borderRadius:10, border:'1px solid rgba(255,255,255,.07)' }}>
      <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:10, fontWeight:700, letterSpacing:'.06em' }}>
        🤝 배우자궁 (일지)
      </div>
      <div style={{ display:'inline-flex', alignItems:'center', gap:12 }}>
        <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(144,184,240,.12)',
          border:'1px solid rgba(144,184,240,.35)' }}>
          <div style={{ fontSize:'.62rem', color:'var(--muted)', marginBottom:4 }}>일간</div>
          <div style={{ fontSize:'1rem', fontWeight:900, color:'var(--gold)' }}>{stem}</div>
        </div>
        <span style={{ color:'rgba(255,255,255,.35)', fontSize:'1.1rem' }}>+</span>
        <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(196,168,255,.12)',
          border:'1px solid rgba(196,168,255,.35)' }}>
          <div style={{ fontSize:'.62rem', color:'var(--muted)', marginBottom:4 }}>일지</div>
          <div style={{ fontSize:'1rem', fontWeight:900, color:'#c4a8ff' }}>{branch}{branchH}</div>
          <div style={{ fontSize:'.65rem', color:'var(--muted)', marginTop:4 }}>{elem}</div>
        </div>
      </div>
    </div>
  );
}

// ─── 10번 실천: 용신 실천 카드 ───
const YONGSIN_PRACTICE: Record<number, { color: string; tip: string }> = {
  0: { color:'#5dce70', tip:'초록·식물, 아침 산책, 성장·학습 루틴' },
  1: { color:'#ff7070', tip:'따뜻한 색, 햇볕, 적극적 표현·실행' },
  2: { color:'#e8c840', tip:'규칙적 식사·수면, 안정적 루틴, 신뢰 쌓기' },
  3: { color:'#e0e0e0', tip:'정리·정돈, 금속 소품, 결단 전 하루 숙성' },
  4: { color:'#90b8f0', tip:'수분·휴식, 차분한 명상, 깊은 사고 시간' },
};

function YongsinPracticeCard({ yongsin, dayStemIdx }: { yongsin: number; dayStemIdx: number }) {
  const elem = ELEM_NAMES[yongsin];
  const guide = YONGSIN_PRACTICE[yongsin] ?? YONGSIN_PRACTICE[2]!;
  const stem = STEMS[dayStemIdx];
  return (
    <div style={{ padding:'12px 14px', background:'rgba(0,0,0,.18)', borderRadius:10,
      border:'1px solid rgba(255,255,255,.07)' }}>
      <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:10, fontWeight:700, letterSpacing:'.06em' }}>
        🗺️ 용신 실천 가이드
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:44, height:44, borderRadius:12, flexShrink:0,
          background:`${guide.color}22`, border:`2px solid ${guide.color}`,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:'1.1rem', fontWeight:900, color:guide.color }}>
          {elem}
        </div>
        <div style={{ flex:1, textAlign:'left' }}>
          <div style={{ fontSize:'.85rem', fontWeight:800, color:'#fff', marginBottom:4 }}>
            {stem} 일간 → 용신 <span style={{ color:guide.color }}>{elem}</span>
          </div>
          <div style={{ fontSize:'.78rem', color:'rgba(248,246,255,.75)', lineHeight:1.65 }}>
            {guide.tip}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 신강/신약 게이지 ───
function SinGangGauge({ pillars, dayStemIdx }: { pillars: (Pillar|null)[], dayStemIdx: number }) {
  const dayElem = STEM_ELEM[dayStemIdx];
  const { score, isWeak } = calcStrength(pillars, dayElem);
  const clamped = Math.max(-6, Math.min(6, score));
  const pct     = ((clamped + 6) / 12) * 100;
  const label   = score <= -3 ? '극신약' : score <= 0 ? '신약' : score <= 3 ? '신강' : '극신강';
  const color   = isWeak ? '#4a9eff' : '#e8c46a';

  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:6, fontWeight:700 }}>일간 강도</div>
      <div style={{ position:'relative', height:12, borderRadius:6, background:'rgba(255,255,255,.08)', overflow:'hidden', margin:'0 auto', width:140 }}>
        <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${pct}%`,
          background:`linear-gradient(90deg,#4a9eff,${color})`, borderRadius:6, transition:'width .6s' }} />
        <div style={{ position:'absolute', left:'50%', top:0, height:'100%', width:1, background:'rgba(255,255,255,.3)' }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', width:140, margin:'4px auto 0', fontSize:'.65rem', color:'var(--muted)' }}>
        <span>신약</span><span>중화</span><span>신강</span>
      </div>
      <div style={{ marginTop:6, fontSize:'.8rem', fontWeight:800, color }}>
        {label} <span style={{ fontSize:'.7rem', fontWeight:400, color:'var(--muted)' }}>({score > 0 ? '+' : ''}{score})</span>
      </div>
    </div>
  );
}

// ─── 십신 관계 그리드 ───
const SIPSIN_COLORS: Record<string,string> = {
  비견:'#4a9eff',겁재:'#7070c0',식신:'#4cbe82',상관:'#2a9060',
  편재:'#e8c46a',정재:'#c09030',편관:'#e05555',정관:'#b03030',
  편인:'#c47bc4',정인:'#8b6fc6',
};

function SipsinGrid({ pillars, dayStemIdx }: { pillars: (Pillar|null)[], dayStemIdx: number }) {
  const labels = ['년','월','일','시'];
  const stems  = ['갑','을','병','정','무','기','경','신','임','계'];

  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:8, fontWeight:700 }}>십신 배치</div>
      <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
        {pillars.map((p, i) => {
          if (!p) return (
            <div key={i} style={{ width:52, padding:'8px 4px', borderRadius:8,
              background:'rgba(255,255,255,.03)', border:'1px solid var(--border)', textAlign:'center' }}>
              <div style={{ fontSize:'.6rem', color:'var(--muted)', marginBottom:4 }}>{labels[i]}주</div>
              <div style={{ fontSize:'.7rem', color:'rgba(255,255,255,.2)' }}>미입력</div>
            </div>
          );
          const ss  = i === 2 ? '일간' : getSipsin(dayStemIdx, p.s);
          const col = i === 2 ? 'var(--gold)' : (SIPSIN_COLORS[ss] || '#888');
          return (
            <div key={i} style={{ width:52, padding:'8px 4px', borderRadius:8,
              background: i===2 ? 'rgba(232,196,106,.07)' : 'rgba(255,255,255,.03)',
              border:`1px solid ${i===2?'rgba(232,196,106,.3)':'var(--border)'}`, textAlign:'center' }}>
              <div style={{ fontSize:'.6rem', color:'var(--muted)', marginBottom:4 }}>{labels[i]}주</div>
              <div style={{ fontSize:'.95rem', fontWeight:900, color:col, marginBottom:3 }}>{stems[p.s]}</div>
              <div style={{ fontSize:'.6rem', padding:'1px 4px', borderRadius:4,
                background:`${col}22`, color:col, display:'inline-block', fontWeight:700 }}>{ss}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
