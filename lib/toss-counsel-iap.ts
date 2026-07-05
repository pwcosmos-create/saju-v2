import { IAP, Storage, type IapProductListItem } from '@apps-in-toss/web-framework';
import {
  COUNSEL_IAP_MINUTES,
  counselMinutesForSku,
  counselSkuForMinutes,
  matchCounselProductForMinutes,
} from '../core/counsel-iap';

const GRANTED_ORDERS_KEY = 'saju_counsel_iap_granted_orders_v1';

const SKU_RESOLVE_FAIL =
  '인앱 상품을 불러오지 못했습니다. 앱인토스 콘솔에 상담 이용권이 등록·승인됐는지 확인한 뒤 다시 시도해 주세요.';

async function readGrantedOrders(): Promise<Set<string>> {
  try {
    const raw = await Storage.getItem(GRANTED_ORDERS_KEY);
    if (!raw) return new Set();
    const list = JSON.parse(raw) as string[];
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

async function markOrderGranted(orderId: string): Promise<void> {
  const granted = await readGrantedOrders();
  granted.add(orderId);
  await Storage.setItem(GRANTED_ORDERS_KEY, JSON.stringify([...granted]));
}

async function grantCounselOrder(orderId: string, sku: string): Promise<number | null> {
  const granted = await readGrantedOrders();
  if (granted.has(orderId)) {
    return counselMinutesForSku(sku);
  }
  const minutes = counselMinutesForSku(sku);
  if (!minutes) return null;
  await markOrderGranted(orderId);
  return minutes;
}

export async function fetchCounselIapProducts(): Promise<IapProductListItem[]> {
  const res = await IAP.getProductItemList();
  return res?.products?.filter((p) => p.type === 'CONSUMABLE') ?? [];
}

/** env SKU → 콘솔 IAP 목록 순으로 SKU 해석 */
export async function resolveCounselSku(
  minutes: number,
  hints?: { skuOverride?: string | null; cachedProducts?: IapProductListItem[] },
): Promise<string | null> {
  const override = hints?.skuOverride?.trim();
  if (override) return override;

  const envSku = counselSkuForMinutes(minutes);
  if (envSku) return envSku;

  let products = hints?.cachedProducts;
  if (!products?.length) {
    try {
      products = await fetchCounselIapProducts();
    } catch {
      products = [];
    }
  }

  const matched = matchCounselProductForMinutes(products, minutes);
  if (matched?.sku) return matched.sku;

  if (minutes !== COUNSEL_IAP_MINUTES) {
    return resolveCounselSku(COUNSEL_IAP_MINUTES, { ...hints, cachedProducts: products });
  }

  return null;
}

export function purchaseCounselMinutes(
  minutes: number,
  onSuccess: (purchasedMinutes: number) => void,
  onFail?: (message: string) => void,
  skuOverride?: string | null,
): () => void {
  const sku = skuOverride?.trim() || counselSkuForMinutes(minutes);
  if (!sku) {
    onFail?.(SKU_RESOLVE_FAIL);
    return () => {};
  }

  return IAP.createOneTimePurchaseOrder({
    options: {
      sku,
      processProductGrant: async ({ orderId }) => {
        const granted = await grantCounselOrder(orderId, sku);
        return granted != null;
      },
    },
    onEvent: async (event) => {
      if (event.type !== 'success') return;
      const mins = await grantCounselOrder(event.data.orderId, sku);
      if (mins) onSuccess(mins);
      else onFail?.('상품 지급에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    },
    onError: (error) => {
      const code = (error as { code?: string })?.code;
      if (code === 'USER_CANCELED') return;
      console.error('IAP error:', error);
      onFail?.('결제에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    },
  });
}

/**
 * 20·30분 등 — 전용 SKU 없으면 10분 상품을 연속 결제.
 * 결제 전 IAP 목록에서 SKU를 자동 해석합니다.
 */
export async function startCounselMinuteBundlePurchase(
  minutes: number,
  callbacks: {
    onProgress?: (step: number, total: number) => void;
    onSuccess: (purchasedMinutes: number) => void;
    onFail?: (message: string) => void;
  },
  hints?: { skuOverride?: string | null; cachedProducts?: IapProductListItem[] },
): Promise<() => void> {
  const units = minutes / COUNSEL_IAP_MINUTES;
  if (!Number.isInteger(units) || units < 1) {
    callbacks.onFail?.('잘못된 시간 옵션입니다.');
    return () => {};
  }

  let products = hints?.cachedProducts;
  if (!products?.length) {
    try {
      products = await fetchCounselIapProducts();
    } catch {
      products = [];
    }
  }

  const dedicatedSku = await resolveCounselSku(minutes, {
    skuOverride: hints?.skuOverride,
    cachedProducts: products,
  });

  if (units === 1 && dedicatedSku) {
    return purchaseCounselMinutes(
      minutes,
      callbacks.onSuccess,
      callbacks.onFail,
      dedicatedSku,
    );
  }

  const unitSku = await resolveCounselSku(COUNSEL_IAP_MINUTES, {
    cachedProducts: products,
  });
  if (!unitSku) {
    callbacks.onFail?.(SKU_RESOLVE_FAIL);
    return () => {};
  }

  let cancelled = false;
  let currentCleanup: (() => void) | null = null;
  let step = 0;

  const finishPartial = () => {
    if (step > 0) callbacks.onSuccess(step * COUNSEL_IAP_MINUTES);
  };

  const runNext = () => {
    if (cancelled) return;
    step += 1;
    callbacks.onProgress?.(step, units);
    currentCleanup = purchaseCounselMinutes(
      COUNSEL_IAP_MINUTES,
      () => {
        if (cancelled) return;
        if (step >= units) callbacks.onSuccess(minutes);
        else runNext();
      },
      (msg) => {
        if (cancelled) return;
        finishPartial();
        callbacks.onFail?.(msg);
      },
      unitSku,
    );
  };

  runNext();
  return () => {
    cancelled = true;
    currentCleanup?.();
  };
}

/** @deprecated use startCounselMinuteBundlePurchase */
export function purchaseCounselMinuteBundle(
  minutes: number,
  callbacks: {
    onProgress?: (step: number, total: number) => void;
    onSuccess: (purchasedMinutes: number) => void;
    onFail?: (message: string) => void;
  },
  skuOverride?: string | null,
): () => void {
  let cleanup: (() => void) | null = null;
  void startCounselMinuteBundlePurchase(minutes, callbacks, { skuOverride }).then((c) => {
    cleanup = c;
  });
  return () => cleanup?.();
}

/** 결제는 됐지만 지급이 안 된 주문 복원 */
export async function restorePendingCounselPurchases(
  onSuccess: (totalMinutes: number) => void,
): Promise<void> {
  const pending = await IAP.getPendingOrders();
  if (!pending?.orders?.length) return;

  let total = 0;
  for (const order of pending.orders) {
    const mins = await grantCounselOrder(order.orderId, order.sku);
    if (mins) {
      total += mins;
      try {
        await IAP.completeProductGrant({ params: { orderId: order.orderId } });
      } catch (e) {
        console.warn('completeProductGrant failed:', e);
      }
    }
  }
  if (total > 0) onSuccess(total);
}
