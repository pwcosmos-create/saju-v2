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
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_1,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
  process.env.GROQ_API_KEY_4,
].filter(Boolean) as string[];

/** true 이면 Groq 초안 뒤 Gemini 검수 2차 호출 (TPM 2배). 기본 off — 한도 절약 */
function isLlmAuditEnabled(): boolean {
  return process.env.LLM_ENABLE_AUDIT === '1';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGroqCompletion(
  groqKey: string,
  upstreamBody: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; text: string }> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', ...upstreamBody }),
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) {
    return { ok: false, status: response.status, text: '' };
  }
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  return { ok: Boolean(text), status: response.status, text };
}

async function callGeminiCompletion(
  geminiKey: string,
  upstreamBody: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; text: string }> {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${geminiKey}` },
    body: JSON.stringify({ model: 'gemini-2.5-flash', ...upstreamBody }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) {
    return { ok: false, status: response.status, text: '' };
  }
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  return { ok: Boolean(text), status: response.status, text };
}

let keyIndex = 0;

// Llama 3.3 70B Korean leakage post-processor
function cleanLlamaLeakages(text: string): string {
  if (!text) return text;
  return text
    .replace(/먼저\s*まず/g, '먼저')
    .replace(/우선\s*まず/g, '우선')
    .replace(/먼저\s+먼저/g, '먼저')
    .replace(/まず/g, '우선')
    .replace(/wichtig한/g, '중요한')
    .replace(/wicht한/g, '중요한')
    .replace(/wichtig하게/g, '중요하게')
    .replace(/wicht하게/g, '중요하게')
    .replace(/wichtig하며/g, '중요하며')
    .replace(/wicht하며/g, '중요하며')
    .replace(/wichtig/gi, '중요')
    .replace(/wicht/gi, '중요')
    .replace(/zuerst/gi, '우선')
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
  let interval: any;

  return new ReadableStream({
    start(controller) {
      interval = setInterval(() => {
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
    },
    cancel() {
      if (interval) clearInterval(interval);
    }
  });
}

// Groq + Gemini 2.5 Flash with automatic fallback
export async function fetchLlmStream(body: any): Promise<Response> {
  let draftText = '';

  const upstreamBody: Record<string, unknown> = {
    ...body,
    stream: false,
  };

  if (upstreamBody.max_tokens && (upstreamBody.max_tokens as number) > 3000) {
    upstreamBody.max_tokens = 3000;
  }

  if (Array.isArray(upstreamBody.messages)) {
    upstreamBody.messages = (upstreamBody.messages as { role: string; content: string }[]).map((m) => ({
      ...m,
      content: typeof m.content === 'string' ? m.content.slice(0, 12000) : m.content,
    }));
  }

  // ── 1차: Groq — 429 시 다음 키로 순회 (키당 1회만)
  if (GROQ_KEYS.length > 0) {
    const startIdx = keyIndex;
    for (let i = 0; i < GROQ_KEYS.length; i += 1) {
      const groqKey = GROQ_KEYS[(startIdx + i) % GROQ_KEYS.length];
      try {
        let result = await callGroqCompletion(groqKey, upstreamBody);
        if (!result.ok && result.status === 413) {
          const shorter = {
            ...upstreamBody,
            messages: (upstreamBody.messages as { role: string; content: string }[]).map((m) => ({
              ...m,
              content: typeof m.content === 'string' ? m.content.slice(0, 8000) : m.content,
            })),
          };
          result = await callGroqCompletion(groqKey, shorter);
        }
        if (result.ok && result.text) {
          draftText = result.text;
          keyIndex = (startIdx + i + 1) % GROQ_KEYS.length;
          break;
        }
        if (result.status === 429) {
          console.warn(`Groq 429 on key #${i + 1}, trying next key.`);
          continue;
        }
        if (result.status !== 429) {
          console.warn(`Groq API returned status ${result.status}.`);
        }
      } catch (e) {
        console.warn('Groq API call failed:', e);
      }
    }
  }

  // ── 2차: Gemini (429 시 3초 후 1회 재시도)
  if (!draftText) {
    const geminiKey = process.env.GOOGLE_AI_API_KEY ?? '';
    if (geminiKey) {
      for (const waitMs of [0, 3000]) {
        if (waitMs > 0) await sleep(waitMs);
        try {
          const result = await callGeminiCompletion(geminiKey, upstreamBody);
          if (result.ok && result.text) {
            draftText = result.text;
            break;
          }
          if (result.status === 429) {
            console.warn(waitMs === 0 ? 'Gemini 429, retrying in 3s.' : 'Gemini 429 on retry.');
            continue;
          }
          console.error(`Gemini fallback failed: ${result.status}`);
          break;
        } catch (e) {
          console.error('Gemini fallback error:', e);
        }
      }
    } else {
      console.error('GOOGLE_AI_API_KEY missing; cannot fall back from Groq.');
    }
  }

  // ── 둘 다 실패 시: 사용자에게 안내 메시지 반환
  if (!draftText) {
    const errMsg = 'AI 서버가 현재 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해 주세요.\n\n(Groq 및 Gemini API 한도 초과 — 약 1~2분 후 재시도하면 정상 작동합니다.)';
    if (body.stream) {
      return new Response(streamTextToOpenAiSse(errMsg), {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
      });
    }
    return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: errMsg } }] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Phase 2: Gemini 검수 (LLM_ENABLE_AUDIT=1 일 때만 — 기본 off, TPM 절약)
  const finalText = isLlmAuditEnabled()
    ? await auditAndRefineWithGemini(draftText)
    : cleanLlamaLeakages(draftText);

  // ── 응답 반환
  if (body.stream) {
    return new Response(streamTextToOpenAiSse(finalText), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
  return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: finalText } }] }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
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
