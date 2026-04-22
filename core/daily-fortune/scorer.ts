import { STEM_ELEM } from '../pillar-calc/korean-calendar-engine';
import type { Pillar } from '../pillar-calc/korean-calendar-engine';
import type { ElemIdx, ElementClassification, FortuneLevel } from './types';
import { JIJANG_DETAIL } from './constants';

type RoleKey = 'yongsin' | 'huisin' | 'gisin' | 'gusin' | 'hansin';

const ROLE_SCORES: Record<RoleKey, number> = {
  yongsin: 3,
  huisin:  1,
  hansin:  0,
  gusin:  -1,
  gisin:  -3,
};

export function getRole(elem: ElemIdx, cls: ElementClassification): RoleKey {
  if (elem === cls.yongsin)         return 'yongsin';
  if (cls.huisin.includes(elem))    return 'huisin';
  if (cls.gisin.includes(elem))     return 'gisin';
  if (cls.gusin === elem)           return 'gusin';
  return 'hansin';
}

// 천간·지장간 계층 분리 스코어링
// includeMiddleResidual=false → Phase 1 (본기만)
// includeMiddleResidual=true  → Phase 2 (중기·여기 포함)
export function elementScore(
  ganji: Pillar,
  cls: ElementClassification,
  includeMiddleResidual = false,
): number {
  const jj = JIJANG_DETAIL[ganji.b];
  let total = 0;

  // 천간 (가중치 1.0)
  total += ROLE_SCORES[getRole(STEM_ELEM[ganji.s] as ElemIdx, cls)];

  // 지장간 본기 (가중치 0.7)
  total += ROLE_SCORES[getRole(STEM_ELEM[jj.bongi] as ElemIdx, cls)] * 0.7;

  if (includeMiddleResidual) {
    if (jj.junggi !== undefined)
      total += ROLE_SCORES[getRole(STEM_ELEM[jj.junggi] as ElemIdx, cls)] * 0.2;
    if (jj.yeogi !== undefined)
      total += ROLE_SCORES[getRole(STEM_ELEM[jj.yeogi] as ElemIdx, cls)] * 0.1;
  }

  return total;
}

// 4층 가중 합산 (대운 0.35 · 세운 0.30 · 월운 0.15 · 일진 0.20)
export interface TimeLayerInput {
  daewoon?: Pillar | null;
  year:     Pillar;
  month:    Pillar;
  day:      Pillar;
}

export function totalScore(
  layers: TimeLayerInput,
  cls: ElementClassification,
  includeMiddleResidual = false,
): number {
  const sc = (g: Pillar | null | undefined, w: number) =>
    g ? elementScore(g, cls, includeMiddleResidual) * w : 0;

  return (
    sc(layers.daewoon, 0.35) +
    sc(layers.year,    0.30) +
    sc(layers.month,   0.15) +
    sc(layers.day,     0.20)
  );
}

// 초기 임계값 — 실측 데이터 기반으로 §12 튜닝 예정
const THRESHOLDS = { p80: 3.0, p60: 1.2, p40: -0.3, p20: -1.8 };

export function scoreToLevel(score: number): FortuneLevel {
  if (score >= THRESHOLDS.p80) return '매우 좋음';
  if (score >= THRESHOLDS.p60) return '좋음';
  if (score >= THRESHOLDS.p40) return '보통';
  if (score >= THRESHOLDS.p20) return '주의';
  return '매우 주의';
}
