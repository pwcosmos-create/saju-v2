import { defineConfig } from '@apps-in-toss/web-framework/config';

/**
 * 앱인토스 콘솔 「앱 만들기」와 아래 값을 동일하게 맞추세요.
 *
 * ┌─ 콘솔에 입력 ─────────────────────────┐
 * │ 앱 이름  : AI사주                    │
 * │ appName  : saju-coupax              │
 * │ 앱 유형  : 비게임  (게임 아님)      │
 * └────────────────────────────────────┘
 *
 * @see https://developers-apps-in-toss.toss.im/tutorials/webview.html
 */
export default defineConfig({
  appName: 'saju-coupax',
  brand: {
    displayName: 'AI사주',
    primaryColor: '#0d0b1e',
    icon: 'https://saju.coupax.co.kr/icon',
  },
  web: {
    host: 'localhost',
    port: 3000,
    commands: {
      dev: 'next dev -p 3000',
      build: 'npm run build:toss',
    },
  },
  /** Next 정적 export 결과: scripts/build-toss.mjs 가 out/web/index.html 구조로 맞춤 */
  outdir: 'out',
  permissions: [
    { name: 'clipboard', access: 'write' },
    { name: 'microphone', access: 'access' },
  ],
  webViewProps: {
    type: 'partner',
  },
  navigationBar: {
    withBackButton: true,
    withHomeButton: false,
  },
});
