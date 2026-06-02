import {
  calcYear, calcMonth, calcDay,
  STEM_ELEM,
} from '../pillar-calc/korean-calendar-engine';
import type { Pillar } from '../pillar-calc/korean-calendar-engine';
import type { SajuResult } from '../pillar-calc/main-calculator';
import type { DaeunResult } from '../pillar-calc/grand-fortune';
import type { DailyFortuneResult } from './types';
import { calcStrength, classifyElements, getSipsin } from './classifier';
import { totalScore, scoreToLevel } from './scorer';
import { detectEvents, summarizeEvents, type NatalInfo } from './events';
import { SIPSIN_ACTION } from './constants';

// 현재 대운 기둥 조회
function getCurrentDaeun(daeun: DaeunResult, birthYear: number, currentYear: number): Pillar | null {
  const age = currentYear - birthYear;
  const idx = Math.floor((age - daeun.startAge) / 10);
  if (idx < 0 || idx >= daeun.pillars.length) return null;
  return daeun.pillars[idx];
}

// ── 메인 진입점
export function dailyFortune(
  natal: SajuResult,
  today: Date = new Date(),
): DailyFortuneResult {
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const d = today.getDate();

  // 일주 확인
  const dp = natal.pillars[2];
  if (!dp) throw new Error('일주 없음 — 생년월일을 먼저 입력하세요.');
  const dayStemIdx = dp.s;
  const dayElemIdx = STEM_ELEM[dayStemIdx];

  // 신강/신약
  const { isWeak } = calcStrength(natal.pillars, dayElemIdx);

  // 오행 분류 (동적)
  const cls = classifyElements(dayStemIdx, isWeak, natal.ohaeng.counts);

  // 시간축 4층
  const dayGanji   = calcDay(y, m, d);
  const monthGanji = calcMonth(y, m, d);
  const yearGanji  = calcYear(y, m, d);
  const daeunGanji = getCurrentDaeun(natal.daeun, natal.input.year, y);

  // 스코어
  const score = totalScore(
    { daewoon: daeunGanji, year: yearGanji, month: monthGanji, day: dayGanji },
    cls,
    false, // Phase 1: 본기만
  );
  const level = scoreToLevel(score);

  // 십신 (일진 천간 기준)
  const sipsin = getSipsin(dayStemIdx, dayGanji.s);

  // 행동 가이드
  const strengthKey: '신강' | '신약' = isWeak ? '신약' : '신강';
  const action = SIPSIN_ACTION[sipsin]?.[strengthKey] ?? '—';

  // 배경 십신 (대운·세운·월운 천간 기준)
  const daewoonSipsin = daeunGanji ? getSipsin(dayStemIdx, daeunGanji.s) : '—';
  const yearSipsin    = getSipsin(dayStemIdx, yearGanji.s);
  const monthSipsin   = getSipsin(dayStemIdx, monthGanji.s);

  // 원국 지지·천간 수집 (이벤트 탐지용)
  const natalInfo: NatalInfo = {
    branches:    natal.pillars.filter(Boolean).map(p => p!.b),
    stems:       natal.pillars.filter(Boolean).map(p => p!.s),
    monthBranch: natal.pillars[1]?.b ?? 0,
  };
  const events = detectEvents(dayGanji.b, natalInfo);

  // 한 줄 요약
  const oneLiner = `${yearSipsin} 흐름에 ${sipsin}일 · ${summarizeEvents(events)} · ${level}`;

  const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return {
    date: dateStr,
    dayGanji,
    score,
    level,
    sipsin,
    action,
    events,
    background: { daewoonSipsin, yearSipsin, monthSipsin },
    oneLiner,
    classification: cls,
  };
}

export type { DailyFortuneResult } from './types';
export { getSipsin } from './classifier';
