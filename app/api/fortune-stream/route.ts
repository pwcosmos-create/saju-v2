/**
 * AI Saju Fortune Stream API - v2.1.0
 *
 * AI 심층 풀이 전용 SSE 스트리밍 엔드포인트.
 * counsel 분기 제거 — 상담은 /api/saju-chat 단일 경로 사용.
 */
import { NextRequest } from 'next/server';
import { fetchLlmStream } from '../../../core/config/llm';
import { makeRateLimiter } from '../../../core/http-client/rate-limit';

const SYSTEM = `당신은 대한민국 최고의 사주팔자 명리학 전문가입니다.
사용자의 사주 분석 결과를 전문적이면서도 따뜻한 상담가의 어조로 풀어주세요.

 [작성 원칙]
1. 불필요한 기호(예: [1], [2], * 등)나 출처 표시는 절대 하지 마세요.
2. 전문 용어가 나올 때는 반드시 쉬운 풀이를 먼저 하고 괄호 안에 한자를 씁니다.
3. 문장이 끊기거나 같은 내용을 반복(중복)하지 마세요. (예: "명리학에서는... 명리학에서는..." 금지)
4. "더[2]"와 같은 AI 특유의 각주를 생성하지 마세요.
5. 오직 한국어로만 답변하며, 친절하고 상세한 평어체(~해요, ~네요)를 사용하세요.
6. 약 2700~3600자 수준의 풍부한 분량으로 상세하게 풀이해 주세요. 중간에 끊기지 않도록 문장 마무리를 확실히 하세요.`;

const checkFortuneStreamRateLimit = makeRateLimiter(5, 600_000);

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

  const upstream = await fetchLlmStream({
    stream: true,
    max_tokens: 3000,
    temperature: 0.7,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: prompt },
    ],
  });

  if (!upstream.ok || !upstream.body) {
    const err = await upstream.text();
    return new Response(JSON.stringify({ error: `LLM 오류: ${err}` }), { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    },
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

