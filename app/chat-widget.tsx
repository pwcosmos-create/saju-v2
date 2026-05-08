/**
 * SAJU-V2 CHAT WIDGET
 * Version: 2.0.3 (Draft-Review-Type & Premium Theme)
 * Last Updated: 2026-05-08
 */
'use client';
import { useState, useRef, useEffect } from 'react';

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
  if (/(입니다|해요|돼요|하세요|좋아요|보입니다|가능합니다|필요합니다|있습니다|됩니다|드립니다)$/.test(cleaned)) return `${cleaned}.`;
  return `${cleaned}입니다.`;
}

function addFollowUpPrompt(text: string, userTurn: number): string {
  const normalized = text.trim();
  if (!normalized) return normalized;
  const prompts = [
    '추가로 궁금한 점이 있으면 이어서 물어봐 주세요.',
    '원하시면 연애·직업·재물 중 한 가지를 더 깊게 봐드릴게요.',
    '다른 질문도 괜찮아요. 편하게 이어가세요.',
  ];
  const prompt = prompts[userTurn % prompts.length];
  return `${normalized}\n\n${prompt}`;
}

function splitTtsChunks(text: string, maxLen = 220): string[] {
  const normalized = stripHanja(text).replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const parts = normalized
    .split(/(?<=[.!?。！？…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return [normalized.slice(0, maxLen)];

  const chunks: string[] = [];
  let current = '';
  for (const p of parts) {
    if ((current + ' ' + p).trim().length <= maxLen) {
      current = (current ? `${current} ` : '') + p;
      continue;
    }
    if (current) chunks.push(current);
    if (p.length <= maxLen) {
      current = p;
      continue;
    }
    for (let i = 0; i < p.length; i += maxLen) {
      chunks.push(p.slice(i, i + maxLen));
    }
    current = '';
  }
  if (current) chunks.push(current);
  return chunks;
}

function speakKoreanQueued(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const chunks = splitTtsChunks(text);
  if (!chunks.length) return;

  const synth = window.speechSynthesis;
  // 새 응답 시작 시에만 이전 발화를 정리한다.
  if (synth.speaking) synth.cancel();

  const voices = synth.getVoices();
  const koVoice = voices.find(v => v.lang.includes('ko') && (v.name.includes('Google') || v.name.includes('Natural')))
               || voices.find(v => v.lang.includes('ko'));

  const speakAt = (idx: number) => {
    if (idx >= chunks.length) return;
    const utt = new SpeechSynthesisUtterance(chunks[idx]);
    if (koVoice) utt.voice = koVoice;
    utt.lang = 'ko-KR';
    utt.rate = TTS_RATE;
    utt.pitch = TTS_PITCH;
    utt.onend = () => speakAt(idx + 1);
    // 일부 브라우저에서 중간 오류가 나도 다음 청크로 이어서 읽는다.
    utt.onerror = () => speakAt(idx + 1);
    synth.speak(utt);
  };

  speakAt(0);
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
const TYPE_SPEED_MS = 15;
const TTS_RATE = 1.0;
const TTS_PITCH = 1.05;
const PAYMENT_EXEMPT_BIRTHDAYS = new Set([
  '1974-3-10',
  '1975-6-13',
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

// 타이핑 효과 함수 (v2.0.3)
function typeEffect(text: string, onUpdate: (t: string) => void, onDone?: () => void) {
  let index = 0;
  const speed = TYPE_SPEED_MS; // 타이핑 속도 (ms)
  
  const timer = setInterval(() => {
    if (index < text.length) {
      onUpdate(text.slice(0, index + 1));
      index++;
    } else {
      clearInterval(timer);
      if (onDone) onDone();
    }
  }, speed);
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
  options: { chatMode: 'single' | 'compatibility'; compareSajuContext?: string },
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef  = useRef<any>(null);
  const isExemptUser = isPaymentExemptTarget(result);
  const targetKey = getTargetKey(result);
  const canStartCounseling = Boolean(result && aiSummaryReady);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

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
      return;
    }
    const key = `saju_chat_preview_used_${result.input.year}-${result.input.month}-${result.input.day}-${result.input.gender}`;
    setPreviewUsed(sessionStorage.getItem(key) === '1');
    setPreviewUnlocked(false);
  }, [result]);

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
          ? `안녕하세요! AI 심층 상담사입니다.\n${result.input.year}년생 ${result.input.gender}성분의 사주를 분석했습니다.\n이 상담은 AI 심층 풀이를 기반으로 진행되는 맞춤 상담입니다.\n${isExemptUser ? '결제 예외 대상이므로 바로 상담을 이용하실 수 있습니다. 😊' : 'AI 심층 상담은 1,000원(이벤트가, 정상가 30,000원) 결제 후 이용 가능합니다. 결제 후 궁금하신 점을 무엇이든 물어보세요. 🎯'}`
          : '안녕하세요! 먼저 위에서 사주 분석을 완료해주세요.',
      }]);
    }
  }, [open, result, isExemptUser]);

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
    const userMsg: Msg = { role: 'user', content: trimmed };
    const newMsgs = [...msgs, userMsg];
    setMsgs([...newMsgs, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);

    const sajuContext = buildChatContext(result);
    const compareSajuContext = compareResult ? buildCompatibilityContext(result, compareResult) : undefined;
    let buffer = '';

    await streamChat(
      newMsgs.map(m => ({ role: m.role, content: m.content })),
      sajuContext,
      {
        chatMode,
        compareSajuContext,
      },
      (chunk) => {
        buffer += chunk;
        setMsgs(prev => {
          const u = [...prev];
          u[u.length - 1] = {
            role: 'assistant',
            content: buffer.length < 120 ? '질문 이해 및 답변 작성 중... ✍️' : '답변 초안 정리 중... ✍️',
          };
          return u;
        });
      },
      () => {
        setMsgs(prev => {
          const u = [...prev];
          u[u.length - 1] = { role: 'assistant', content: '최종 검증 중... ✨' };
          return u;
        });

        setTimeout(() => {
          setLoading(false);
          const userTurn = newMsgs.filter((m) => m.role === 'user').length;
          const finalized = addFollowUpPrompt(finalizeKoreanAnswer(buffer), userTurn);
          // 실시간 대화감 강화를 위해 타이핑 시작과 동시에 TTS를 재생한다.
          if (finalized) speakKoreanQueued(finalized);
          typeEffect(finalized, (typed) => {
            setMsgs(prev => {
              const u = [...prev];
              u[u.length - 1] = { role: 'assistant', content: typed };
              return u;
            });
          }, () => {
            if (!isPaid && !isExemptUser && previewUnlocked) {
              const key = `saju_chat_preview_used_${result.input.year}-${result.input.month}-${result.input.day}-${result.input.gender}`;
              setPreviewUnlocked(false);
              setPreviewUsed(true);
              if (typeof window !== 'undefined') sessionStorage.setItem(key, '1');
            }
          });
        }, 450);
      },
      (err) => {
        setMsgs(prev => {
          const u = [...prev];
          u[u.length - 1] = { role: 'assistant', content: `오류가 발생했습니다: ${err}` };
          return u;
        });
        setLoading(false);
      },
    );
  }

  function toggleVoice() {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { alert('이 브라우저는 음성 인식을 지원하지 않습니다. (Chrome 권장)'); return; }
    if (listening) { recogRef.current?.stop(); setListening(false); return; }
    const recog = new SR();
    recog.lang = 'ko-KR'; recog.continuous = false; recog.interimResults = false;
    recog.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setListening(false);
      send(t);
    };
    recog.onerror = () => setListening(false);
    recog.onend   = () => setListening(false);
    recogRef.current = recog;
    recog.start();
    setListening(true);
  }

  function stopTTS() {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  }

  function usePreviewOnce() {
    if (!result || previewUsed) return;
    setPreviewUnlocked(true);
    setMsgs(prev => [...prev, {
      role: 'assistant',
      content: '무료 미리보기 1회가 시작되었습니다. 궁금한 점을 1개 질문해 주세요.',
    }]);
  }

  return (
    <>
      {/* Chat Panel */}
      <div style={{
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
                  ? `남은 상담 시간: ${formatTime(timeLeft)}`
                  : 'AI 심층 풀이 기반 텍스트/음성 맞춤 상담'}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,.62)', marginTop: 2 }}>
              타이핑 {TYPE_SPEED_MS}ms · 읽기 x{TTS_RATE.toFixed(1)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={stopTTS} title="음성 중지" style={{
              background: 'none', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8,
              color: 'rgba(255,255,255,.5)', fontSize: '.8rem', cursor: 'pointer', padding: '4px 8px',
            }}>🔇</button>
            <button onClick={() => setOpen(false)} style={{
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

          {msgs.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '82%', padding: '10px 14px',
                borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: m.role === 'user' ? 'rgba(232,201,126,.15)' : 'rgba(255,255,255,.07)',
                border: `1px solid ${m.role === 'user' ? 'rgba(232,201,126,.3)' : 'rgba(255,255,255,.1)'}`,
                color: '#e0e0e0', fontSize: '.87rem', lineHeight: 1.65, whiteSpace: 'pre-wrap',
              }}>
                {m.content || (loading && i === msgs.length - 1 ? <span className="chat-typing-cursor">▌</span> : '')}
              </div>
            </div>
          ))}
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
              <button onClick={toggleVoice} title={listening ? '녹음 중지' : '음성 입력'} style={{
                padding: '9px 11px',
                background: listening ? 'rgba(220,50,50,.25)' : 'rgba(255,255,255,.06)',
                border: `1px solid ${listening ? 'rgba(220,80,80,.5)' : 'rgba(255,255,255,.12)'}`,
                borderRadius: 10, color: listening ? '#ff6b6b' : 'rgba(255,255,255,.55)',
                cursor: 'pointer', fontSize: '1rem', animation: listening ? 'pulse 1s infinite' : 'none',
              }}>🎤</button>
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
      <div style={{
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
          onClick={() => setOpen(o => !o)}
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
