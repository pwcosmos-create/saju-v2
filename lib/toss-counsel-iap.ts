import { IAP, Storage, type IapProductListItem } from '@apps-in-toss/web-framework';
import { counselMinutesForSku, counselSkuForMinutes } from '../core/counsel-iap';

const GRANTED_ORDERS_KEY = 'saju_counsel_iap_granted_orders_v1';

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

export function purchaseCounselMinutes(
  minutes: number,
  onSuccess: (purchasedMinutes: number) => void,
  onFail?: (message: string) => void,
  skuOverride?: string | null,
): () => void {
  const sku = skuOverride?.trim() || counselSkuForMinutes(minutes);
  if (!sku) {
    onFail?.('인앱 상품 SKU가 설정되지 않았습니다. 콘솔 등록 후 NEXT_PUBLIC_TOSS_IAP_SKU_COUNSEL_* 환경변수를 설정해 주세요.');
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
