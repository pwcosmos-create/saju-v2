/** 토스 앱 Android 패키지 — Apps in Toss SDK 기준 */
export const TOSS_ANDROID_PACKAGE = 'viva.republica.toss';

export const TOSS_MINI_APP_URL = 'intoss-private://saju-coupax';

export const TOSS_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=viva.republica.toss';

/** 인스타·틱톡·카톡 등 인앱 브라우저 → 토스 미니앱 */
export function redirectToTossMiniApp(): void {
  const ua = navigator.userAgent.toLowerCase();
  const appPath = TOSS_MINI_APP_URL.replace(/^[a-z]+:\/\//, '');

  if (ua.includes('android')) {
    window.location.href =
      `intent://${appPath}#Intent;scheme=intoss-private;package=${TOSS_ANDROID_PACKAGE};end`;
    return;
  }

  if (ua.includes('kakaotalk') && !ua.includes('android')) {
    window.location.href =
      `kakaotalk://web/openExternalApp?url=${encodeURIComponent(window.location.href)}`;
    return;
  }

  window.location.href = TOSS_MINI_APP_URL;
}
