/**
 * AI Saju Fortune Stream API - v2.1.0
 *
 * AI 심층 풀이 전용 SSE 스트리밍 엔드포인트.
 * counsel 분기 제거 — 상담은 /api/saju-chat 단일 경로 사용.
 */
import { NextRequest } from 'next/server';
import { fetchLlmStream, streamTextToOpenAiSse } from '../../../core/config/llm';
import { buildCouncilHybridFortune, tryCouncilHybridBase } from '../../../core/gemma24/council-fortune-hybrid';
import {
  autoEnqueueCouncilCardProductionBackground,
  inferCouncilCardNeeds,
  inferCouncilCardNeedsForFortune,
} from '../../../core/gemma24/council-card-request';
import { buildGemma24KnowledgeResult, getLoadedLiveCardsSource } from '../../../core/gemma24/saju-knowledge';
import { makeRateLimiter } from '../../../core/http-client/rate-limit';

const SYSTEM = `당신은 사주팔자를 쉽고 따뜻하게 풀어주는 명리학 상담가입니다.
처음 보는 분도 이해할 수 있게, 동시에 충분히 자세하게 풀어주세요.

 [작성 원칙]
1. [1]~[10] 표시 순서 섹션을 모두 빠짐없이 작성. ◆ 소제목 사용.
2. 전문 용어는 쉬운 말·비유를 먼저 쓰고 괄호 안에 한자를 씁니다.
3. 섹션마다 최소 450자, ◆마다 2~3문단(일상 예시·구체 조언 포함).
4. 문장이 끊기거나 같은 내용을 반복(중복)하지 마세요.
5. 출처·각주([1] 등) 표시 금지. 오직 한국어, 평어체(~해요, ~네요).
6. 전체 5000~6000자 수준으로 쉽고 자세하게. 문장 마무리를 확실히 하세요.`;

const checkFortuneStreamRateLimit = makeRateLimiter(5, 600_000);

const FORTUNE_EXPOSE_HEADERS =
  'X-Saju-Council-Badge, X-Gemma24-Knowledge-Count, X-Saju-Fortune-Mode, X-Saju-Card-Request-Queued';

function fortuneStreamHeaders(
  extra: Record<string, string>,
  cardRequestQueued: boolean,
): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': FORTUNE_EXPOSE_HEADERS,
    ...(cardRequestQueued ? { 'X-Saju-Card-Request-Queued': '1' } : {}),
    ...extra,
  };
}

function queueFortuneCardProduction(
  needs: ReturnType<typeof inferCouncilCardNeedsForFortune>,
  prompt: string,
): boolean {
  if (!needs.length) return false;
  autoEnqueueCouncilCardProductionBackground({
    needs,
    source: 'fortune',
    userMessage: 'AI 심층 풀이 (누락·보강 섹션)',
    sajuContextSnippet: prompt,
  });
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청 형식' }), { status: 400 });
  }

  if (!checkFortuneStreamRateLimit(ip)) {
    return new Response(JSON.stringify({ error: '요청 한도 초과. 1분 후 다시 시도해주세요.' }), { status: 429 });
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.slice(0, 20000) : '';
  if (!prompt) return new Response(JSON.stringify({ error: 'prompt 없음' }), { status: 400 });

  const hybridBase = tryCouncilHybridBase(prompt);
  const cardNeeds = hybridBase
    ? inferCouncilCardNeedsForFortune(prompt, hybridBase.composed.needsSupplementIds)
    : inferCouncilCardNeeds(prompt, '');
  const cardRequestQueued = queueFortuneCardProduction(cardNeeds, prompt);

  const councilHybrid = hybridBase
    ? await buildCouncilHybridFortune(prompt, hybridBase)
    : null;

  if (councilHybrid) {
    const cardsSource = getLoadedLiveCardsSource();
    if (cardsSource && process.env.NODE_ENV !== 'production') {
      console.info(`[fortune-stream] council ${councilHybrid.mode} ← ${cardsSource}`);
    }
    return new Response(streamTextToOpenAiSse(councilHybrid.text), {
      headers: fortuneStreamHeaders({
        'X-Saju-Council-Badge': 'certified',
        'X-Gemma24-Knowledge-Count': String(councilHybrid.cardCount),
        'X-Saju-Fortune-Mode': councilHybrid.mode,
      }, cardRequestQueued),
    });
  }

  const gemma24 = buildGemma24KnowledgeResult(prompt, { certifiedOnly: true });
  const system = gemma24.systemAppend ? `${SYSTEM}\n\n${gemma24.systemAppend}` : SYSTEM;

  // Groq 429 시 4키 병렬은 한도만 소진 — 조합 풀이 실패 시 단일 호출만
  const upstream = await fetchLlmStream({
    stream: true,
    max_tokens: 6000,
    temperature: 0.7,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
  });

  if (!upstream.ok || !upstream.body) {
    const err = await upstream.text();
    return new Response(JSON.stringify({ error: `LLM 오류: ${err}` }), { status: 502 });
  }

  return new Response(upstream.body, {
    headers: fortuneStreamHeaders({
      'X-Saju-Council-Badge': gemma24.badge,
      'X-Gemma24-Knowledge-Count': String(gemma24.cardCount),
      'X-Saju-Fortune-Mode': 'llm',
    }, cardRequestQueued),
  });
}

export function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

