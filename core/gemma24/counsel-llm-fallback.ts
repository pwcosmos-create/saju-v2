/** 상담 LLM 폴백 — always / auto / off */

/** 인증 카드·일운 카드 조합 없이 Gemini 2.5 Flash만 사용 */
export function isCounselGeminiOnlyMode(): boolean {
  return process.env.GEMMA24_COUNSEL_GEMINI_ONLY === '1';
}

export type CounselLlmFallbackMode = '0' | '1' | 'auto';

export function counselLlmFallbackMode(): CounselLlmFallbackMode {
  const raw = (process.env.GEMMA24_COUNSEL_LLM_FALLBACK ?? 'auto').trim();
  if (raw === '1') return '1';
  if (raw === '0') return '0';
  return 'auto';
}

function hasLlmApiKeys(): boolean {
  return Boolean(
    process.env.GROQ_API_KEY
    || process.env.GROQ_API_KEY_1
    || process.env.GOOGLE_AI_API_KEY,
  );
}

/** 카드·엔진으로 답 못 줄 때 Groq/Gemini 사용 여부 */
export function shouldUseCounselLlmFallback(): boolean {
  if (isCounselGeminiOnlyMode()) {
    return Boolean(process.env.GOOGLE_AI_API_KEY?.trim());
  }
  if (process.env.GEMMA24_COUNSEL_CARD_ONLY === '1') return false;
  const mode = counselLlmFallbackMode();
  if (mode === '0') return false;
  if (mode === '1') return true;
  return hasLlmApiKeys();
}
