import { SajuResult } from '../pillar-calc/main-calculator';
import {
  STEMS, BRANCHES, STEMS_H, BRANCHES_H,
  ELEM_NAMES, ELEM_NAMES_H, STEM_ELEM, BRANCH_ELEM,
} from '../pillar-calc/korean-calendar-engine';
import { classifyElements, getSipsin } from '../daily-fortune/classifier';
import { calcYear } from '../pillar-calc/korean-calendar-engine';
import { buildMonthlyBriefs, formatMonthlyPrompt } from '../daily-fortune/monthly-brief';

// ── 오행 헬퍼
function e(i: number) { return `${ELEM_NAMES[i]}(${ELEM_NAMES_H[i]})`; }

function pillarStr(p: { s: number; b: number } | null): string {
  if (!p) return '미입력';
  return `${STEMS[p.s]}${BRANCHES[p.b]}(${STEMS_H[p.s]}${BRANCHES_H[p.b]})`;
}

const GENERATES = [1, 2, 3, 4, 0];
const CONTROLS  = [2, 3, 4, 0, 1];

// 월지 본기 (branch index → stem index)
// 자=癸(9) 축=己(5) 인=甲(0) 묘=乙(1) 진=戊(4) 사=丙(2)
// 오=丁(3) 미=己(5) 신=庚(6) 유=辛(7) 술=戊(4) 해=壬(8)
const BRANCH_BONGI = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8];

const SIPSIN_TO_GYEOK: Record<string, string> = {
  '비견': '건록격(乾祿格)', '겁재': '월겁격(月劫格)',
  '식신': '식신격(食神格)', '상관': '상관격(傷官格)',
  '편재': '편재격(偏財格)', '정재': '정재격(正財格)',
  '편관': '칠살격(七殺格)', '정관': '정관격(正官格)',
  '편인': '편인격(偏印格)', '정인': '정인격(正印格)',
};

function getGyeokguk(dayStemIdx: number, monthBranch: number): string {
  const bongiStem = BRANCH_BONGI[monthBranch];
  const sipsin = getSipsin(dayStemIdx, bongiStem);
  return SIPSIN_TO_GYEOK[sipsin] ?? `${sipsin}격`;
}

// ── 가중치 신강/신약 (월지 3배, 일지 2배)
function calcStrengthWeighted(
  pillars: ({ s: number; b: number } | null)[],
  dayElem: number
): { score: number; label: string; support: number; drain: number } {
  const [yp, mp, dp, hp] = pillars;
  const positions: { elem: number; w: number }[] = [
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
    if (elem === dayElem)                 support += w;
    else if (GENERATES[elem] === dayElem) support += w;
    else if (GENERATES[dayElem] === elem) drain   += w;
    else if (CONTROLS[dayElem] === elem)  drain   += w;
    else if (CONTROLS[elem] === dayElem)  drain   += w;
  }
  const score = support - drain;
  const label = score >= 2 ? '신강(身强)' : score <= -1 ? '신약(身弱)' : '중화에 가까운 신약';
  return { score, label, support, drain };
}

// ── 2026 세운 영향
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

export function buildPremiumPrompt(result: SajuResult): string {
  const { pillars, input, ohaeng, shinsal, sipsin, daeun } = result;
  const [yp, mp, dp, hp] = pillars;

  const dayStemIdx = dp ? dp.s : 0;
  const dayElemIdx = STEM_ELEM[dayStemIdx];

  const { score, label: strengthLabel, support, drain } = calcStrengthWeighted(pillars, dayElemIdx);
  const isWeak = score <= 0;

  const cls = classifyElements(dayStemIdx, isWeak, ohaeng.counts);
  const yongsinName  = e(cls.yongsin);
  const huisinNames  = cls.huisin.map(i => e(i)).join(' · ') || '없음';
  const gisinNames   = cls.gisin.map(i => e(i)).join(' · ') || '없음';
  const gusinText    = cls.gusin !== null ? e(cls.gusin) : '없음';

  const gyeokguk = getGyeokguk(dayStemIdx, mp?.b ?? 0);

  const jaeSungElem  = CONTROLS[dayElemIdx];
  const jaeSungCount = ohaeng.counts[jaeSungElem];
  const isJaedaSinyak = isWeak && jaeSungCount >= 2;

  const ohaengLines = ohaeng.counts
    .map((c, i) => `  ${e(i)}: ${c}개${c === 0 ? ' (없음)' : c >= 3 ? ' (매우 강함)' : ''}`)
    .join('\n');
  const dominant = ohaeng.counts.map((c,i)=>({c,i})).filter(x=>x.c>=2)
    .map(x=>`${e(x.i)} ${x.c}개`).join(', ') || '없음';
  const lacking = ohaeng.counts.map((c,i)=>({c,i})).filter(x=>x.c===0)
    .map(x=>e(x.i)).join(', ') || '없음';

  const now = new Date();
  const monthlyBriefs = buildMonthlyBriefs(result, cls, now.getFullYear());
  const monthlyPrompt = formatMonthlyPrompt(monthlyBriefs);
  const seunGanji = calcYear(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const seunElem  = STEM_ELEM[seunGanji.s];
  const seunYearLabel = `${now.getFullYear()} ${STEMS[seunGanji.s]}${BRANCHES[seunGanji.b]}년(${STEMS_H[seunGanji.s]}${BRANCHES_H[seunGanji.b]}年)`;
  const seun2026 = seunComment(dayElemIdx, seunElem, isWeak);

  const shinsalText = shinsal.length > 0
    ? shinsal.map(s => `  - ${s.name}: ${s.desc}`).join('\n')
    : '  - 해당 없음';

  const daeunText = daeun.pillars.slice(0, 4).map((p, i) => {
    const age = daeun.startAge + i * 10;
    return `${age}세: ${STEMS[p.s]}${BRANCHES[p.b]}`;
  }).join(' / ');

  const sipsinText = sipsin
    ? `연주:${sipsin[0]} / 월주:${sipsin[1]} / 일주:${sipsin[2]} / 시주:${sipsin[3] ?? '미입력'}`
    : '(시간 미입력)';

  return `당신은 30년 경력의 명리학 전문가입니다.
아래 사주를 "구조 → 작용 → 현실 적용" 순서로 분석해주세요.

━━━ 필수 규칙 ━━━
1. 오직 한국어로만 작성. 한자는 한글 뒤 괄호 병기: 신약(身弱)
2. 짧은 문장으로 끊어 쓰기. 한 문장에 한 개념만.
3. 👉 화살표로 핵심 결론을 강조.
4. 각 섹션마다 "절대 하면 안 되는 것" vs "맞는 방식"을 명확히 구분.
5. [확정 데이터]의 용신·기신·격국을 전 항목에서 일관 적용.
6. 5000자 이상.

━━━ 품질 기준 (이 수준을 반드시 지킬 것) ━━━
• 신약 표현: "공격받는 구조"가 아닌 반드시 공격·누수·압박 중 실제 해당하는 것을 구체적으로 구분해서 서술
  예) "목(木)의 극(공격) + 수(水)의 설기(누수) + 화(火)의 제압(압박) — 3중 복합 약세"
• 재다신약 표현: "돈이 스트레스"가 아닌 "재물이 기회가 아니라 의무로 바뀌는 구조"로 서술
  → "내 돈인데 내 돈 같지 않은" 현실 패턴을 구체적으로 묘사
• 정관격+신약 조합 필수 추가: 책임감과 함께 반드시 "타인의 평가와 기준에 민감한 구조"를 심리 분석에 포함
  → 남 기준에 맞추려 함 / 인정받으려 노력 / 거절 어려움
• 처방 표현: "직접 돈 만지지 말 것"이 아닌 "결정권을 줄이고 정해진 규칙·시스템에 위임"으로 실천 가능하게
• 월별 운세: 좋은 달과 나쁜 달을 이유와 함께 명확히 구분. 가장 좋은 달과 가장 나쁜 달을 반드시 명시.
━━━━━━━━━━━━━━━

━━━ 사주 원국 ━━━
생년월일: ${input.year}년 ${input.month}월 ${input.day}일 (${input.gender}성)
연주: ${pillarStr(yp)} / 월주: ${pillarStr(mp)} / 일주: ${pillarStr(dp)} / 시주: ${pillarStr(hp)}
십신: ${sipsinText}
신살: ${shinsalText}
대운: ${daeunText} (${daeun.forward ? '순행' : '역행'})

━━━ 확정 데이터 ━━━
오행 분포:
${ohaengLines}
지배 오행: ${dominant} / 부족 오행: ${lacking}
신강·신약: ${strengthLabel} (생조 ${support} / 설기·극 ${drain})
용신(用神) = ${yongsinName} / 희신(喜神) = ${huisinNames}
기신(忌神) = ${gisinNames} / 구신(仇神) = ${gusinText}
격국: ${gyeokguk}
${isJaedaSinyak ? `특이 패턴: 재다신약(財多身弱) — 재성 ${e(jaeSungElem)} ${jaeSungCount}개` : ''}
${seunYearLabel} 세운 영향: ${seun2026}
━━━━━━━━━━━━━━━

아래 10개 항목을 순서대로 작성하세요.
각 항목은 "# ■ N. 제목" 형식으로 시작하고, 소제목은 "## ●" 형식을 사용하세요.

# ■ 1. 이 사주의 핵심 구조 — 한 줄 정의
👉 이 사주를 한 문장으로 정의하는 것으로 시작하세요.
${strengthLabel}인 이유를 단계별로 짧게 설명하세요:
- 월지(가장 중요한 자리)가 무엇이고 일간에 어떤 영향인지
- 오행이 일간에 가하는 압력을 "극(공격) / 설기(누수) / 제압(압박)" 세 종류로 구분해서 서술
- 결론: 단순히 "약하다"가 아니라 어떤 복합 구조인지 정확히 명시

# ■ 2. ${strengthLabel}의 진짜 의미 — 현실에서 이렇게 나타남
많은 사람이 착각하는 것을 먼저 짚어주세요.
${isJaedaSinyak ? '재다신약이면: "돈이 많다 = 잘 산다" ❌ → "재물이 기회가 아니라 의무로 바뀐다" — "내 돈인데 내 돈 같지 않은" 현실 패턴을 구체적으로 묘사할 것.' : ''}
## ● 실제 현실에서 이렇게 나타남
구체적인 생활 패턴 3~4가지를 👉로 서술.
## ● 특히 위험한 패턴
이 사주에서 가장 피해야 할 상황 3가지.
이유도 함께 설명.

# ■ 3. ${gyeokguk} + ${strengthLabel} — 삶의 압박 구조와 심리
격국의 원래 의미 → ${strengthLabel}일 때 어떻게 변형되는지 설명.
정관격이면 반드시 포함: 책임감뿐 아니라 "타인의 평가와 기준에 민감한 구조"
→ 남 기준에 맞추려 함 / 인정받으려 노력 / 거절 어려움 / 눈치 많이 봄
## ● 실제 모습
현실에서 드러나는 행동 패턴을 👉로 서술.

# ■ 4. ${lacking !== '없음' ? `${lacking} 부재` : '오행 과불균형'} — 인생 핵심 약점
부족한 오행이 무엇을 뜻하는지 설명.
## ● 없으면 생기는 일
구체적인 영향 3~4가지를 👉로 서술.
## ● 결론
👉 이 약점이 삶에서 어떤 패턴으로 반복되는지 한 줄로.

# ■ 5. 용신 해석 — 정확한 순위
## ● 1순위: ${yongsinName}
역할과 한마디 요약.
## ● 2순위: ${huisinNames}
역할과 효과.
## ● ${gisinNames} — 조심 포인트
왜 해로운지 구체적으로.
👉 결론: 어떻게 활용하거나 피해야 하는지.

# ■ 6. 돈의 흐름 — 구조가 먼저
## ● 절대 하면 안 되는 것
최소 4가지를 명확히 나열. 이유 포함.
## ● 맞는 돈 버는 방식
핵심 3가지 카테고리로 나눠 설명:
1) 자동화·시스템 수익 (구체적 예시)
2) 분산·규칙 기반 투자: "직접 판단보다 정해진 규칙·시스템에 따라 운용" — 실천 가능한 방법으로 서술
3) 협업·파트너십 (어떻게)
${isJaedaSinyak ? '👉 재다신약(財多身弱) 핵심 처방: "내가 직접 결정하면 망하고, 시스템과 규칙이 관리하면 산다" — 이 원칙을 중심으로 자세히 설명.' : ''}

# ■ 7. 인간관계 특징 — 패턴과 주의사항
## ● 이 사람의 관계 패턴
특징 3가지를 👉로 서술.
## ● 특히 조심해야 할 관계
구체적인 상황 3가지. 왜 위험한지 이유 포함.
연애·결혼 패턴도 포함하여 설명.

# ■ 8. 건강 포인트
## ● 이 사주의 건강 핵심
스트레스형인지, 에너지 소모형인지 규정.
## ● 위험 부위
오행 불균형에서 도출한 취약 장기·신체 부위.
계절별 주의사항 포함.
👉 결론: "몸보다 마음이 먼저인지" "몸이 먼저인지" 명확히.

# ■ 9. ${seunYearLabel} 핵심 해석
세운 영향: ${seun2026}
## ● 올해의 의미
이 세운이 일간에게 어떤 압박 또는 기회인지 명확히.
## ● 특히 위험한 시기
구체적 월 구간과 이유.
## ● 좋은 시기
구체적 월 구간과 활용법.

【월별 데이터 — 이 수치 기반으로 각 월 2~3문장 서술】
${monthlyPrompt}

# ■ 10. 인생 핵심 전략 — 결론
## ✔ 절대 원칙
👉 이 사주의 성공 핵심을 한 문장으로.
## ✔ 성공 공식
단계별 3가지.
## ✔ 실패 공식
피해야 할 3가지.
## ✔ 대운 흐름
대운 ${daeunText} 각 시기별 핵심 한 줄씩.
## ✔ 최종 한 줄 요약
👉 이 사람이 평생 기억해야 할 단 하나의 원칙.`;
}

export function buildPrompt(result: SajuResult): string {
  const { pillars, input, ohaeng, shinsal, sipsin, daeun } = result;
  const [yp, mp, dp, hp] = pillars;

  const dayStemIdx = dp ? dp.s : 0;
  const dayElemIdx = STEM_ELEM[dayStemIdx];

  // 신강/신약
  const { score, label: strengthLabel, support, drain } = calcStrengthWeighted(pillars, dayElemIdx);
  const isWeak = score <= 0;

  // ── 오행 분류 (classifier.ts — 이 데이터가 LLM 서술의 기준이 됨)
  const cls = classifyElements(dayStemIdx, isWeak, ohaeng.counts);
  const yongsinName  = e(cls.yongsin);
  const huisinNames  = cls.huisin.map(i => e(i)).join(' · ') || '없음';
  const gisinNames   = cls.gisin.map(i => e(i)).join(' · ') || '없음';
  const gusinText    = cls.gusin !== null ? e(cls.gusin) : '없음';
  const hansinNames  = cls.hansin.map(i => e(i)).join(' · ') || '없음';

  // ── 격국 (월지 본기 → 십신 → 격국명)
  const gyeokguk = getGyeokguk(dayStemIdx, mp?.b ?? 0);

  // ── 재다신약 패턴 감지
  const jaeSungElem  = CONTROLS[dayElemIdx];
  const jaeSungCount = ohaeng.counts[jaeSungElem];
  const isJaedaSinyak = isWeak && jaeSungCount >= 2;

  // 오행 분포
  const ohaengLines = ohaeng.counts
    .map((c, i) => `  ${e(i)}: ${c}개${c === 0 ? ' ◀ 없음' : c >= 3 ? ' ◀ 과다' : ''}`)
    .join('\n');
  const dominant = ohaeng.counts.map((c,i)=>({c,i})).filter(x=>x.c>=2)
    .map(x=>`${e(x.i)} ${x.c}개`).join(', ') || '없음';
  const lacking = ohaeng.counts.map((c,i)=>({c,i})).filter(x=>x.c===0)
    .map(x=>e(x.i)).join(', ') || '없음';

  // 세운 (올해 간지 기준 동적 계산)
  const now = new Date();
  const monthlyBriefs = buildMonthlyBriefs(result, cls, now.getFullYear());
  const monthlyPrompt = formatMonthlyPrompt(monthlyBriefs);
  const seunGanji = calcYear(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const seunElem  = STEM_ELEM[seunGanji.s];
  const seunYearLabel = `${now.getFullYear()} ${STEMS[seunGanji.s]}${BRANCHES[seunGanji.b]}년(${STEMS_H[seunGanji.s]}${BRANCHES_H[seunGanji.b]}年)`;
  const seunStemLabel = `${STEMS_H[seunGanji.s]}${BRANCHES_H[seunGanji.b]}(${STEMS_H[seunGanji.s]})`;
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

━━━ 언어·포맷 규칙 (절대 준수) ━━━
1. 오직 한국어로만 작성. 영어·일본어·중국어 간체(简体)·번체(繁體) 토큰 단독 사용 절대 금지.
2. 한자는 반드시 한글 뒤 괄호 병기: 신약(身弱) ← 올바름 / 身弱 단독 사용 ← 오류
3. 剛强·刚强·家庭(한자만)·사랑과家庭에 등 중국어식 혼용 표현 사용 시 번역 실패로 간주
4. [확정 데이터]에 명시된 용신·기신·격국 수치를 분석 전체에서 일관 적용. 이 수치와 다른 주장 금지.
5. 핵심 명리 용어·판정 결과는 반드시 **굵게** 표시. 예: **신약(身弱)**, **용신(用神) 토(土)**, **편관격(偏官格)**
6. 항목 나열 시 반드시 "— "(대시+공백) 형식 사용. 번호 목록·마침표 목록 사용 금지.
7. 각 섹션 [N]은 4~6문단으로 구성. 문단마다 핵심 주제 1개. 너무 긴 단일 문단 금지.
8. 표(table)·코드블록·마크다운 헤더(##) 사용 금지. 오직 **강조**와 "— " 불릿만 사용.
━━━━━━━━━━━━━━━━━━

━━━ 사주 원국 ━━━
생년월일: ${input.year}년 ${input.month}월 ${input.day}일 (${input.gender}성)
연주: ${pillarStr(yp)} / 월주: ${pillarStr(mp)} / 일주: ${pillarStr(dp)} / 시주: ${pillarStr(hp)}
십신: ${sipsinText}
신살 (※ 신살은 격국이 아님):
${shinsalText}
대운: ${daeunText} (${daeun.forward ? '순행' : '역행'})
━━━━━━━━━━━━━━━━━━

━━━ 확정 데이터 (이 수치 그대로 사용 — 변경 금지) ━━━
오행 분포 (원국 8자):
${ohaengLines}

지배 오행: ${dominant}
부족 오행: ${lacking}

▶ 신강·신약 판정 (가중치 계산):
  생조 세력(비겁+인성, 가중합): ${support}
  설기·극 세력(식상+재성+관성, 가중합): ${drain}
  최종 판정: ★ ${strengthLabel} (${score > 0 ? '+' : ''}${score}점) ★
  ※ 월지 3배, 일지 2배 가중치 적용

▶ 오행 분류 확정 (이 목록 외의 오행을 용신·기신으로 언급하면 오류):
  용신(用神) = ${yongsinName}          ← 이 일간에게 가장 이로운 오행
  희신(喜神) = ${huisinNames}          ← 용신을 돕는 오행
  기신(忌神) = ${gisinNames}           ← 일간에게 해로운 오행 (용신·희신과 겹치면 오류)
  구신(仇神) = ${gusinText}
  한신(閑神) = ${hansinNames}

▶ 격국 (格局):
  ${gyeokguk}
  ※ 화개살·천을귀인 등은 신살(神殺)이며, 격국이 아님. 격국은 반드시 위 명칭만 사용.

▶ 핵심 명식 패턴:
${isJaedaSinyak
  ? `  재다신약(財多身弱): 재성 ${e(jaeSungElem)} ${jaeSungCount}개, 일간 신약
  → 재물은 넘치나 몸이 감당 못하는 구조
  → 직업·재물 조언 시 "자동화 수익 파이프라인 구축", "알고리즘·시스템을 통한 자산 통제",
     "파트너십으로 재성 분산"을 핵심 해결책으로 명시할 것`
  : '  특이 패턴 없음'}

▶ ${seunYearLabel} 세운 영향:
  ${seunStemLabel}가 일간 ${e(dayElemIdx)}에 미치는 관계 → ${seun2026}
━━━━━━━━━━━━━━━━━━

━━━ 일관성 검증 (모순 발생 시 즉시 수정) ━━━
• 용신(${yongsinName})을 기신이라고 쓰면 오류
• 기신(${gisinNames})을 용신·희신이라고 추천하면 오류
• 격국을 신살(화개살·천을귀인 등)로 서술하면 오류
• "${dominant}(이)가 많다" 쓰고 "${dominant}(이)가 부족하다" 쓰면 오류
━━━━━━━━━━━━━━━━━━

아래 10개 항목을 한국어로 3000자 이상 상세히 분석해주세요.

[1] 신강·신약(身强·身弱) 확정 및 근거
— 위 판정(${strengthLabel})을 출발점으로, 월령 득기·천간 투출·지지 통근을 보완 설명

[2] 용신(用神)·희신(喜神)·기신(忌神) 확정
— 확정 데이터의 분류(용신: ${yongsinName} / 기신: ${gisinNames})를 선언하고, 이후 전 항목에서 일관 적용

[3] 일간(日干) 성격 분석
— ${e(dayElemIdx)} 일간의 기질, 강점·약점, 음양 특성

[4] 오행 균형과 십신(十神) 분석
— 과다 오행(${dominant})의 영향, 부족 오행(${lacking}) 보완 전략

[5] 격국(格局): ${gyeokguk}
— 이 격국이 삶에 드러나는 방식과 활용법 (신살을 격국이라 부르지 말 것)

[6] 성격·적성·직업
— 타고난 기질에 맞는 직종, 피해야 할 환경${isJaedaSinyak ? '\n— 재다신약 처방: 자동화 파이프라인·알고리즘 시스템·파트너십 중심으로 조언' : ''}

[7] 대인관계·연애·가족운
— 인간관계 패턴, 배우자 인연, 부모·자녀 관계

[8] 재물운·사업운
— 재물 모으는 방식, 투자·사업 적성 (신강·신약 조건 반영)${isJaedaSinyak ? '\n— 재다신약: 감정 배제한 시스템 운용 강조, 충동 투자 위험성 명시' : ''}

[9] ${seunYearLabel} 월별 운세
— 세운 영향(${seun2026})을 바탕으로, 아래 엔진 계산 데이터를 그대로 활용해 각 월을 2~3문장으로 서술할 것.
— 월별 간지·오행 역할·점수·한 줄 요약은 아래 데이터 기반. 임의 생성 금지.

【월별 엔진 데이터 — 반드시 이 수치 기준으로 서술】
${monthlyPrompt}

서술 지침: 각 월 점수·역할·oneLiner에 충실하되, 직업·재물·건강·관계 중 그 달에 맞는 관점으로 다듬을 것. 길흉 방향(천간·지지 역할)을 뒤집는 표현 금지.

[10] 종합 인생 지침 및 개운법
— 용신 오행(${yongsinName})을 일상에서 활용하는 구체적 방법, 주의 시기`;
}
