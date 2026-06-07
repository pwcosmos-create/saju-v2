/** 토스 콘솔 보상형(전면) 광고 그룹 ID */
export const SAJU_REWARDED_AD_GROUP_ID = 'ait.v2.live.6e873e2eea174a0d';

const AD_WAIT_MS = 12_000;

let adLoaded = false;
let loadStarted = false;
let loadCleanup: (() => void) | null = null;
const loadWaiters: Array<() => void> = [];

type AdOutcome = 'shown' | 'skipped' | 'failed';

function getAdSdk() {
  return import('@apps-in-toss/web-framework');
}

function flushLoadWaiters() {
  while (loadWaiters.length) loadWaiters.shift()?.();
}

function resetLoadState() {
  adLoaded = false;
  loadStarted = false;
}

function startAdLoad(onLoaded?: () => void): void {
  if (typeof window === 'undefined') return;
  if (onLoaded) loadWaiters.push(onLoaded);
  if (adLoaded) {
    flushLoadWaiters();
    return;
  }
  if (loadStarted) return;

  void getAdSdk()
    .then(({ loadFullScreenAd }) => {
      if (!loadFullScreenAd.isSupported?.()) {
        flushLoadWaiters();
        return;
      }
      if (loadStarted) return;
      loadStarted = true;
      loadCleanup?.();
      loadCleanup = loadFullScreenAd({
        options: { adGroupId: SAJU_REWARDED_AD_GROUP_ID },
        onEvent: (event) => {
          if (event.type === 'loaded') {
            adLoaded = true;
            flushLoadWaiters();
          }
        },
        onError: () => {
          resetLoadState();
          flushLoadWaiters();
        },
      });
    })
    .catch(() => flushLoadWaiters());
}

/** 앱·분석 화면 진입 시 광고 preload — 버튼 탭 시 확인창 없이 바로 노출 */
export function preloadSajuRewardedAd(): void {
  startAdLoad();
}

/** 보상형 전면 광고 노출. 닫힘·보상·실패 시 resolve */
export function showSajuRewardedAd(): Promise<AdOutcome> {
  if (typeof window === 'undefined') return Promise.resolve('skipped');

  return getAdSdk()
    .then(({ loadFullScreenAd, showFullScreenAd }) =>
      new Promise<AdOutcome>((resolve) => {
        let settled = false;
        let presented = false;

        const finish = (outcome: AdOutcome) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resetLoadState();
          resolve(outcome);
          preloadSajuRewardedAd();
        };

        const timer = setTimeout(() => finish('failed'), AD_WAIT_MS);

        if (!showFullScreenAd.isSupported?.()) {
          finish('skipped');
          return;
        }

        const present = () => {
          if (presented || settled) return;
          presented = true;
          showFullScreenAd({
            options: { adGroupId: SAJU_REWARDED_AD_GROUP_ID },
            onEvent: (event) => {
              if (
                event.type === 'dismissed' ||
                event.type === 'userEarnedReward' ||
                event.type === 'failedToShow'
              ) {
                finish(event.type === 'failedToShow' ? 'failed' : 'shown');
              }
            },
            onError: () => finish('failed'),
          });
        };

        if (adLoaded) {
          present();
          return;
        }

        if (!loadFullScreenAd.isSupported?.()) {
          finish('skipped');
          return;
        }

        startAdLoad(() => {
          if (adLoaded) present();
        });
      }),
    )
    .catch(() => 'skipped' as AdOutcome);
}
