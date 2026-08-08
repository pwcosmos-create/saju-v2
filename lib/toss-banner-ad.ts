/**
 * 토스 인라인 배너 광고 (TossAds)
 * 콘솔: 배너 광고-1 · ait.v2.live.e3df07897a024f60
 *
 * ※ GoogleAdMob.load/show 는 전면·리워드 전용.
 *    배너는 TossAds.initialize → attachBanner 를 써야 함.
 */
export const SAJU_BANNER_AD_GROUP_ID = 'ait.v2.live.e3df07897a024f60';

/** 문서 권장 고정형 배너 높이 (safe-area 제외) */
export const SAJU_BANNER_HEIGHT_PX = 96;

export type BannerUiState = 'idle' | 'loading' | 'ready' | 'empty' | 'unsupported';

type BannerHandle = { destroy: () => void };

let _initPromise: Promise<boolean> | null = null;
let _handle: BannerHandle | null = null;
let _uiState: BannerUiState = 'idle';
const _listeners: Array<(s: BannerUiState) => void> = [];

function notify(state: BannerUiState) {
  _uiState = state;
  _listeners.forEach((fn) => fn(_uiState));
}

function clearHandle() {
  _handle?.destroy();
  _handle = null;
}

function getSdk() {
  return import('@apps-in-toss/web-framework');
}

function ensureInitialized(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (_initPromise) return _initPromise;

  const run = getSdk()
    .then(({ TossAds }) => {
      if (!TossAds?.initialize?.isSupported?.()) return false;

      return new Promise<boolean>((resolve) => {
        let settled = false;
        const done = (ok: boolean) => {
          if (settled) return;
          settled = true;
          resolve(ok);
        };
        TossAds.initialize({
          callbacks: {
            onInitialized: () => done(true),
            onInitializationFailed: () => done(false),
          },
        });
        window.setTimeout(() => done(false), 12_000);
      });
    })
    .catch(() => false)
    .then((ok) => {
      // 실패는 캐시하지 않아 다음 진입 시 재시도
      if (!ok) _initPromise = null;
      return ok;
    });

  _initPromise = run;
  return run;
}

/**
 * DOM 슬롯에 배너 부착.
 * @returns cleanup 함수
 */
export function attachSajuBanner(
  target: string | HTMLElement,
  onState?: (s: BannerUiState) => void,
): () => void {
  let cancelled = false;
  notify('loading');
  onState?.('loading');

  if (SAJU_BANNER_AD_GROUP_ID.startsWith('PLACEHOLDER')) {
    notify('empty');
    onState?.('empty');
    return () => {};
  }

  void (async () => {
    const ok = await ensureInitialized();
    if (cancelled) return;
    if (!ok) {
      notify('unsupported');
      onState?.('unsupported');
      return;
    }

    try {
      const { TossAds } = await getSdk();
      if (cancelled) return;
      if (!TossAds?.attachBanner?.isSupported?.()) {
        notify('unsupported');
        onState?.('unsupported');
        return;
      }

      clearHandle();
      _handle = TossAds.attachBanner(SAJU_BANNER_AD_GROUP_ID, target, {
        theme: 'dark',
        tone: 'blackAndWhite',
        variant: 'expanded',
        callbacks: {
          onAdRendered: () => {
            if (cancelled) return;
            notify('ready');
            onState?.('ready');
          },
          onNoFill: () => {
            if (cancelled) return;
            clearHandle();
            notify('empty');
            onState?.('empty');
          },
          onAdFailedToRender: () => {
            if (cancelled) return;
            clearHandle();
            notify('empty');
            onState?.('empty');
          },
        },
      });
    } catch {
      if (cancelled) return;
      clearHandle();
      notify('empty');
      onState?.('empty');
    }
  })();

  return () => {
    cancelled = true;
    clearHandle();
    notify('idle');
  };
}

export function onBannerState(fn: (s: BannerUiState) => void): () => void {
  _listeners.push(fn);
  fn(_uiState);
  return () => {
    const i = _listeners.indexOf(fn);
    if (i !== -1) _listeners.splice(i, 1);
  };
}

export function destroyBannerAd(): void {
  clearHandle();
  notify('idle');
}
