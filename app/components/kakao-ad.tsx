'use client';

import React, { useEffect, useRef } from 'react';

interface KakaoAdProps {
  className?: string;
}

export default function KakaoAd({ className }: KakaoAdProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const APPS_IN_TOSS = process.env.NEXT_PUBLIC_APPS_IN_TOSS === '1';

  useEffect(() => {
    if (APPS_IN_TOSS || typeof window === 'undefined') return;

    const container = containerRef.current;
    if (!container) return;

    // Clear previous contents to ensure clean mounting in client transitions
    container.innerHTML = '';

    const ins = document.createElement('ins');
    ins.className = 'kakao_ad_area';
    ins.style.display = 'none';
    ins.setAttribute('data-ad-unit', 'DAN-JQne2FQbiyiDWP3v');
    ins.setAttribute('data-ad-width', '300');
    ins.setAttribute('data-ad-height', '250');

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = '//t1.kakaocdn.net/kas/static/ba.min.js';
    script.async = true;

    container.appendChild(ins);
    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [APPS_IN_TOSS]);

  if (APPS_IN_TOSS) return null;

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '24px auto',
        padding: '16px 12px 12px 12px',
        maxWidth: 340,
        borderRadius: 20,
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
        transition: 'all 0.3s ease-in-out',
      }}
    >
      <div
        style={{
          fontSize: '0.65rem',
          color: 'rgba(255, 255, 255, 0.3)',
          letterSpacing: '0.1em',
          fontWeight: 700,
          marginBottom: 12,
          textTransform: 'uppercase',
        }}
      >
        ADVERTISEMENT
      </div>
      <div
        ref={containerRef}
        style={{
          width: 300,
          height: 250,
          background: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    </div>
  );
}
