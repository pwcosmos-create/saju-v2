import {
  BRANCHES,
  BRANCHES_H,
  STEMS,
  STEMS_H,
  calcYear,
} from '../pillar-calc/korean-calendar-engine';
import { calculate } from '../pillar-calc/main-calculator';
import { adviseDaeunPeriod, parseDaeunFromQuery } from '../gemma24/council-fortune-daeun';
import { extractPromptFacts } from '../gemma24/saju-knowledge';
import { dailyFortune } from './index';
import { parseSajuInputFromContext } from './from-saju-context';

export type YearFortuneCounselPayload = {
  year: number;
  seunKo: string;
  seunHanja: string;
  yearSipsin: string;
  daewoonSipsin: string;
  level: string;
  score: number;
  daeunLabel: string | null;
  daeunAdvice: string | null;
  yongsinElem: string | null;
};

export function tryYearFortuneFromSajuContext(
  sajuContext: string,
  year: number,
): YearFortuneCounselPayload | null {
  const input = parseSajuInputFromContext(sajuContext);
  if (!input) return null;
  try {
    const natal = calculate(input);
    const midYear = new Date(Date.UTC(year, 6, 15, 12, 0, 0));
    const f = dailyFortune(natal, midYear);
    const yg = calcYear(year, 6, 15);
    const seunKo = `${STEMS[yg.s] ?? ''}${BRANCHES[yg.b] ?? ''}`;
    const seunHanja = `${STEMS_H[yg.s] ?? ''}${BRANCHES_H[yg.b] ?? ''}`;
    const facts = extractPromptFacts(sajuContext);
    const { periods } = parseDaeunFromQuery(sajuContext);
    const period = periods.find((p) => year >= p.startYear && year <= p.endYear) ?? null;

    return {
      year,
      seunKo,
      seunHanja,
      yearSipsin: f.background.yearSipsin,
      daewoonSipsin: f.background.daewoonSipsin,
      level: f.level,
      score: f.score,
      daeunLabel: period?.label ?? null,
      daeunAdvice: period
        ? adviseDaeunPeriod(period, facts.yongsinElem, facts.gisinElems)
        : null,
      yongsinElem: facts.yongsinElem,
    };
  } catch {
    return null;
  }
}

export function buildYearFortuneCounselReply(
  p: YearFortuneCounselPayload,
  counselorName: string,
): string {
  const who = counselorName ? `『${counselorName}』입니다. ` : '';
  const topic = `${p.year}년 운세`;
  const mood =
    p.level === '매우 좋음' || p.level === '좋음'
      ? '세운 기운이 전반적으로 받쳐 주는 해입니다.'
      : p.level === '보통'
        ? '무리하지 않고 리듬을 맞추면 안정적으로 가는 해입니다.'
        : '속도를 조절하고 선택을 가볍게 하는 편이 좋은 해입니다.';

  const lines = [
    `${who}질문하신 「${topic}」를 입력하신 사주와 ${p.year}년 세운(歲運)으로 풀어 보았습니다.`,
    '',
    `◆ ${p.year}년 세운`,
    `${p.seunKo}(${p.seunHanja}) · 일간 기준 십신 ${p.yearSipsin}`,
    `${mood} (연간 종합 ${p.level})`,
    '',
    '◆ 대운과 맞물린 흐름',
    `대운 ${p.daewoonSipsin} · 세운 ${p.yearSipsin} — 10년 대운 위에서 1년 단위로 읽습니다.`,
  ];

  if (p.daeunLabel && p.daeunAdvice) {
    lines.push(`— ${p.year}년은 ${p.daeunLabel} 대운 구간: ${p.daeunAdvice}`);
  }
  if (p.yongsinElem) {
    lines.push(
      `— 용신 ${p.yongsinElem} 방향(안정·관리)에 맞춰 상반기는 기반을, 하반기는 실행·정리에 두면 좋습니다.`,
    );
  }

  lines.push(
    '',
    `◆ ${p.year}년 이렇게 보면 좋아요`,
    `세운 십신 ${p.yearSipsin}에 맞게 중요한 결정은 서두르지 말고, 몸과 마음의 리듬을 맞추세요.`,
    '이직·이사·관계 전환은 교운(交運) 전후 1~2년은 특히 신중히 검토하는 편이 안정에 가깝습니다.',
    '',
    `위 내용은 ${p.year}년 세운과 사주 흐름을 바탕으로 한 참고 풀이입니다.`,
  );

  return lines.join('\n');
}
