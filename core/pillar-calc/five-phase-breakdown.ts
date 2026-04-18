import { Pillar, STEM_ELEM, BRANCH_ELEM, ELEM_NAMES, ELEM_NAMES_H } from './korean-calendar-engine';

export interface OhaengResult {
  counts: number[];  // [목,화,토,금,수]
  strongest: number;
  weakest: number;
  detail: string;
}

export function calcOhaeng(pillars: (Pillar | null)[]): OhaengResult {
  const counts = [0, 0, 0, 0, 0];
  for (const p of pillars) {
    if (p) { counts[STEM_ELEM[p.s]]++; counts[BRANCH_ELEM[p.b]]++; }
  }
  const strongest = counts.indexOf(Math.max(...counts));
  const weakest   = counts.indexOf(Math.min(...counts));
  return { counts, strongest, weakest, detail: buildDetail(counts, strongest, weakest) };
}

function buildDetail(counts: number[], strong: number, weak: number): string {
  const strongDescs = [
    '창의적 에너지와 성장 욕구가 강하게 발현됩니다.',
    '열정과 표현 욕구가 활발하게 작용합니다.',
    '안정을 추구하고 현실적으로 행동하는 경향이 강합니다.',
    '원칙과 정의를 중시하며 완벽을 추구하는 성향이 강합니다.',
    '지혜와 유연한 사고로 상황을 깊이 분석하는 경향이 강합니다.',
  ];
  const weakAdvice = [
    '목(木) 기운을 보완하려면 초록색 식물을 곁에 두거나 숲속 산책을 즐겨보세요.',
    '화(火) 기운을 보완하려면 따뜻한 색상의 조명이나 촛불을 활용해보세요.',
    '토(土) 기운을 보완하려면 도자기 소품이나 노란색·황토색 계열을 생활에 더하세요.',
    '금(金) 기운을 보완하려면 금속 소품이나 흰색 계열의 인테리어를 더해보세요.',
    '수(水) 기운을 보완하려면 작은 수조나 분수, 파란색 계열 소품을 활용해보세요.',
  ];
  return `${ELEM_NAMES[strong]}(${ELEM_NAMES_H[strong]}) 기운이 가장 강하게 작용합니다. ${strongDescs[strong]} 반면 ${ELEM_NAMES[weak]}(${ELEM_NAMES_H[weak]}) 기운은 상대적으로 부족합니다. ${weakAdvice[weak]}`;
}
