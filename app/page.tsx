import type { Metadata } from 'next';
import HomePageClient from './home-page-client';

const SITE_URL = 'https://saju.coupax.co.kr';
const YEAR = new Date().getFullYear();
const OG_TITLE = `✦ AI사주 — ${YEAR}년 사주팔자 무료 분석 · AI 심층 풀이`;
const OG_DESC = `${YEAR}년 AI사주. 생년월일 입력으로 오행·용신·신살·대운·AI 심층 풀이까지 무료 제공. 풀이 후 텍스트·음성 AI 상담도 이용 가능합니다.`;

/** 랜딩(/) 전용 canonical·OG — 하위 경로는 각 layout/page 에서 덮어씀 */
export const metadata: Metadata = {
  alternates: { canonical: SITE_URL },
  openGraph: {
    url: SITE_URL,
    title: OG_TITLE,
    description: OG_DESC,
  },
};

export default function Page() {
  return <HomePageClient />;
}
