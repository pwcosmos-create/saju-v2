const DEFAULT_API_BASE = 'https://saju.coupax.co.kr';

/** 토스 정적 빌드·WebView에서 API 호스트 (NEXT_PUBLIC_API_BASE 우선) */
export function getApiBase(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_API_BASE ?? '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (process.env.NEXT_PUBLIC_APPS_IN_TOSS === '1') return DEFAULT_API_BASE;
  return '';
}
