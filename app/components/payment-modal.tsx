'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { IapProductListItem } from '@apps-in-toss/web-framework';
import { COUNSEL_IAP_MINUTES, COUNSEL_IAP_SUPPLY_PRICE_10MIN } from '../../core/counsel-iap';
import {
  fetchCounselIapProducts,
  purchaseCounselMinutes,
} from '../../lib/toss-counsel-iap';

const APPS_IN_TOSS = process.env.NEXT_PUBLIC_APPS_IN_TOSS === '1';

interface PaymentModalProps {
  open: boolean;
  onSuccess: (purchasedMinutes: number) => void;
  onClose: () => void;
}

export default function PaymentModal({ open, onSuccess, onClose }: PaymentModalProps) {
  const minutes = COUNSEL_IAP_MINUTES;
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<IapProductListItem[]>([]);
  const cleanupRef = useRef<(() => void) | null>(null);

  const amount = 990;

  useEffect(() => {
    if (!open || !APPS_IN_TOSS) return;
    void fetchCounselIapProducts().then(setProducts).catch(() => setProducts([]));
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [open]);

  useEffect(() => () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  if (!open) return null;

  const productForMinutes = (m: number) =>
    products.find((p) => p.displayName.includes(`${m}분`) || p.description.includes(`${m}분`));

  const displayPrice = APPS_IN_TOSS
    ? (productForMinutes(minutes)?.displayAmount ?? `${amount.toLocaleString()}원`)
    : `${amount.toLocaleString()}원`;

  const handlePayment = async () => {
    setLoading(true);
    try {
      if (APPS_IN_TOSS) {
        cleanupRef.current?.();
        cleanupRef.current = purchaseCounselMinutes(
          minutes,
          (purchased) => {
            setLoading(false);
            cleanupRef.current = null;
            if (purchased) onSuccess(COUNSEL_IAP_MINUTES);
          },
          (msg) => {
            setLoading(false);
            cleanupRef.current = null;
            if (msg) alert(msg);
          },
          productForMinutes(minutes)?.sku,
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
          orderName: `AI 심층 상담 ${minutes}분`,
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
          if (data.success) onSuccess(COUNSEL_IAP_MINUTES);
          else alert('결제 승인 실패');
        }
      } else {
        const proceed = window.confirm(
          `[테스트 환경] 실제 결제창이 뜰 수 없습니다.\n${amount}원을 결제하시겠습니까?`,
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
          if (data.success) onSuccess(COUNSEL_IAP_MINUTES);
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('결제 진행 중 오류가 발생했거나 취소되었습니다.');
    } finally {
      if (!APPS_IN_TOSS) setLoading(false);
    }
  };

  return (
    <>
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
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
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#333' }}>AI 심층 상담 이용권</h2>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', fontSize: '1.5rem',
              color: '#999', cursor: 'pointer',
            }}>✕</button>
          </div>

          <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#666' }}>
              {APPS_IN_TOSS
                ? '토스 인앱결제로 10분 상담 이용권을 구매합니다.'
                : 'AI 심층 상담 10분 이용권 (990원)'}
            </p>
            <div style={{
              padding: '14px 16px', borderRadius: 10,
              background: '#f5f8ff', border: '1px solid #d6e4ff',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#3182f6' }}>
                AI 심층 상담 {COUNSEL_IAP_MINUTES}분
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
            {APPS_IN_TOSS && (
              <p style={{ marginTop: 10, fontSize: '.78rem', color: '#888', lineHeight: 1.6 }}>
                콘솔 등록 예시 — 공급가 {COUNSEL_IAP_SUPPLY_PRICE_10MIN.toLocaleString()}원 (판매가 990원)
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
              {loading ? '결제 진행 중...' : `${displayPrice} 결제하기`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
