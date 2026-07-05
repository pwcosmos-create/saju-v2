/** 인사 즉시응답 — 클라이언트·서버 공용 (무거운 카드 모듈 의존 없음) */

const GREETING_RE =
  /^(안녕|안뇽|하이|헬로|hello|hi|반가|ㅎㅇ|하이요|안녕하세요|안녕하십니까|반갑)[\s!.?~]*$/i;

export function isCounselGreetingMessage(message: string): boolean {
  const t = message.trim();
  return t.length > 0 && t.length <= 24 && GREETING_RE.test(t);
}

export function isCounselGreetingReply(content: string): boolean {
  const t = content.trim();
  return (
    t.length <= 280
    && /사주·운세 상담을 도와드립니다|편하게 말씀해 주세요|궁금한 점을 편하게/.test(t)
  );
}

export function buildGreetingReply(counselorName: string): string {
  const who = counselorName ? `『${counselorName}』입니다. ` : '';
  return [
    `안녕하세요. ${who}사주·운세 상담을 도와드립니다.`,
    '연애, 재물, 직업, 올해·시기 운세처럼 궁금한 점을 편하게 말씀해 주세요.',
  ].join('\n');
}
