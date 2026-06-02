/** 특정 연도·올해 세운(年運) 질문 */

import { kstCalendarDatePlusDays } from '../daily-fortune/kst-date';

const YEAR_FORTUNE_ASK_RE =
  /운세|운|기운|흐름|세운|사주|어때|어떤|어떨|좋을|나을|괜찮|어떻|전망|예상/;

const HAS_MONTH_DAY_RE = /\d{1,2}\s*월\s*\d{1,2}\s*일/;

/** YYYY년 운세 / 올해 운세 — 월·일 없는 연 단위 질문 */
export function parseYearFortuneYear(message: string): number | null {
  const t = message.trim();
  if (!t || HAS_MONTH_DAY_RE.test(t)) return null;

  const yMatch = t.match(/(\d{4})\s*년/);
  if (yMatch && YEAR_FORTUNE_ASK_RE.test(t)) {
    const y = Number.parseInt(yMatch[1]!, 10);
    if (y >= 1900 && y <= 2100) return y;
  }

  const thisYear = kstCalendarDatePlusDays(0).getUTCFullYear();

  if (/내년|내녴|다음\s*해|next\s*year/i.test(t) && YEAR_FORTUNE_ASK_RE.test(t)) {
    return thisYear + 1;
  }
  if (/작년|지난해|last\s*year/i.test(t) && YEAR_FORTUNE_ASK_RE.test(t)) {
    return thisYear - 1;
  }
  if (/올해|금년|this\s*year/i.test(t) && YEAR_FORTUNE_ASK_RE.test(t)) {
    return thisYear;
  }

  return null;
}

export function yearFortuneTopicLabel(year: number): string {
  return `${year}년 운세`;
}

export function yearFortuneCardTitle(year: number): string {
  return `해석·${year}년 세운`;
}

export function isYearFortuneQuestion(message: string): boolean {
  return parseYearFortuneYear(message) !== null;
}
