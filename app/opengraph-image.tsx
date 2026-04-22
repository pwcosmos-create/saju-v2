import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = '사주팔자 무료 분석 — AI 심층 풀이';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  // 한글 폰트 로드 (Google Fonts CSS → woff2 URL 추출)
  let fonts: { name: string; data: ArrayBuffer; style: 'normal'; weight: 700 }[] = [];
  try {
    const css = await fetch(
      'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700,900',
      { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }
    ).then(r => r.text());

    const urls = [...css.matchAll(/src: url\((.+?)\) format\('woff2'\)/g)].map(m => m[1]);
    if (urls.length > 0) {
      const data = await fetch(urls[0]).then(r => r.arrayBuffer());
      fonts = [{ name: 'NotoSansKR', data, style: 'normal', weight: 700 }];
    }
  } catch { /* 폰트 로드 실패 시 시스템 폰트로 폴백 */ }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0d0b1e',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: fonts.length ? 'NotoSansKR' : 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 배경 글로우 */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(ellipse 60% 60% at 30% 50%, rgba(139,111,198,0.35) 0%, transparent 70%), radial-gradient(ellipse 60% 60% at 75% 50%, rgba(74,158,255,0.2) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* 테두리 장식선 */}
        <div style={{
          position: 'absolute', top: 32, left: 32, right: 32, bottom: 32,
          border: '1px solid rgba(232,196,106,0.2)',
          borderRadius: 24,
          display: 'flex',
        }} />

        {/* 태그 */}
        <div style={{
          display: 'flex',
          background: 'rgba(139,111,198,0.25)',
          border: '1px solid rgba(139,111,198,0.5)',
          borderRadius: 100,
          padding: '8px 28px',
          marginBottom: 28,
        }}>
          <span style={{ color: '#c4a8ff', fontSize: 26, fontWeight: 700, letterSpacing: 1 }}>
            ✦ 무료 사주팔자 정밀 분석
          </span>
        </div>

        {/* ☯ 심볼 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 100,
          height: 100,
          background: 'linear-gradient(135deg, #8b6fc6, #4a9eff)',
          borderRadius: 22,
          marginBottom: 28,
          fontSize: 60,
        }}>
          ☯
        </div>

        {/* 메인 타이틀 */}
        <div style={{
          fontSize: 74,
          fontWeight: 900,
          color: '#e8c46a',
          letterSpacing: -2,
          marginBottom: 18,
          textAlign: 'center',
          display: 'flex',
        }}>
          사주팔자 무료 분석
        </div>

        {/* 서브타이틀 */}
        <div style={{
          fontSize: 32,
          color: 'rgba(240,238,255,0.7)',
          marginBottom: 40,
          textAlign: 'center',
          display: 'flex',
        }}>
          AI 심층 풀이 · 60갑자 일주 · 오행 · 대운 · 신살
        </div>

        {/* URL 칩 */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 100,
          padding: '10px 32px',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 24 }}>
            saju.coupax.co.kr
          </span>
        </div>
      </div>
    ),
    fonts.length > 0 ? { ...size, fonts } : { ...size },
  );
}
