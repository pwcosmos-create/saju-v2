'use client';
/**
 * CounselPanel — AI 심층 상담 패널 (재구축 v3.0)
 *
 * Phase 2 MVP: 텍스트 상담만. TTS/STT/궁합은 Phase 4/5에서 추가.
 */
import { useState, useEffect, useRef } from 'react';
import type { SajuResult } from '../../core/pillar-calc/main-calculator';
import { COUNSELOR_NAMES } from '../../core/counselor-config';
import { useCounselChat } from './use-counsel-chat';

/** 세션마다 랜덤 상담사 배정 */
function pickCounselor(): string {
  return COUNSELOR_NAMES[Math.floor(Math.random() * COUNSELOR_NAMES.length)];
}

const INTRO_PREFIX = '안녕하세요! AI 심층 상담입니다';

function buildIntro(counselor: string, result: SajuResult): string {
  return `${INTRO_PREFIX}.\n이번 세션의 배정 상담사는 「${counselor}」입니다. 생년월일·성별 조합이 같은 동안은 같은 분이 끝까지 해설해 드려요.\n${result.input.year}년생 ${result.input.gender}성분의 사주를 분석했습니다.\n\n사주나 운세에 관해 궁금한 점을 편하게 물어보세요.`;
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

  /** 풀이가 초기화되면 대화도 초기화 */
  useEffect(() => {
    if (!aiSummaryReady) {
      reset();
      setOpen(false);
    }
  }, [aiSummaryReady, reset]);

  /** 패널 열 때: 인트로 메시지 세팅 */
  useEffect(() => {
    if (open && result && msgs.length === 0) {
      applyMsgs([{ role: 'assistant', content: buildIntro(counselor, result) }]);
    }
  }, [open, result, counselor, msgs.length, applyMsgs]);

  /** 새 메시지가 올 때마다 스크롤 */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput('');
    await send(trimmed);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  /* ─── 스타일 상수 ─── */
  const GOLD = '#e8c97e';
  const PURPLE = '#8b6fc6';
  const panelBg = 'rgba(14,11,28,0.97)';
  const borderColor = 'rgba(255,255,255,0.1)';

  /* ─── 플로팅 버튼 ─── */
  const FabButton = (
    <button
      id="counsel-panel-fab"
      onClick={() => setOpen(true)}
      aria-label="AI 심층 상담 열기"
      style={{
        position: 'fixed',
        bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        right: 20,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 20px',
        background: 'linear-gradient(135deg, #6b4fa0, #3a7bd5)',
        border: 'none',
        borderRadius: 100,
        color: '#fff',
        fontWeight: 700,
        fontSize: '.88rem',
        cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(107,79,160,0.5)',
      }}
    >
      <span style={{ fontSize: '1rem' }}>✦</span>
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
        top: 'max(4dvh, env(safe-area-inset-top, 0px))',
        bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
        right: 12,
        width: 'min(420px, calc(100vw - 24px))',
        zIndex: 9100,
        display: 'flex',
        flexDirection: 'column',
        background: panelBg,
        border: `1px solid ${borderColor}`,
        borderRadius: 20,
        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        backdropFilter: 'blur(24px)',
      }}
    >
      {/* ── 헤더 ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 18px',
        borderBottom: `1px solid ${borderColor}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: GOLD, fontSize: '1rem' }}>✦</span>
          <span style={{ fontWeight: 800, fontSize: '.95rem' }}>AI 심층 상담</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: '.72rem', color: 'rgba(255,255,255,.5)',
            background: 'rgba(255,255,255,.06)',
            padding: '3px 10px', borderRadius: 20,
          }}>
            상담사: {counselor}
          </span>
          <button
            id="counsel-panel-close"
            onClick={() => setOpen(false)}
            aria-label="닫기"
            style={{
              background: 'rgba(255,255,255,.08)', border: 'none',
              borderRadius: 8, width: 28, height: 28,
              color: 'rgba(255,255,255,.6)', cursor: 'pointer',
              fontSize: '1rem', lineHeight: 1,
            }}
          >✕</button>
        </div>
      </div>

      {/* ── aiSummaryReady 가드 ── */}
      {!aiSummaryReady && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 32, textAlign: 'center', gap: 12,
        }}>
          <span style={{ fontSize: '2rem' }}>✦</span>
          <p style={{ color: 'rgba(255,255,255,.6)', fontSize: '.88rem', lineHeight: 1.7, margin: 0 }}>
            AI 심층 풀이가 완료된 후<br />상담을 이용하실 수 있어요.
          </p>
        </div>
      )}

      {/* ── 메시지 영역 ── */}
      {aiSummaryReady && (
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          {msgs.map((msg, i) => {
            const isUser = msg.role === 'user';
            const isError = !isUser && (
              msg.content.startsWith('답변을 불러오지 못했습니다') ||
              msg.content.startsWith('응답 시간이 초과')
            );
            const isEmpty = !isUser && msg.content === '';

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{
                  maxWidth: '88%',
                  padding: '10px 14px',
                  borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: isUser
                    ? `linear-gradient(135deg, ${PURPLE}, #3a7bd5)`
                    : isError
                      ? 'rgba(220,80,80,.15)'
                      : 'rgba(255,255,255,.07)',
                  border: isError ? '1px solid rgba(220,80,80,.3)' : '1px solid rgba(255,255,255,.08)',
                  color: isError ? 'rgba(255,180,180,.9)' : '#e8e8e8',
                  fontSize: '.88rem',
                  lineHeight: 1.75,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {isEmpty
                    ? (
                      <span style={{ opacity: 0.5, display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span style={{ animation: 'dot-blink 1.2s .0s infinite', display: 'inline-block' }}>●</span>
                        <span style={{ animation: 'dot-blink 1.2s .2s infinite', display: 'inline-block' }}>●</span>
                        <span style={{ animation: 'dot-blink 1.2s .4s infinite', display: 'inline-block' }}>●</span>
                      </span>
                    )
                    : msg.content
                  }
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
          borderTop: `1px solid ${borderColor}`,
          display: 'flex',
          gap: 8,
          flexShrink: 0,
        }}>
          <input
            ref={inputRef}
            id="counsel-input"
            type="text"
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
              padding: '9px 14px',
              color: '#e8e8e8',
              fontSize: '.88rem',
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
              padding: '9px 18px',
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
            }}
          >
            전송
          </button>
        </div>
      )}

      {/* 애니메이션 */}
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
