import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0d0b1e',
};
import './globals.css';

const SITE_URL = 'https://saju.coupax.co.kr';
const THIS_YEAR = new Date().getFullYear();
const TITLE = `사주팔자 무료 분석 — ${THIS_YEAR}년 운세 · AI 심층 풀이`;
const DESC = `${THIS_YEAR}년 사주팔자 무료 분석. 생년월일 입력으로 오행·용신·신살·대운·AI 심층 풀이까지 무료 제공.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: `%s | 사주팔자 무료 분석`,
  },
  description: DESC,
  keywords: [
    '사주', '사주팔자', '무료사주', '사주보기', '사주풀이', '사주분석',
    '내사주', '사주팔자무료', '사주팔자보기', '무료사주풀이', '사주무료보기',
    `${THIS_YEAR}년운세`, `${THIS_YEAR}운세`, '올해운세', '토정비결',
    '만세력', '진짜만세력', '사주만세력', '사주계산',
    '일주', '일주분석', '60갑자', '갑자일주', '경금일주',
    '오행', '오행분석', '용신', '신강신약',
    '신살', '천을귀인', '화개살', '대운', '세운',
    '사주AI', 'AI사주', '사주인공지능', 'AI운세',
    '운세', '오늘의운세', '2026운세', '연간운세', '월별운세',
    '사주보는법', '사주공부', '명리학',
  ],
  authors: [{ name: 'saju.coupax.co.kr' }],
  creator: 'saju.coupax.co.kr',
  publisher: 'saju.coupax.co.kr',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
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
    card: 'summary_large_image',
    title: TITLE,
    description: DESC,
  },
};

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: '사주팔자란 무엇인가요?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '사주팔자(四柱八字)는 태어난 연·월·일·시를 각각 천간(天干)과 지지(地支)로 나타낸 여덟 글자(8자)입니다. 이를 통해 타고난 기질·적성·운세를 분석하는 동양 철학 체계입니다.',
      },
    },
    {
      '@type': 'Question',
      name: '사주팔자는 어떻게 보나요?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '생년월일과 태어난 시간을 입력하면 연주·월주·일주·시주 네 기둥(四柱)과 오행 분포를 자동 계산합니다. 이 사이트에서는 무료로 일주 분석, 오행, 신살, 대운, AI 심층 풀이까지 제공합니다.',
      },
    },
    {
      '@type': 'Question',
      name: '일주(日柱)란 무엇인가요?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '일주는 사주팔자에서 태어난 날을 나타내는 두 글자(천간+지지)입니다. 60갑자 중 하나로, 그 사람의 자아·성격·배우자 인연 등 삶의 핵심을 상징합니다.',
      },
    },
    {
      '@type': 'Question',
      name: '용신(用神)이란 무엇인가요?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '용신은 사주팔자에서 일간(日干)을 가장 이롭게 돕는 오행입니다. 신강(身强)한 사람과 신약(身弱)한 사람의 용신이 다르며, 용신 오행의 색·방위·직업 등을 활용하면 운이 좋아집니다.',
      },
    },
    {
      '@type': 'Question',
      name: '무료로 사주풀이를 받을 수 있나요?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: `네, saju.coupax.co.kr에서는 생년월일 입력만으로 사주팔자 분석을 완전 무료로 제공합니다. ${THIS_YEAR}년 운세, 대운, 신살, AI 심층 풀이까지 무료입니다.`,
      },
    },
  ],
};

const WEBAPP_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: '사주팔자 무료 분석',
  url: SITE_URL,
  description: DESC,
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'All',
  inLanguage: 'ko',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
  aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', ratingCount: '1200' },
};

const GA_ID = 'G-XXXXXXXXXX'; // TODO: 실제 GA4 측정 ID로 교체

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta name="naver-site-verification" content="b5a4069102b997a4c8f1463c8231793e29e5eaf0" />
        {/* Google Analytics */}
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer=window.dataLayer||[];
          function gtag(){dataLayer.push(arguments);}
          gtag('js',new Date());
          gtag('config','${GA_ID}',{page_path:window.location.pathname});
        `}} />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="stylesheet" crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBAPP_SCHEMA) }} />
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
