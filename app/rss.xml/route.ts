import { NextResponse } from 'next/server';

const SITE_URL = 'https://saju.coupax.co.kr';
const SITE_TITLE = '사주팔자 무료 분석';
const SITE_DESC = '생년월일 입력만으로 사주팔자, 오행, 용신, 대운, AI 심층 풀이까지 무료 제공';

const items = [
  {
    title: '사주팔자 무료 분석 — AI 심층 풀이',
    link: SITE_URL,
    desc: '생년월일과 시간을 입력하면 연주·월주·일주·시주 사주팔자를 자동 계산하고, 오행 분포·용신·신살·대운·AI 심층 풀이를 무료로 제공합니다.',
    pubDate: 'Mon, 01 Jan 2025 00:00:00 +0900',
  },
  {
    title: '오행(五行) 분석 — 목화토금수 균형 진단',
    link: SITE_URL,
    desc: '사주 원국의 목(木)·화(火)·토(土)·금(金)·수(水) 오행 분포를 분석하고, 용신·기신·희신을 자동 계산하여 삶의 방향을 제시합니다.',
    pubDate: 'Wed, 01 Jan 2025 00:00:00 +0900',
  },
  {
    title: '대운(大運) 및 세운(歲運) 운세',
    link: SITE_URL,
    desc: '10년 단위 대운과 올해 세운을 계산하여 인생 흐름과 올해의 주요 운세를 분석합니다.',
    pubDate: 'Thu, 01 Jan 2026 00:00:00 +0900',
  },
  {
    title: `${new Date().getFullYear()}년 월별 운세 — 1월~12월`,
    link: SITE_URL,
    desc: `${new Date().getFullYear()}년 월별 사주 운세를 엔진 계산 기반으로 제공합니다. 용신·기신 적용, 형충회합 이벤트 포함.`,
    pubDate: `Wed, 01 Jan ${new Date().getFullYear()} 00:00:00 +0900`,
  },
];

export async function GET() {
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_TITLE}</title>
    <link>${SITE_URL}</link>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <description>${SITE_DESC}</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>Next.js</generator>
${items.map(item => `    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${item.link}</link>
      <description><![CDATA[${item.desc}]]></description>
      <pubDate>${item.pubDate}</pubDate>
      <guid>${item.link}</guid>
    </item>`).join('\n')}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
