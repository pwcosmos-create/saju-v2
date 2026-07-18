/** Gemini TTS 모델 — env `GEMINI_TTS_MODEL` 로 pro 복귀 가능 */
export const GEMINI_TTS_MODEL_DEFAULT = 'gemini-2.5-flash-preview-tts';
export const GEMINI_TTS_MODEL_PRO = 'gemini-2.5-pro-preview-tts';

/** TTS 전용 키 우선 — 상담 LLM coach 키(429)보다 메인 결제 키를 먼저 시도 */
export function resolveGeminiTtsApiKeys(): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  const add = (raw?: string) => {
    const k = raw?.trim();
    if (!k || seen.has(k)) return;
    seen.add(k);
    keys.push(k);
  };
  add(process.env.GOOGLE_AI_TTS_API_KEY);
  add(process.env.GOOGLE_AI_API_KEY);
  add(process.env.GOOGLE_AI_COUNSEL_API_KEY);
  add(process.env.GEMINI_COUNSEL_COACH_API_KEY);
  return keys;
}

export function isRetryableGeminiTtsError(status: number, body: string): boolean {
  if (status === 429 || status === 503) return true;
  return /quota|rate.?limit|RESOURCE_EXHAUSTED|exceeded your current quota/i.test(body);
}

export function resolveGeminiTtsModel(): string {
  const raw = process.env.GEMINI_TTS_MODEL?.trim();
  if (raw === GEMINI_TTS_MODEL_PRO || raw === GEMINI_TTS_MODEL_DEFAULT) return raw;
  return GEMINI_TTS_MODEL_DEFAULT;
}

export function geminiTtsGenerateUrl(model: string, apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
}
