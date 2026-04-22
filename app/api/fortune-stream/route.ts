import { NextRequest } from 'next/server';
import { fetchGroqStream } from '../../../core/config/llm';
import { makeRateLimiter } from '../../../core/http-client/rate-limit';

const SYSTEM = `당신은 30년 경력의 명리학(命理學) 전문가입니다.
사주팔자를 분석할 때 전통 명리학 이론을 정확하게 적용하고, 전문 용어는 한자와 설명을 함께 제공합니다.
한국어로만 답변합니다.`;

// IP당 10분에 5회
const checkRateLimit = makeRateLimiter(5, 600_000);

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: '요청 한도 초과. 1분 후 다시 시도해주세요.' }), { status: 429 });
  }

  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청 형식' }), { status: 400 });
  }

  const prompt = body.prompt?.slice(0, 8000);
  if (!prompt) return new Response(JSON.stringify({ error: 'prompt 없음' }), { status: 400 });

  const upstream = await fetchGroqStream({
    stream:      true,
    max_tokens:  16384,
    temperature: 0.7,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user',   content: prompt },
    ],
  });

  if (!upstream.ok || !upstream.body) {
    const err = await upstream.text();
    return new Response(JSON.stringify({ error: `Groq 오류: ${err}` }), { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  });
}
