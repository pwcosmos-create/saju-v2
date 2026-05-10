import type { Metadata } from 'next';

const SITE = 'https://saju.coupax.co.kr';

export async function generateMetadata(): Promise<Metadata> {
  const year = new Date().getFullYear();
  const title = `만세력 사주팔자 분석 · ${year}년 운세·월별`;
  const description =
    `연월일시주·오행·용신·신살·대운·${year}년 월별 운세를 계산하고 AI 심층 풀이와 텍스트·음성 상담까지 제공합니다. 무료 사주 계산.`;

  return {
    title,
    description,
    keywords: [
      '사주계산', '만세력', '무료사주', '사주팔자', '연월일시주',
      '오행', '용신', '신살', '대운', '월별운세', 'AI사주', '사주풀이',
    ],
    alternates: { canonical: `${SITE}/saju` },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      url: `${SITE}/saju`,
      title: `${title} | ✦ AI사주`,
      description,
      siteName: '✦ AI사주',
      locale: 'ko_KR',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ✦ AI사주`,
      description,
    },
  };
}

export default function SajuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
