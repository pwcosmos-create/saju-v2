/** 토스 정적 export: assetPrefix ./, HTML base 태그로 번들 루트 지정 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');
export const IS_TOSS_MINI = process.env.NEXT_PUBLIC_APPS_IN_TOSS === '1';

export function appPath(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return BASE_PATH ? `${BASE_PATH}${p}` : p;
}

/** 토스: base 기준 경로 (index.html, saju/index.html) */
export function appHref(path: string): string {
  const segment = path.replace(/^\//, '').replace(/\/$/, '');
  if (IS_TOSS_MINI) {
    if (!segment || segment === '.') return 'index.html';
    return `${segment}/index.html`;
  }
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  return BASE_PATH ? `${BASE_PATH}${withSlash}` : withSlash;
}

export function goToPath(path: string): void {
  if (typeof window === 'undefined') return;
  window.location.assign(appHref(path));
}
