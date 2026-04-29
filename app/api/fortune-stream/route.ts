import { NextRequest } from 'next/server';
import { fetchGroqStream } from '../../../core/config/llm';
import { makeRateLimiter } from '../../../core/http-client/rate-limit';

const SYSTEM = `당신은 사주팔자를 쉽고 따뜻하게 풀어주는 명리학 상담가입니다.
전문 용어가 나올 때마다 쉬운 말을 먼저 쓰고, 괄호 안에 한자를 병기합니다.
예) "일간의 기운이 약한 상태 — 신약(身弱)"
딱딱한 강의체가 아니라, 읽는 사람이 자기 이야기처럼 느낄 수 있는 따뜻한 말투로 써주세요.
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
