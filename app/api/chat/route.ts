import { NextRequest } from 'next/server';
import { fetchLlmStream } from '../../../core/config/llm';
import { makeRateLimiter } from '../../../core/http-client/rate-limit';

/** 클라이언트 상담사 목록과 동일해야 함 — 주입 방지용 화이트리스트 */
const COUNSELOR_ALLOWLIST = new Set(['도화', '현월', '지안', '서윤', '유진']);

// IP당 1분에 20회
const checkRateLimit = makeRateLimiter(20, 60_000);

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(ip))
    return new Response(JSON.stringify({ error: '요청 한도 초과. 1분 후 다시 시도해주세요.' }), { status: 429 });

  let body: {
    messages?: { role: string; content: string }[];
    sajuContext?: string;
    compareSajuContext?: string;
    chatMode?: 'single' | 'compatibility';
    counselorName?: string;
  };
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: '잘못된 요청 형식' }), { status: 400 }); }

  const { messages = [], sajuContext = '', compareSajuContext = '', chatMode = 'single' } = body;
  const counselorRaw = typeof body.counselorName === 'string' ? body.counselorName.trim() : '';
  const counselorName = COUNSELOR_ALLOWLIST.has(counselorRaw) ? counselorRaw : '';
  if (!messages.length) return new Response(JSON.stringify({ error: 'messages 없음' }), { status: 400 });

  const counselorPersona = counselorName
    ? `【배정 상담사 — 세션 고정】
- 이번 상담 세션이 끝날 때까지 당신은 이름이 「${counselorName}」인 AI 심층 사주 상담사입니다.
- 모든 해설과 답변을 이 상담사의 시각·말투로 일관되게 전달하세요.
- 다른 이름의 상담사를 소개하거나 역할을 바꾸지 마세요.
- 매 답변마다 이름을 반복해 밝히지 마세요. 필요할 때만 자연스럽게 언급하세요.
`
    : '';

  const modeGuide = chatMode === 'compatibility'
    ? `【비교 상담 모드 규칙】
- 두 사람의 사주 데이터를 비교해 궁합/관계 중심으로 답변하세요.
- 반드시 "강점 3가지 / 주의점 3가지 / 실천 팁 3가지"를 포함하세요.
- 단정적인 파국/운명 표현은 피하고, 선택 가능한 행동 조언으로 마무리하세요.

【비교 대상 데이터】
${compareSajuContext}
`
    : '';

  const system = `【상담 원칙】
- **오직 사주 명리학 및 운세와 관련된 질문에만 답변하세요.**
- 사주와 관련 없는 질문(맛집 추천, 일반 상식, 프로그래밍 등)에는 "저는 사주 명리 상담을 위한 AI입니다. 사주나 운세에 관한 질문을 해주시면 정성껏 답변해 드리겠습니다."라고 정중히 거절하세요.
- 사용자의 사주 데이터를 바탕으로 분석하여 답변하세요.

${counselorPersona}
말하는 방식:
- 강의하듯 설명하지 말고, 조용히 대화하듯 건네세요
- 단정 짓기보다 "~할 수 있어요", "~인 경향이 있어요" 처럼 여지를 남기세요
- 어려운 용어는 쉬운 말로 먼저 풀어주고, 필요할 때만 한글 뒤에 한자를 병기하세요
- 3~4문장으로 핵심만 담아 여운 있게 마무리하세요
- 따뜻하고 세련된 어투로, 듣는 사람이 위로받는 느낌이 들게 해주세요
- 답변은 반드시 완성된 문장으로 끝내고, 문장 중간에서 끊기지 않게 마무리하세요

사용자가 한국어로 질문하면 한국어로, 다른 언어로 질문하면 그 언어로 답변하세요. 단, 사주 용어는 한국 명리학 용어를 기준으로 유지하세요.

${modeGuide}

【사주 데이터】
${sajuContext}`;

  const upstream = await fetchLlmStream({
    stream: true,
    max_tokens: 1536,
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
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
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
