'use client';

import { useEffect } from 'react';
import {
  redirectToTossMiniApp,
  TOSS_MINI_APP_URL,
  TOSS_PLAY_STORE_URL,
} from '../../lib/toss-mini-app-link';

export default function AppSajuPage() {
  useEffect(() => {
    redirectToTossMiniApp();
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0d0b1e',
        textAlign: 'center',
        paddingTop: 100,
        fontFamily: 'system-ui, sans-serif',
        color: '#e8e8e8',
      }}
    >
      <div style={{ maxWidth: 400, margin: '0 auto', padding: 20 }}>
        <h1 style={{ fontSize: 24, marginBottom: 10, color: '#e8c97e' }}>✦ AI사주</h1>
        <p style={{ color: 'rgba(255,255,255,.7)', marginBottom: 30 }}>토스 앱으로 이동 중입니다…</p>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,.45)' }}>
          페이지가 멈춰 있으면 아래 버튼을 눌러 주세요.
        </p>
        <a
          href={TOSS_MINI_APP_URL}
          style={{
            display: 'inline-block',
            padding: '15px 30px',
            background: '#3182f6',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: 10,
            fontWeight: 'bold',
            marginTop: 20,
          }}
        >
          토스 앱 열기
        </a>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginTop: 24 }}>
          토스 앱이 없다면{' '}
          <a href={TOSS_PLAY_STORE_URL} style={{ color: '#7bbfff' }}>
            Play Store에서 설치
          </a>
        </p>
      </div>
    </main>
  );
}
