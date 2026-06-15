'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface AdGateModalProps {
  /** 모달이 열려있는지 여부 */
  open: boolean;
  /** 광고를 보고 분석을 진행할 때 호출 */
  onProceed: () => void;
  /** 모달을 닫을 때 호출 (분석 취소) */
  onClose: () => void;
}

const AD_UNIT = 'DAN-JQne2FQbiyiDWP3v';
const AD_WAIT_SEC = 5; // 최소 광고 노출 시간

export default function AdGateModal({ open, onProceed, onClose }: AdGateModalProps) {
  const adContainerRef = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState(AD_WAIT_SEC);
  const [ready, setReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adLoadedRef = useRef(false);

  // 광고 DOM 주입
  const injectAd = useCallback(() => {
    const container = adContainerRef.current;
    if (!container || adLoadedRef.current) return;
    adLoadedRef.current = true;

    container.innerHTML = '';

    const ins = document.createElement('ins');
    ins.className = 'kakao_ad_area';
    ins.style.display = 'none';
    ins.setAttribute('data-ad-unit', AD_UNIT);
    ins.setAttribute('data-ad-width', '300');
    ins.setAttribute('data-ad-height', '250');

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = '//t1.kakaocdn.net/kas/static/ba.min.js';
    script.async = true;

    container.appendChild(ins);
    container.appendChild(script);
  }, []);

  // 카운트다운 타이머
  useEffect(() => {
    if (!open) {
      // 닫힐 때 상태 초기화
      setCountdown(AD_WAIT_SEC);
      setReady(false);
      adLoadedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // 모달 열릴 때 광고 주입
    setTimeout(() => injectAd(), 100);

    // 카운트다운 시작
    setCountdown(AD_WAIT_SEC);
    setReady(false);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setReady(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open, injectAd]);

  // 스크롤 잠금
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const handleProceed = () => {
    if (!ready) return;
    onProceed();
  };

  const progressPct = ((AD_WAIT_SEC - countdown) / AD_WAIT_SEC) * 100;

  return (
    <>
      <style>{`
        @keyframes adGateFadeIn {
          from { opacity: 0; transform: scale(0.94) translateY(16px); }
          to   { opacity: 1; transform: scale(1)   translateY(0); }
        }
        @keyframes adGateOverlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes progressPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.6; }
        }
        .ag-proceed-btn {
          transition: all 0.3s ease;
        }
        .ag-proceed-btn:not(:disabled):hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(124, 79, 196, 0.5);
        }
        .ag-proceed-btn:not(:disabled):active {
          transform: translateY(0);
        }
        .ag-close-btn:hover {
          background: rgba(255,255,255,0.15) !important;
        }
      `}</style>

      {/* 오버레이 배경 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          background: 'rgba(8, 6, 18, 0.82)',
          backdropFilter: 'blur(6px)',
          animation: 'adGateOverlayIn 0.25s ease forwards',
        }}
        onClick={onClose}
        aria-label="광고 모달 배경"
      />

      {/* 모달 카드 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="광고 게이트 모달"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            width: '100%',
            maxWidth: 380,
            background: 'linear-gradient(160deg, rgba(26,20,52,0.97) 0%, rgba(14,11,34,0.98) 100%)',
            border: '1px solid rgba(124, 79, 196, 0.35)',
            borderRadius: 24,
            boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(74, 158, 255, 0.08) inset',
            overflow: 'hidden',
            animation: 'adGateFadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          }}
        >
          {/* 헤더 */}
          <div style={{
            padding: '20px 20px 0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{
                fontSize: '.7rem',
                color: 'rgba(255,255,255,0.35)',
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                fontWeight: 700,
                marginBottom: 4,
              }}>
                광고
              </div>
              <div style={{
                fontSize: '1rem',
                fontWeight: 800,
                background: 'linear-gradient(90deg, #c9a0ff, #7c9fff)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                잠깐! 풀이 전 광고를 확인해주세요 ✦
              </div>
            </div>
            <button
              className="ag-close-btn"
              onClick={onClose}
              aria-label="닫기"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                color: 'rgba(255,255,255,0.5)',
                width: 32,
                height: 32,
                cursor: 'pointer',
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>

          {/* 광고 영역 */}
          <div style={{
            padding: '16px 20px 12px 20px',
            display: 'flex',
            justifyContent: 'center',
          }}>
            <div style={{
              width: 300,
              height: 250,
              borderRadius: 14,
              overflow: 'hidden',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}>
              <div ref={adContainerRef} style={{ width: '100%', height: '100%' }} />
              {/* 광고 로딩 플레이스홀더 */}
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                gap: 8,
                opacity: 0.35,
              }}>
                <div style={{ fontSize: '2rem' }}>◈</div>
                <div style={{ fontSize: '.72rem', color: 'rgba(255,255,255,0.6)' }}>광고 불러오는 중...</div>
              </div>
            </div>
          </div>

          {/* 프로그레스 바 */}
          <div style={{ padding: '0 20px' }}>
            <div style={{
              height: 4,
              borderRadius: 99,
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${progressPct}%`,
                background: ready
                  ? 'linear-gradient(90deg, #7c4fc4, #4a9eff)'
                  : 'linear-gradient(90deg, #7c4fc4, #4a9eff)',
                borderRadius: 99,
                transition: 'width 0.9s linear',
              }} />
            </div>
          </div>

          {/* 푸터 */}
          <div style={{ padding: '14px 20px 20px 20px' }}>
            <div style={{
              fontSize: '.75rem',
              color: 'rgba(255,255,255,0.35)',
              textAlign: 'center',
              marginBottom: 12,
              minHeight: 20,
            }}>
              {ready
                ? '✓ 준비 완료! 아래 버튼을 눌러 사주 풀이를 확인하세요.'
                : `${countdown}초 후 풀이를 볼 수 있어요`}
            </div>

            <button
              className="ag-proceed-btn"
              onClick={handleProceed}
              disabled={!ready}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 12,
                border: 'none',
                cursor: ready ? 'pointer' : 'not-allowed',
                fontWeight: 800,
                fontSize: '.98rem',
                color: '#fff',
                background: ready
                  ? 'linear-gradient(135deg, #7c4fc4, #4a9eff)'
                  : 'rgba(255,255,255,0.08)',
                opacity: ready ? 1 : 0.6,
                letterSpacing: '.02em',
              }}
            >
              {ready ? '✦ 사주 풀이 보기' : `⏳ ${countdown}초 대기 중...`}
            </button>

            <p style={{
              fontSize: '.67rem',
              color: 'rgba(255,255,255,0.2)',
              textAlign: 'center',
              marginTop: 10,
              margin: '10px 0 0',
            }}>
              광고 수익은 서비스 운영에 사용됩니다. 감사합니다 🙏
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
