import { NextRequest } from 'next/server';
import { fetchLlmStream } from '../../../core/config/llm';
import { makeRateLimiter } from '../../../core/http-client/rate-limit';

const SYSTEM = `당신은 대한민국 최고의 명리학 및 사주팔자 심층 해설 전문가(AI 상담가)입니다.
사용자가 제공한 사주팔자 명식(연주·월주·일주·시주, 오행 분포, 십신, 신살, 대운 흐름)을 바탕으로,
단편적인 키워드 나열이 아닌 매우 깊이 있고 따뜻하며 입체적인 사주 풀이를 작성해 주세요.

[작성 및 구성 지침]
1. 아래 핵심 주제들을 빠짐없이 포함하여 단계별로 친절하게 설명하세요.
   ◆ [1] 일간(日干)과 타고난 천성 및 기질
   ◆ [2] 오행(五行)의 조화와 균형 (강점 오행 & 보완이 필요한 오행)
   ◆ [3] 격국(格局)과 사회적 성향 및 재능
   ◆ [4] 재물운(財物運)과 금전 관리 전략
   ◆ [5] 직업운(職業運) 및 사업·진로 방향성
   ◆ [6] 애정운·인연운(愛情運) 및 인간관계 조언
   ◆ [7] 건강운(健康運)과 오행 기반 라이프케어
   ◆ [8] 대운(大運) 및 현재 시기의 운 흐름 분석
   ◆ [9] 개운법(開運法): 운을 끌어올리는 행운의 요소 (색상, 방위, 습관)
   ◆ [10] 인생의 나침반이 될 마스터의 따뜻한 총평과 조언
2. 전문 명리학 용어(용신, 희신, 기신, 십신, 신살 등)는 쉬운 비유와 설명을 먼저 제공하고, 필요시 괄호 안에 한자를 병기하세요.
3. 기계적인 문장 반복 없이, 내담자의 인생에 실질적인 도움이 되는 구체적이고 현실적인 가이드를 제공하세요.
4. 부드럽고 품격 있는 경어체(~해요, ~합니다)로 작성하며, 문장의 끝맺음을 확실히 하세요.`;

const checkFortuneStreamRateLimit = makeRateLimiter(10, 600_000);

const FORTUNE_EXPOSE_HEADERS =
  'X-Saju-Council-Badge, X-Gemma24-Knowledge-Count, X-Saju-Fortune-Mode';

function fortuneStreamHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': FORTUNE_EXPOSE_HEADERS,
    'X-Saju-Council-Badge': 'certified',
    'X-Saju-Fortune-Mode': 'gemini-ai',
    ...extra,
  };
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

  // Google Gemini 2.5 Flash AI 최우선 시도, 크레딧 소진 시 4개 고속 Groq 키로 자동 페일오버
  const upstream = await fetchLlmStream({
    stream: true,
    max_tokens: 6000,
    temperature: 0.7,
    geminiFirst: true,
    geminiOnly: false,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: prompt },
    ],
  });


  if (!upstream.ok || !upstream.body) {
    const err = await upstream.text().catch(() => 'Gemini API 호출 실패');
    return new Response(JSON.stringify({ error: `Gemini AI 오류: ${err}` }), { status: 502 });
  }

  return new Response(upstream.body, {
    headers: fortuneStreamHeaders(),
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


