import { SajuResult } from '../pillar-calc/main-calculator';
import {
  STEMS, BRANCHES, STEMS_H, BRANCHES_H,
  ELEM_NAMES, ELEM_NAMES_H, STEM_ELEM, BRANCH_ELEM,
} from '../pillar-calc/korean-calendar-engine';

// ── 오행 헬퍼
function e(i: number) { return `${ELEM_NAMES[i]}(${ELEM_NAMES_H[i]})`; }

function pillarStr(p: { s: number; b: number } | null): string {
  if (!p) return '미입력';
  return `${STEMS[p.s]}${BRANCHES[p.b]}(${STEMS_H[p.s]}${BRANCHES_H[p.b]})`;
}

// 상생: [i]가 생하는 오행
const GENERATES = [1, 2, 3, 4, 0]; // 목→화→토→금→수→목
// 상극: [i]가 극하는 오행
const CONTROLS  = [2, 3, 4, 0, 1]; // 목극토, 화극금, 토극수, 금극목, 수극화

// ── 가중치 신강/신약 계산 (월지 3배, 일지 2배, 나머지 1배)
function calcStrengthWeighted(
  pillars: ({ s: number; b: number } | null)[],
  dayElem: number
): { score: number; label: string; support: number; drain: number } {
  const [yp, mp, dp, hp] = pillars;

  // 각 자리의 오행과 가중치
  const positions: { elem: number; w: number }[] = [
    yp ? { elem: STEM_ELEM[yp.s],   w: 1 } : null,
    yp ? { elem: BRANCH_ELEM[yp.b], w: 1 } : null,
    mp ? { elem: STEM_ELEM[mp.s],   w: 1 } : null,
    mp ? { elem: BRANCH_ELEM[mp.b], w: 3 } : null, // 월지 3배
    dp ? { elem: BRANCH_ELEM[dp.b], w: 2 } : null, // 일지 2배
    hp ? { elem: STEM_ELEM[hp.s],   w: 1 } : null,
    hp ? { elem: BRANCH_ELEM[hp.b], w: 1 } : null,
  ].filter(Boolean) as { elem: number; w: number }[];

  let support = 0, drain = 0;
  for (const { elem, w } of positions) {
    if (elem === dayElem)                     support += w; // 비겁
    else if (GENERATES[elem] === dayElem)     support += w; // 인성 (elem이 dayElem을 생)
    else if (GENERATES[dayElem] === elem)     drain   += w; // 식상
    else if (CONTROLS[dayElem] === elem)      drain   += w; // 재성
    else if (CONTROLS[elem] === dayElem)      drain   += w; // 관성
  }

  const score = support - drain;
  const label = score >= 2 ? '신강(身强)' : score <= -1 ? '신약(身弱)' : '중화(中和)에 가까운 신약';
  return { score, label, support, drain };
}

// ── 용신 룩업 테이블 (10간 × 신강/신약)
// primary: 1순위 용신 오행, secondary: 희신, adjust: 조후용신
interface YongsinEntry {
  primary: number[];
  secondary: number[];
  adjust?: number;
  note?: string;
}
type StrengthKey = '신강' | '신약';

const YONGSIN_TABLE: Record<number, Record<StrengthKey, YongsinEntry>> = {
  0: { // 갑(木)
    신약: { primary: [4],    secondary: [0],    adjust: 1,  note: '수(水) 인성으로 뿌리 강화, 화(火)로 발산' },
    신강: { primary: [1, 2], secondary: [3],            note: '식상·재성으로 에너지 설기' },
  },
  1: { // 을(木)
    신약: { primary: [4],    secondary: [0],    adjust: 1  },
    신강: { primary: [1, 2], secondary: [3]               },
  },
  2: { // 병(火)
    신약: { primary: [0],    secondary: [1],    adjust: 2,  note: '목(木) 인성, 토(土)로 통근' },
    신강: { primary: [2, 3], secondary: [4],               note: '토·금으로 설기·극' },
  },
  3: { // 정(火)
    신약: { primary: [0],    secondary: [1],    adjust: 2  },
    신강: { primary: [2, 3], secondary: [4]               },
  },
  4: { // 무(土)
    신약: { primary: [1],    secondary: [2],               note: '화(火) 인성이 토를 생' },
    신강: { primary: [3, 4], secondary: [0],               note: '금·수로 설기, 목으로 소통' },
  },
  5: { // 기(土)
    신약: { primary: [1],    secondary: [2]               },
    신강: { primary: [3, 4], secondary: [0]               },
  },
  6: { // 경(金)
    신약: { primary: [2],    secondary: [3],    adjust: 4,  note: '토(土) 인성 1순위, 수(水)로 조후·관살 억제' },
    신강: { primary: [4, 0], secondary: [1],               note: '수·목으로 설기·재성 활용' },
  },
  7: { // 신(金)
    신약: { primary: [2],    secondary: [3],    adjust: 4  },
    신강: { primary: [4, 0], secondary: [1]               },
  },
  8: { // 임(水)
    신약: { primary: [3],    secondary: [4],               note: '금(金) 인성, 수(水) 비겁' },
    신강: { primary: [0, 1], secondary: [2],               note: '목·화로 설기·재성' },
  },
  9: { // 계(水)
    신약: { primary: [3],    secondary: [4]               },
    신강: { primary: [0, 1], secondary: [2]               },
  },
};

function getYongsin(stemIdx: number, isWeak: boolean): YongsinEntry {
  const key: StrengthKey = isWeak ? '신약' : '신강';
  return YONGSIN_TABLE[stemIdx]?.[key] ?? {
    primary: isWeak ? [(stemIdx + 4) % 5] : [GENERATES[STEM_ELEM[stemIdx]]],
    secondary: [],
  };
}

// ── 2026 세운 영향 (일간 × 세운 오행 관계)
function seunComment(dayElem: number, seunElem: number, isWeak: boolean): string {
  if (seunElem === dayElem)
    return `비겁(比劫) 해 — 독립심·경쟁 강화, ${isWeak ? '일간 보강에 도움' : '재물 분산 주의'}`;
  if (GENERATES[seunElem] === dayElem)
    return `인성(印星) 해 — 문서·학업 인연, ${isWeak ? '일간 강화에 유리' : '과인성 주의'}`;
  if (GENERATES[dayElem] === seunElem)
    return `식상(食傷) 해 — 창의·표현 활발, ${isWeak ? '에너지 소모 주의' : '재물 창출 기회'}`;
  if (CONTROLS[dayElem] === seunElem)
    return `재성(財星) 해 — 재물·이성운 활발, ${isWeak ? '무리한 욕심 주의' : '재물 수확 가능'}`;
  if (CONTROLS[seunElem] === dayElem)
    return `관살(官殺) 해 — 책임·압박 증가, ${isWeak ? '건강·과로 주의, 중요 결정은 하반기 이후로' : '승진·명예 기회'}`;
  return '중립적 영향';
}

export function buildPrompt(result: SajuResult): string {
  const { pillars, input, ohaeng, shinsal, sipsin, daeun } = result;
  const [yp, mp, dp, hp] = pillars;

  const dayStemIdx  = dp ? dp.s : 0;
  const dayElemIdx  = STEM_ELEM[dayStemIdx];

  // 가중치 신강/신약
  const { score, label: strengthLabel, support, drain } =
    calcStrengthWeighted(pillars, dayElemIdx);
  const isWeak = score <= 0;

  // 용신
  const ys = getYongsin(dayStemIdx, isWeak);
  const primaryNames   = ys.primary.map(i => e(i)).join(' · ');
  const secondaryNames = ys.secondary.map(i => e(i)).join(' · ');
  const adjustName     = ys.adjust !== undefined ? e(ys.adjust) : '';
  const kisinElem      = isWeak
    ? [GENERATES[dayElemIdx], CONTROLS[(dayElemIdx+2)%5], CONTROLS[dayElemIdx]]
    : [(dayElemIdx+4)%5];
  const kisinNames = kisinElem.map(i => e(i)).join(' · ');

  // 오행 분포 라벨
  const ohaengLines = ohaeng.counts
    .map((c, i) => `  ${e(i)}: ${c}개${c === 0 ? ' ◀ 없음' : c >= 3 ? ' ◀ 과다' : ''}`)
    .join('\n');

  const dominant = ohaeng.counts
    .map((c, i) => ({ c, i })).filter(x => x.c >= 2)
    .map(x => `${e(x.i)} ${x.c}개`).join(', ') || '없음';
  const lacking = ohaeng.counts
    .map((c, i) => ({ c, i })).filter(x => x.c === 0)
    .map(x => e(x.i)).join(', ') || '없음';

  // 2026 세운 (병오년: 병火=1, 오午=火=1)
  const seunElem = 1; // 화(火)
  const seun2026 = seunComment(dayElemIdx, seunElem, isWeak);

  // 신살
  const shinsalText = shinsal.length > 0
    ? shinsal.map(s => `  - ${s.name}: ${s.desc}`).join('\n')
    : '  - 해당 없음';

  // 대운
  const daeunText = daeun.pillars.slice(0, 4).map((p, i) => {
    const age = daeun.startAge + i * 10;
    return `${age}세: ${STEMS[p.s]}${BRANCHES[p.b]}`;
  }).join(' / ');

  const sipsinText = sipsin
    ? `연주:${sipsin[0]} / 월주:${sipsin[1]} / 일주:${sipsin[2]} / 시주:${sipsin[3] ?? '미입력'}`
    : '(시간 미입력)';

  return `당신은 30년 경력의 한국 명리학(命理學) 전문가입니다.

━━━ 언어 규칙 (절대 준수) ━━━
오직 한국어로만 작성. 일본어(가나·한자 단독)·영어·베트남어 등 외국어 토큰 절대 금지.
한자는 반드시 한글과 괄호 병기: 예) 용신(用神), 신약(身弱)
━━━━━━━━━━━━━━━━━━

━━━ 사주 원국 ━━━
생년월일: ${input.year}년 ${input.month}월 ${input.day}일 (${input.gender}성)
연주: ${pillarStr(yp)} / 월주: ${pillarStr(mp)} / 일주: ${pillarStr(dp)} / 시주: ${pillarStr(hp)}
십신: ${sipsinText}
신살:
${shinsalText}
대운: ${daeunText} (${daeun.forward ? '순행' : '역행'})
━━━━━━━━━━━━━━━━━━

━━━ 사전 계산 결과 (이 수치를 그대로 사용할 것) ━━━
오행 분포 (원국 8자):
${ohaengLines}

지배 오행: ${dominant}
부족 오행: ${lacking}

▶ 신강·신약 판정 (가중치 계산):
  생조 세력(비겁+인성, 가중합): ${support}
  설기·극 세력(식상+재성+관성, 가중합): ${drain}
  최종 판정: ★ ${strengthLabel} (${score > 0 ? '+' : ''}${score}점) ★
  ※ 월지는 3배, 일지는 2배 가중치 적용

▶ 용신(用神) — 위 판정에서 도출:
  1순위 용신: ${primaryNames}
  2순위 희신: ${secondaryNames}${adjustName ? `\n  조후용신: ${adjustName}` : ''}
  기신(忌神): ${kisinNames}${ys.note ? `\n  참고: ${ys.note}` : ''}

▶ 2026 병오년(丙午年) 세운 영향:
  병화(丙火)가 일간 ${e(dayElemIdx)}에 미치는 관계 → ${seun2026}
━━━━━━━━━━━━━━━━━━

━━━ 일관성 규칙 (모순 금지) ━━━
• 위 [사전 계산 결과]와 다른 신강·신약 판정을 내리지 말 것
• "${dominant}(이)가 많다"고 쓴 후 "${dominant}(이)가 부족하다"고 쓰면 오류
• 기신(${kisinNames})을 용신으로 추천하면 오류
• 2026년 세운 해석은 반드시 위 계산 결과 반영
━━━━━━━━━━━━━━━━━━

아래 10개 항목을 한국어로 3000자 이상 상세히 분석해주세요.

[1] 신강·신약(身强·身弱) 확정 및 근거
— 위 판정(${strengthLabel})을 출발점으로, 월령 득기·천간 투출·지지 통근을 보완 설명

[2] 용신(用神)·희신(喜神)·기신(忌神) 확정
— 위 도출 결과(용신: ${primaryNames})를 기반으로 선언, 이후 전 항목에서 일관 적용

[3] 일간(日干) 성격 분석
— ${e(dayElemIdx)} 일간의 기질, 강점·약점, 음양 특성

[4] 오행 균형과 십신(十神) 분석
— 과다 오행(${dominant})의 영향, 부족 오행(${lacking}) 보완 전략

[5] 격국(格局)
— 격국명과 삶에 드러나는 방식

[6] 성격·적성·직업
— 타고난 기질에 맞는 직종, 피해야 할 환경 (관료적 해석 없이 실제 적성 중심)

[7] 대인관계·연애·가족운
— 인간관계 패턴, 배우자 인연, 부모·자녀 관계

[8] 재물운·사업운
— 재물 모으는 방식, 투자·사업 적성 (신강·신약 조건 반영)

[9] 2026년 병오년(丙午年) 운세
— 세운 영향(${seun2026}) 반드시 반영, 월별 핵심 조언 1~12월

[10] 종합 인생 지침 및 개운법
— 용신 오행을 일상에서 활용하는 구체적 방법, 주의 시기`;
}
