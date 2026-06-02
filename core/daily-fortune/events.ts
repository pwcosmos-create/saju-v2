import type { ElemIdx, FortuneEvent } from './types';
import {
  isChung, getYughap, HAP3, isHyeong, getHyeongTriples,
  SEASON_BRANCHES,
} from './constants';
import { STEM_ELEM } from '../pillar-calc/korean-calendar-engine';

// 사주 원국 줄기(천간) 집합 — 합화 stemExposed 체크용
export interface NatalInfo {
  branches: number[];
  stems:    number[];    // [년간, 월간, 일간, 시간]
  monthBranch: number;  // 월지 (계절 판단)
}

// ── 탐합망충: 합과 충이 겹치면 합 우선, 충 해소
function applyTanhapMangchung(events: FortuneEvent[]): FortuneEvent[] {
  const hapTargets = new Set(
    events
      .filter(e => e.type === 'yughap' || e.type === 'samhap')
      .flatMap(e => e.target !== undefined ? [e.target] : (e.trio ?? [])),
  );
  return events.map(e =>
    e.type === 'chung' && e.target !== undefined && hapTargets.has(e.target)
      ? { ...e, weakened: true }
      : e,
  );
}

// ── 합화 후보 플래그 (v1: 성부 판정 없이 조건만 체크)
function markHwaCandidates(events: FortuneEvent[], natal: NatalInfo): FortuneEvent[] {
  const natalStemElems = new Set(natal.stems.map(s => STEM_ELEM[s]));

  return events.map(e => {
    const hwa = e.hwaElem;
    if (hwa === undefined) return e;

    const seasonMatch  = SEASON_BRANCHES[hwa]?.has(natal.monthBranch) ?? false;
    const stemExposed  = natalStemElems.has(hwa);
    const hwaCandidate = seasonMatch && stemExposed;

    return { ...e, hwaCandidate, hwaConditions: { seasonMatch, stemExposed } };
  });
}

// ── 메인 이벤트 탐지
export function detectEvents(todayBranch: number, natal: NatalInfo): FortuneEvent[] {
  const raw: FortuneEvent[] = [];

  for (const nb of natal.branches) {
    // 충
    if (isChung(todayBranch, nb))
      raw.push({ type: 'chung', target: nb });

    // 육합
    const hwa6 = getYughap(todayBranch, nb);
    if (hwa6 !== null)
      raw.push({ type: 'yughap', target: nb, hwaElem: hwa6 });

    // 형 (쌍)
    if (isHyeong(todayBranch, nb))
      raw.push({ type: 'hyeong', target: nb });
  }

  // 삼합 (원국 2지 + 오늘 1지)
  for (const [trio, hwa] of HAP3) {
    if (trio.includes(todayBranch)) {
      const others = trio.filter(b => b !== todayBranch);
      if (others.every(b => natal.branches.includes(b)))
        raw.push({ type: 'samhap', trio: trio as [number, number, number], hwaElem: hwa });
    }
  }

  // 형 (3방)
  for (const triple of getHyeongTriples()) {
    if (triple.includes(todayBranch)) {
      const others = triple.filter(b => b !== todayBranch);
      if (others.every(b => natal.branches.includes(b)))
        raw.push({ type: 'hyeong', trio: triple as [number, number, number] });
    }
  }

  const resolved = applyTanhapMangchung(raw);
  return markHwaCandidates(resolved, natal);
}

// ── 이벤트 한 줄 요약
export function summarizeEvents(events: FortuneEvent[]): string {
  if (events.length === 0) return '특이 사항 없음';
  const labels = events
    .filter(e => !e.weakened)
    .map(e => {
      switch (e.type) {
        case 'chung':  return '충(沖) 주의';
        case 'yughap': return e.hwaCandidate ? '육합·합화 가능성' : '육합(合) 성립';
        case 'samhap': return e.hwaCandidate ? '삼합·합화 가능성' : '삼합(合) 성립';
        case 'hyeong': return '형(刑) 주의';
      }
    })
    .filter(Boolean);
  return labels.length > 0 ? labels.join(' · ') : '특이 사항 없음';
}
