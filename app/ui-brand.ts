/**
 * UI 브랜드 토큰 — 랜딩·사주 헤더 등 클라이언트 컴포넌트에서 공통 사용.
 * `globals.css` 의 :root 변수와 맞출 때는 이 값을 기준으로 양쪽을 함께 수정하세요.
 */
export const BRAND = {
  // New Design System V1 Tokens
  bg: '#0A1931',
  cta: '#B8860B',
  highlight: '#ADD8E6',
  text: '#FFFFFF',
  
  // Legacy Tokens (mapped to prevent breakage)
  gold: '#B8860B',
  purple: '#0A1931',
  
  navGlass: 'rgba(10, 25, 49, 0.85)',
  navGlassSaju: 'rgba(10, 25, 49, 0.8)',
  borderNav: 'rgba(173, 216, 230, 0.2)',

  /** 스파클 SVG +「AI사주」워드마크 — 새로운 테마에 맞춤 */
  wordmarkGradient: 'linear-gradient(135deg, #ffffff 0%, #add8e6 45%, #b8860b 100%)',
  sparkleMain: '#ffffff',
  sparkleMid: '#add8e6',
  sparkleDeep: '#b8860b',
} as const;
