import {
  calcMonth,
  STEM_ELEM, BRANCH_ELEM,
  STEMS, BRANCHES, STEMS_H, BRANCHES_H,
  ELEM_NAMES,
} from '../pillar-calc/korean-calendar-engine';
import type { SajuResult } from '../pillar-calc/main-calculator';
import type { ElementClassification, ElemIdx } from './types';
import { getRole, elementScore, scoreToLevel } from './scorer';
import { detectEvents, summarizeEvents } from './events';
import { getSipsin } from './classifier';
import type { NatalInfo } from './events';

// ── 역할 표시 매핑
const ROLE_KR: Record<string, string> = {
  yongsin: '용신', huisin: '희신', gisin: '기신', gusin: '구신', hansin: '한신',
};
const ROLE_TONE: Record<string, string> = {
  yongsin: '길(吉)', huisin: '소길(小吉)', hansin: '중립', gusin: '소흉(小凶)', gisin: '흉(凶)',
};
const LEVEL_STAR: Record<string, string> = {
  '매우 좋음': '★★★★★', '좋음': '★★★★', '보통': '★★★', '주의': '★★', '매우 주의': '★',
};

// ── 룰 기반 한 줄 요약 (LLM 자유 생성 금지 구역)
function makeOneLiner(sk: string, bk: string, events: string): string {
  const TEMPLATES: Record<string, string> = {
    'yongsin+yongsin': '천간·지지 모두 용신 — 중요 결정 실행, 도전에 최적',
    'yongsin+huisin':  '용신 주도, 희신 보조 — 계획 실행, 무리없이 전진',
    'huisin+yongsin':  '희신 천간, 용신 지지 — 안정된 기반 위에서 착실한 진행',
    'huisin+huisin':   '희신 우세 — 꾸준히 전진, 큰 모험은 자제',
    'yongsin+hansin':  '용신 천간 — 주도적으로 나서되 지지 기반 점검',
    'hansin+yongsin':  '지지 용신 — 내실 다지기, 외형보다 기초 강화',
    'hansin+huisin':   '중립+소길 — 조용히 준비, 기회 포착 시 행동',
    'huisin+hansin':   '소길+중립 — 조심스럽게 전진, 과욕 경계',
    'yongsin+gisin':   '천간 길·지지 흉 — 시작은 좋으나 마무리 주의',
    'yongsin+gusin':   '천간 길·지지 소흉 — 추진하되 방해 요소 점검',
    'huisin+gisin':    '소길+흉 혼재 — 좋은 기회와 리스크 공존, 선택 신중',
    'huisin+gusin':    '소길+소흉 — 기회 있으나 복병 주의',
    'gisin+yongsin':   '천간 흉·지지 길 — 표면 어렵지만 내실 안정, 인내',
    'gisin+huisin':    '흉+소길 혼재 — 소극적 대응, 수비 우선',
    'gisin+hansin':    '기신 천간 — 지출·분쟁 주의, 현상 유지',
    'gisin+gisin':     '천간·지지 모두 기신 — 무리한 시도 금지, 조용히 버팀',
    'gisin+gusin':     '흉신 중첩 — 건강·재물 이중 주의, 최소 행동',
    'gusin+gisin':     '소흉+흉 — 실익 없는 행동 자제, 방어 모드',
    'gusin+gusin':     '소흉 중첩 — 인간관계·협업 오해 주의',
    'gusin+hansin':    '소흉+중립 — 조용히 지낼 것, 큰 결정 연기',
    'hansin+gisin':    '중립+흉 — 기신 지지 영향 주시, 보수적 판단',
    'hansin+gusin':    '중립+소흉 — 변화 최소화, 안정 추구',
    'hansin+hansin':   '중립 — 평소 루틴 유지, 조용한 달',
  };
  const base = TEMPLATES[`${sk}+${bk}`] ?? '길흉 혼재 — 상황 판단 후 행동';
  return events !== '특이 사항 없음' ? `${base} · ${events}` : base;
}

// ── 공개 타입
export interface MonthlyBrief {
  month:        number;
  ganjiStr:     string;       // "무인(戊寅)"
  stemElemName: string;       // "목"
  branchElemName: string;     // "화"
  stemRoleKey:  string;       // 'yongsin' | 'huisin' | ...
  branchRoleKey: string;
  stemRole:     string;       // "용신"
  branchRole:   string;
  stemTone:     string;       // "길(吉)"
  branchTone:   string;
  sipsin:       string;       // "편관"
  events:       string;       // "충(沖) 주의" or "특이 사항 없음"
  score:        number;
  level:        string;
  oneLiner:     string;
}

// ── 메인 빌더
export function buildMonthlyBriefs(
  natal: SajuResult,
  cls: ElementClassification,
  year: number,
): MonthlyBrief[] {
  const dayStemIdx = natal.pillars[2]?.s ?? 0;
  const natalInfo: NatalInfo = {
    branches:    natal.pillars.filter(Boolean).map(p => p!.b),
    stems:       natal.pillars.filter(Boolean).map(p => p!.s),
    monthBranch: natal.pillars[1]?.b ?? 0,
  };

  return Array.from({ length: 12 }, (_, i) => {
    const month  = i + 1;
    const ganji  = calcMonth(year, month, 15); // 15일 = 절기 안전 지점
    const sElem  = STEM_ELEM[ganji.s]   as ElemIdx;
    const bElem  = BRANCH_ELEM[ganji.b] as ElemIdx;

    const sk = getRole(sElem, cls);
    const bk = getRole(bElem, cls);

    const sipsin   = getSipsin(dayStemIdx, ganji.s);
    const evts     = detectEvents(ganji.b, natalInfo);
    const events   = summarizeEvents(evts);
    const score    = elementScore(ganji, cls);
    const level    = scoreToLevel(score);
    const ganjiStr = `${STEMS[ganji.s]}${BRANCHES[ganji.b]}(${STEMS_H[ganji.s]}${BRANCHES_H[ganji.b]})`;

    return {
      month, ganjiStr,
      stemElemName:   ELEM_NAMES[sElem],
      branchElemName: ELEM_NAMES[bElem],
      stemRoleKey:    sk,
      branchRoleKey:  bk,
      stemRole:       ROLE_KR[sk],
      branchRole:     ROLE_KR[bk],
      stemTone:       ROLE_TONE[sk],
      branchTone:     ROLE_TONE[bk],
      sipsin, events, score, level,
      oneLiner: makeOneLiner(sk, bk, events),
    };
  });
}

// ── LLM 주입용 포맷터
export function formatMonthlyPrompt(briefs: MonthlyBrief[]): string {
  return briefs.map(b =>
    `${b.month}월 ${b.ganjiStr}: 천간 ${b.stemElemName}(${b.stemRole}·${b.stemTone}) + 지지 ${b.branchElemName}(${b.branchRole}·${b.branchTone}) | 십신 ${b.sipsin} | ${b.events} | 점수 ${b.score.toFixed(1)} ${LEVEL_STAR[b.level] ?? ''} | ${b.oneLiner}`
  ).join('\n');
}
