import type { NextConfig } from "next";

const isTossBuild = process.env.TOSS_BUILD === '1';

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
] as const;

const nextConfig: NextConfig = {
  env: {
    /** 클라이언트 번들에서 토스 WebView 미니앱 여부 판별 (TOSS_BUILD=1 빌드 시만 '1') */
    NEXT_PUBLIC_APPS_IN_TOSS: isTossBuild ? '1' : '',
    NEXT_PUBLIC_BASE_PATH: '',
    NEXT_PUBLIC_API_BASE:
      process.env.NEXT_PUBLIC_API_BASE?.trim()
      || (isTossBuild ? 'https://saju.coupax.co.kr' : ''),
  },
  ...(isTossBuild ? {
    output: 'export',
    /** 토스 .ait 번들 루트 = out/web — /web 접두사 없이 상대 경로로 로드 */
    assetPrefix: './',
    trailingSlash: true,
  } : {
    async headers() {
      return [
        /** 토스 WebView hidden iframe — cross-origin framing 허용 */
        {
          source: '/api/:path(chat-bridge|fortune-bridge|tts-bridge)',
          headers: [
            ...securityHeaders,
            { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
          ],
        },
        {
          source: '/toss-bridge.js',
          headers: [...securityHeaders],
        },
        {
          source: '/((?!api/chat-bridge|api/fortune-bridge|api/tts-bridge).*)',
          headers: [
            ...securityHeaders,
            { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          ],
        },
      ];
    },
  }),
};

export default nextConfig;
