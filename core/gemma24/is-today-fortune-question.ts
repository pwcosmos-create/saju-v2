/** 당일·내일 등 특정 일자 일운 질문 */

const TODAY_FORTUNE_RE =
  /오늘의?\s*운세|오늘\s*운|금일\s*운|일운|오늘\s*기운|오늘\s*하루|today'?s?\s*fortune/i;

const TOMORROW_FORTUNE_RE =
  /내일의?\s*(?:운세|운|기운|하루|사주|일운|일진)|내일\s*운|내일은?\s*어때|내일\s*어떤|다음\s*날\s*운|tomorrow/i;

const SHORT_DAY_ASK_RE =
  /^(?:오늘|내일)(?:은|이|의)?\s*(?:어때|어떤|어떨|좋을|나을|괜찮|어떻)/;

/** 생활 이벤트만 묻는 내일 질문(일운 아님) */
const TOMORROW_EVENT_RE =
  /내일.*(?:이직|면접|결혼|이사|수술|시험|계약|출산|면회)/;

/** 0=오늘, 1=내일, 2=모레 — 일운 질문이 아니면 null */
export function parseDayFortuneOffset(message: string): number | null {
  const t = message.trim();
  if (!t) return null;

  if (TOMORROW_EVENT_RE.test(t) && !/운세|일운|기운|하루|사주|일진|어때/.test(t)) {
    return null;
  }

  if (/모레|글피/.test(t) && /운|기운|어때|하루|사주/.test(t)) return 2;
  if (TOMORROW_FORTUNE_RE.test(t)) return 1;
  if (/^내일/.test(t) && (t.length <= 32 || /사주|운|기운|하루|어때|좋|어떤/.test(t))) return 1;

  if (TODAY_FORTUNE_RE.test(t)) return 0;
  if (/^오늘/.test(t) && (t.length <= 32 || /사주|운|기운|하루|어때|좋|어떤/.test(t))) return 0;

  if (SHORT_DAY_ASK_RE.test(t)) return /^내일/.test(t) ? 1 : 0;

  return null;
}

/** 클라이언트 일운 payload 전송용 (parse 실패 시 느슨한 매칭) */
export function guessDayFortuneOffsetForPayload(message: string): number | null {
  return parseDayFortuneOffset(message) ?? (/내일|모레|글피/.test(message) ? 1 : /오늘/.test(message) ? 0 : null);
}

export function isDayFortuneQuestion(message: string): boolean {
  return parseDayFortuneOffset(message) !== null;
}

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
