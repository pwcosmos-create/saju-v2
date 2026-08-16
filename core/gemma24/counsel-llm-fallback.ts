/** 인증 카드·일운 카드 조합 없이 Gemini 2.5 Flash AI만 사용 */
export function isCounselGeminiOnlyMode(): boolean {
  if (process.env.GEMMA24_COUNSEL_CARD_ONLY === '1') return false;
  return true;
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

/** IAP 결제 후 시작된 상담 세션 */
export function isPaidCounselSession(sessionStartedAt: number | null): boolean {
  return sessionStartedAt != null && Number.isFinite(sessionStartedAt) && sessionStartedAt > 0;
}

/** 유료 상담 세션·GEMINI_ONLY — 카드 조합 대신 Gemini 2.5 Flash로 답변 */
export function useCounselGeminiLlm(sessionStartedAt: number | null): boolean {
  if (isCounselGeminiOnlyMode()) return true;
  return isPaidCounselSession(sessionStartedAt);
}

/** 카드·엔진으로 답 못 줄 때 Groq/Gemini 사용 여부 */
export function shouldUseCounselLlmFallback(sessionStartedAt: number | null = null): boolean {
  if (useCounselGeminiLlm(sessionStartedAt)) {
    return Boolean(getCounselGeminiApiKey());
  }
  if (process.env.GEMMA24_COUNSEL_CARD_ONLY === '1') return false;
  const mode = counselLlmFallbackMode();
  if (mode === '0') return false;
  if (mode === '1') return true;
  return hasLlmApiKeys();
}

/** 유료 상담 LLM — 풀이용 GOOGLE_AI_API_KEY 와 분리 (429·지연 완화) */
export function getCounselGeminiApiKey(): string {
  return (
    process.env.GOOGLE_AI_COUNSEL_API_KEY?.trim()
    || process.env.GEMINI_COUNSEL_COACH_API_KEY?.trim()
    || process.env.GOOGLE_AI_API_KEY?.trim()
    || ''
  );
}
