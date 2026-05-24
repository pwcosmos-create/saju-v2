/** 「오늘의 운세」「일운」 등 당일 운세 질문 */
const TODAY_FORTUNE_RE =
  /오늘의?\s*운세|오늘\s*운|금일\s*운|일운|오늘\s*기운|오늘\s*하루|today'?s?\s*fortune/i;

/** 대운·세운 교육 카드가 아닌 당일 풀이가 필요한 질문 */
export function isTodayFortuneQuestion(message: string): boolean {
  return TODAY_FORTUNE_RE.test(message.trim());
}
