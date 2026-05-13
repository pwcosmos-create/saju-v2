/**
 * UI 브랜드 토큰 — 랜딩·사주 헤더 등 클라이언트 컴포넌트에서 공통 사용.
 * `globals.css` 의 :root 변수와 맞출 때는 이 값을 기준으로 양쪽을 함께 수정하세요.
 */
export const BRAND = {
  gold: '#e8c97e',
  purple: '#8b6fc6',
  bg: '#0d0b1e',
  navGlass: 'rgba(13, 11, 30, 0.85)',
  navGlassSaju: 'rgba(13, 11, 30, 0.8)',
  borderNav: 'rgba(139, 111, 198, 0.2)',

  /** 스파클 SVG +「AI사주」워드마크 — 동일 라벤더 팔레트 */
  wordmarkGradient: 'linear-gradient(135deg, #f2ecff 0%, #dcccff 45%, #a78bff 100%)',
  sparkleMain: '#ebe4ff',
  sparkleMid: '#c4b5ff',
  sparkleDeep: '#9b82eb',
} as const;
