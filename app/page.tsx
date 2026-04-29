import Link from 'next/link';

const FEATURES = [
  {
    icon: '☯',
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
    icon: '◎',
    title: '오행·신살·대운',
    desc: '오행 분포, 천을귀인 등 신살, 10년 대운 흐름까지 한눈에 분석합니다.',
    color: '#5dce70',
  },
  {
    icon: '📅',
    title: '월별 운세',
    desc: '2026년 월별 운세와 연간 운세 흐름을 탭별로 상세하게 확인하세요.',
    color: '#90b8f0',
  },
];

const STEPS = [
  { num: '01', title: '생년월일 입력', desc: '이름, 성별, 생년월일, 태어난 시간을 입력하세요.' },
  { num: '02', title: '사주 자동 계산', desc: '60갑자 사주팔자와 오행·신살·대운이 즉시 계산됩니다.' },
  { num: '03', title: 'AI 풀이 확인', desc: 'AI가 실시간으로 나만의 사주를 깊이 있게 풀이해드립니다.' },
];

export default function LandingPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0b1e',
      color: '#e0cfff',
      fontFamily: "'Apple SD Gothic Neo','Noto Sans KR',sans-serif",
      overflowX: 'hidden',
    }}>

      {/* 네비게이션 */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 60,
        background: 'rgba(13,11,30,0.85)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(139,111,198,0.2)',
      }}>
        <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#c4a8ff', letterSpacing: -1 }}>
          ✦ AI사주
        </span>
        <Link href="/saju" style={{
          padding: '8px 20px', borderRadius: 100,
          background: '#8b6fc6', color: '#fff',
          fontSize: '.88rem', fontWeight: 700, textDecoration: 'none',
        }}>
          무료로 보기
        </Link>
      </nav>

      {/* Hero */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '100px 24px 60px',
        position: 'relative',
      }}>
        {/* 배경 글로우 */}
        <div style={{
          position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,111,198,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          display: 'inline-block', marginBottom: 28,
          padding: '6px 20px', borderRadius: 100,
          background: 'rgba(139,111,198,0.15)',
          border: '1px solid rgba(139,111,198,0.4)',
          fontSize: '.82rem', fontWeight: 700, color: '#c4a8ff',
        }}>
          ✦ 완전 무료 · 가입 불필요
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
          AI가 사주팔자를 실시간으로 심층 풀이해드립니다
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 64 }}>
          <Link href="/saju" style={{
            padding: '16px 40px', borderRadius: 16,
            background: '#8b6fc6', color: '#fff',
            fontSize: '1.05rem', fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 0 40px rgba(139,111,198,0.4)',
          }}>
            ✦ 사주팔자 무료 분석하기
          </Link>
        </div>

        {/* 음양 심볼 */}
        <div style={{ fontSize: '5rem', opacity: 0.15, userSelect: 'none' }}>☯</div>

        {/* 통계 */}
        <div style={{
          display: 'flex', gap: 48, marginTop: 48,
          flexWrap: 'wrap', justifyContent: 'center',
        }}>
          {[
            { num: '무료', label: '완전 무료' },
            { num: '7가지', label: '분석 탭' },
            { num: 'AI', label: '실시간 풀이' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#c4a8ff' }}>{s.num}</div>
              <div style={{ fontSize: '.82rem', color: '#6b6490', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
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
        <div style={{ fontSize: '3rem', marginBottom: 24, opacity: 0.6 }}>☯</div>
        <h2 style={{
          fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
          fontWeight: 900, marginBottom: 16, color: '#e0cfff',
        }}>
          지금 바로 내 사주를<br/>확인해보세요
        </h2>
        <p style={{ color: '#6b6490', marginBottom: 40, fontSize: '.95rem' }}>
          생년월일만 있으면 됩니다 · 완전 무료
        </p>
        <Link href="/saju" style={{
          padding: '18px 48px', borderRadius: 16,
          background: '#8b6fc6', color: '#fff',
          fontSize: '1.1rem', fontWeight: 700, textDecoration: 'none',
          boxShadow: '0 0 60px rgba(139,111,198,0.35)',
          display: 'inline-block',
        }}>
          ✦ 무료로 사주팔자 보기
        </Link>
      </section>

      {/* 푸터 */}
      <footer style={{
        padding: '32px 24px', textAlign: 'center',
        borderTop: '1px solid rgba(139,111,198,0.15)',
        color: '#6b6490', fontSize: '.82rem',
      }}>
        <div style={{ marginBottom: 8 }}>✦ AI사주 — 사주팔자 무료 분석</div>
        <div>본 서비스는 전통 동양 철학 기반 참고용 정보입니다.</div>
      </footer>
    </div>
  );
}
