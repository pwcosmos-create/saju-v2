'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { IapProductListItem } from '@apps-in-toss/web-framework';
import { COUNSEL_LEAVE_SESSION_NOTICE } from '../../core/counsel-session';
import {
  COUNSEL_IAP_MINUTES,
  COUNSEL_IAP_SALE_PRICE_10MIN,
  COUNSEL_IAP_SUPPLY_PRICE_10MIN,
  matchCounselProductForMinutes,
} from '../../core/counsel-iap';
import {
  fetchCounselIapProducts,
  purchaseCounselMinutes,
  resolveCounselSku,
} from '../../lib/toss-counsel-iap';

const APPS_IN_TOSS = process.env.NEXT_PUBLIC_APPS_IN_TOSS === '1';
const SUCCESS_HOLD_MS = 2200;
const PAYMENT_TIMEOUT_MS = 120_000;

type PaymentPhase = 'select' | 'paying' | 'success';

interface PaymentModalProps {
  open: boolean;
  /** 신규 구매 vs 진행 중 세션 시간 연장 */
  mode?: 'purchase' | 'extend';
  onSuccess: (purchasedMinutes: number) => void;
  onClose: () => void;
}

export default function PaymentModal({
  open,
  mode = 'purchase',
  onSuccess,
  onClose,
}: PaymentModalProps) {
  const [phase, setPhase] = useState<PaymentPhase>('select');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<IapProductListItem[]>([]);
  const [successMinutes, setSuccessMinutes] = useState(0);
  const cleanupRef = useRef<(() => void) | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paymentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const purchaseSettledRef = useRef(false);

  const product10 = matchCounselProductForMinutes(products, COUNSEL_IAP_MINUTES);
  const displayPrice = APPS_IN_TOSS
    ? (product10?.displayAmount ?? `${COUNSEL_IAP_SALE_PRICE_10MIN.toLocaleString()}원`)
    : `${COUNSEL_IAP_SALE_PRICE_10MIN.toLocaleString()}원`;

  const resetModalState = () => {
    setPhase('select');
    setLoading(false);
    setSuccessMinutes(0);
    purchaseSettledRef.current = false;
    if (paymentTimeoutRef.current) {
      clearTimeout(paymentTimeoutRef.current);
      paymentTimeoutRef.current = null;
    }
  };

  const settlePayment = (message?: string) => {
    if (purchaseSettledRef.current) return;
    purchaseSettledRef.current = true;
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (paymentTimeoutRef.current) {
      clearTimeout(paymentTimeoutRef.current);
      paymentTimeoutRef.current = null;
    }
    setPhase('select');
    setLoading(false);
    if (message) alert(message);
  };

  const finishPurchaseSuccess = (minutes: number) => {
    if (purchaseSettledRef.current) return;
    purchaseSettledRef.current = true;
    if (paymentTimeoutRef.current) {
      clearTimeout(paymentTimeoutRef.current);
      paymentTimeoutRef.current = null;
    }
    finishWithSuccess(minutes);
  };

  const finishWithSuccess = (minutes: number) => {
    setSuccessMinutes(minutes);
    setPhase('success');
    setLoading(false);
    cleanupRef.current = null;
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => {
      successTimerRef.current = null;
      onSuccess(minutes);
      resetModalState();
    }, SUCCESS_HOLD_MS);
  };

  useEffect(() => {
    if (!open) {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
      resetModalState();
      return;
    }
    if (!APPS_IN_TOSS) return;
    void fetchCounselIapProducts().then(setProducts).catch(() => setProducts([]));
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [open]);

  useEffect(() => () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  if (!open) return null;

  const title = phase === 'success'
    ? (mode === 'extend' ? '시간 연장 완료' : '결제 완료')
    : mode === 'extend'
      ? '상담 10분 연장'
      : 'AI 심층 상담 이용권';

  const subtitle = mode === 'extend'
    ? '10분 이용권을 추가 구매하면 상담을 이어갈 수 있어요.'
    : APPS_IN_TOSS
      ? '토스 인앱결제로 10분 상담 이용권을 구매합니다.'
      : 'AI 심층 상담 10분 이용권 (990원)';

  const canDismiss = phase === 'select' && !loading;

  const handleClose = () => {
    if (!canDismiss) return;
    onClose();
  };

  const handlePayment = async () => {
    setLoading(true);
    setPhase('paying');
    purchaseSettledRef.current = false;
    try {
      if (APPS_IN_TOSS) {
        cleanupRef.current?.();
        if (paymentTimeoutRef.current) clearTimeout(paymentTimeoutRef.current);
        paymentTimeoutRef.current = setTimeout(() => {
          if (!purchaseSettledRef.current) {
            settlePayment('결제 응답이 지연되고 있습니다. 토스 결제창을 확인하거나 잠시 후 다시 시도해 주세요.');
          }
        }, PAYMENT_TIMEOUT_MS);
        let freshProducts = products;
        if (!product10) {
          try {
            freshProducts = await fetchCounselIapProducts();
            setProducts(freshProducts);
          } catch {
            /* keep cached */
          }
        }
        const sku = await resolveCounselSku(COUNSEL_IAP_MINUTES, {
          skuOverride: matchCounselProductForMinutes(freshProducts, COUNSEL_IAP_MINUTES)?.sku,
          cachedProducts: freshProducts,
        });
        if (!sku) {
          settlePayment('인앱 상품을 불러오지 못했습니다. 콘솔에 상담 이용권이 등록·승인됐는지 확인해 주세요.');
          return;
        }
        cleanupRef.current = purchaseCounselMinutes(
          COUNSEL_IAP_MINUTES,
          (purchased) => finishPurchaseSuccess(purchased),
          (msg) => settlePayment(msg || undefined),
          sku,
        );
        return;
      }

      let sdk: { checkoutPayment?: (opts: object) => Promise<{ paymentKey?: string; orderId?: string }> };
      try {
        sdk = (await import('@apps-in-toss/web-framework')) as typeof sdk;
      } catch {
        sdk = {};
      }

      if (sdk.checkoutPayment) {
        const response = await sdk.checkoutPayment({
          amount: COUNSEL_IAP_SALE_PRICE_10MIN,
          orderId: 'ORDER_' + Date.now(),
          orderName: `AI 심층 상담 ${COUNSEL_IAP_MINUTES}분`,
        });
        if (response) {
          const res = await fetch('/api/payments/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentKey: response.paymentKey || 'native_payment_key',
              orderId: response.orderId || 'ORDER_' + Date.now(),
              amount: COUNSEL_IAP_SALE_PRICE_10MIN,
            }),
          });
          const data = await res.json();
          if (data.success) finishWithSuccess(COUNSEL_IAP_MINUTES);
          else {
            setPhase('select');
            alert('결제 승인 실패');
          }
        } else {
          setPhase('select');
        }
      } else {
        const proceed = window.confirm(
          `[테스트 환경] 실제 결제창이 뜰 수 없습니다.\n${COUNSEL_IAP_SALE_PRICE_10MIN.toLocaleString()}원을 결제하시겠습니까?`,
        );
        if (proceed) {
          const res = await fetch('/api/payments/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentKey: 'mock_test_key',
              orderId: 'ORDER_' + Date.now(),
              amount: COUNSEL_IAP_SALE_PRICE_10MIN,
            }),
          });
          const data = await res.json();
          if (data.success) finishWithSuccess(COUNSEL_IAP_MINUTES);
          else setPhase('select');
        } else {
          setPhase('select');
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      setPhase('select');
      alert('결제 진행 중 오류가 발생했거나 취소되었습니다.');
    } finally {
      if (!APPS_IN_TOSS) setLoading(false);
    }
  };

  const payButtonLabel = loading || phase === 'paying'
    ? '결제 진행 중...'
    : mode === 'extend'
      ? `${displayPrice} · 10분 연장`
      : `${displayPrice} 결제하기`;

  return (
    <>
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
        }}
        onClick={handleClose}
      />
      <div
        role="dialog"
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', padding: 16,
        }}
      >
        <div style={{
          pointerEvents: 'auto',
          width: '100%', maxWidth: 400,
          background: '#fff', borderRadius: 16,
          overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '90vh',
        }}>
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid #eee',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#333' }}>{title}</h2>
            <button
              onClick={handleClose}
              disabled={!canDismiss}
              style={{
                background: 'none', border: 'none', fontSize: '1.5rem',
                color: canDismiss ? '#999' : '#ddd', cursor: canDismiss ? 'pointer' : 'not-allowed',
              }}
            >✕</button>
          </div>

          {phase === 'success' ? (
            <div style={{ padding: '36px 24px 40px', textAlign: 'center' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: 12 }}>✅</div>
              <p style={{ margin: '0 0 8px', fontSize: '1.05rem', fontWeight: 700, color: '#333' }}>
                10분이 {mode === 'extend' ? '추가' : '적용'}되었습니다
              </p>
              <p style={{ margin: 0, fontSize: '.88rem', color: '#666', lineHeight: 1.6 }}>
                잠시 후 상담 화면으로 돌아갑니다.
              </p>
            </div>
          ) : (
            <>
              <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                <p style={{ margin: '0 0 14px 0', fontSize: '0.9rem', color: '#666' }}>
                  {subtitle}
                </p>

                <div style={{
                  padding: '14px 16px', borderRadius: 10,
                  background: '#f5f8ff', border: '1px solid #d6e4ff',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#3182f6' }}>
                    AI 심층 상담 {COUNSEL_IAP_MINUTES}분
                    {mode === 'extend' ? ' 연장' : ''}
                  </div>
                  <div style={{ marginTop: 6, fontSize: '.85rem', color: '#666' }}>
                    사주 기반 1:1 AI 상담 · 세션당 {COUNSEL_IAP_MINUTES}분
                  </div>
                </div>

                <div style={{
                  textAlign: 'right', marginTop: 15,
                  fontSize: '1.1rem', fontWeight: 'bold', color: '#333',
                }}>
                  결제 금액: {displayPrice}
                </div>

                <p style={{
                  marginTop: 12,
                  fontSize: '.78rem',
                  color: '#b07a20',
                  lineHeight: 1.55,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: '#fff8eb',
                  border: '1px solid #ffe2a8',
                }}>
                  ⚠️ {COUNSEL_LEAVE_SESSION_NOTICE}
                </p>

                {APPS_IN_TOSS && (
                  <p style={{ marginTop: 10, fontSize: '.78rem', color: '#888', lineHeight: 1.6 }}>
                    공급가 {COUNSEL_IAP_SUPPLY_PRICE_10MIN.toLocaleString()}원
                    (판매가 {COUNSEL_IAP_SALE_PRICE_10MIN.toLocaleString()}원)
                  </p>
                )}
              </div>

              <div style={{ padding: '16px 20px', borderTop: '1px solid #eee' }}>
                <button
                  onClick={() => void handlePayment()}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 8, border: 'none',
                    background: '#3182f6', color: '#fff', fontSize: '1rem', fontWeight: 'bold',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {payButtonLabel}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
