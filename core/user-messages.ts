/** 사용자 화면용 — API·벤더명·장문 안내 없음 */

export const SAJU_WAITING_LABEL = '잠시만 기다리세요.. 확인중입니다';

/** 로딩·대기·LLM 한도 시 동일 문구 */
export const SAJU_THINKING_LABEL = SAJU_WAITING_LABEL;

export const LLM_USER_OVERLOAD_MESSAGE = SAJU_WAITING_LABEL;

export function isSajuWaitingMessage(text: string): boolean {
  const t = text.trim();
  return (
    t === SAJU_WAITING_LABEL
    || t.includes('확인중입니다')
    || t.startsWith('잠시만 기다리세요')
    || t.startsWith('생각중입니다')
  );
}

export function isLlmUserOverloadText(text: string): boolean {
  return (
    isSajuWaitingMessage(text)
    || text.includes('풀이 요청이 많아')
    || text.includes('과부하')
    || text.includes('한도 초과')
  );
}
