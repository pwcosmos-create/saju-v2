// 사주 계산 메인 진입점 — @orrery/core (진짜만세력 기반) 사용
import { calculateSaju as orreryCalc } from '@orrery/core/saju';
import { SKY, EARTH } from '@orrery/core/constants';
import type { DaewoonItem } from '@orrery/core/types';
import type { OhaengResult } from './five-phase-breakdown';
import { calcOhaeng } from './five-phase-breakdown';
import type { DaeunResult } from './grand-fortune';
import type { Shinsal } from './celestial-relations';
import { checkShinsal } from './celestial-relations';
import type { Pillar } from './korean-calendar-engine';

export interface SajuInput {
  year: number;
  month: number;
  day: number;
  hourTotalMin: number;  // -1 = unknown
  gender: string;
}

export interface SajuResult {
  pillars: (Pillar | null)[];
  ohaeng: OhaengResult;
  daeun: DaeunResult;
  shinsal: Shinsal[];
  input: SajuInput;
  // orrery 확장 데이터
  sipsin?: string[];   // [년,월,일,시] 천간 십신
  unseong?: string[];  // [년,월,일,시] 12운성
  jigang?: string[];   // [년,월,일,시] 지장간
}

// 한자 천간/지지 → 인덱스
function stemIdx(ch: string): number  { return SKY.indexOf(ch); }
function branchIdx(ch: string): number { return EARTH.indexOf(ch); }

// 한자 60갑자 문자열 → {s, b}
function ganziToPillar(ganzi: string): Pillar {
  return { s: stemIdx(ganzi[0]), b: branchIdx(ganzi[1]) };
}

// orrery daewoon → DaeunResult
function mapDaewoon(items: DaewoonItem[], gender: string, yearStem: number): DaeunResult {
  const pillars = items.slice(0, 8).map(d => ganziToPillar(d.ganzi));
  const startAge = items[0]?.age ?? 3;
  const yang = yearStem % 2 === 0;
  const male = gender === '남';
  const forward = (yang && male) || (!yang && !male);
  return { pillars, startAge, forward };
}

export function calculate(input: SajuInput): SajuResult {
  const { year, month, day, hourTotalMin, gender } = input;
  const unknownTime = hourTotalMin < 0;
  const hour   = unknownTime ? 12 : Math.floor(hourTotalMin / 60);
  const minute = unknownTime ? 0  : hourTotalMin % 60;

  const res = orreryCalc({
    year, month, day, hour, minute,
    gender:      gender === '남' ? 'M' : 'F',
    unknownTime,
    jasiMethod: 'split',
  });

  // orrery order: [시(0), 일(1), 월(2), 년(3)] → our: [년(0), 월(1), 일(2), 시(3)]
  const [si, il, wol, nyun] = res.pillars;
  const ordered = [nyun, wol, il, unknownTime ? null : si];
  const pillars: (Pillar | null)[] = ordered.map(p =>
    p ? ganziToPillar(p.pillar.ganzi) : null
  );

  const ohaeng  = calcOhaeng(pillars);
  const daeun   = mapDaewoon(res.daewoon, gender, pillars[0]?.s ?? 0);
  const shinsal = checkShinsal(pillars, pillars[2]?.s ?? 0);

  return {
    pillars, ohaeng, daeun, shinsal, input,
    sipsin:  ordered.map(p => p?.stemSipsin ?? ''),
    unseong: ordered.map(p => p?.unseong    ?? ''),
    jigang:  ordered.map(p => p?.jigang     ?? ''),
  };
}
