/** 사용자 화면용 — API·벤더명·장문 안내 없음 */

export const SAJU_THINKING_LABEL = '생각중입니다…';

/** LLM 한도 등 실패 시에도 동일 표시 (에러 문구 대신) */
export const LLM_USER_OVERLOAD_MESSAGE = SAJU_THINKING_LABEL;

export function isLlmUserOverloadText(text: string): boolean {
  const t = text.trim();
  return (
    t === SAJU_THINKING_LABEL
    || t.startsWith('생각중입니다')
    || text.includes('풀이 요청이 많아')
    || text.includes('과부하')
    || text.includes('한도 초과')
  );
}
