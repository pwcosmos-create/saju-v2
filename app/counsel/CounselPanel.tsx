'use client';
/**
 * CounselPanel — AI 심층 상담 패널 (v3.2 - 모바일 지원)
 *
 * - iOS AudioContext 잠금 해제: handleSend 클릭 시 primeAudio() 호출
 * - 모바일 레이아웃: dvh 기반, 키보드 대응, 안전 영역 패딩
 */
import { useState, useEffect, useRef } from 'react';
import type { SajuResult } from '../../core/pillar-calc/main-calculator';
import { COUNSELOR_NAMES } from '../../core/counselor-config';
import { useTts } from './use-tts';
import { useCounselChat } from './use-counsel-chat';

function pickCounselor(): string {
  return COUNSELOR_NAMES[Math.floor(Math.random() * COUNSELOR_NAMES.length)];
}

const INTRO_PREFIX = '안녕하세요! AI 심층 상담입니다';

function buildIntro(counselor: string, result: SajuResult): string {
  return `${INTRO_PREFIX}.\n이번 세션의 배정 상담사는 「${counselor}」입니다.\n${result.input.year}년생 ${result.input.gender}성분의 사주를 분석했습니다.\n\n사주나 운세에 관해 궁금한 점을 편하게 물어보세요.`;
}

export default function CounselPanel({
  result,
  aiSummaryReady,
}: {
  result: SajuResult | null;
  aiSummaryReady: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [counselor] = useState(pickCounselor);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { msgs, loading, send, reset, applyMsgs } = useCounselChat(result, aiSummaryReady);
  const { playing, enabled, setEnabled, speak, stop, primeAudio } = useTts(counselor);

  useEffect(() => {
    if (!aiSummaryReady) {
      stop(); reset(); setOpen(false);
    }
  }, [aiSummaryReady, reset, stop]);

  useEffect(() => {
    if (open && result && msgs.length === 0) {
      applyMsgs([{ role: 'assistant', content: buildIntro(counselor, result) }]);
    }
  }, [open, result, counselor, msgs.length, applyMsgs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || !result || !aiSummaryReady || loading) return null;
    // iOS 첫 터치에서 AudioContext 잠금 해제
    await primeAudio();
    stop();
    setInput('');
    // send 완료 시 content 반환 → 직접 TTS 호출
    const responseContent = await send(trimmed);
    if (enabled && responseContent) {
      void speak(responseContent);
    }
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const GOLD = '#e8c97e';
  const PURPLE = '#8b6fc6';
  const panelBg = 'rgba(14,11,28,0.97)';
  const borderColor = 'rgba(255,255,255,0.1)';

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
      <button id="counsel-tts-toggle" onClick={() => setEnabled(v => !v)} title={enabled ? '음성 끄기' : '음성 켜기'} style={{
        background: enabled ? 'rgba(74,158,255,.15)' : 'rgba(255,255,255,.06)',
        border: `1px solid ${enabled ? 'rgba(74,158,255,.4)' : 'rgba(255,255,255,.15)'}`,
        borderRadius: 8, padding: '3px 10px',
        color: enabled ? '#7bbfff' : 'rgba(255,255,255,.35)',
        cursor: 'pointer', fontSize: '.72rem', fontWeight: 700,
      }}>
        {enabled ? '🔊 음성' : '🔇 음소거'}
      </button>
    );
  }

  /* ─── 플로팅 버튼 ─── */
  const FabButton = (
    <button
      id="counsel-panel-fab"
      onClick={() => setOpen(true)}
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
    <div
      id="counsel-panel"
      role="dialog"
      aria-label="AI 심층 상담"
      style={{
        position: 'fixed',
        /* 모바일: 거의 전체화면, 데스크톱: 우측 고정 패널 */
        top: 'env(safe-area-inset-top, 0px)',
        bottom: 'env(safe-area-inset-bottom, 0px)',
        right: 0,
        left: 0,
        /* 데스크톱에서만 작은 패널 */
        maxWidth: 'min(420px, 100vw)',
        marginLeft: 'auto',
        marginRight: 0,
        /* 데스크톱 여백 */
        borderRadius: 'clamp(0px, calc((100vw - 480px) * 9999), 20px)',
        margin: 'clamp(0px, calc((100vw - 480px) * 9999), 12px) clamp(0px, calc((100vw - 480px) * 9999), 12px) clamp(0px, calc((100vw - 480px) * 9999), 80px)',
        zIndex: 9100,
        display: 'flex',
        flexDirection: 'column',
        background: panelBg,
        border: `1px solid ${borderColor}`,
        boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
        overflow: 'hidden',
        backdropFilter: 'blur(24px)',
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
          <span style={{
            fontSize: '.7rem', color: 'rgba(255,255,255,.4)',
            background: 'rgba(255,255,255,.06)',
            padding: '3px 9px', borderRadius: 20,
          }}>{counselor}</span>
          <button
            id="counsel-panel-close"
            onClick={() => { stop(); setOpen(false); }}
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
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          {msgs.map((msg, i) => {
            const isUser = msg.role === 'user';
            const isError = !isUser && (
              msg.content.startsWith('답변을 불러오지') ||
              msg.content.startsWith('응답 시간이')
            );
            const isEmpty = !isUser && msg.content === '';
            return (
              <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '88%',
                  padding: '10px 14px',
                  borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: isUser
                    ? `linear-gradient(135deg, ${PURPLE}, #3a7bd5)`
                    : isError ? 'rgba(220,80,80,.15)' : 'rgba(255,255,255,.07)',
                  border: isError ? '1px solid rgba(220,80,80,.3)' : '1px solid rgba(255,255,255,.08)',
                  color: isError ? 'rgba(255,180,180,.9)' : '#e8e8e8',
                  fontSize: '.88rem',
                  lineHeight: 1.75,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {isEmpty ? (
                    <span style={{ opacity: 0.5, display: 'flex', gap: 4, alignItems: 'center' }}>
                      <span style={{ animation: 'dot-blink 1.2s .0s infinite', display: 'inline-block' }}>●</span>
                      <span style={{ animation: 'dot-blink 1.2s .2s infinite', display: 'inline-block' }}>●</span>
                      <span style={{ animation: 'dot-blink 1.2s .4s infinite', display: 'inline-block' }}>●</span>
                    </span>
                  ) : (
                    <>
                      {msg.content}
                      {!isUser && !isError && msg.content.length > 10 && (
                        <button
                          onClick={() => playing ? stop() : void speak(msg.content)}
                          style={{
                            display: 'block', marginTop: 8,
                            background: 'none', border: 'none',
                            color: 'rgba(255,255,255,.4)', cursor: 'pointer',
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
          paddingBottom: 'max(10px, env(safe-area-inset-bottom, 10px))',
          borderTop: `1px solid ${borderColor}`,
          display: 'flex',
          gap: 8,
          flexShrink: 0,
          background: panelBg,
        }}>
          <input
            ref={inputRef}
            id="counsel-input"
            type="text"
            inputMode="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="질문을 입력하세요…"
            disabled={loading}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,.06)',
              border: `1px solid ${borderColor}`,
              borderRadius: 10,
              padding: '11px 14px',
              color: '#e8e8e8',
              fontSize: '16px', // iOS 자동 확대 방지
              outline: 'none',
              opacity: loading ? 0.6 : 1,
            }}
          />
          <button
            id="counsel-send-btn"
            onClick={() => void handleSend()}
            disabled={loading || !input.trim()}
            aria-label="전송"
            style={{
              padding: '11px 18px',
              background: loading || !input.trim()
                ? 'rgba(255,255,255,.1)'
                : `linear-gradient(135deg, ${PURPLE}, #3a7bd5)`,
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontWeight: 700,
              fontSize: '.88rem',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              transition: 'background .2s',
              WebkitTapHighlightColor: 'transparent',
              flexShrink: 0,
            }}
          >전송</button>
        </div>
      )}

      <style>{`
        @keyframes dot-blink {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.1); }
        }
      `}</style>
    </div>
  );

  return (
    <>
      {!open && result && FabButton}
      {open && Panel}
    </>
  );
}
