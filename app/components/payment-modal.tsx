'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { IapProductListItem } from '@apps-in-toss/web-framework';
import { COUNSEL_LEAVE_SESSION_NOTICE } from '../../core/counsel-session';
import {
  COUNSEL_IAP_MINUTE_OPTIONS,
  COUNSEL_IAP_MINUTES,
  counselSalePriceForMinutes,
  counselSupplyPriceForMinutes,
  matchCounselProductForMinutes,
  type CounselIapMinuteOption,
} from '../../core/counsel-iap';
import {
  fetchCounselIapProducts,
  startCounselMinuteBundlePurchase,
} from '../../lib/toss-counsel-iap';

const APPS_IN_TOSS = process.env.NEXT_PUBLIC_APPS_IN_TOSS === '1';
const SUCCESS_HOLD_MS = 2200;

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
  const [selectedMinutes, setSelectedMinutes] = useState<CounselIapMinuteOption>(COUNSEL_IAP_MINUTES);
  const [payStep, setPayStep] = useState({ step: 0, total: 1 });
  const [successMinutes, setSuccessMinutes] = useState(0);
  const cleanupRef = useRef<(() => void) | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const productForMinutes = (m: number) => matchCounselProductForMinutes(products, m);

  const resetModalState = () => {
    setPhase('select');
    setLoading(false);
    setPayStep({ step: 0, total: 1 });
    setSuccessMinutes(0);
    setSelectedMinutes(COUNSEL_IAP_MINUTES);
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
    setSelectedMinutes(COUNSEL_IAP_MINUTES);
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

  const amount = counselSalePriceForMinutes(selectedMinutes);
  const displayPrice = APPS_IN_TOSS
    ? (productForMinutes(selectedMinutes)?.displayAmount ?? `${amount.toLocaleString()}원`)
    : `${amount.toLocaleString()}원`;

  const title = phase === 'success'
    ? (mode === 'extend' ? '시간 연장 완료' : '결제 완료')
    : mode === 'extend'
      ? '상담 시간 연장'
      : 'AI 심층 상담 이용권';

  const subtitle = mode === 'extend'
    ? '추가할 시간을 선택한 뒤 결제해 주세요.'
    : APPS_IN_TOSS
      ? '이용 시간을 선택한 뒤 토스 인앱결제로 구매합니다.'
      : '이용 시간을 선택한 뒤 구매합니다.';

  const canDismiss = phase === 'select' && !loading;

  const handleClose = () => {
    if (!canDismiss) return;
    onClose();
  };

  const handlePayment = async () => {
    setLoading(true);
    setPhase('paying');
    try {
      if (APPS_IN_TOSS) {
        cleanupRef.current?.();
        const units = selectedMinutes / COUNSEL_IAP_MINUTES;
        setPayStep({ step: 0, total: units });
        let freshProducts = products;
        if (!productForMinutes(selectedMinutes)) {
          try {
            freshProducts = await fetchCounselIapProducts();
            setProducts(freshProducts);
          } catch {
            /* keep cached */
          }
        }
        cleanupRef.current = await startCounselMinuteBundlePurchase(
          selectedMinutes,
          {
            onProgress: (step, total) => setPayStep({ step, total }),
            onSuccess: (purchased) => finishWithSuccess(purchased),
            onFail: (msg) => {
              setPhase('select');
              setLoading(false);
              cleanupRef.current = null;
              if (msg) alert(msg);
            },
          },
          {
            skuOverride: matchCounselProductForMinutes(freshProducts, selectedMinutes)?.sku,
            cachedProducts: freshProducts,
          },
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
          amount,
          orderId: 'ORDER_' + Date.now(),
          orderName: `AI 심층 상담 ${selectedMinutes}분`,
        });
        if (response) {
          const res = await fetch('/api/payments/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentKey: response.paymentKey || 'native_payment_key',
              orderId: response.orderId || 'ORDER_' + Date.now(),
              amount,
            }),
          });
          const data = await res.json();
          if (data.success) finishWithSuccess(selectedMinutes);
          else {
            setPhase('select');
            alert('결제 승인 실패');
          }
        } else {
          setPhase('select');
        }
      } else {
        const proceed = window.confirm(
          `[테스트 환경] 실제 결제창이 뜰 수 없습니다.\n${amount.toLocaleString()}원을 결제하시겠습니까?`,
        );
        if (proceed) {
          const res = await fetch('/api/payments/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentKey: 'mock_test_key',
              orderId: 'ORDER_' + Date.now(),
              amount,
            }),
          });
          const data = await res.json();
          if (data.success) finishWithSuccess(selectedMinutes);
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

  const payButtonLabel = (() => {
    if (loading || phase === 'paying') {
      if (payStep.total > 1 && payStep.step > 0) {
        return `결제 ${payStep.step}/${payStep.total} 진행 중...`;
      }
      return '결제 진행 중...';
    }
    return mode === 'extend' ? `${displayPrice} 연장하기` : `${displayPrice} 결제하기`;
  })();

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
            <div style={{
              padding: '36px 24px 40px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '2.4rem', marginBottom: 12 }}>✅</div>
              <p style={{
                margin: '0 0 8px',
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#333',
              }}>
                {successMinutes}분이 {mode === 'extend' ? '추가' : '적용'}되었습니다
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

                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {COUNSEL_IAP_MINUTE_OPTIONS.map((m) => {
                    const selected = selectedMinutes === m;
                    const price = counselSalePriceForMinutes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSelectedMinutes(m)}
                        disabled={loading}
                        style={{
                          flex: 1,
                          padding: '12px 8px',
                          borderRadius: 10,
                          border: selected ? '2px solid #3182f6' : '1px solid #ddd',
                          background: selected ? '#f5f8ff' : '#fafafa',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          textAlign: 'center',
                          opacity: loading ? 0.7 : 1,
                        }}
                      >
                        <div style={{
                          fontSize: '1rem', fontWeight: 700,
                          color: selected ? '#3182f6' : '#333',
                        }}>
                          +{m}분
                        </div>
                        <div style={{ marginTop: 4, fontSize: '.78rem', color: '#888' }}>
                          {price.toLocaleString()}원
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div style={{
                  padding: '14px 16px', borderRadius: 10,
                  background: '#f5f8ff', border: '1px solid #d6e4ff',
                }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#3182f6' }}>
                    AI 심층 상담 {selectedMinutes}분
                    {mode === 'extend' ? ' 연장' : ''}
                  </div>
                  <div style={{ marginTop: 6, fontSize: '.85rem', color: '#666' }}>
                    사주 기반 1:1 AI 상담 · {selectedMinutes}분 {mode === 'extend' ? '추가' : '이용'}
                  </div>
                </div>

                <div style={{
                  textAlign: 'right', marginTop: 15,
                  fontSize: '1.1rem', fontWeight: 'bold', color: '#333',
                }}>
                  결제 금액: {displayPrice}
                </div>

                {selectedMinutes > COUNSEL_IAP_MINUTES && APPS_IN_TOSS && (
                  <p style={{ marginTop: 8, fontSize: '.78rem', color: '#888', lineHeight: 1.5 }}>
                    10분 이용권 {selectedMinutes / COUNSEL_IAP_MINUTES}회 순차 결제됩니다.
                  </p>
                )}

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
                    공급가 {counselSupplyPriceForMinutes(selectedMinutes).toLocaleString()}원 기준
                    (10분당 {counselSupplyPriceForMinutes(COUNSEL_IAP_MINUTES).toLocaleString()}원)
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
