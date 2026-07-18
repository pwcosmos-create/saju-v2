/** 1회 구매·연장 단위 (콘솔 등록 상품: AI 심층 상담 10분) */
export const COUNSEL_IAP_MINUTES = 10;

/** 선택 가능한 이용권·연장 옵션 (분) */
export const COUNSEL_IAP_MINUTE_OPTIONS = [10, 20, 30] as const;

export type CounselIapMinuteOption = (typeof COUNSEL_IAP_MINUTE_OPTIONS)[number];

/** 판매가 990원 → 공급가 900원 (VAT 10% 제외, 10분 기준) */
export const COUNSEL_IAP_SUPPLY_PRICE_10MIN = 900;
export const COUNSEL_IAP_SALE_PRICE_10MIN = 990;

export function counselSalePriceForMinutes(minutes: number): number {
  return (minutes / COUNSEL_IAP_MINUTES) * COUNSEL_IAP_SALE_PRICE_10MIN;
}

export function counselSupplyPriceForMinutes(minutes: number): number {
  return (minutes / COUNSEL_IAP_MINUTES) * COUNSEL_IAP_SUPPLY_PRICE_10MIN;
}

export function isCounselMinuteOption(minutes: number): minutes is CounselIapMinuteOption {
  return (COUNSEL_IAP_MINUTE_OPTIONS as readonly number[]).includes(minutes);
}

/** 10분 단위 구매 횟수 (20분=2회, 30분=3회) */
export function counselPurchaseUnitsForMinutes(minutes: number): number {
  return minutes / COUNSEL_IAP_MINUTES;
}

const SKU_ENV: Record<number, string | undefined> = {
  10: process.env.NEXT_PUBLIC_TOSS_IAP_SKU_COUNSEL_10,
  20: process.env.NEXT_PUBLIC_TOSS_IAP_SKU_COUNSEL_20,
  30: process.env.NEXT_PUBLIC_TOSS_IAP_SKU_COUNSEL_30,
};

export function counselSkuForMinutes(minutes: number): string | null {
  const sku = SKU_ENV[minutes]?.trim();
  return sku || null;
}

export function counselMinutesForSku(sku: string): number {
  for (const [mins, envSku] of Object.entries(SKU_ENV)) {
    if (envSku?.trim() === sku) return Number(mins);
  }
  /** 판매 상품은 10분 이용권만 — SKU 부분문자열(예: v3.0, …30…)로 20·30분 추론하지 않음 */
  return COUNSEL_IAP_MINUTES;
}

/** IAP 상품 목록에서 분 단위 상품 매칭 (env SKU 없을 때 런타임 폴백) */
export type CounselIapProductLike = {
  sku: string;
  displayName: string;
  description?: string | null;
  displayAmount?: string;
};

function productText(p: CounselIapProductLike): string {
  return `${p.displayName} ${p.description ?? ''} ${p.sku}`;
}

export function matchCounselProductForMinutes(
  products: CounselIapProductLike[],
  minutes: number,
): CounselIapProductLike | undefined {
  if (!products.length) return undefined;

  const envSku = counselSkuForMinutes(minutes);
  if (envSku) {
    const byEnv = products.find((p) => p.sku === envSku);
    if (byEnv) return byEnv;
  }

  const minLabel = `${minutes}분`;
  const byMinute = products.find((p) => productText(p).includes(minLabel));
  if (byMinute) return byMinute;

  if (minutes === COUNSEL_IAP_MINUTES) {
    const counsel = products.find((p) => /상담|counsel/i.test(productText(p)));
    if (counsel) return counsel;
    if (products.length === 1) return products[0];
  }

  return undefined;
}
