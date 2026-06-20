'use client';

import React, { useState } from 'react';

interface PaymentModalProps {
  open: boolean;
  onSuccess: (purchasedMinutes: number) => void;
  onClose: () => void;
}

export default function PaymentModal({ open, onSuccess, onClose }: PaymentModalProps) {
  const [minutes, setMinutes] = useState(10);
  const [loading, setLoading] = useState(false);

  const amount = (minutes / 10) * 990;

  if (!open) return null;

  const handlePayment = async () => {
    setLoading(true);
    try {
      // @apps-in-toss/web-framework를 동적으로 불러옴 (서버 사이드 렌더링 방지 및 토스 환경 대응)
      let sdk: any;
      try {
        sdk = (await import('@apps-in-toss/web-framework')) as any;
      } catch (e) {
        console.warn('Toss web-framework SDK is not available. Falling back to mock payment.');
      }

      if (sdk && sdk.checkoutPayment) {
        // 토스 미니앱 네이티브 결제 브릿지 호출
        const response = await sdk.checkoutPayment({
          amount,
          orderId: 'ORDER_' + Date.now(),
          orderName: `AI 심층 상담 ${minutes}분`,
        });
        
        // 결제가 성공적으로 이루어졌다고 가정
        if (response) {
          // 서버 검증이 필요한 경우 아래와 같이 API 호출 (현재는 모킹)
          const res = await fetch('/api/payments/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentKey: response.paymentKey || 'native_payment_key',
              orderId: response.orderId || 'ORDER_' + Date.now(),
              amount,
            })
          });
          const data = await res.json();
          if (data.success) {
            onSuccess(minutes);
          } else {
            alert('결제 승인 실패');
          }
        }
      } else {
        // PC 웹 브라우저 등 테스트 환경용 모의 결제
        const proceed = window.confirm(`[테스트 환경] 실제 결제창이 뜰 수 없습니다.\n${amount}원을 결제하시겠습니까?`);
        if (proceed) {
          const res = await fetch('/api/payments/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentKey: 'mock_test_key',
              orderId: 'ORDER_' + Date.now(),
              amount,
            })
          });
          const data = await res.json();
          if (data.success) {
            onSuccess(minutes);
          }
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('결제 진행 중 오류가 발생했거나 취소되었습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div 
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)'
        }} 
        onClick={onClose} 
      />
      <div 
        role="dialog"
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', padding: 16
        }}
      >
        <div style={{
          pointerEvents: 'auto',
          width: '100%', maxWidth: 400,
          background: '#fff', borderRadius: 16,
          overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '90vh'
        }}>
          {/* 헤더 */}
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid #eee',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#333' }}>AI 심층 상담 시간 충전</h2>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', fontSize: '1.5rem', 
              color: '#999', cursor: 'pointer'
            }}>✕</button>
          </div>

          {/* 컨텐츠 */}
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#666' }}>상담 시간을 선택해주세요. (10분당 990원)</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {[10, 20, 30].map(m => (
                <button
                  key={m}
                  onClick={() => setMinutes(m)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8,
                    border: minutes === m ? '2px solid #3182f6' : '1px solid #ddd',
                    background: minutes === m ? '#e8f3ff' : '#fff',
                    color: minutes === m ? '#3182f6' : '#333',
                    fontWeight: minutes === m ? 'bold' : 'normal',
                    cursor: 'pointer'
                  }}
                >
                  {m}분
                </button>
              ))}
            </div>
            <div style={{ textAlign: 'right', marginTop: 15, fontSize: '1.1rem', fontWeight: 'bold', color: '#333' }}>
              결제 금액: {amount.toLocaleString()}원
            </div>
          </div>

          {/* 하단 결제 버튼 */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid #eee' }}>
            <button
              onClick={handlePayment}
              disabled={loading}
              style={{
                width: '100%', padding: '14px', borderRadius: 8, border: 'none',
                background: '#3182f6', color: '#fff', fontSize: '1rem', fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? '토스페이로 결제 중...' : `${amount.toLocaleString()}원 결제하기`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
