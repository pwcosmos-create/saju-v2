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

const SKU_ENV: Record<number, string | undefined> = {
  10: process.env.NEXT_PUBLIC_TOSS_IAP_SKU_COUNSEL_10,
  20: process.env.NEXT_PUBLIC_TOSS_IAP_SKU_COUNSEL_20,
  30: process.env.NEXT_PUBLIC_TOSS_IAP_SKU_COUNSEL_30,
};

export function counselSkuForMinutes(minutes: number): string | null {
  const sku = SKU_ENV[minutes]?.trim();
  return sku || null;
}

export function counselMinutesForSku(sku: string): number | null {
  for (const [mins, envSku] of Object.entries(SKU_ENV)) {
    if (envSku?.trim() === sku) return Number(mins);
  }
  if (sku.includes('10') || sku.endsWith('_10m')) return COUNSEL_IAP_MINUTES;
  if (sku.includes('20') || sku.endsWith('_20m')) return 20;
  if (sku.includes('30') || sku.endsWith('_30m')) return 30;
  /** 콘솔 SKU 미매핑 시에도 10분 이용권 1회로 처리 */
  return COUNSEL_IAP_MINUTES;
}
