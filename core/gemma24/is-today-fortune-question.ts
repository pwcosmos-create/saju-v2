/** 당일·내일·특정 날짜 일운 질문 */

import { kstCalendarDatePlusDays } from '../daily-fortune/kst-date';

const TODAY_FORTUNE_RE =
  /오늘의?\s*운세|오늘\s*운|금일\s*운|일운|오늘\s*기운|오늘\s*하루|today'?s?\s*fortune/i;

const TOMORROW_FORTUNE_RE =
  /내일의?\s*(?:운세|운|기운|하루|사주|일운|일진)|내일\s*운|내일은?\s*어때|내일\s*어떤|다음\s*날\s*운|tomorrow/i;

const SHORT_DAY_ASK_RE =
  /^(?:오늘|내일)(?:은|이|의)?\s*(?:어때|어떤|어떨|좋을|나을|괜찮|어떻)/;

const TOMORROW_EVENT_RE =
  /내일.*(?:이직|면접|결혼|이사|수술|시험|계약|출산|면회)/;

const FORTUNE_ASK_RE = /운세|일운|기운|하루|일진/;

/** 특정 날짜 + 「어때」 등 일운 의도 */
const DATE_FORTUNE_ASK_RE =
  /운세|일운|기운|하루|일진|어때|어떤|어떨|좋을|나을|괜찮|어떻|사주|괜찮을|나을까|알려|궁금|볼까|봐줘/;

const PARTIAL_MONTH_DAY_RE = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/;

export type DayFortuneTarget =
  | { kind: 'offset'; offset: number; label: string }
  | { kind: 'date'; date: Date; label: string };

function calendarDateUtc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/** YYYY년 M월 D일 / YYYY-MM-DD */
export function parseFortuneCalendarDate(message: string): Date | null {
  const t = message.trim();
  const m =
    t.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/)
    ?? t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const y = Number.parseInt(m[1]!, 10);
  const mo = Number.parseInt(m[2]!, 10);
  const d = Number.parseInt(m[3]!, 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return calendarDateUtc(y, mo, d);
}

/** M월 D일 — 연도 생략 시 KST 기준 가장 가까운 미래(또는 오늘) */
export function parsePartialFortuneCalendarDate(message: string): Date | null {
  const t = message.trim();
  if (/\d{4}\s*년/.test(t)) return null;
  const m = t.match(PARTIAL_MONTH_DAY_RE);
  if (!m) return null;
  const mo = Number.parseInt(m[1]!, 10);
  const d = Number.parseInt(m[2]!, 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;

  const today = kstCalendarDatePlusDays(0);
  const y = today.getUTCFullYear();
  const tm = today.getUTCMonth() + 1;
  const td = today.getUTCDate();
  const year = mo < tm || (mo === tm && d < td) ? y + 1 : y;
  return calendarDateUtc(year, mo, d);
}

function formatDateTopicLabel(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return `${y}년 ${m}월 ${d}일 운세`;
}

/** 일운 대상 날짜·표시 라벨 */
export function parseDayFortuneTarget(message: string): DayFortuneTarget | null {
  const t = message.trim();
  if (!t) return null;

  const cal = parseFortuneCalendarDate(t);
  if (cal && DATE_FORTUNE_ASK_RE.test(t)) {
    return { kind: 'date', date: cal, label: formatDateTopicLabel(cal) };
  }

  const partial = parsePartialFortuneCalendarDate(t);
  if (partial && DATE_FORTUNE_ASK_RE.test(t)) {
    return { kind: 'date', date: partial, label: formatDateTopicLabel(partial) };
  }

  if (TOMORROW_EVENT_RE.test(t) && !FORTUNE_ASK_RE.test(t)) return null;

  if (/모레|글피/.test(t) && FORTUNE_ASK_RE.test(t)) {
    return { kind: 'offset', offset: 2, label: '모레의 운세' };
  }
  if (TOMORROW_FORTUNE_RE.test(t)) {
    return { kind: 'offset', offset: 1, label: '내일의 운세' };
  }
  if (/^내일/.test(t) && (t.length <= 32 || /사주|운|기운|하루|어때|좋|어떤/.test(t))) {
    return { kind: 'offset', offset: 1, label: '내일의 운세' };
  }

  if (TODAY_FORTUNE_RE.test(t)) {
    return { kind: 'offset', offset: 0, label: '오늘의 운세' };
  }
  if (/^오늘/.test(t) && (t.length <= 32 || /사주|운|기운|하루|어때|좋|어떤/.test(t))) {
    return { kind: 'offset', offset: 0, label: '오늘의 운세' };
  }

  if (SHORT_DAY_ASK_RE.test(t)) {
    return /^내일/.test(t)
      ? { kind: 'offset', offset: 1, label: '내일의 운세' }
      : { kind: 'offset', offset: 0, label: '오늘의 운세' };
  }

  return null;
}

export function resolveDailyFortuneDate(message: string): Date | null {
  const target = parseDayFortuneTarget(message);
  if (!target) return null;
  if (target.kind === 'date') return target.date;
  return kstCalendarDatePlusDays(target.offset);
}

/** 0=오늘, 1=내일, 2=모레 — 레거시 offset만 (특정 날짜는 null) */
export function parseDayFortuneOffset(message: string): number | null {
  const target = parseDayFortuneTarget(message);
  if (!target || target.kind === 'date') return null;
  return target.offset;
}

export function guessDayFortuneOffsetForPayload(message: string): number | null {
  const target = parseDayFortuneTarget(message);
  if (!target) return null;
  if (target.kind === 'date') return null;
  return target.offset;
}

export function isDayFortuneQuestion(message: string): boolean {
  return parseDayFortuneTarget(message) !== null;
}

export function isTodayFortuneQuestion(message: string): boolean {
  const target = parseDayFortuneTarget(message);
  return target?.kind === 'offset' && target.offset === 0;
}

export function isTomorrowFortuneQuestion(message: string): boolean {
  const target = parseDayFortuneTarget(message);
  return target?.kind === 'offset' && (target.offset === 1 || target.offset === 2);
}

export function dayFortuneTopicLabel(messageOrOffset: string | number): string {
  if (typeof messageOrOffset === 'number') {
    if (messageOrOffset === 1) return '내일의 운세';
    if (messageOrOffset === 2) return '모레의 운세';
    return '오늘의 운세';
  }
  return parseDayFortuneTarget(messageOrOffset)?.label ?? '오늘의 운세';
}
