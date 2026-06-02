import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name   = searchParams.get('name')  || '나의';
  const iljoo  = searchParams.get('iljoo') || '';
  const year   = searchParams.get('year')  || new Date().getFullYear().toString();
  const oh     = searchParams.get('oh')    || '';   // 예: "목2화3토1금1수1"
  const gender = searchParams.get('gender') || '';

  const subtitle = [iljoo ? iljoo + '일주' : '', year + '년 운세', gender]
    .filter(Boolean).join('  ·  ');

  const elemInfo = oh
    ? oh
    : '오행 · 신살 · 대운 · AI 풀이';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: '#0d0b1e', position: 'relative',
        }}
      >
        {/* 배경 글로우 */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(ellipse at 25% 25%, rgba(100,60,180,0.45) 0%, transparent 55%), radial-gradient(ellipse at 75% 75%, rgba(40,80,200,0.35) 0%, transparent 55%)',
        }} />

        {/* 카드 컨테이너 */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '0 80px', gap: '0', zIndex: 1,
        }}>
          {/* 배지 */}
          <div style={{
            fontSize: 22, color: '#c4a8ff', fontWeight: 700,
            background: 'rgba(139,111,198,0.25)', padding: '8px 24px',
            borderRadius: 100, marginBottom: 28, letterSpacing: '0.05em',
          }}>
            ✦ 무료 사주팔자 정밀 분석
          </div>

          {/* 메인 타이틀 */}
          <div style={{
            fontSize: 80, fontWeight: 900, color: '#ffffff',
            letterSpacing: '-3px', lineHeight: 1.1, textAlign: 'center',
            marginBottom: 16,
          }}>
            {name.length > 4 ? name.slice(0,4) : name} 사주팔자
          </div>

          {/* 서브타이틀 */}
          {subtitle && (
            <div style={{
              fontSize: 32, color: '#e8c46a', fontWeight: 700,
              marginBottom: 36, letterSpacing: '-0.5px',
            }}>
              {subtitle}
            </div>
          )}

          {/* 구분선 */}
          <div style={{
            width: 400, height: 1, background: 'rgba(255,255,255,0.2)', marginBottom: 32,
          }} />

          {/* 기능 설명 */}
          <div style={{
            fontSize: 26, color: '#c0bedd', fontWeight: 500,
            textAlign: 'center', lineHeight: 1.6,
          }}>
            {elemInfo}
          </div>

          {/* URL */}
          <div style={{
            fontSize: 22, color: '#7a6fa0', marginTop: 40,
            letterSpacing: '0.05em',
          }}>
            saju.coupax.co.kr
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
