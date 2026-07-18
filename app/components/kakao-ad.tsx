'use client';

import React, { useEffect, useRef } from 'react';

// Expand Window interface locally for Kakao AdFit
declare global {
  interface Window {
    adfit?: {
      destroy: (unit: string) => void;
    };
  }
}

interface KakaoAdProps {
  className?: string;
  unit?: string;
  width?: number | string;
  height?: number | string;
}

export default function KakaoAd({
  className,
  unit = 'DAN-JQne2FQbiyiDWP3v',
  width = 300,
  height = 250,
}: KakaoAdProps) {
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
    ins.setAttribute('data-ad-unit', unit);
    ins.setAttribute('data-ad-width', width.toString());
    ins.setAttribute('data-ad-height', height.toString());

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `//t1.kakaocdn.net/kas/static/ba.min.js?v=${Date.now()}`;
    script.async = true;

    container.appendChild(ins);
    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = '';
      }
      if (typeof window !== 'undefined' && window.adfit && typeof window.adfit.destroy === 'function') {
        window.adfit.destroy(unit);
      }
    };
  }, [APPS_IN_TOSS, unit, width, height]);

  if (APPS_IN_TOSS) return null;

  const widthNum = Number(width);
  const isNumeric = !isNaN(widthNum);
  const cssHeight = typeof height === 'number' ? `${height}px` : (isNaN(Number(height)) ? height : `${height}px`);

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
        maxWidth: isNumeric ? `${widthNum + 40}px` : width,
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
          width: isNumeric ? `${widthNum}px` : width,
          height: cssHeight,
          background: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    </div>
  );
}

