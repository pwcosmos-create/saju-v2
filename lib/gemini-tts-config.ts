/** Gemini TTS 모델 — env `GEMINI_TTS_MODEL` 로 pro 복귀 가능 */
export const GEMINI_TTS_MODEL_DEFAULT = 'gemini-2.5-flash-preview-tts';
export const GEMINI_TTS_MODEL_PRO = 'gemini-2.5-pro-preview-tts';

export function resolveGeminiTtsModel(): string {
  const raw = process.env.GEMINI_TTS_MODEL?.trim();
  if (raw === GEMINI_TTS_MODEL_PRO || raw === GEMINI_TTS_MODEL_DEFAULT) return raw;
  return GEMINI_TTS_MODEL_DEFAULT;
}

export function geminiTtsGenerateUrl(model: string, apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
}
