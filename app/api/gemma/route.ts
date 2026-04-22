import { NextRequest } from 'next/server';

const SYSTEM = `당신은 30년 경력의 명리학(命理學) 전문가입니다.
사주팔자를 분석할 때 전통 명리학 이론을 정확하게 적용하고, 전문 용어는 한자와 설명을 함께 제공합니다.
한국어로만 답변합니다.`;

const rlMap = new Map<string, { count: number; reset: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rlMap.get(ip);
  if (!entry || now > entry.reset) { rlMap.set(ip, { count: 1, reset: now + 600_000 }); return true; }
  if (entry.count >= 1) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(ip))
    return Response.json({ error: '요청 한도 초과. 10분 후 다시 시도해주세요.' }, { status: 429 });

  let body: { saju?: string; year?: number; month?: number; day?: number; gender?: string };
  try { body = await req.json(); }
  catch { return Response.json({ error: '잘못된 요청 형식' }, { status: 400 }); }

  const { saju = '', year, month, day, gender = '남' } = body;
  if (!saju) return Response.json({ error: 'saju 없음' }, { status: 400 });

  const prompt = `생년월일: ${year}년 ${month}월 ${day}일 (${gender}성)
사주팔자: ${saju}

위 사주를 전통 명리학으로 상세히 분석해주세요. 다음 항목을 순서대로 서술해주세요:
1. 일간(日干) 성격과 기질 — 타고난 본성과 강점·약점
2. 오행 분포와 신강·신약 판정
3. 용신(用神)과 기신(忌神)
4. 직업과 적성 — 잘 맞는 분야와 피해야 할 환경
5. 재물운과 연애·결혼운
6. 2026년 병오년(丙午年) 운세와 월별 흐름
7. 종합 조언과 구체적인 개운법`;

  const geminiKey = process.env.GOOGLE_AI_API_KEY ?? '';

  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${geminiKey}` },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        stream: false,
        max_tokens: 8192,
        temperature: 0.7,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user',   content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: `AI 오류: ${err}` }, { status: 502 });
    }

    const data = await res.json();
    const result: string = data.choices?.[0]?.message?.content ?? '';
    return Response.json({ result, prompt });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
