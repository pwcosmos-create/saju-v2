import {
  STEMS,
  BRANCHES,
  STEMS_H,
  BRANCHES_H,
} from '../pillar-calc/korean-calendar-engine';
import type { DailyFortuneResult } from './types';
import { summarizeEvents } from './events';

export const TODAY_FORTUNE_CARD_TITLE = '해석·오늘 일운';
export const TOMORROW_FORTUNE_CARD_TITLE = '해석·내일 일운';

export type DayFortuneLabel = '오늘' | '내일' | '모레';

export function dayFortuneCardTitle(day: DayFortuneLabel): string {
  if (day === '내일') return TOMORROW_FORTUNE_CARD_TITLE;
  if (day === '모레') return '해석·모레 일운';
  return TODAY_FORTUNE_CARD_TITLE;
}

export type DayFortuneTargetRef =
  | { kind: 'offset'; offset: number }
  | { kind: 'date'; date: Date };

export function dayFortuneCardTitleForTarget(target: DayFortuneTargetRef): string {
  if (target.kind === 'date') {
    const y = target.date.getUTCFullYear();
    const m = target.date.getUTCMonth() + 1;
    const d = target.date.getUTCDate();
    return `해석·${y}년 ${m}월 ${d}일 일운`;
  }
  return dayFortuneCardTitle(offsetToDayLabel(target.offset));
}

export function dayFortuneTopic(day: DayFortuneLabel): string {
  if (day === '내일') return '내일의 운세';
  if (day === '모레') return '모레의 운세';
  return '오늘의 운세';
}

export function isTodayFortuneDisplayCard(card: { title: string }): boolean {
  const t = card.title.trim();
  return (
    t === TODAY_FORTUNE_CARD_TITLE
    || t === TOMORROW_FORTUNE_CARD_TITLE
    || /해석·(?:오늘|내일|모레)\s*일운/.test(t)
  );
}

export type DailyFortuneCounselPayload = {
  date: string;
  dayLabel: string;
  dayHanja: string;
  level: string;
  score: number;
  sipsin: string;
  action: string;
  oneLiner: string;
  eventsSummary: string;
  daewoonSipsin: string;
  yearSipsin: string;
  monthSipsin: string;
};

export function dailyFortuneToCounselPayload(f: DailyFortuneResult): DailyFortuneCounselPayload {
  const s = f.dayGanji.s;
  const b = f.dayGanji.b;
  return {
    date: f.date,
    dayLabel: `${STEMS_H[s]}${BRANCHES_H[b]}`,
    dayHanja: `${STEMS[s]}${BRANCHES[b]}`,
    level: f.level,
    score: f.score,
    sipsin: f.sipsin,
    action: f.action,
    oneLiner: f.oneLiner,
    eventsSummary: summarizeEvents(f.events),
    daewoonSipsin: f.background.daewoonSipsin,
    yearSipsin: f.background.yearSipsin,
    monthSipsin: f.background.monthSipsin,
  };
}

function dayFortuneTitleAndTopic(day: DayFortuneLabel | string): { title: string; topic: string } {
  if (typeof day === 'string' && /\d{4}\s*년/.test(day)) {
    const title = `해석·${day} 일운`;
    return { title, topic: `${day} 운세` };
  }
  const label = day as DayFortuneLabel;
  return { title: dayFortuneCardTitle(label), topic: dayFortuneTopic(label) };
}

/** PASS 카드 없을 때 즉석 제작·상담 답변용 초안 */
export function buildDayFortuneCardDraft(
  f: DailyFortuneCounselPayload,
  day: DayFortuneLabel | string = '오늘',
): {
  title: string;
  summary: string;
  body: string;
  tags: string[];
} {
  const { title, topic } = dayFortuneTitleAndTopic(day);
  const dayWord = typeof day === 'string' ? day.replace(/\s*운세\s*$/, '').trim() || day : day;
  const mood =
    f.level === '매우 좋음' || f.level === '좋음'
      ? '전반적으로 기운이 받쳐 주는 날입니다.'
      : f.level === '보통'
        ? '무리하지 않고 리듬을 맞추면 좋은 날입니다.'
        : '속도를 조금 늦추고 선택을 가볍게 하는 편이 좋습니다.';
  const flowTip =
    f.oneLiner.split(' · ').slice(0, -1).join(' · ').trim()
      || `${f.sipsin} 기운에 맞게 ${f.action}`;
  const eventsLine =
    f.eventsSummary !== '특이 사항 없음'
      ? `원국과 맞물린 포인트: ${f.eventsSummary}`
      : '원국과 특별히 겹치는 충·합 신호는 크지 않습니다.';

  return {
    title,
    summary: `${f.date} ${f.dayLabel}일 · ${f.level} — ${topic} 맞춤 해석`,
    body: `「${title}」
【개요】${f.date} · ${f.dayLabel}일(${f.dayHanja}) · 종합 ${f.level}
【핵심】${mood} 일진 십신은 ${f.sipsin}이고, ${f.action}
대운 ${f.daewoonSipsin} · 세운 ${f.yearSipsin} · 월운 ${f.monthSipsin} 속에서 ${dayWord}은 ${f.sipsin}의 날로 읽힙니다.
${eventsLine}
【실천】${flowTip}
키워드: ${topic}, 일운, 일진, ${f.sipsin}, ${f.date}`,
    tags: ['해석', '일운', topic, f.date],
  };
}

/** Gemini 상담 system 프롬프트용 — 카드 문구 복사 없이 사실 데이터만 */
export function formatDailyFortuneCounselForLlm(f: DailyFortuneCounselPayload): string {
  const draft = buildDayFortuneCardDraft(f);
  return `【일운 산출 데이터 — 아래 수치·날짜를 사실로 활용하고, 자연스러운 대화체로 풀어 쓸 것】\n${draft.body}`;
}

/** 유료 상담 — 사주 카드·템플릿 없이 실시간 일운 사실만 전달 */
export function formatDailyFortuneFactsForPaidLlm(
  f: DailyFortuneCounselPayload,
  topicLabel: string,
): string {
  return `【실시간 일운 계산 — ${topicLabel}】
- 날짜: ${f.date}
- 일진: ${f.dayLabel}(${f.dayHanja})
- 종합: ${f.level}
- 일진 십신: ${f.sipsin}
- 행동 조언: ${f.action}
- 한줄 요약: ${f.oneLiner}
- 원국 이벤트: ${f.eventsSummary}
- 대운·세운·월운 십신: ${f.daewoonSipsin} / ${f.yearSipsin} / ${f.monthSipsin}`;
}

export function buildDayFortuneCounselReply(
  f: DailyFortuneCounselPayload,
  counselorName: string,
  day: DayFortuneLabel | string = '오늘',
): string {
  const who = counselorName ? `『${counselorName}』입니다. ` : '';
  const topic =
    typeof day === 'string' && /운세/.test(day)
      ? day
      : dayFortuneTopic(day as DayFortuneLabel);
  const dayWord =
    typeof day === 'string'
      ? day.replace(/\s*운세\s*$/, '').trim() || day
      : day;
  const mood =
    f.level === '매우 좋음' || f.level === '좋음'
      ? '전반적으로 기운이 받쳐 주는 날입니다.'
      : f.level === '보통'
        ? '무리하지 않고 리듬을 맞추면 좋은 날입니다.'
        : '속도를 조금 늦추고 선택을 가볍게 하는 편이 좋습니다.';

  return [
    `${who}질문하신 「${topic}」를 입력하신 사주와 ${dayWord} 일진으로 풀어 보았습니다.`,
    '',
    `◆ ${dayWord}의 기운`,
    `${f.date} · ${f.dayLabel}일(${f.dayHanja}) · 종합 ${f.level}`,
    `${mood} 일진 십신은 ${f.sipsin}이고, ${f.action}`,
    '',
    '◆ 흐름 한눈에',
    `대운 ${f.daewoonSipsin} · 세운 ${f.yearSipsin} · 월운 ${f.monthSipsin} 속에서 ${dayWord}은 ${f.sipsin}의 날로 읽힙니다.`,
    f.eventsSummary !== '특이 사항 없음'
      ? `원국과 맞물린 포인트: ${f.eventsSummary}`
      : '원국과 특별히 겹치는 충·합 신호는 크지 않습니다.',
    '',
    `◆ ${dayWord} 이렇게 보면 좋아요`,
    f.oneLiner.split(' · ').slice(0, -1).join(' · ').trim()
      || `${f.sipsin} 기운에 맞게 ${f.action}`,
    '',
    `위 내용은 ${dayWord} 일진과 사주 흐름을 바탕으로 한 참고 풀이입니다.`,
  ].join('\n');
}

export function buildTodayFortuneCardDraft(f: DailyFortuneCounselPayload) {
  return buildDayFortuneCardDraft(f, '오늘');
}

export function buildTodayFortuneCounselReply(
  f: DailyFortuneCounselPayload,
  counselorName: string,
) {
  return buildDayFortuneCounselReply(f, counselorName, '오늘');
}

export function offsetToDayLabel(offset: number): DayFortuneLabel {
  if (offset === 1) return '내일';
  if (offset === 2) return '모레';
  return '오늘';
}
