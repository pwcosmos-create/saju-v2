/** 토스 콘솔 보상형(전면) 광고 그룹 ID */
export const SAJU_REWARDED_AD_GROUP_ID = 'ait.v2.live.6e873e2eea174a0d';

const AD_WAIT_MS = 12_000;

let adLoaded = false;
let loadCleanup: (() => void) | null = null;

type AdOutcome = 'shown' | 'skipped' | 'failed';

function getAdSdk() {
  return import('@apps-in-toss/web-framework');
}

/** 분석 화면 진입 시 광고를 미리 로드해 버튼 탭 시 바로 노출 */
export function preloadSajuRewardedAd(): void {
  if (typeof window === 'undefined') return;
  void getAdSdk()
    .then(({ loadFullScreenAd }) => {
      if (!loadFullScreenAd.isSupported?.() || adLoaded) return;
      loadCleanup?.();
      loadCleanup = loadFullScreenAd({
        options: { adGroupId: SAJU_REWARDED_AD_GROUP_ID },
        onEvent: (event) => {
          if (event.type === 'loaded') adLoaded = true;
        },
        onError: () => {
          adLoaded = false;
        },
      });
    })
    .catch(() => {});
}

/** 보상형 전면 광고 노출. 닫힘·보상·실패 시 resolve */
export function showSajuRewardedAd(): Promise<AdOutcome> {
  if (typeof window === 'undefined') return Promise.resolve('skipped');

  return getAdSdk()
    .then(({ loadFullScreenAd, showFullScreenAd }) =>
      new Promise<AdOutcome>((resolve) => {
        let settled = false;
        const finish = (outcome: AdOutcome) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          adLoaded = false;
          resolve(outcome);
        };

        const timer = setTimeout(() => finish('failed'), AD_WAIT_MS);

        if (!showFullScreenAd.isSupported?.()) {
          finish('skipped');
          return;
        }

        const present = () => {
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

        loadCleanup?.();
        loadCleanup = loadFullScreenAd({
          options: { adGroupId: SAJU_REWARDED_AD_GROUP_ID },
          onEvent: (event) => {
            if (event.type === 'loaded') {
              adLoaded = true;
              present();
            }
          },
          onError: () => finish('failed'),
        });
      }),
    )
    .catch(() => 'skipped' as AdOutcome);
}
