/**
 * 상담 중 누락 인증 카드 — 즉석 제작 요청 · 초안 생성
 */
import { NextRequest } from 'next/server';
import {
  buildCouncilCardDrafts,
  inferCouncilCardNeeds,
  submitCouncilCardRequest,
  type CouncilCardNeed,
} from '../../../core/gemma24/council-card-request';
import { makeRateLimiter } from '../../../core/http-client/rate-limit';

const checkRateLimit = makeRateLimiter(8, 60_000);

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown';

  if (!checkRateLimit(ip)) {
    return Response.json({ error: '요청 한도 초과. 1분 후 다시 시도해 주세요.' }, { status: 429 });
  }

  let body: {
    sajuContext?: string;
    userMessage?: string;
    compareSajuContext?: string;
    counselorName?: string;
    needs?: CouncilCardNeed[];
    autoDraft?: boolean;
    source?: 'counsel' | 'fortune' | 'api';
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: '잘못된 요청 형식' }, { status: 400 });
  }

  const userMessage = typeof body.userMessage === 'string' ? body.userMessage.trim() : '';
  const sajuContext = typeof body.sajuContext === 'string' ? body.sajuContext : '';
  const compareSajuContext = typeof body.compareSajuContext === 'string' ? body.compareSajuContext : '';

  if (!userMessage) {
    return Response.json({ error: 'userMessage 필요' }, { status: 400 });
  }

  const needs = Array.isArray(body.needs) && body.needs.length
    ? body.needs.slice(0, 6)
    : inferCouncilCardNeeds(sajuContext, userMessage, compareSajuContext);

  if (!needs.length) {
    return Response.json({
      ok: true,
      requestId: null,
      message: '현재 질문·명식 기준으로 추가 제작이 필요한 카드가 감지되지 않았습니다.',
      needs: [],
      drafts: [],
    });
  }

  const autoDraft = body.autoDraft !== false;
  const drafts = autoDraft ? buildCouncilCardDrafts(needs) : [];

  const source = body.source === 'counsel' || body.source === 'fortune' ? body.source : 'api';

  const record = await submitCouncilCardRequest({
    source,
    userMessage,
    sajuContextSnippet: sajuContext.slice(0, 1200),
    counselorName: body.counselorName,
    needs,
    drafts,
  });

  return Response.json({
    ok: true,
    requestId: record.id,
    message: `${needs.length}건의 카드 제작 요청을 접수했습니다. 초안은 위원회 검수 후 cards.json에 반영됩니다.`,
    needs,
    drafts: autoDraft ? drafts : undefined,
  });
}
