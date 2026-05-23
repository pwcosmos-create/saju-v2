/**
 * AI Saju LLM configuration
 *
 * - Gemini 2.5 Flash endpoint and API key management
 * - Backward-compatible export for existing call sites
 */
// 외부 API 설정 단일 진실 모듈 — 값은 환경변수에서만 읽음 (서버 전용)

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`환경변수 누락: ${name}`);
  return val;
}

const GROQ_KEYS = [
  process.env.GROQ_API_KEY_1,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
  process.env.GROQ_API_KEY_4
].filter(Boolean) as string[];

let keyIndex = 0;

function getRotatedGroqKey(): string {
  if (GROQ_KEYS.length === 0) return '';
  const key = GROQ_KEYS[keyIndex];
  keyIndex = (keyIndex + 1) % GROQ_KEYS.length;
  return key;
}

// Llama 3.3 70B Korean leakage post-processor
function cleanLlamaLeakages(text: string): string {
  if (!text) return text;
  return text
    // 1. Japanese leakages (e.g. 먼저/우선 대신 "まず" 사용 방지)
    .replace(/먼저\s*まず/g, '먼저')
    .replace(/우선\s*まず/g, '우선')
    .replace(/먼저\s+먼저/g, '먼저')
    .replace(/まず/g, '우선')
    // 2. German leakages (e.g. 중요하게 대신 "wicht/wichtig" 사용 방지)
    .replace(/wichtig한/g, '중요한')
    .replace(/wicht한/g, '중요한')
    .replace(/wichtig하게/g, '중요하게')
    .replace(/wicht하게/g, '중요하게')
    .replace(/wichtig하며/g, '중요하며')
    .replace(/wicht하며/g, '중요하며')
    .replace(/wichtig/gi, '중요')
    .replace(/wicht/gi, '중요')
    .replace(/zuerst/gi, '우선')
    // 3. AI footnotes and cleanups
    .replace(/\[\d+\]/g, '');
}

// Gemini 2.5 Flash Saju Quality & Security Auditor
async function auditAndRefineWithGemini(draftText: string): Promise<string> {
  const geminiKey = process.env.GOOGLE_AI_API_KEY ?? '';
  if (!geminiKey) return cleanLlamaLeakages(draftText);

  const systemInstruction = `당신은 최고 권위의 명리학 검수관이자 철통 보안관(감시자)입니다.
주어진 AI의 사주 풀이 초안(Draft)을 엄격하게 감시하고 교정하여 최종 결과물만 출력하십시오.

[감시 및 교정 지침]
1. 🛡️ [개인정보 보안]: 초안 내에 실명, 연락처, 세부 생년월일 숫자 등 어떠한 개인 식별 정보(PII)라도 발견될 경우 즉시 '사용자님' 또는 '당신'으로 강제 치환 및 익명화하십시오.
2. ☯️ [명리학 정합성]: 용신(用神)과 기신(忌神)의 역할이 혼동되거나 모순되어 설명된 구절이 있다면, 용신을 이로운 오행으로 기신을 해로운 오행으로 일관되게 정정하십시오.
3. ✂️ [오류 및 중복 정제]: AI 특유의 출처 표식([1], [2], 각주), 소제목 중복 기재, 같은 내용의 문장 무한 루프 반복(Stuttering) 등의 찌꺼기를 완벽히 제거하고 글의 흐름을 수려하게 가다듬으십시오.

오직 교정 및 검수가 완료된 수려한 최종 사주 풀이 텍스트 본문만 출력하십시오.`;

  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${geminiKey}` },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: draftText }
        ],
        temperature: 0.2
      })
    });

    if (res.ok) {
      const data = await res.json();
      const auditedText = data.choices?.[0]?.message?.content;
      if (auditedText) return cleanLlamaLeakages(auditedText);
    }
  } catch (e) {
    console.error("Gemini 감시자 검수 중 오류 발생 (초안 유지):", e);
  }
  return cleanLlamaLeakages(draftText);
}

// Convert audited text back to SSE stream format
function streamTextToOpenAiSse(text: string): ReadableStream {
  const encoder = new TextEncoder();
  const cleanedText = cleanLlamaLeakages(text);
  const chunks: string[] = [];
  const chunkSize = 20;
  for (let i = 0; i < cleanedText.length; i += chunkSize) {
    chunks.push(cleanedText.slice(i, i + chunkSize));
  }

  let chunkIdx = 0;
  return new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        if (chunkIdx < chunks.length) {
          const content = chunks[chunkIdx];
          const payload = `data: ${JSON.stringify({
            choices: [{ delta: { content } }]
          })}\n\n`;
          controller.enqueue(encoder.encode(payload));
          chunkIdx++;
        } else {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          clearInterval(interval);
          controller.close();
        }
      }, 10);
    }
  });
}

// Groq gemma2-9b-it stream with automatic fallback to Gemini 2.5 Flash
export async function fetchLlmStream(body: any): Promise<Response> {
  const activeGroqKey = getRotatedGroqKey();
  let draftText = '';

  // Enforce stream: false for upstream so we can buffer and audit the whole draft
  const upstreamBody = {
    ...body,
    stream: false
  };

  // Clamp max_tokens to 8192 to prevent 413 Payload Too Large error on Groq
  if (upstreamBody.max_tokens && upstreamBody.max_tokens > 8192) {
    upstreamBody.max_tokens = 8192;
  }

  if (activeGroqKey) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:  'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${activeGroqKey}` 
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          ...upstreamBody
        }),
        signal: AbortSignal.timeout(6000) // 6 seconds timeout for Groq API
      });

      if (response.ok) {
        const data = await response.json();
        draftText = data.choices?.[0]?.message?.content ?? '';
      } else {
        console.warn(`Groq API returned status ${response.status}. Falling back to Gemini.`);
      }
    } catch (e) {
      console.warn("Groq API call failed, falling back to Gemini:", e);
    }
  }

  // Backup fallback: Gemini 2.5 Flash on Google AI Studio
  if (!draftText) {
    try {
      const geminiKey = requireEnv('GOOGLE_AI_API_KEY');
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${geminiKey}` },
        body:    JSON.stringify({ model: 'gemini-2.5-flash', ...upstreamBody }),
      });
      if (response.ok) {
        const data = await response.json();
        draftText = data.choices?.[0]?.message?.content ?? '';
      }
    } catch (e) {
      console.error("Critical: Both Groq and Gemini failed to generate draft:", e);
      throw e;
    }
  }

  // Phase 2: Run Gemini 2.5 Flash Quality & Security audit on the draft text
  const auditedText = await auditAndRefineWithGemini(draftText);

  // Return formatted stream or json response depending on body.stream
  if (body.stream) {
    const sseStream = streamTextToOpenAiSse(auditedText);
    return new Response(sseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } else {
    // Non-streaming response format
    const jsonResponse = {
      choices: [{
        message: {
          role: 'assistant',
          content: auditedText
        }
      }]
    };
    return new Response(JSON.stringify(jsonResponse), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}

// Backward compatibility for existing imports.
export const fetchGroqStream = fetchLlmStream;

export const LLM_CONFIG = {
  gemini: {
    model:  'gemini-2.5-flash',
    url:    'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    apiKey: () => requireEnv('GOOGLE_AI_API_KEY'),
  },
  // 프리미엄 전용 — 무료 채팅에 사용 금지
  claude: {
    model:  'claude-sonnet-4-6',
    url:    'https://api.anthropic.com/v1/messages',
    apiKey: () => requireEnv('ANTHROPIC_API_KEY'),
  },
} as const;

export const KASI_CONFIG = {
  base:       'https://apis.data.go.kr/B090041/openapi/service',
  serviceKey: () => requireEnv('KASI_SERVICE_KEY'),
  services: {
    lunarCalendar:  'LrsrCldInfoService/getLunCalInfo',
    solarCalendar:  'LrsrCldInfoService/getSolCalInfo',
    solarTerms:     'SpcdeInfoService/get24DivisionsInfo',
    moonPhase:      'LunPhInfoService/getLunPhInfo',
    riseSet:        'RiseSetInfoService/getAreaRiseSetInfo',
    solarAltitude:  'SrAltudeInfoService/getAreaSrAltudeInfo',
  },
} as const;
