'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { BRAND } from './ui-brand';

function wordmarkGradientStyle(fontSize: string, letterSpacing = -1.5): CSSProperties {
  return {
    fontSize,
    fontWeight: 900,
    letterSpacing,
    lineHeight: 1,
    background: BRAND.wordmarkGradient,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  };
}

const SPARKLE_MAIN = 'M12 2L13.5 9L21 10.5L13.5 12L12 19L10.5 12L3 10.5L10.5 9L12 2Z';
const SPARKLE_A = 'M18.5 15.5L19.5 18L22 19L19.5 20L18.5 22.5L17.5 20L15 19L17.5 18L18.5 15.5Z';
const SPARKLE_B = 'M5.5 16L6 17.5L7.5 18L6 18.5L5.5 20L5 18.5L3.5 18L5 17.5L5.5 16Z';

type BrandMarkProps = {
  href?: string;
  logoPx?: number;
  wordmarkRem?: string;
};

export function BrandMarkLink({ href = '/', logoPx = 34, wordmarkRem = '1.6rem' }: BrandMarkProps) {
  return (
    <Link href={href} prefetch={false} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
      <svg width={logoPx} height={logoPx} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d={SPARKLE_MAIN} fill={BRAND.sparkleMain} />
        <path d={SPARKLE_A} fill={BRAND.sparkleMid} />
        <path d={SPARKLE_B} fill={BRAND.sparkleDeep} />
      </svg>
      <span style={wordmarkGradientStyle(wordmarkRem)}>AI사주</span>
    </Link>
  );
}

type PrimaryCtaProps = { href: string; children: ReactNode };

export function PrimaryCtaLink({ href, children }: PrimaryCtaProps) {
  return (
    <Link
      href={href}
      style={{
        padding: '8px 20px',
        borderRadius: 100,
        background: BRAND.purple,
        color: '#fff',
        fontSize: '.88rem',
        fontWeight: 700,
        textDecoration: 'none',
      }}
    >
      {children}
    </Link>
  );
}

type SiteNavVariant = 'landing' | 'saju';

const APPS_IN_TOSS = process.env.NEXT_PUBLIC_APPS_IN_TOSS === '1';

export function SiteNav({ variant }: { variant: SiteNavVariant }) {
  if (variant === 'landing') {
    return (
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          height: 'calc(60px + env(safe-area-inset-top, 0px))',
          boxSizing: 'border-box',
          background: BRAND.navGlass,
          backdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${BRAND.borderNav}`,
        }}
      >
        <BrandMarkLink />
      </nav>
    );
  }

  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '18px 32px',
        paddingTop: 'max(18px, env(safe-area-inset-top, 18px))',
        paddingLeft: 'max(16px, env(safe-area-inset-left, 16px), 32px)',
        paddingRight: 'max(16px, env(safe-area-inset-right, 16px), 32px)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: BRAND.navGlassSaju,
        boxSizing: 'border-box',
        maxWidth: '100%',
      }}
    >
      <BrandMarkLink />
    </header>
  );
}

/** 랜딩 푸터 한 줄 — 로고 마크 + 서비스명 */
export function FooterBrandRow() {
  return (
    <div
      style={{
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d={SPARKLE_MAIN} fill={BRAND.sparkleMain} />
        <path d={SPARKLE_A} fill={BRAND.sparkleMid} />
        <path d={SPARKLE_B} fill={BRAND.sparkleDeep} />
      </svg>
      <span style={wordmarkGradientStyle('1.02rem', -0.5)}>AI사주</span>
      <span style={{ color: '#6b6490', fontWeight: 500 }}>— 사주팔자 무료 분석</span>
    </div>
  );
}
