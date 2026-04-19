import type { Metadata } from 'next';
import './globals.css';

const SITE_URL = 'https://saju.coupax.co.kr';
const TITLE = '사주팔자 무료 분석 — AI 심층 풀이';
const DESC = '생년월일·시간으로 60갑자 사주팔자를 무료 분석. 일주·오행·신살·대운·2026년 운세·AI 심층 풀이까지. 진짜만세력 기반 정밀 계산.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s | 사주팔자 무료 분석',
  },
  description: DESC,
  keywords: [
    '사주', '사주팔자', '무료사주', '사주보기', '사주풀이', '사주분석',
    '운세', '2026년운세', '대운', '일주', '오행', '신살', '만세력',
    '사주팔자무료', '내사주', '사주AI', '사주풀이무료',
  ],
  authors: [{ name: 'saju.coupax.co.kr' }],
  creator: 'saju.coupax.co.kr',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    title: TITLE,
    description: DESC,
    siteName: '사주팔자 무료 분석',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESC,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="stylesheet" crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: '사주팔자 무료 분석',
            url: SITE_URL,
            description: DESC,
            applicationCategory: 'LifestyleApplication',
            operatingSystem: 'All',
            inLanguage: 'ko',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
          }) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
