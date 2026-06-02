import { STEM_ELEM, BRANCH_ELEM } from '../pillar-calc/korean-calendar-engine';
import type { Pillar } from '../pillar-calc/korean-calendar-engine';
import type { ElemIdx, ElementClassification } from './types';
import { GENERATES, CONTROLS, CONTROLLED_BY, YONGSIN_TABLE } from './constants';

// ── 신강/신약 가중 계산 (월지 3배, 일지 2배)
export function calcStrength(
  pillars: (Pillar | null)[],
  dayElem: number,
): { score: number; isWeak: boolean } {
  const [yp, mp, dp, hp] = pillars;
  const positions = [
    yp ? { elem: STEM_ELEM[yp.s],   w: 1 } : null,
    yp ? { elem: BRANCH_ELEM[yp.b], w: 1 } : null,
    mp ? { elem: STEM_ELEM[mp.s],   w: 1 } : null,
    mp ? { elem: BRANCH_ELEM[mp.b], w: 3 } : null,
    dp ? { elem: BRANCH_ELEM[dp.b], w: 2 } : null,
    hp ? { elem: STEM_ELEM[hp.s],   w: 1 } : null,
    hp ? { elem: BRANCH_ELEM[hp.b], w: 1 } : null,
  ].filter(Boolean) as { elem: number; w: number }[];

  let support = 0, drain = 0;
  for (const { elem, w } of positions) {
    if (elem === dayElem)                 support += w; // 비겁
    else if (GENERATES[elem] === dayElem) support += w; // 인성
    else if (GENERATES[dayElem] === elem) drain   += w; // 식상
    else if (CONTROLS[dayElem] === elem)  drain   += w; // 재성
    else if (CONTROLS[elem] === dayElem)  drain   += w; // 관성
  }

  const score = support - drain;
  return { score, isWeak: score <= 0 };
}

// ── 조후(調候) 보정 필요 오행 감지
export function detectJohoo(elemCounts: number[], dayElem: number): ElemIdx | null {
  const [목, 화, , 금, 수] = elemCounts;

  if (화 >= 2 && (dayElem === 3 || dayElem === 2)) return 4; // 금·토일간 과열 → 수
  if (수 >= 3 && (dayElem === 0 || dayElem === 1)) return 1; // 목·화일간 과랭 → 화
  if (금 + 수 >= 4) return 1;                                 // 한습 → 화
  if (목 + 화 >= 5) return 4;                                 // 과조 → 수
  return null;
}

// ── 5분류 동적 분류
export function classifyElements(
  dayStemIdx: number,
  isWeak: boolean,
  elemCounts: number[],
): ElementClassification {
  const key: '신약' | '신강' = isWeak ? '신약' : '신강';
  const base = YONGSIN_TABLE[dayStemIdx]?.[key];
  if (!base) throw new Error(`용신 테이블 누락: ${dayStemIdx}`);

  const yongsin = base.primary[0] as ElemIdx;
  const huisin  = [...base.secondary] as ElemIdx[];
  const dayElem = STEM_ELEM[dayStemIdx];

  // 조후 희신 승격
  const johoo = detectJohoo(elemCounts, dayElem);
  if (johoo !== null && !huisin.includes(johoo) && johoo !== yongsin) {
    huisin.push(johoo);
  }

  // 기신 = 용신을 극하는 오행
  const baseGisin = CONTROLLED_BY[yongsin] as ElemIdx;

  // 구신 = 1순위 희신을 극하는 오행 (기신의 조력이 아닌 희신의 적)
  const primaryHuisin = base.secondary[0] as ElemIdx | undefined;
  const baseGusin: ElemIdx | null = primaryHuisin !== undefined
    ? CONTROLLED_BY[primaryHuisin] as ElemIdx
    : null;

  // 구신 승격: 원국에 구신이 2개 이상이면 기신으로 격상
  const gisinList: ElemIdx[] = [baseGisin];
  let gusin: ElemIdx | null = baseGusin;
  if (baseGusin !== null && elemCounts[baseGusin] >= 2) {
    gisinList.push(baseGusin);
    gusin = null;
  }

  // 한신 = 나머지
  const assigned = new Set<ElemIdx>([yongsin, ...huisin, ...gisinList, ...(gusin !== null ? [gusin] : [])]);
  const hansin = ([0, 1, 2, 3, 4] as ElemIdx[]).filter(e => !assigned.has(e));

  return { yongsin, huisin, gisin: gisinList, gusin, hansin };
}

// ── 천간 기준 십신 계산
export function getSipsin(dayStemIdx: number, targetStemIdx: number): string {
  const dayElem    = STEM_ELEM[dayStemIdx]    as ElemIdx;
  const targetElem = STEM_ELEM[targetStemIdx] as ElemIdx;
  const sameYY     = dayStemIdx % 2 === targetStemIdx % 2;

  if (dayElem === targetElem)
    return sameYY ? '비견' : '겁재';
  if (GENERATES[dayElem] === targetElem)
    return sameYY ? '식신' : '상관';
  if (GENERATES[targetElem] === dayElem)
    return sameYY ? '편인' : '정인';
  if (CONTROLS[dayElem] === targetElem)
    return sameYY ? '편재' : '정재';
  if (CONTROLS[targetElem] === dayElem)
    return sameYY ? '편관' : '정관';
  return '비견'; // fallback
}
