import { SajuResult } from '../pillar-calc/main-calculator';
import { STEMS, BRANCHES, STEMS_H, BRANCHES_H } from '../pillar-calc/korean-calendar-engine';

function pillarStr(p: { s: number; b: number } | null): string {
  if (!p) return '미입력';
  return `${STEMS[p.s]}${BRANCHES[p.b]}(${STEMS_H[p.s]}${BRANCHES_H[p.b]})`;
}

export function buildPrompt(result: SajuResult): string {
  const { pillars, input } = result;
  const [yp, mp, dp, hp] = pillars;
  const sajuText = `연주: ${pillarStr(yp)} / 월주: ${pillarStr(mp)} / 일주: ${pillarStr(dp)} / 시주: ${pillarStr(hp)}`;

  return `사주 분석을 해줘. 다음은 ${input.year}년 ${input.month}월 ${input.day}일생 ${input.gender}성의 사주팔자야:
${sajuText}

명리학 전문가로서 아래 항목을 모두 포함해 한국어로 3000자 이상 상세히 분석해줘.
전문 용어는 반드시 괄호 안에 한자와 설명을 달아줘.

1. 일간(日干) 분석 — 나를 상징하는 일간의 오행 성질, 음양, 성격적 특성
2. 사주 전체 오행(五行) 균형 — 목화토금수 분포와 과다·부족한 기운
3. 신강·신약(身强·身弱) 판단 — 일간의 힘이 강한지 약한지와 삶의 태도
4. 십신(十神) 분석 — 비겁·식상·재성·관성·인성의 분포와 의미
5. 격국(格局) — 이 사주의 격국과 용신(用神)
6. 성격과 적성 — 타고난 성격, 강점, 약점, 적합한 직업
7. 대인관계와 연애운 — 인간관계 패턴과 이성운
8. 재물운과 직업운 — 재물을 모으는 방식과 직업적 성취
9. 2026년 병오년(丙午年) 운세 — 올해 흐름과 월별 조언
10. 종합 조언 — 이 사주를 가진 사람에게 전하는 명리학적 인생 지침`;
}
