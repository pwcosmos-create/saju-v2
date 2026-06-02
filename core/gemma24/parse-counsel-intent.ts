/**
 * 상담 질문 의도 — 일운·세운·주제(연애·직업 등) 통합 판별
 */
import { isDayFortuneQuestion, parseDayFortuneTarget } from './is-today-fortune-question';
import { isYearFortuneQuestion, parseYearFortuneYear } from './is-year-fortune-question';
import { pickConsultDeepIds } from './saju-knowledge';

const TOPIC_LABEL: Record<number, string> = {
  1: '성향',
  2: '사주 전체',
  3: '격국·십신',
  4: '오행',
  5: '용신·기신',
  6: '운세·시기',
  7: '재물',
  8: '연애·관계',
  9: '직업',
  10: '건강',
};

/** 맥락 없는 일반 운세 질문 */
const GENERAL_FORTUNE_RE =
  /운세|운\s*(?:좀|알려|어때|어떤|궁금)|사주\s*(?:봐|봐줘|풀이|해석)|명리|팔자\s*(?:풀이|봐)/;

export type CounselTopicIntent = {
  deepIds: number[];
  label: string;
};

/** 사업·매출 운세 질문 (일반 「직업」 백과와 구분) */
const BUSINESS_FORTUNE_RE =
  /사업운|사업\s*운|창업운|매출운|거래운|사업\s*(?:은|가|를|좀|어때|어떤|궁금)/;

/** 일·연 운세가 아닌 주제 상담 (연애·이직·재물 등) */
export function parseCounselTopicIntent(message: string): CounselTopicIntent | null {
  const t = message.trim();
  if (!t) return null;
  if (isDayFortuneQuestion(t) || isYearFortuneQuestion(t)) return null;

  if (BUSINESS_FORTUNE_RE.test(t)) {
    return { deepIds: [9], label: '사업운' };
  }

  const deepIds = pickConsultDeepIds(t);
  if (deepIds.length) {
    const label = TOPIC_LABEL[deepIds[0]!] ?? '사주';
    return { deepIds, label };
  }

  if (GENERAL_FORTUNE_RE.test(t) && t.length <= 48) {
    return { deepIds: [6], label: '운세·흐름' };
  }

  return null;
}

export function hasSpecificCounselIntent(message: string): boolean {
  return (
    parseDayFortuneTarget(message) !== null
    || parseYearFortuneYear(message) !== null
    || parseCounselTopicIntent(message) !== null
  );
}

export function counselIntentTopicLabel(message: string): string {
  const day = parseDayFortuneTarget(message);
  if (day) return day.label;
  const year = parseYearFortuneYear(message);
  if (year !== null) return `${year}년 운세`;
  const topic = parseCounselTopicIntent(message);
  if (topic) return topic.label;
  return '사주';
}
