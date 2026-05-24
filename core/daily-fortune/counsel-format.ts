import {
  STEMS,
  BRANCHES,
  STEMS_H,
  BRANCHES_H,
} from '../pillar-calc/korean-calendar-engine';
import type { DailyFortuneResult } from './types';
import { summarizeEvents } from './events';

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

export function buildTodayFortuneCounselReply(
  f: DailyFortuneCounselPayload,
  counselorName: string,
): string {
  const who = counselorName ? `『${counselorName}』입니다. ` : '';
  const mood =
    f.level === '매우 좋음' || f.level === '좋음'
      ? '전반적으로 기운이 받쳐 주는 날입니다.'
      : f.level === '보통'
        ? '무리하지 않고 리듬을 맞추면 좋은 날입니다.'
        : '속도를 조금 늦추고 선택을 가볍게 하는 편이 좋습니다.';

  return [
    `${who}질문하신 「오늘의 운세」를 입력하신 사주와 오늘 일진으로 풀어 보았습니다.`,
    '',
    '◆ 오늘의 기운',
    `${f.date} · ${f.dayLabel}일(${f.dayHanja}) · 종합 ${f.level}`,
    `${mood} 일진 십신은 ${f.sipsin}이고, ${f.action}`,
  '',
    '◆ 흐름 한눈에',
    `대운 ${f.daewoonSipsin} · 세운 ${f.yearSipsin} · 월운 ${f.monthSipsin} 속에서 오늘은 ${f.sipsin}의 날로 읽힙니다.`,
    f.eventsSummary !== '특이 사항 없음'
      ? `원국과 맞물린 포인트: ${f.eventsSummary}`
      : '원국과 특별히 겹치는 충·합 신호는 크지 않습니다.',
    '',
    '◆ 오늘 이렇게 보면 좋아요',
    f.oneLiner.split(' · ').slice(0, -1).join(' · ').trim()
      || `${f.sipsin} 기운에 맞게 ${f.action}`,
    '',
    '위 내용은 오늘 일진과 사주 흐름을 바탕으로 한 참고 풀이입니다.',
  ].join('\n');
}
