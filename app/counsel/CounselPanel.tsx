'use client';
/**
 * CounselPanel — AI 심층 상담 패널 (v3.3)
 *
 * - STT 마이크 버튼 (Web Speech API, ko-KR)
 * - Wake Lock: 상담 중 화면 꺼짐 방지
 * - iOS AudioContext 잠금 해제
 */
import { useState, useEffect, useRef } from 'react';
import type { SajuResult } from '../../core/pillar-calc/main-calculator';
import { COUNSELOR_NAMES } from '../../core/counselor-config';
import { useTts } from './use-tts';
import { useStt } from './use-stt';
import {
  COUNSEL_LEAVE_CONFIRM_MESSAGE,
  COUNSEL_LEAVE_SESSION_NOTICE,
  COUNSEL_SESSION_EXPIRED_MESSAGE,
  counselSessionLimitMs,
  counselSessionLimitSecs,
  formatCounselTimeLeft,
  isCounselSessionExpired,
} from '../../core/counsel-session';
import { isSajuWaitingMessage } from '../../core/user-messages';
import { useCounselChat } from './use-counsel-chat';
import { renderCounselContent } from './render-counsel-content';
import PaymentModal from '../components/payment-modal';
import { restorePendingCounselPurchases } from '../../lib/toss-counsel-iap';
import { COUNSEL_IAP_MINUTES } from '../../core/counsel-iap';
import { buildGreetingReply, isCounselTtsReadRequest } from '../../core/counsel-greeting';

const APPS_IN_TOSS = process.env.NEXT_PUBLIC_APPS_IN_TOSS === '1';

function pickCounselor(): string {
  return COUNSELOR_NAMES[Math.floor(Math.random() * COUNSELOR_NAMES.length)];
}

function buildIntro(counselor: string, result: SajuResult, sessionMinutes: number): string {
  const greeting = buildGreetingReply(counselor);
  return `${greeting}\n\n${result.input.year}년생 ${result.input.gender}성분의 사주를 분석했습니다.\n이번 상담 시간은 ${sessionMinutes}분입니다.`;
}

export default function CounselPanel({
  result,
  aiSummaryReady,
}: {
  result: SajuResult | null;
  aiSummaryReady: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [purchasedMinutes, setPurchasedMinutes] = useState(0);
  const [input, setInput] = useState('');
  const [counselor] = useState(pickCounselor);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(counselSessionLimitSecs(purchasedMinutes));
  const [sessionExpired, setSessionExpired] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { msgs, loading, send, reset, applyMsgs } = useCounselChat(
    result,
    aiSummaryReady,
    counselor,
    sessionStartedAt,
    purchasedMinutes || COUNSEL_IAP_MINUTES,
  );
  const { playing, enabled, setEnabled, speak, stop, primeAudio } = useTts(counselor);

  useEffect(() => {
    if (!APPS_IN_TOSS || !result) return;
    void restorePendingCounselPurchases((total) => {
      if (total <= 0) return;
      setPurchasedMinutes(total);
      setSessionStartedAt(Date.now());
      setSessionExpired(false);
      setTimeLeft(counselSessionLimitSecs(total));
      setOpen(true);
    });
  }, [result]);

  /** 현재 TTS로 읽히는 메시지 콘텐츠 추적 (버블 강조 용) */
  const [speakingContent, setSpeakingContent] = useState<string | null>(null);
  const [ttsHintDismissed, setTtsHintDismissed] = useState(false);
  const lastAutoSpokenRef = useRef('');

  // playing이 끌리면 강조 해제
  useEffect(() => {
    if (!playing) setSpeakingContent(null);
  }, [playing]);

  useEffect(() => {
    if (!open) {
      lastAutoSpokenRef.current = '';
      setTtsHintDismissed(false);
      return;
    }
    void primeAudio();
  }, [open, primeAudio]);

  /** AI 답변(인트로 포함) — Gemini TTS 자동 읽기 */
  useEffect(() => {
    if (!open || !enabled || loading) return;
    const last = msgs[msgs.length - 1];
    if (last?.role !== 'assistant') return;
    const content = last.content.trim();
    if (content.length < 6 || isSajuWaitingMessage(content)) return;
    if (content === lastAutoSpokenRef.current) return;
    lastAutoSpokenRef.current = content;
    setSpeakingContent(content);
    void speak(content);
  }, [msgs, open, enabled, loading, speak]);

  /** STT 콜백에서 안전하게 호출하기 위한 ref (클로저 스테일 방지) */
  const sendVoiceRef = useRef<(text: string) => Promise<void>>(async () => { });
  /** 마이크로 보낸 직후 TTS는 답 본문만 읽기 */
  const lastInputViaVoiceRef = useRef(false);

  const { listening, supported: sttSupported, start: startStt } = useStt((text) => {
    setInput(text);
    lastInputViaVoiceRef.current = true;
    void sendVoiceRef.current(text);
  });


  /** Wake Lock + iOS 폴백 (hidden video 루프) — 화면 꺼짐 방지 */
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!open) {
      wakeLockRef.current?.release().catch(() => { });
      wakeLockRef.current = null;
      videoRef.current?.pause();
      return;
    }
    // 방법 1: Wake Lock API (크롬/엣지/iOS 16.4+)
    if ('wakeLock' in navigator) {
      (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } })
        .wakeLock.request('screen')
        .then(lock => { wakeLockRef.current = lock; })
        .catch(() => { });
    }
    // 방법 2: iOS 구버전 폴백 — 투명 1x1 video loop
    if (!videoRef.current) {
      const v = document.createElement('video');
      v.setAttribute('loop', '');
      v.setAttribute('playsinline', '');
      v.setAttribute('muted', '');
      v.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;top:0;left:0';
      v.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28ybXA0MQAAAO1tZGF0';
      document.body.appendChild(v);
      videoRef.current = v;
    }
    videoRef.current.play().catch(() => { });
  }, [open]);

  /** 탭 닫기·앱 전환·화면 꺼짐 → TTS 정지 + Wake Lock 해제 */
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        // 페이지가 숨겨질 때 (탭 전환, 홈 버튼, 앱 전환 등)
        stop();
        wakeLockRef.current?.release().catch(() => { });
        wakeLockRef.current = null;
        videoRef.current?.pause();
      } else if (open) {
        // 다시 보일 때 Wake Lock 재획득
        if ('wakeLock' in navigator) {
          (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } })
            .wakeLock.request('screen')
            .then(lock => { wakeLockRef.current = lock; })
            .catch(() => { });
        }
        videoRef.current?.play().catch(() => { });
      }
    }
    function handlePageHide() {
      // 브라우저 탭 닫기 / 새로고침 / 페이지 이탈
      stop();
      wakeLockRef.current?.release().catch(() => { });
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [open, stop]);


  /** 상담 열림 시 뒤 페이지 스크롤·하단 노출 차단 */
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [open]);


  useEffect(() => {
    if (!aiSummaryReady) {
      stop(); reset(); setOpen(false); setShowPaymentModal(false);
      setSessionStartedAt(null);
      setTimeLeft(counselSessionLimitSecs(purchasedMinutes));
      setSessionExpired(false);
    }
  }, [aiSummaryReady, reset, stop]);

  useEffect(() => {
    if (!open) {
      setSessionStartedAt(null);
      setTimeLeft(counselSessionLimitSecs(purchasedMinutes || COUNSEL_IAP_MINUTES));
      setSessionExpired(false);
    }
  }, [open, purchasedMinutes]);

  useEffect(() => {
    if (!open || !sessionStartedAt || sessionExpired) return;
    const timer = window.setInterval(() => {
      const remainingSecs = Math.max(
        0,
        Math.floor((sessionStartedAt + counselSessionLimitMs(purchasedMinutes) - Date.now()) / 1000),
      );
      setTimeLeft(remainingSecs);
      if (remainingSecs <= 0) {
        setSessionExpired(true);
        window.clearInterval(timer);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, sessionStartedAt, sessionExpired, purchasedMinutes]);

  useEffect(() => {
    if (open && result && msgs.length === 0) {
      applyMsgs([{
        role: 'assistant',
        content: buildIntro(counselor, result, purchasedMinutes || COUNSEL_IAP_MINUTES),
      }]);
    }
  }, [open, result, counselor, msgs.length, applyMsgs, purchasedMinutes]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  useEffect(() => {
    const last = msgs[msgs.length - 1];
    if (last?.role === 'assistant' && last.content === COUNSEL_SESSION_EXPIRED_MESSAGE) {
      setSessionExpired(true);
    }
  }, [msgs]);

  /** 전송 공통 로직 — 텍스트 직접 받음 (input state 타이밍 무관) */
  async function handleSendWithText(trimmed: string) {
    if (!trimmed || !result || !aiSummaryReady || loading || sessionExpired) return;
    if (sessionStartedAt && isCounselSessionExpired(sessionStartedAt, purchasedMinutes)) {
      setSessionExpired(true);
      return;
    }

    if (isCounselTtsReadRequest(trimmed)) {
      const lastAssistant = [...msgs].reverse().find(
        (m) => m.role === 'assistant' && m.content.trim().length > 6 && !isSajuWaitingMessage(m.content),
      );
      stop();
      setInput('');
      if (!lastAssistant) {
        applyMsgs([
          ...msgs,
          { role: 'user', content: trimmed },
          { role: 'assistant', content: '먼저 상담 답변이 있어야 음성으로 들려 드릴 수 있어요. 질문을 입력해 주세요.' },
        ]);
        return;
      }
      applyMsgs([...msgs, { role: 'user', content: trimmed }]);
      setEnabled(true);
      setTtsHintDismissed(true);
      setSpeakingContent(lastAssistant.content);
      await primeAudio();
      void speak(lastAssistant.content, { manual: true });
      return;
    }

    stop();
    setInput('');
    await send(trimmed);
    lastInputViaVoiceRef.current = false;
    inputRef.current?.focus();
  }

  /** 화면 터치 전송 버튼 */
  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;
    lastInputViaVoiceRef.current = false;
    await primeAudio();
    await handleSendWithText(trimmed);
  }

  // sendVoiceRef: 항상 최신 함수 참조 유지 (클로저 스테일 방지)
  sendVoiceRef.current = handleSendWithText;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function openExtendPayment() {
    setShowPaymentModal(true);
  }

  function attemptCloseCounselPanel() {
    if (sessionStartedAt && !sessionExpired && timeLeft > 0) {
      if (!window.confirm(COUNSEL_LEAVE_CONFIRM_MESSAGE)) return;
    }
    stop();
    setOpen(false);
  }

  function handlePurchaseSuccess(_granted: number) {
    const minutesGranted = COUNSEL_IAP_MINUTES;
    if (open && sessionStartedAt) {
      if (sessionExpired || timeLeft <= 0) {
        setSessionStartedAt(Date.now());
        setPurchasedMinutes(minutesGranted);
        setTimeLeft(counselSessionLimitSecs(minutesGranted));
      } else {
        const nextMinutes = (purchasedMinutes || COUNSEL_IAP_MINUTES) + minutesGranted;
        setPurchasedMinutes(nextMinutes);
        setTimeLeft(Math.max(
          0,
          Math.floor((sessionStartedAt + counselSessionLimitMs(nextMinutes) - Date.now()) / 1000),
        ));
      }
      setSessionExpired(false);
    } else {
      setPurchasedMinutes(minutesGranted);
      setSessionStartedAt(Date.now());
      setSessionExpired(false);
      setTimeLeft(counselSessionLimitSecs(minutesGranted));
      setOpen(true);
    }
    setShowPaymentModal(false);
  }

  const paymentMode = sessionStartedAt ? 'extend' : 'purchase';
  const GOLD = '#e8c97e';
  const PURPLE = '#8b6fc6';
  const panelBg = '#0e0b1c';
  const borderColor = 'rgba(255,255,255,0.1)';

  function toggleTts() {
    setEnabled((v) => {
      if (!v) setTtsHintDismissed(true);
      return !v;
    });
  }

  function VoiceBtn() {
    if (playing) {
      return (
        <button id="counsel-tts-stop" onClick={stop} title="음성 정지" style={{
          background: 'rgba(220,80,80,.2)', border: '1px solid rgba(220,80,80,.4)',
          borderRadius: 8, padding: '3px 10px',
          color: 'rgba(255,160,160,.9)', cursor: 'pointer', fontSize: '.72rem', fontWeight: 700,
        }}>⏹ 정지</button>
      );
    }
    return (
      <button id="counsel-tts-toggle" onClick={toggleTts} title={enabled ? '음성 끄기' : '음성 켜기'} style={{
        background: enabled ? 'rgba(74,158,255,.15)' : 'rgba(255,255,255,.06)',
        border: `1px solid ${enabled ? 'rgba(74,158,255,.4)' : 'rgba(255,255,255,.15)'}`,
        borderRadius: 8, padding: '3px 10px',
        color: enabled ? '#7bbfff' : 'rgba(255,255,255,.55)',
        cursor: 'pointer', fontSize: '.72rem', fontWeight: 700,
      }}>
        {enabled ? '🔊 음성' : '🔊 음성 켜기'}
      </button>
    );
  }

  /* ─── 플로팅 버튼 ─── */
  const FabButton = (
    <button
      id="counsel-panel-fab"
      onClick={() => setShowPaymentModal(true)}
      aria-label="AI 심층 상담 열기"
      style={{
        position: 'fixed',
        bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        right: 16,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 18px',
        background: 'linear-gradient(135deg, #6b4fa0, #3a7bd5)',
        border: 'none',
        borderRadius: 100,
        color: '#fff',
        fontWeight: 700,
        fontSize: '.85rem',
        cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(107,79,160,0.5)',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span>✦</span>
      AI 심층 상담
    </button>
  );

  /* ─── 패널 ─── */
  const Panel = (
    <>
    <style>{`
      @keyframes reading-glow {
        0%, 100% { box-shadow: 0 0 10px rgba(139,111,198,.25), inset 0 0 6px rgba(139,111,198,.06); }
        50%       { box-shadow: 0 0 22px rgba(139,111,198,.55), inset 0 0 12px rgba(139,111,198,.15); }
      }
      @media (max-width: 520px) {
        #counsel-panel {
          inset: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          height: 100dvh !important;
          min-height: 100dvh !important;
          margin: 0 !important;
          border-radius: 0 !important;
          border-left: none !important;
          border-right: none !important;
        }
      }
    `}</style>
    {open && (
      <div
        id="counsel-panel-backdrop"
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9099,
          background: panelBg,
        }}
      />
    )}
    <div
      id="counsel-panel"
      role="dialog"
      aria-label="AI 심층 상담"
      style={{
        position: 'fixed',
        ...(APPS_IN_TOSS
          ? {
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              width: '100%',
              maxWidth: '100%',
              height: '100dvh',
              minHeight: '100dvh',
              margin: 0,
              borderRadius: 0,
            }
          : {
              top: 'env(safe-area-inset-top, 0px)',
              bottom: 'env(safe-area-inset-bottom, 0px)',
              right: 0,
              left: 0,
              maxWidth: 'min(420px, 100vw)',
              marginLeft: 'auto',
              marginRight: 0,
              borderRadius: 'clamp(0px, calc((100vw - 480px) * 9999), 20px)',
              margin: 'clamp(0px, calc((100vw - 480px) * 9999), 12px) clamp(0px, calc((100vw - 480px) * 9999), 12px) clamp(0px, calc((100vw - 480px) * 9999), 80px)',
            }),
        zIndex: 9100,
        display: 'flex',
        flexDirection: 'column',
        background: panelBg,
        border: APPS_IN_TOSS ? 'none' : `1px solid ${borderColor}`,
        boxShadow: APPS_IN_TOSS ? 'none' : '0 8px 40px rgba(0,0,0,0.7)',
        overflow: 'hidden',
      }}
    >
      {/* ── 헤더 ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        paddingTop: 'max(14px, env(safe-area-inset-top, 14px))',
        borderBottom: `1px solid ${borderColor}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: GOLD }}>✦</span>
          <span style={{ fontWeight: 800, fontSize: '.95rem' }}>AI 심층 상담</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <VoiceBtn />
          {sessionStartedAt && (
            <button
              type="button"
              onClick={openExtendPayment}
              title="상담 시간 연장"
              style={{
                background: sessionExpired
                  ? 'linear-gradient(90deg, #7c4fc4, #3a7bd5)'
                  : 'rgba(255,255,255,.08)',
                border: sessionExpired
                  ? 'none'
                  : `1px solid ${borderColor}`,
                borderRadius: 8,
                padding: '4px 10px',
                color: sessionExpired ? '#fff' : 'rgba(255,255,255,.65)',
                fontSize: '.68rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ⏱ {sessionExpired ? '연장하기' : '시간 추가'}
            </button>
          )}
          {sessionStartedAt && !sessionExpired && (
            <span style={{
              fontSize: '.68rem',
              color: timeLeft <= 60 ? '#ff8a8a' : 'rgba(255,255,255,.45)',
              fontWeight: timeLeft <= 60 ? 700 : 400,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {formatCounselTimeLeft(timeLeft)}
            </span>
          )}
          <span style={{
            fontSize: '.7rem', color: 'rgba(255,255,255,.4)',
            background: 'rgba(255,255,255,.06)',
            padding: '3px 9px', borderRadius: 20,
          }}>{counselor}</span>
          <button
            id="counsel-panel-close"
            onClick={attemptCloseCounselPanel}
            aria-label="닫기"
            style={{
              background: 'rgba(255,255,255,.08)', border: 'none',
              borderRadius: 8, minWidth: 36, height: 36,
              color: 'rgba(255,255,255,.7)', cursor: 'pointer',
              fontSize: '1.1rem', WebkitTapHighlightColor: 'transparent',
            }}
          >✕</button>
        </div>
      </div>

      {aiSummaryReady && sessionStartedAt && !enabled && !ttsHintDismissed && (
        <div
          role="note"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            margin: '0 12px',
            marginTop: 10,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(74,158,255,.1)',
            border: '1px solid rgba(74,158,255,.25)',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={toggleTts}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              padding: 0,
              textAlign: 'left',
              color: 'rgba(200,225,255,.95)',
              fontSize: '.78rem',
              lineHeight: 1.45,
              cursor: 'pointer',
            }}
          >
            🔊 누르면 답변을 음성으로 들을 수 있어요
          </button>
          <button
            type="button"
            onClick={() => setTtsHintDismissed(true)}
            aria-label="안내 닫기"
            style={{
              flexShrink: 0,
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,.45)',
              cursor: 'pointer',
              fontSize: '.9rem',
              lineHeight: 1,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── guard ── */}
      {!aiSummaryReady && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 32, textAlign: 'center', gap: 12,
        }}>
          <span style={{ fontSize: '2rem' }}>✦</span>
          <p style={{ color: 'rgba(255,255,255,.6)', fontSize: '.9rem', lineHeight: 1.7, margin: 0 }}>
            AI 심층 풀이가 완료된 후<br />상담을 이용하실 수 있어요.
          </p>
        </div>
      )}

      {/* ── 메시지 영역 ── */}
      {aiSummaryReady && (
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          {msgs.map((msg, i) => {
            const isUser = msg.role === 'user';
            const isWaiting = !isUser && isSajuWaitingMessage(msg.content);
            const isError = !isUser && !isWaiting && (
              msg.content.startsWith('답변을 불러오지') ||
              msg.content.startsWith('응답 시간이')
            );
            const isEmpty = !isUser && msg.content === '';
            const isReading = playing && !isUser && speakingContent === msg.content;
            return (
              <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '88%',
                  padding: '10px 14px',
                  borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: isUser
                    ? `linear-gradient(135deg, ${PURPLE}, #3a7bd5)`
                    : isError ? 'rgba(220,80,80,.15)' : isWaiting ? 'rgba(139,111,198,.12)' : isReading ? 'rgba(139,111,198,.18)' : 'rgba(255,255,255,.07)',
                  border: isError
                    ? '1px solid rgba(220,80,80,.3)'
                    : isWaiting
                      ? '1px solid rgba(139,111,198,.35)'
                    : isReading
                      ? '1px solid rgba(139,111,198,.6)'
                      : '1px solid rgba(255,255,255,.08)',
                  boxShadow: isReading ? '0 0 16px rgba(139,111,198,.35), inset 0 0 8px rgba(139,111,198,.08)' : 'none',
                  color: isError ? 'rgba(255,180,180,.9)' : '#e8e8e8',
                  fontSize: '.88rem',
                  lineHeight: 1.75,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  animation: isReading ? 'reading-glow 2s ease-in-out infinite' : 'none',
                  transition: 'border 0.3s, box-shadow 0.3s, background 0.3s',
                }}>
                  {isEmpty ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* 답변 준비 중 표시 */}
                      <span style={{ opacity: 0.5, display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span style={{ animation: 'dot-blink 1.2s .0s infinite', display: 'inline-block' }}>●</span>
                        <span style={{ animation: 'dot-blink 1.2s .2s infinite', display: 'inline-block' }}>●</span>
                        <span style={{ animation: 'dot-blink 1.2s .4s infinite', display: 'inline-block' }}>●</span>
                        <span style={{ opacity: 0.6, fontSize: '.78rem', marginLeft: 4 }}>
                          {msg.thought || '잠시만 기다리세요.. 확인중입니다'}
                        </span>
                      </span>
                      {/* 후원 안내 배너 — 로딩 중 노출 */}
                      {false && (
                        <div style={{
                          marginTop: 4,
                          padding: '8px 10px',
                          borderRadius: 8,
                          background: 'rgba(232,201,126,.08)',
                          border: '1px solid rgba(232,201,126,.2)',
                          fontSize: '.74rem',
                          lineHeight: 1.6,
                          color: 'rgba(232,201,126,.8)',
                        }}>
                          💛 <strong>운영 후원 안내</strong><br />
                          서버비·운영비 명목으로 소액 후원을 받습니다.<br />
                          후원 여부와 관계없이 서비스 이용에는 제한이 없습니다.
                          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                            <a
                              href="https://toss.me/coupax"
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-block',
                                padding: '3px 10px',
                                borderRadius: 6,
                                background: 'rgba(232,201,126,.15)',
                                border: '1px solid rgba(232,201,126,.3)',
                                color: '#e8c97e',
                                fontSize: '.72rem',
                                fontWeight: 700,
                                textDecoration: 'none',
                                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                // @ts-ignore
                                style: { textDecoration: 'none' }
                              }}
                            >
                              💸 토스 후원
                            </a>
                            <a
                              href="https://qr.kakaopay.com/FfbMJbXMZ"
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-block',
                                padding: '3px 10px',
                                borderRadius: 6,
                                background: 'rgba(232,201,126,.15)',
                                border: '1px solid rgba(232,201,126,.3)',
                                color: '#e8c97e',
                                fontSize: '.72rem',
                                fontWeight: 700,
                                textDecoration: 'none',
                              }}
                            >
                              💛 카카오페이
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {msg.thought && (
                        <div style={{
                          fontSize: '.78rem',
                          color: 'rgba(255,255,255,.45)',
                          fontStyle: 'italic',
                          marginBottom: 8,
                          paddingBottom: 6,
                          borderBottom: '1px dashed rgba(255,255,255,.1)'
                        }}>
                          💡 생각 과정: {msg.thought}
                        </div>
                      )}
                      {isUser ? msg.content : renderCounselContent(msg.content)}
                      {!isUser && !isError && msg.content.length > 10 && (
                        <button
                          onClick={() => {
                            if (playing) {
                              stop();
                            } else {
                              void primeAudio().then(() => {
                                setSpeakingContent(msg.content);
                                void speak(msg.content, { manual: true });
                              });
                            }
                          }}
                          style={{
                            display: 'block', marginTop: 8,
                            background: 'none', border: 'none',
                            color: isReading ? 'rgba(180,140,255,.8)' : 'rgba(255,255,255,.4)',
                            cursor: 'pointer',
                            fontSize: '.72rem', padding: 0,
                            WebkitTapHighlightColor: 'transparent',
                          }}
                        >
                          {playing ? '⏹ 정지' : '🔊 읽기'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* ── 입력 영역 ── */}
      {aiSummaryReady && (
        <div style={{
          padding: '10px 12px',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
          borderTop: `1px solid ${borderColor}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          flexShrink: 0,
          background: panelBg,
          boxShadow: '0 -8px 24px rgba(0,0,0,0.35)',
        }}>
          {sessionStartedAt && !loading && !sessionExpired && (
            <>
            <div style={{
              fontSize: '.72rem',
              color: timeLeft <= 60 ? '#ff8a8a' : 'rgba(255,255,255,.45)',
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}>
              남은 상담 시간 {formatCounselTimeLeft(timeLeft)} (세션 {purchasedMinutes || COUNSEL_IAP_MINUTES}분)
            </div>
            <div style={{
              fontSize: '.7rem',
              color: 'rgba(255,200,120,.85)',
              textAlign: 'center',
              lineHeight: 1.5,
              padding: '0 4px',
            }}>
              ⚠️ {COUNSEL_LEAVE_SESSION_NOTICE}
            </div>
            </>
          )}
          {sessionExpired && (
            <div style={{
              fontSize: '.78rem',
              color: 'rgba(255,180,180,.9)',
              textAlign: 'center',
              lineHeight: 1.5,
            }}>
              {COUNSEL_SESSION_EXPIRED_MESSAGE}
            </div>
          )}
          {sessionExpired ? (
            <button
              type="button"
              onClick={openExtendPayment}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #7c4fc4, #3a7bd5)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '.95rem',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(124,79,196,0.35)',
              }}
            >
              ⏱ 시간 연장하고 대화 이어가기
            </button>
          ) : (
          <div style={{ display: 'flex', gap: 8 }}>
          {/* 마이크 버튼 — STT 지원 브라우저에서만 표시 */}
          {sttSupported && (
            <button
              id="counsel-mic-btn"
              onClick={async () => {
                await primeAudio(); // 마이크 탭 = 사용자 제스처 → iOS AudioContext unlock
                startStt();
              }}
              disabled={loading || sessionExpired}
              aria-label={listening ? '음성 입력 중지' : '음성으로 입력'}
              title={listening ? '듣는 중... (탭하여 중지)' : '마이크로 입력'}
              style={{
                flexShrink: 0,
                width: 44, height: 44,
                borderRadius: 10,
                border: listening
                  ? '1px solid rgba(255,80,80,.6)'
                  : `1px solid ${borderColor}`,
                background: listening
                  ? 'rgba(255,60,60,.2)'
                  : 'rgba(255,255,255,.06)',
                color: listening ? '#ff8080' : 'rgba(255,255,255,.6)',
                fontSize: '1.1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: listening ? 'mic-pulse 1s ease-in-out infinite' : 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {listening ? '🔴' : '🎙️'}
            </button>
          )}
          <input
            ref={inputRef}
            id="counsel-input"
            type="text"
            inputMode="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              sessionExpired
                ? '시간 연장 후 대화를 이어갈 수 있어요.'
                : (listening ? '듣는 중…' : '질문을 입력하세요…')
            }
            disabled={loading || sessionExpired}
            style={{
              flex: 1,
              background: listening ? 'rgba(255,60,60,.08)' : 'rgba(255,255,255,.06)',
              border: listening
                ? '1px solid rgba(255,80,80,.4)'
                : `1px solid ${borderColor}`,
              borderRadius: 10,
              padding: '11px 14px',
              color: '#e8e8e8',
              fontSize: '16px',
              outline: 'none',
              opacity: loading ? 0.6 : 1,
              transition: 'background .2s, border .2s',
            }}
          />
          <button
            id="counsel-send-btn"
            onClick={() => void handleSend()}
            disabled={loading || sessionExpired || !input.trim()}
            aria-label="전송"
            style={{
              padding: '11px 18px',
              background: loading || sessionExpired || !input.trim()
                ? 'rgba(255,255,255,.1)'
                : `linear-gradient(135deg, ${PURPLE}, #3a7bd5)`,
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontWeight: 700,
              fontSize: '.88rem',
              cursor: loading || sessionExpired || !input.trim() ? 'not-allowed' : 'pointer',
              transition: 'background .2s',
              WebkitTapHighlightColor: 'transparent',
              flexShrink: 0,
            }}
          >전송</button>
          </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes dot-blink {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.1); }
        }
        @keyframes mic-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,60,60,.4); }
          50%       { box-shadow: 0 0 0 6px rgba(255,60,60,0); }
        }
      `}</style>
    </div>
    </>
  );

  return (
    <>
      {!open && result && FabButton}
      {open && Panel}
      <PaymentModal
        open={showPaymentModal}
        mode={paymentMode}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={handlePurchaseSuccess}
      />
    </>
  );
}
