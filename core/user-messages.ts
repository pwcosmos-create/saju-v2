/** 사용자 화면용 — API·벤더명 노출 없음 */

export const LLM_USER_OVERLOAD_MESSAGE =
  '지금은 풀이 요청이 많아 답변을 이어가기 어렵습니다.\n1~2분 뒤 「다시 분석하기」를 눌러 주세요.';

export function isLlmUserOverloadText(text: string): boolean {
  return (
    text.includes('풀이 요청이 많아')
    || text.includes('과부하')
    || text.includes('한도 초과')
  );
}
