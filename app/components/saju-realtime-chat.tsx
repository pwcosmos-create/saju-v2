'use client';
/**
 * SajuRealtimeChat - 실시간 1:1 대화형 AI 사주 풀이 컴포넌트
 *
 * - 정적 카드 나열을 탈피하여 실시간 한 글자씩 타이핑되는 대화형 스트리밍 인터페이스
 * - RAG 60갑자 만세력 뼈대 + Gemini Free 0원 스트리밍 + 온디바이스 0원 폴백
 * - Proof Stage V3.1: Midnight Blue (#0A1931), Deep Copper (#B8860B), Clear Sky Blue (#ADD8E6)
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { SajuResult } from '../../core/pillar-calc/main-calculator';
import { STEMS, BRANCHES, STEMS_H, BRANCHES_H, STEM_ELEM, ELEM_NAMES } from '../../core/pillar-calc/korean-calendar-engine';
import { calcStrength, classifyElements, getSipsin } from '../../core/daily-fortune/classifier';
import { getIljooDesc } from '../../core/interpretation-db/matcher';
import { primeSpeechAudio, speakKoreanQueued, stopKoreanSpeech } from '../../lib/korean-tts';

export interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  topic?: string;
  isStreaming?: boolean;
}

const QUICK_PROMPTS = [
  { id: 'wealth', label: '💰 2026년 재물운 & 자산 관리', prompt: '올해 2026년 저의 재물운과 돈을 불리거나 지키는 구체적인 방법을 알려주세요.' },
  { id: 'career', label: '💼 이직 / 직장 / 사업 운세', prompt: '직장에서의 승진이나 이직, 혹은 새로운 사업을 시작하기에 언제가 좋은 타이밍인가요?' },
  { id: 'love', label: '🤝 인연의 흐름 & 애정운', prompt: '저의 타고난 배우자 복과 앞으로 들어올 좋은 인연의 흐름에 대해 자세히 풀어주세요.' },
  { id: 'daeun', label: '🌟 인생의 전성기와 대운', prompt: '제 인생에서 가장 강력한 운이 들어오는 전성기(대운)와 조심해야 할 시기를 알려주세요.' },
  { id: 'advice', label: '✨ 기운을 보완하는 개운법', prompt: '제 사주에서 부족한 오행을 채우고 운을 끌어올리는 행운의 색상, 숫자, 일상 실천법을 알려주세요.' },
];

const ELEM_COLORS: Record<string, string> = {
  '목': '#5dce70',
  '화': '#ff7070',
  '토': '#e8c840',
  '금': '#e0e0e0',
  '수': '#90b8f0',
};

export default function SajuRealtimeChat({
  result,
  streamText,
  isStreaming,
  onSendAdditionalPrompt,
}: {
  result: SajuResult | null;
  streamText: string;
  isStreaming: boolean;
  onSendAdditionalPrompt: (prompt: string) => Promise<void>;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 사주 핵심 피처 추출 (RAG 뼈대)
  const sajuSummary = useMemo(() => {
    if (!result) return null;
    const dayStemIdx = result.pillars[2]?.s ?? 0;
    const dayBranchIdx = result.pillars[2]?.b ?? 0;
    const dayElem = STEM_ELEM[dayStemIdx];
    const { isWeak } = calcStrength(result.pillars, dayElem);
    const elemCls = classifyElements(dayStemIdx, isWeak, result.ohaeng.counts);
    const dpPillar = result.pillars[2];
    const iljooDescText = dpPillar ? getIljooDesc(dpPillar) : '';

    return {
      dayStemIdx,
      dayBranchIdx,
      dayStemKo: STEMS[dayStemIdx],
      dayBranchKo: BRANCHES[dayBranchIdx],
      dayStemH: STEMS_H[dayStemIdx],
      dayBranchH: BRANCHES_H[dayBranchIdx],
      dayElemName: ELEM_NAMES[dayElem],
      isWeak,
      strengthLabel: isWeak ? '신약(身弱)' : '신강(身强)',
      yongsin: elemCls.yongsin,
      counts: result.ohaeng.counts,
      iljooKeyword: iljooDescText.split('.')[0] || '명석하고 주도적인 기운',
    };
  }, [result]);

  // 초기 메인 풀이 스트리밍 반영
  useEffect(() => {
    if (!result) return;
    if (streamText) {
      setMessages((prev) => {
        const aiMsgIndex = prev.findIndex((m) => m.id === 'main-fortune');
        const updatedMsg: ChatMessage = {
          id: 'main-fortune',
          sender: 'ai',
          text: streamText,
          isStreaming: isStreaming,
        };
        if (aiMsgIndex >= 0) {
          const next = [...prev];
          next[aiMsgIndex] = updatedMsg;
          return next;
        } else {
          return [updatedMsg];
        }
      });
    }
  }, [streamText, isStreaming, result]);

  // 스크롤 자동 이동
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // 음성 TTS 토글
  const handleToggleTts = () => {
    if (isTtsPlaying) {
      stopKoreanSpeech();
      setIsTtsPlaying(false);
    } else {
      const fullAiText = messages.filter((m) => m.sender === 'ai').map((m) => m.text).join('\n\n');
      if (!fullAiText) return;
      primeSpeechAudio();
      setIsTtsPlaying(true);
      speakKoreanQueued(fullAiText, {
        onDone: () => setIsTtsPlaying(false),
        onChunkError: () => setIsTtsPlaying(false),
      });
    }
  };

  // 질문 전송 처리
  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputVal.trim();
    if (!textToSend || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInputVal('');

    await onSendAdditionalPrompt(textToSend);
  };

  if (!result || !sajuSummary) return null;

  return (
    <div style={{
      width: '100%',
      maxWidth: 720,
      margin: '0 auto',
      background: 'linear-gradient(180deg, #0A1931 0%, #060D1A 100%)',
      borderRadius: 20,
      border: '1px solid rgba(173, 216, 230, 0.18)',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(184, 134, 11, 0.12)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 620,
    }}>
      {/* ─── 상단 미니 만세력 & 사주 4주 8자 요약 바 (Proof Stage) ─── */}
      <div style={{
        padding: '16px 20px',
        background: 'rgba(10, 25, 49, 0.85)',
        borderBottom: '1px solid rgba(173, 216, 230, 0.15)',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.2rem' }}>🔮</span>
            <div>
              <div style={{ fontSize: '.95rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                AI 사주 명리학 1:1 실시간 대화
              </div>
              <div style={{ fontSize: '.75rem', color: '#ADD8E6', opacity: 0.85 }}>
                {sajuSummary.dayStemKo}{sajuSummary.dayBranchKo}일주 ({sajuSummary.dayStemH}{sajuSummary.dayBranchH}) · {sajuSummary.strengthLabel} · 용신 {ELEM_NAMES[sajuSummary.yongsin]}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleTts}
            aria-label="사주 풀이 음성 듣기"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 20,
              background: isTtsPlaying ? 'rgba(184, 134, 11, 0.25)' : 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${isTtsPlaying ? '#B8860B' : 'rgba(255, 255, 255, 0.15)'}`,
              color: isTtsPlaying ? '#F5D67A' : '#e0e0e0',
              fontSize: '.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <span>{isTtsPlaying ? '🔊 듣는 중' : '🔈 음성 듣기'}</span>
          </button>
        </div>

        {/* 4주 8자 미니 칩스 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 6,
          background: 'rgba(0, 0, 0, 0.25)',
          padding: '8px 10px',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}>
          {['시주', '일주', '월주', '년주'].map((col, idx) => {
            const pillarIdx = [3, 2, 1, 0][idx];
            const p = result.pillars[pillarIdx];
            if (!p) {
              return (
                <div key={col} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '.64rem', color: '#8899aa' }}>{col}</div>
                  <div style={{ fontSize: '.78rem', color: '#667788' }}>미입력</div>
                </div>
              );
            }
            const stemEl = STEM_ELEM[p.s];
            const colColor = ELEM_COLORS[ELEM_NAMES[stemEl]] || '#fff';
            return (
              <div key={col} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '.64rem', color: '#8899aa', marginBottom: 2 }}>{col}</div>
                <div style={{ fontSize: '.88rem', fontWeight: 800, color: colColor }}>
                  {STEMS[p.s]}{BRANCHES[p.b]}
                </div>
                <div style={{ fontSize: '.62rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                  {STEMS_H[p.s]}{BRANCHES_H[p.b]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 실시간 대화창 본문 (한 글자씩 실시간 스트리밍) ─── */}
      <div style={{
        flex: 1,
        padding: '20px 16px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {messages.map((msg) => {
          const isAi = msg.sender === 'ai';
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isAi ? 'flex-start' : 'flex-end',
                maxWidth: '100%',
              }}
            >
              {isAi && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, marginLeft: 4 }}>
                  <span style={{ fontSize: '.85rem' }}>🧙‍♂️</span>
                  <span style={{ fontSize: '.76rem', fontWeight: 700, color: '#B8860B' }}>AI 사주 도사</span>
                </div>
              )}

              <div style={{
                maxWidth: '92%',
                padding: '14px 18px',
                borderRadius: isAi ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
                background: isAi ? 'rgba(255, 255, 255, 0.05)' : 'linear-gradient(135deg, #B8860B 0%, #8A6405 100%)',
                color: '#fff',
                border: isAi ? '1px solid rgba(173, 216, 230, 0.16)' : 'none',
                boxShadow: isAi ? '0 4px 16px rgba(0, 0, 0, 0.25)' : '0 4px 14px rgba(184, 134, 11, 0.3)',
                lineHeight: 1.72,
                fontSize: '.94rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {msg.text}
                {msg.isStreaming && (
                  <span style={{
                    display: 'inline-block',
                    width: 7,
                    height: 15,
                    marginLeft: 4,
                    background: '#ADD8E6',
                    animation: 'blink 0.8s infinite',
                    verticalAlign: 'middle',
                  }} />
                )}
              </div>
            </div>
          );
        })}

        <div ref={chatBottomRef} />
      </div>

      {/* ─── 하단 퀵 질문 칩스 (상황 맞춤 질의) ─── */}
      <div style={{
        padding: '10px 16px',
        background: 'rgba(0, 0, 0, 0.25)',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
      }}>
        <div style={{ fontSize: '.72rem', color: '#8899aa', marginBottom: 8, fontWeight: 600 }}>
          💡 바로 물어보기 (1:1 맞춤 상황 풀이)
        </div>
        <div style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 4,
          scrollbarWidth: 'none',
        }}>
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q.id}
              type="button"
              disabled={isStreaming}
              onClick={() => handleSend(q.prompt)}
              style={{
                flexShrink: 0,
                padding: '7px 13px',
                borderRadius: 20,
                background: 'rgba(173, 216, 230, 0.08)',
                border: '1px solid rgba(173, 216, 230, 0.22)',
                color: '#e2edff',
                fontSize: '.78rem',
                fontWeight: 700,
                cursor: isStreaming ? 'not-allowed' : 'pointer',
                opacity: isStreaming ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 하단 1:1 대화 입력창 ─── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
        style={{
          display: 'flex',
          gap: 8,
          padding: '12px 16px',
          background: 'rgba(10, 25, 49, 0.95)',
          borderTop: '1px solid rgba(173, 216, 230, 0.15)',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder={isStreaming ? 'AI가 풀이를 작성 중입니다...' : '궁금한 점을 자유롭게 물어보세요 (예: 올해 이직해도 될까요?)'}
          disabled={isStreaming}
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 12,
            padding: '11px 15px',
            color: '#fff',
            fontSize: '.9rem',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={isStreaming || !inputVal.trim()}
          style={{
            padding: '0 18px',
            borderRadius: 12,
            background: isStreaming || !inputVal.trim()
              ? 'rgba(255, 255, 255, 0.1)'
              : 'linear-gradient(135deg, #B8860B 0%, #946C06 100%)',
            border: 'none',
            color: isStreaming || !inputVal.trim() ? '#778899' : '#fff',
            fontWeight: 800,
            fontSize: '.88rem',
            cursor: isStreaming || !inputVal.trim() ? 'not-allowed' : 'pointer',
            boxShadow: !isStreaming && inputVal.trim() ? '0 2px 10px rgba(184, 134, 11, 0.4)' : 'none',
          }}
        >
          전송
        </button>
      </form>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
