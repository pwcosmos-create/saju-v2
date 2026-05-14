import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

const SITE_URL = 'https://saju.coupax.co.kr';
const SITE_TITLE = '사주팔자 무료 분석';
const SITE_DESC =
  '생년월일 입력으로 사주팔자·오행·용신·신살·대운·월별 운세·AI 심층 풀이·상담까지 — RSS는 요약 위주로 제공합니다.';

const SAJU_PAGE = `${SITE_URL}/saju`;

/** 항목별 영구 식별자 — 동일 guid 는 리더에서 한 건으로 덮어쓰임. 본문은 네이버 RSS 안내에 맞춰 짧게 유지 */
function buildItems(now: Date) {
  const y = now.getFullYear();
  return [
    {
      title: '사주팔자 무료 분석 — AI사주 쿠팩스',
      link: SITE_URL,
      guid: `${SITE_URL}#rss-home`,
      desc: '만세력 기반 60갑자 사주, 오행·용신·신살·대운·월별 운세와 AI 심층 풀이를 한 곳에서 제공합니다.',
      pubDate: 'Mon, 01 Jan 2025 00:00:00 +0900',
    },
    {
      title: '연·월·일·시 사주 자동 계산 (/saju)',
      link: SAJU_PAGE,
      guid: `${SITE_URL}#rss-saju-calc`,
      desc: '양력·음력 입력으로 연주·월주·일주·시주를 계산합니다. 일간·오행 분포를 바로 확인할 수 있습니다.',
      pubDate: 'Mon, 06 Jan 2025 00:00:00 +0900',
    },
    {
      title: '오행(五行)·용신·기신 균형 진단',
      link: SAJU_PAGE,
      guid: `${SITE_URL}#rss-ohaeng`,
      desc: '목화토금수 분포와 용신·기신·희신을 자동 산출해 성향과 보완 포인트를 짚어 드립니다.',
      pubDate: 'Wed, 01 Jan 2025 00:00:00 +0900',
    },
    {
      title: '신살·대운(大運)·세운(歲運)',
      link: SAJU_PAGE,
      guid: `${SITE_URL}#rss-daeun-seun`,
      desc: '천을귀인 등 신살 표시, 10년 단위 대운과 올해 세운 흐름을 함께 볼 수 있습니다.',
      pubDate: 'Thu, 01 Jan 2026 00:00:00 +0900',
    },
    {
      title: `${y}년 월별 운세(1~12월)`,
      link: SAJU_PAGE,
      guid: `${SITE_URL}#rss-monthly-${y}`,
      desc: `${y}년 월별 운세를 엔진으로 계산합니다. 용신·기신과 형충회합 이벤트를 반영합니다.`,
      pubDate: `Wed, 01 Jan ${y} 00:00:00 +0900`,
    },
    {
      title: 'AI 실시간 심층 풀이(스트리밍)',
      link: SAJU_PAGE,
      guid: `${SITE_URL}#rss-ai-stream`,
      desc: '계산 결과를 바탕으로 AI가 성향·직업·건강 등 주제를 스트리밍 형태로 풀이합니다.',
      pubDate: 'Sat, 10 May 2026 00:00:00 +0900',
    },
    {
      title: 'AI 심층 상담 · 궁합·비교 모드',
      link: SAJU_PAGE,
      guid: `${SITE_URL}#rss-ai-chat-compat`,
      desc: '풀이 후 텍스트·음성 상담과 두 사람 사주 비교(궁합) 모드를 지원합니다. 상담 일부는 유료입니다.',
      pubDate: 'Sat, 10 May 2026 00:00:00 +0900',
    },
  ];
}

export async function GET() {
  const now = new Date();
  const items = buildItems(now);
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_TITLE}</title>
    <link>${SITE_URL}</link>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <description>${SITE_DESC}</description>
    <language>ko</language>
    <lastBuildDate>${now.toUTCString()}</lastBuildDate>
    <generator>Next.js</generator>
${items.map(item => `    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${item.link}</link>
      <description><![CDATA[${item.desc}]]></description>
      <pubDate>${item.pubDate}</pubDate>
      <guid isPermaLink="true">${item.guid}</guid>
    </item>`).join('\n')}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      /* 배포 직후 네이버·브라우저가 옛 피드를 너무 오래 들고 가지 않도록 짧게 */
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
