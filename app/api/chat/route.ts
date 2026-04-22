import { NextRequest } from 'next/server';
import { fetchGroqStream } from '../../../core/config/llm';

const rlMap = new Map<string, { count: number; reset: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rlMap.get(ip);
  if (!entry || now > entry.reset) { rlMap.set(ip, { count: 1, reset: now + 60_000 }); return true; }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(ip))
    return new Response(JSON.stringify({ error: '요청 한도 초과. 1분 후 다시 시도해주세요.' }), { status: 429 });

  let body: { messages?: { role: string; content: string }[]; sajuContext?: string };
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: '잘못된 요청 형식' }), { status: 400 }); }

  const { messages = [], sajuContext = '' } = body;
  if (!messages.length) return new Response(JSON.stringify({ error: 'messages 없음' }), { status: 400 });

  const system = `당신은 깊은 통찰과 따뜻한 시선을 가진 명리학 상담사입니다.
오랜 경험에서 우러나온 지혜로, 상대방이 편안하게 받아들일 수 있도록 부드럽고 자연스럽게 이야기해 주세요.

말하는 방식:
- 강의하듯 설명하지 말고, 조용히 대화하듯 건네세요
- 단정 짓기보다 "~할 수 있어요", "~인 경향이 있어요" 처럼 여지를 남기세요
- 어려운 용어는 쉬운 말로 먼저 풀어주고, 필요할 때만 한글 뒤에 한자를 병기하세요
- 3~4문장으로 핵심만 담아 여운 있게 마무리하세요
- 따뜻하고 세련된 어투로, 듣는 사람이 위로받는 느낌이 들게 해주세요

사용자가 한국어로 질문하면 한국어로, 다른 언어로 질문하면 그 언어로 답변하세요. 단, 사주 용어는 한국 명리학 용어를 기준으로 유지하세요.

【사주 데이터】
${sajuContext}`;

  const upstream = await fetchGroqStream({
    stream: true,
    max_tokens: 1024,
    temperature: 0.7,
    messages: [
      { role: 'system', content: system },
      ...messages.slice(-10),
    ],
  });

  if (!upstream.ok || !upstream.body) {
    const err = await upstream.text();
    return new Response(JSON.stringify({ error: `오류: ${err}` }), { status: 502 });
  }

  return new Response(upstream.body, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  });
}
