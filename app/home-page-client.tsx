'use client';
/**
 * SAJU-V2 MAIN PAGE
 * 푸터 표시 버전은 package.json 의 version 과 동기화됩니다.
 */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import packageJson from '../package.json';
import {
  SUPPORT_ACCOUNT_NO,
  SUPPORT_BANK,
  SUPPORT_ACCOUNT_HOLDER,
  formatAccountForDisplay,
  supportAccountDigits,
  supportAccountManualCopyHint,
} from '../lib/support-account';
import { FooterBrandRow, SiteNav } from './site-chrome';
import { BRAND } from './ui-brand';

const APP_VERSION = packageJson.version;

const FEATURES = [
  {
    icon: '✨',
    title: '사주팔자 정밀 계산',
    desc: '진짜만세력(고영창) 기반 60갑자 사주팔자를 정밀하게 계산합니다. 양력·음력 모두 지원.',
    color: '#f5d67a',
  },
  {
    icon: '✦',
    title: 'AI 심층 풀이',
    desc: 'AI가 실시간 스트리밍으로 성격·직업·건강·운세를 깊이 있게 풀이해드립니다.',
    color: '#c4a8ff',
  },
  {
    icon: '💎',
    title: '오행·신살·대운',
    desc: '오행 분포, 천을귀인 등 신살, 10년 대운 흐름까지 한눈에 분석합니다.',
    color: '#5dce70',
  },
  {
    icon: '📅',
    title: '월별 운세',
    desc: `${new Date().getFullYear()}년 월별 운세와 연간 운세 흐름을 탭별로 상세하게 확인하세요.`,
    color: '#90b8f0',
  },
];

const STEPS = [
  { num: '01', title: '생년월일 입력', desc: '이름, 성별, 생년월일, 태어난 시간을 입력하세요.' },
  { num: '02', title: '사주 자동 계산', desc: '60갑자 사주팔자와 오행·신살·대운이 즉시 계산됩니다.' },
  { num: '03', title: 'AI 풀이 확인', desc: 'AI가 실시간으로 나만의 사주를 깊이 있게 풀이해드립니다.' },
];

export default function HomePageClient() {
  const router = useRouter();
  const [aiLoading, setAiLoad] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [landingSupportCopyFb, setLandingSupportCopyFb] = useState<'idle' | 'ok' | 'err'>('idle');
  const landingSupportCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const steps = ["운명의 기운을 읽는 중...", "천간과 지지의 조화를 검토 중...", "전문적인 조언을 정성껏 작성 중..."];

  useEffect(() => () => {
    if (landingSupportCopyTimerRef.current) clearTimeout(landingSupportCopyTimerRef.current);
  }, []);

  async function copyLandingSupportAccount() {
    const digits = supportAccountDigits(SUPPORT_ACCOUNT_NO);
    if (!digits) return;
    if (landingSupportCopyTimerRef.current) clearTimeout(landingSupportCopyTimerRef.current);
    try {
      await navigator.clipboard.writeText(digits);
      setLandingSupportCopyFb('ok');
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
          setLandingSupportCopyFb('ok');
        } else {
          setLandingSupportCopyFb('err');
          window.alert(supportAccountManualCopyHint(digits));
        }
      } catch {
        setLandingSupportCopyFb('err');
        window.alert(supportAccountManualCopyHint(digits));
      }
    }
    landingSupportCopyTimerRef.current = setTimeout(() => {
      setLandingSupportCopyFb('idle');
      landingSupportCopyTimerRef.current = null;
    }, 2400);
  }

  function askAI() {
    if (aiLoading) return;
    setAiLoad(true);
    setLoadingStep(0);

    const timer1 = setTimeout(() => setLoadingStep(1), 250);
    const timer2 = setTimeout(() => setLoadingStep(2), 550);
    setTimeout(() => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      router.push('/saju');
    }, 800);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: BRAND.bg,
      color: '#e0cfff',
      fontFamily: "'Apple SD Gothic Neo','Noto Sans KR',sans-serif",
      overflowX: 'hidden',
    }}>
      <style>{`
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .rotating-star { animation: rotate 2s linear infinite; display: inline-block; }
        .analyzing-btn { animation: pulse 1.5s infinite; }
        .btn-shine { position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent); animation: shine 2s infinite; }
        @keyframes shine { to { left: 100%; } }

        /* 히어로 별무리 — 떠오름 + 반짝임 + 미세 회전 (레이어별로 transform 분리) */
        .hero-twinkle-cluster { overflow: visible; }
        .hero-twinkle-cluster .ht-layer-glow {
          transform-box: fill-box;
          transform-origin: center;
        }
        @keyframes htFloatMain {
          0%, 100% { transform: translate(0, 0); }
          45% { transform: translate(2px, -6px); }
          70% { transform: translate(-3px, 2px); }
        }
        @keyframes htGlowMain {
          0%, 100% { opacity: 1; transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 8px rgba(196,168,255,.35)); }
          38% { opacity: .62; transform: scale(1.14) rotate(10deg); filter: drop-shadow(0 0 18px rgba(196,168,255,.95)); }
          72% { opacity: .88; transform: scale(.94) rotate(-6deg); filter: drop-shadow(0 0 10px rgba(139,111,198,.55)); }
        }
        @keyframes htFloatSub1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-5px, 4px); }
        }
        @keyframes htGlowSub1 {
          0%, 100% { opacity: .85; transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 4px rgba(139,111,198,.4)); }
          42% { opacity: .45; transform: scale(1.25) rotate(-14deg); filter: drop-shadow(0 0 12px rgba(196,168,255,.75)); }
          68% { opacity: .95; transform: scale(.88) rotate(8deg); }
        }
        @keyframes htFloatSub2 {
          0%, 100% { transform: translate(0, 0); }
          55% { transform: translate(6px, -3px); }
        }
        @keyframes htGlowSub2 {
          0%, 100% { opacity: .88; transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 5px rgba(139,111,198,.45)); }
          48% { opacity: .5; transform: scale(1.22) rotate(16deg); filter: drop-shadow(0 0 14px rgba(196,168,255,.8)); }
          74% { opacity: .92; transform: scale(.9) rotate(-10deg); }
        }
        .ht-main-float { animation: htFloatMain 5.4s ease-in-out infinite; transform-origin: 12px 11px; transform-box: fill-box; }
        .ht-main-glow { animation: htGlowMain 2.85s ease-in-out infinite; transform-origin: 12px 11px; }
        .ht-sub1-float { animation: htFloatSub1 4.2s ease-in-out infinite 0.35s; transform-origin: 18.5px 18px; transform-box: fill-box; }
        .ht-sub1-glow { animation: htGlowSub1 2.15s ease-in-out infinite 0.6s; transform-origin: 18.5px 18px; }
        .ht-sub2-float { animation: htFloatSub2 3.6s ease-in-out infinite 0.2s; transform-origin: 5.5px 18px; transform-box: fill-box; }
        .ht-sub2-glow { animation: htGlowSub2 2.45s ease-in-out infinite 0.15s; transform-origin: 5.5px 18px; }

        /* 하단 CTA 단일 별 */
        @keyframes ctaStarPulse {
          0%, 100% { opacity: .55; transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 8px rgba(196,168,255,.25)); }
          50% { opacity: 1; transform: scale(1.08) rotate(12deg); filter: drop-shadow(0 0 16px rgba(196,168,255,.65)); }
        }
        .cta-twinkle-svg .cta-star-layer {
          animation: ctaStarPulse 3s ease-in-out infinite;
          transform-origin: 12px 11px;
          transform-box: fill-box;
        }

        @media (prefers-reduced-motion: reduce) {
          .ht-main-float, .ht-main-glow, .ht-sub1-float, .ht-sub1-glow, .ht-sub2-float, .ht-sub2-glow,
          .cta-twinkle-svg .cta-star-layer {
            animation: none !important;
          }
          .hero-twinkle-cluster .ht-layer-glow { filter: drop-shadow(0 0 6px rgba(196,168,255,.35)); opacity: .92; }
        }
      `}</style>

      <SiteNav variant="landing" />

      {/* Hero */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '100px 24px 60px',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,111,198,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          display: 'inline-block', marginBottom: 28,
          padding: '6px 20px', borderRadius: 100,
          background: 'rgba(232, 201, 126, 0.15)',
          border: '1px solid rgba(232, 201, 126, 0.4)',
          fontSize: '.82rem', fontWeight: 700, color: '#e8c97e',
        }}>
          ✦ 무료 사주팔자 정밀 분석
        </div>

        <h1 style={{
          fontSize: 'clamp(2.8rem, 8vw, 5.5rem)',
          fontWeight: 900, lineHeight: 1.1,
          letterSpacing: -2, marginBottom: 24,
          background: 'linear-gradient(135deg, #e0cfff 0%, #b48fff 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          나의 AI사주를<br/>알아보세요
        </h1>

        <p style={{
          fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
          color: '#8b6fc6', maxWidth: 520, lineHeight: 1.7, marginBottom: 48,
        }}>
          생년월일과 태어난 시간을 입력하면<br/>
          AI 심층 풀이 후 텍스트·음성 맞춤 상담도 이용할 수 있습니다
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 64 }}>
          <button
            onClick={askAI}
            disabled={aiLoading}
            className={aiLoading ? "analyzing-btn" : ""}
            style={{
              background: aiLoading ? 'linear-gradient(135deg, #6b46c1, #3182ce)' : 'linear-gradient(135deg, #805ad5, #4299e1)',
              color: '#fff', border: 'none', padding: '16px 40px', borderRadius: 16,
              fontSize: '1.05rem', fontWeight: 700, cursor: aiLoading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.3s',
              boxShadow: '0 0 40px rgba(139,111,198,0.4)',
              position: 'relative', overflow: 'hidden'
            }}
          >
            {aiLoading ? (
              <>
                <span className="rotating-star">✦</span>
                <span>{loadingStep === 3 ? "최종 검토 중..." : steps[loadingStep]}</span>
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L13.5 9L21 10.5L13.5 12L12 19L10.5 12L3 10.5L10.5 9L12 2Z" fill="currentColor"/>
                </svg>
                사주팔자 무료 분석하기
              </>
            )}
            {aiLoading && <div className="btn-shine" />}
          </button>
        </div>

        <div className="hero-twinkle" style={{ marginTop: 40, opacity: 0.72, userSelect: 'none' }}>
          <svg className="hero-twinkle-cluster" width="120" height="120" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <g className="ht-main-float">
              <g className="ht-layer-glow ht-main-glow">
                <path d="M12 2L13.5 9L21 10.5L13.5 12L12 19L10.5 12L3 10.5L10.5 9L12 2Z" fill="#c4a8ff"/>
              </g>
            </g>
            <g className="ht-sub1-float">
              <g className="ht-layer-glow ht-sub1-glow">
                <path d="M18.5 15.5L19.5 18L22 19L19.5 20L18.5 22.5L17.5 20L15 19L17.5 18L18.5 15.5Z" fill="#8b6fc6"/>
              </g>
            </g>
            <g className="ht-sub2-float">
              <g className="ht-layer-glow ht-sub2-glow">
                <path d="M5.5 16L6 17.5L7.5 18L6 18.5L5.5 20L5 18.5L3.5 18L5 17.5L5.5 16Z" fill="#8b6fc6"/>
              </g>
            </g>
          </svg>
        </div>

        <div style={{
          display: 'flex', gap: 48, marginTop: 48,
          flexWrap: 'wrap', justifyContent: 'center',
        }}>
          {[
            { num: '무료', label: '사주팔자 분석' },
            { num: '7가지', label: '분석 탭' },
            { num: '선택', label: '운영 후원' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#e8c97e' }}>{s.num}</div>
              <div style={{ fontSize: '.82rem', color: '#6b6490', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 18,
          padding: '10px 14px',
          borderRadius: 12,
          background: 'rgba(232, 201, 126, 0.12)',
          border: '1px solid rgba(232, 201, 126, 0.35)',
          color: '#f4d889',
          fontSize: '.84rem',
          fontWeight: 700,
          letterSpacing: '.01em',
        }}>
          분석·심층 풀이·AI 상담은 무료입니다 · 서버·운영비는 선택 후원으로 보조합니다
        </div>

        {SUPPORT_BANK && SUPPORT_ACCOUNT_NO && (
          <div
            role="note"
            style={{
              marginTop: 14,
              alignSelf: 'center',
              maxWidth: 460,
              width: '100%',
              padding: '14px 16px',
              borderRadius: 14,
              background: 'linear-gradient(145deg, rgba(45,38,82,.95), rgba(22,18,44,.98))',
              border: '1px solid rgba(232,201,126,.42)',
              boxShadow: '0 8px 28px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.06)',
              textAlign: 'left',
            }}
          >
            <div style={{ fontWeight: 800, color: '#f5d78a', marginBottom: 8, fontSize: '.88rem' }}>
              운영 후원 안내 (선택)
            </div>
            <p style={{
              margin: '0 0 12px',
              fontSize: '.78rem',
              lineHeight: 1.55,
              color: 'rgba(255,248,236,.92)',
            }}>
              서버비·운영비 등 비용 명목으로 소액 후원을 받습니다. 후원 여부와 관계없이 서비스 이용에는 제한이 없습니다.
            </p>
            <div
              style={{
                background: 'rgba(0,0,0,.28)',
                border: '1px solid rgba(232,201,126,.22)',
                borderRadius: 11,
                padding: '11px 12px',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                <span style={{ fontWeight: 800, color: '#ffecc8', fontSize: '.82rem' }}>{SUPPORT_BANK}</span>
                {SUPPORT_ACCOUNT_HOLDER ? (
                  <span style={{ fontSize: '.74rem', color: 'rgba(255,255,255,.72)' }}>
                    예금주 <strong style={{ color: '#f0e6ff', fontWeight: 700 }}>{SUPPORT_ACCOUNT_HOLDER}</strong>
                  </span>
                ) : null}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    flex: '1 1 160px',
                    fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
                    fontSize: 'clamp(.92rem, 3.5vw, 1.05rem)',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: '#fff',
                    wordBreak: 'break-word',
                    textShadow: '0 1px 12px rgba(232,201,126,.25)',
                  }}
                >
                  {formatAccountForDisplay(SUPPORT_ACCOUNT_NO)}
                </span>
                <button
                  type="button"
                  onClick={() => void copyLandingSupportAccount()}
                  aria-label="계좌번호 복사"
                  style={{
                    flexShrink: 0,
                    borderRadius: 10,
                    border: '1px solid rgba(232,201,126,.45)',
                    background: landingSupportCopyFb === 'ok'
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
                  {landingSupportCopyFb === 'ok' ? '복사 완료' : landingSupportCopyFb === 'err' ? '다시 시도' : '계좌번호 복사'}
                </button>
              </div>
              <p style={{
                margin: '10px 0 0',
                fontSize: '.68rem',
                color: 'rgba(255,230,190,.62)',
                lineHeight: 1.45,
              }}>
                버튼을 누르면 숫자만 클립보드에 복사되어 이체 앱에 붙여넣기 하기 편합니다.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* 기능 */}
      <section style={{ padding: '80px 24px', maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{
          textAlign: 'center', fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
          fontWeight: 900, marginBottom: 12, color: '#e0cfff',
        }}>
          무엇을 알 수 있나요?
        </h2>
        <p style={{ textAlign: 'center', color: '#6b6490', marginBottom: 56, fontSize: '.95rem' }}>
          사주팔자의 모든 것을 한 번에 분석합니다
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 20,
        }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(139,111,198,0.2)',
              borderRadius: 20, padding: 28,
              transition: 'border-color 0.2s',
            }}>
              <div style={{ fontSize: '2.2rem', marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: f.color, marginBottom: 10 }}>
                {f.title}
              </h3>
              <p style={{ fontSize: '.88rem', color: '#8b6fc6', lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 사용 방법 */}
      <section style={{
        padding: '80px 24px',
        background: 'rgba(139,111,198,0.05)',
        borderTop: '1px solid rgba(139,111,198,0.1)',
        borderBottom: '1px solid rgba(139,111,198,0.1)',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{
            fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
            fontWeight: 900, marginBottom: 12, color: '#e0cfff',
          }}>
            3단계로 끝납니다
          </h2>
          <p style={{ color: '#6b6490', marginBottom: 56, fontSize: '.95rem' }}>
            복잡한 가입 없이 바로 시작하세요
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {STEPS.map((s) => (
              <div key={s.num} style={{
                display: 'flex', alignItems: 'flex-start', gap: 24,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(139,111,198,0.2)',
                borderRadius: 16, padding: '24px 28px', textAlign: 'left',
              }}>
                <div style={{
                  fontSize: '1.6rem', fontWeight: 900, color: '#8b6fc6',
                  minWidth: 48, opacity: 0.6,
                }}>
                  {s.num}
                </div>
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#c4a8ff', marginBottom: 6 }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: '.9rem', color: '#6b6490', lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: '100px 24px', textAlign: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,111,198,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ marginBottom: 32, opacity: 1 }}>
          <svg className="cta-twinkle-svg" width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <g className="cta-star-layer">
              <path d="M12 2L13.5 9L21 10.5L13.5 12L12 19L10.5 12L3 10.5L10.5 9L12 2Z" fill="#c4a8ff"/>
            </g>
          </svg>
        </div>
        <h2 style={{
          fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
          fontWeight: 900, marginBottom: 16, color: '#e0cfff',
        }}>
          지금 바로 내 사주를<br/>확인해보세요
        </h2>
        <p style={{ color: '#6b6490', marginBottom: 40, fontSize: '.95rem' }}>
          무료 분석 후 심층 풀이와 AI 상담까지 이어서 이용해 보세요 · 마음에 드셨다면 상단 후원 안내도 참고해 주세요
        </p>
        <Link href="/saju" style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '18px 48px', borderRadius: 16,
          background: '#8b6fc6', color: '#fff',
          fontSize: '1.1rem', fontWeight: 700, textDecoration: 'none',
          boxShadow: '0 0 60px rgba(139,111,198,0.35)',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L13.5 9L21 10.5L13.5 12L12 19L10.5 12L3 10.5L10.5 9L12 2Z" fill="currentColor"/>
          </svg>
          무료로 사주팔자 보기
        </Link>
      </section>

      {/* 푸터 */}
      <footer style={{
        padding: '32px 24px', textAlign: 'center',
        borderTop: '1px solid rgba(139,111,198,0.15)',
        color: '#6b6490', fontSize: '.82rem',
      }}>
        <FooterBrandRow />
        <div style={{ marginBottom: 12 }}>
          <Link href="/privacy" style={{ color: '#8b6fc6', marginRight: 12 }}>개인정보처리방침</Link>
          <Link href="/terms" style={{ color: '#8b6fc6' }}>이용약관</Link>
        </div>
        <div>본 서비스는 전통 동양 철학 기반 참고용 정보입니다.</div>
        <div style={{ marginTop: 12, opacity: 0.6, fontSize: '0.7rem' }}>v{APP_VERSION}</div>
      </footer>
    </div>
  );
}
