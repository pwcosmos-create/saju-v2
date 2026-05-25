/** 당일·내일 등 특정 일자 일운 질문 */

const TODAY_FORTUNE_RE =
  /오늘의?\s*운세|오늘\s*운|금일\s*운|일운|오늘\s*기운|오늘\s*하루|today'?s?\s*fortune/i;

const TOMORROW_FORTUNE_RE =
  /내일의?\s*운세|내일\s*운|내일\s*기운|내일\s*하루|내일은?\s*어때|내일\s*어떤|다음\s*날\s*운|tomorrow/i;

const SHORT_DAY_ASK_RE =
  /^(?:오늘|내일)(?:은|이|의)?\s*(?:어때|어떤|어떨|좋을|나을|괜찮|어떻)/;

/** 0=오늘, 1=내일, 2=모레 — 일운 질문이 아니면 null */
export function parseDayFortuneOffset(message: string): number | null {
  const t = message.trim();
  if (!t) return null;
  if (/모레|글피/.test(t) && /운|기운|어때|하루/.test(t)) return 2;
  if (TOMORROW_FORTUNE_RE.test(t) || /^내일/.test(t) && /어때|운|기운|하루|좋/.test(t)) return 1;
  if (TODAY_FORTUNE_RE.test(t) || /^오늘/.test(t) && /어때|운|기운|하루|좋/.test(t)) return 0;
  if (SHORT_DAY_ASK_RE.test(t)) return /^내일/.test(t) ? 1 : 0;
  return null;
}

export function isDayFortuneQuestion(message: string): boolean {
  return parseDayFortuneOffset(message) !== null;
}

/** 대운·세운 교육 카드가 아닌 당일 풀이가 필요한 질문 */
export function isTodayFortuneQuestion(message: string): boolean {
  return parseDayFortuneOffset(message) === 0;
}

export function isTomorrowFortuneQuestion(message: string): boolean {
  const o = parseDayFortuneOffset(message);
  return o === 1 || o === 2;
}

export function dayFortuneTopicLabel(offset: number): string {
  if (offset === 1) return '내일의 운세';
  if (offset === 2) return '모레의 운세';
  return '오늘의 운세';
}
