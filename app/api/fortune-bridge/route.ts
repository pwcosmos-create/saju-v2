import { NextRequest } from 'next/server';
import { fetchLlmCompletionText } from '../../../core/config/llm';
import {
  buildCouncilHybridFortune,
  buildCouncilHybridFortuneOfflineOnly,
  tryCouncilHybridBase,
} from '../../../core/gemma24/council-fortune-hybrid';
import { buildGemma24KnowledgeResult } from '../../../core/gemma24/saju-knowledge';
import { makeRateLimiter } from '../../../core/http-client/rate-limit';
import { tossBridgeHtml } from '../../../core/http-client/toss-bridge-html';
import { isLlmUserOverloadText } from '../../../core/user-messages';

const SYSTEM = `당신은 대한민국 최고의 사주팔자 명리학 전문가입니다.
사용자의 사주 분석 결과를 전문적이면서도 따뜻한 상담가의 어조로 풀어주세요.`;

const checkRateLimit = makeRateLimiter(5, 600_000);
/** LLM 보충 대기 후 규칙 기반 6~10번까지 채움 (1~5만 반환하지 않음) */
const HYBRID_LLM_DEADLINE_MS = 25_000;
const LLM_BUSY_ERROR = 'AI 서버가 혼잡합니다. 1~2분 후 다시 시도해 주세요.';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return tossBridgeHtml({ ok: false, error: '요청 한도 초과. 1분 후 다시 시도해주세요.' }, 429);
  }

  let prompt = '';
  try {
    const ct = req.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      const body = await req.json();
      prompt = typeof body.prompt === 'string' ? body.prompt.slice(0, 20000) : '';
    } else {
      const fd = await req.formData();
      const raw = fd.get('payload');
      if (raw && typeof raw === 'string') {
        const parsed = JSON.parse(raw) as { prompt?: string };
        prompt = typeof parsed.prompt === 'string' ? parsed.prompt.slice(0, 20000) : '';
      }
    }
  } catch {
    return tossBridgeHtml({ ok: false, error: '잘못된 요청 형식' }, 400);
  }

  if (!prompt) return tossBridgeHtml({ ok: false, error: 'prompt 없음' }, 400);

  try {
    const hybridBase = tryCouncilHybridBase(prompt);
    if (hybridBase) {
      const councilHybrid = await Promise.race([
        buildCouncilHybridFortune(prompt, hybridBase),
        new Promise<ReturnType<typeof buildCouncilHybridFortuneOfflineOnly>>((resolve) => {
          setTimeout(
            () => resolve(buildCouncilHybridFortuneOfflineOnly(prompt, hybridBase)),
            HYBRID_LLM_DEADLINE_MS,
          );
        }),
      ]);
      if (councilHybrid?.text && !isLlmUserOverloadText(councilHybrid.text)) {
        return tossBridgeHtml({ ok: true, content: councilHybrid.text });
      }
    }

    const gemma24 = buildGemma24KnowledgeResult(prompt, { certifiedOnly: true });
    const system = gemma24.systemAppend ? `${SYSTEM}\n\n${gemma24.systemAppend}` : SYSTEM;
    const text = await fetchLlmCompletionText(
      {
        max_tokens: 3000,
        temperature: 0.7,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      },
      { geminiFirst: true },
    );
    if (!text || isLlmUserOverloadText(text)) {
      return tossBridgeHtml({ ok: false, error: LLM_BUSY_ERROR }, 503);
    }
    return tossBridgeHtml({ ok: true, content: text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return tossBridgeHtml({ ok: false, error: msg }, 500);
  }
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
