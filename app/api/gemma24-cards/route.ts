/**
 * live cards.json — saju-v2 사용 가능 카드 실시간 집계
 * GET /api/gemma24-cards
 * GET /api/gemma24-cards?summary=1  (목록 생략)
 */
import { NextRequest } from 'next/server';
import { collectGemma24CardStats } from '../../../core/gemma24/card-stats';

export async function GET(req: NextRequest) {
  const summaryOnly = req.nextUrl.searchParams.get('summary') === '1';
  const stats = collectGemma24CardStats({ includeLists: !summaryOnly });

  return Response.json(stats, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}
