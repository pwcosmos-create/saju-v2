import { calculate, type SajuInput } from '../pillar-calc/main-calculator';
import { dailyFortune } from './index';
import { dailyFortuneToCounselPayload, type DailyFortuneCounselPayload } from './counsel-format';
import { kstCalendarDatePlusDays } from './kst-date';

/** 상담용 sajuContext 문자열 → SajuInput */
export function parseSajuInputFromContext(context: string): SajuInput | null {
  const m = context.match(
    /생년월일:\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*\((남|여)성\)/,
  );
  if (!m) return null;
  return {
    year: Number.parseInt(m[1]!, 10),
    month: Number.parseInt(m[2]!, 10),
    day: Number.parseInt(m[3]!, 10),
    hourTotalMin: -1,
    gender: m[4] === '여' ? '여' : '남',
  };
}

/** 클라이언트 dailyFortune 누락 시 서버에서 일운 재계산 */
export function tryDailyFortuneFromSajuContext(
  sajuContext: string,
  when: Date | number,
): DailyFortuneCounselPayload | null {
  const input = parseSajuInputFromContext(sajuContext);
  if (!input) return null;
  const targetDate =
    typeof when === 'number' ? kstCalendarDatePlusDays(when) : when;
  try {
    const natal = calculate(input);
    return dailyFortuneToCounselPayload(dailyFortune(natal, targetDate));
  } catch {
    return null;
  }
}
