/**
 * 대운·세운 섹션([9]) — 프롬프트 확정 데이터 기반 오프라인 풀이
 */
import { ELEM_NAMES, STEM_ELEM, STEMS } from '../pillar-calc/korean-calendar-engine';

export type DaeunPeriod = {
  age: number;
  startYear: number;
  endYear: number;
  label: string;
};

const STEM_KO_TO_ELEM: Record<string, string> = {
  갑: '목', 을: '목', 병: '화', 정: '화', 무: '토', 기: '토', 경: '금', 신: '금', 임: '수', 계: '수',
};

const ELEM_VS_YONGSIN: Record<string, { match: string; clash: string; neutral: string }> = {
  목: {
    match: '성장·학습·인맥 확장에 에너지가 실리기 쉬운 시기',
    clash: '확장 욕심을 줄이고, 기존 성과를 정리하는 시기',
    neutral: '새 출발보다 기반을 다지며 조율하는 시기',
  },
  화: {
    match: '표현·브랜딩·대외 활동에서 성과가 나기 쉬운 시기',
    clash: '과열·성급한 결정을 피하고, 체력·수면을 챙기는 시기',
    neutral: '속도를 조절하며 실행과 휴식의 균형을 맞추는 시기',
  },
  토: {
    match: '안정·신뢰·꾸준한 관리가 통하는 시기',
    clash: '고집·부담을 줄이고, 역할 분담을 재정리하는 시기',
    neutral: '변화를 서두르지 않고, 신뢰를 쌓는 시기',
  },
  금: {
    match: '정리·결단·원칙 있는 선택이 도움이 되는 시기',
    clash: '경직·완고함을 완화하고, 관계에서 여유를 두는 시기',
    neutral: '규칙과 유연함을 함께 챙기는 시기',
  },
  수: {
    match: '휴식·학습·전략 수정으로 균형을 맞추기 좋은 시기',
    clash: '불안·우유부단을 줄이고, 실행 가능한 범위만 잡는 시기',
    neutral: '내면을 다지며 다음 단계를 준비하는 시기',
  },
};

export function parseDaeunFromQuery(query: string): {
  periods: DaeunPeriod[];
  forward: boolean | null;
  birthYear: number | null;
} {
  const birthYear = Number.parseInt(query.match(/생년월일:\s*(\d{4})년/)?.[1] ?? '', 10) || null;
  const forward =
    /대운:[^\n]*역행/.test(query) ? false : /대운:[^\n]*순행/.test(query) ? true : null;

  const detailedBlock = query.match(/【대운 데이터[^】]*】\s*([\s\S]*?)(?=【|━━━\s*✍|━━━\s*글|$)/)?.[1];
  if (detailedBlock) {
    const periods: DaeunPeriod[] = [];
    for (const m of detailedBlock.matchAll(
      /^-\s*(\d+)세\((\d{4})~(\d{4})\):\s*([^\n]+)/gm,
    )) {
      periods.push({
        age: Number.parseInt(m[1]!, 10),
        startYear: Number.parseInt(m[2]!, 10),
        endYear: Number.parseInt(m[3]!, 10),
        label: m[4]!.trim(),
      });
    }
    if (periods.length) return { periods, forward, birthYear };
  }

  const short = query.match(/대운:\s*([^\n(]+)/)?.[1]?.trim();
  if (short && birthYear) {
    const periods: DaeunPeriod[] = [];
    for (const m of short.matchAll(/(\d+)세:\s*([갑을병정무기경신임계][子丑寅卯辰巳午未申酉戌亥])/g)) {
      const age = Number.parseInt(m[1]!, 10);
      const startYear = birthYear + age;
      periods.push({
        age,
        startYear,
        endYear: startYear + 9,
        label: m[2]!,
      });
    }
    if (periods.length) return { periods, forward, birthYear };
  }

  return { periods: [], forward, birthYear };
}

function stemElemFromLabel(label: string): string | null {
  const stem = label.match(/^([갑을병정무기경신임계])/)?.[1];
  if (!stem) return null;
  const idx = STEMS.indexOf(stem as (typeof STEMS)[number]);
  if (idx >= 0) return ELEM_NAMES[STEM_ELEM[idx]];
  return STEM_KO_TO_ELEM[stem] ?? null;
}

/** 대운 구간별 조언 (상담·세운 풀이 공용) */
export function adviseDaeunPeriod(
  period: DaeunPeriod,
  yongsinElem: string | null,
  gisinElems: string[],
): string {
  const pe = stemElemFromLabel(period.label);
  if (!pe || !yongsinElem) return '명식에 맞는 속도로 기반을 다지는 시기';
  const tips = ELEM_VS_YONGSIN[pe];
  if (!tips) return '흐름을 관찰하며 무리하지 않는 시기';
  if (pe === yongsinElem) return tips.match;
  if (gisinElems.includes(pe)) return tips.clash;
  return tips.neutral;
}

function findCurrentPeriod(periods: DaeunPeriod[], birthYear: number): DaeunPeriod | null {
  const age = new Date().getFullYear() - birthYear;
  return (
    periods.find((p) => age >= p.age && age < p.age + 10)
    ?? periods.find((p) => age >= p.age - 2 && age < p.age + 12)
    ?? null
  );
}

function parseMonthlyBlock(query: string): string[] {
  const block = query.match(/【월별 엔진 데이터】\s*([\s\S]*?)(?=【|━━━\s*✍|\[10\]|$)/)?.[1];
  if (!block) return [];
  return block.split('\n').map((l) => l.trim()).filter((l) => /^\d+월/.test(l));
}

function parseMonthlyHighlights(query: string): { good: string[]; caution: string[] } {
  const lines = parseMonthlyBlock(query);
  const good = lines.filter((l) => /매우 좋음|★★★★|★★★★★/.test(l)).slice(0, 2);
  const caution = lines.filter((l) => /매우 주의|주의/.test(l) && !/매우 좋음/.test(l)).slice(0, 2);
  return { good, caution };
}

function summarizeMonthlyHalf(lines: string[], from: number, to: number): string | null {
  const slice = lines.filter((l) => {
    const m = l.match(/^(\d+)월/);
    if (!m) return false;
    const mo = Number.parseInt(m[1]!, 10);
    return mo >= from && mo <= to;
  });
  if (!slice.length) return null;
  const good = slice.filter((l) => /매우 좋음|★★★★|★★★★★|좋음/.test(l)).length;
  const bad = slice.filter((l) => /매우 주의|주의/.test(l) && !/매우 좋음/.test(l)).length;
  if (good >= 3 && bad <= 1) return `${from}~${to}월은 실행·대외 활동에 유리한 흐름이 많습니다.`;
  if (bad >= 3 && good <= 1) return `${from}~${to}월은 속도를 줄이고 기반·건강을 챙기는 편이 안정에 가깝습니다.`;
  return `${from}~${to}월은 좋은 달과 주의 달이 섞이니, 중요한 일은 데이터가 좋은 달에 맞추세요.`;
}

function parseSeunYear(query: string): string | null {
  return (
    query.match(/\d{4}년\s+[갑을병정무기경신임계][子丑寅卯辰巳午未申酉戌亥][^\n]*년/)?.[0]?.trim()
    ?? query.match(/\d{4}\s+[갑을병정무기경신임계][子丑寅卯辰巳午未申酉戌亥]\([^)]+\)/)?.[0]?.trim()
    ?? null
  );
}

/** 섹션 [9] 본문 (대운·세운) */
export function buildDaeunFortuneBody(opts: {
  periods: DaeunPeriod[];
  forward: boolean | null;
  birthYear: number | null;
  yongsinElem: string | null;
  gisinElems: string[];
  stemKo: string | null;
  query: string;
}): string | null {
  const { periods, forward, birthYear, yongsinElem, gisinElems, stemKo, query } = opts;
  if (!periods.length) return null;

  const lines: string[] = [];
  const dir = forward === false ? '역행' : forward === true ? '순행' : '흐름';
  lines.push(`◆ 10년 대운 ${dir}`, `— ${periods[0]!.age}세부터 ${periods.length}개 구간으로 읽습니다.`);

  lines.push('', '◆ 구간별 흐름 (10년 단위)');
  for (const p of periods) {
    lines.push(
      `— ${p.age}세(${p.startYear}~${p.endYear}) ${p.label}: ${adviseDaeunPeriod(p, yongsinElem, gisinElems)}`,
    );
  }

  if (birthYear) {
    const cur = findCurrentPeriod(periods, birthYear);
    const age = new Date().getFullYear() - birthYear;
    if (cur) {
      lines.push('', `◆ 지금(${age}세) — ${cur.label} 대운`);
      lines.push(`— ${adviseDaeunPeriod(cur, yongsinElem, gisinElems)}`);
      if (yongsinElem) {
        lines.push(`— 용신 ${yongsinElem} 방향(안정·관리)에 맞춰 역할을 정리하면 흐름이 부드럽습니다.`);
      }
      const next = periods.find((p) => p.age === cur.age + 10);
      if (next && age >= cur.age + 7) {
        lines.push(
          `— ${next.age}세(${next.startYear}년~) ${next.label}로 넘어가기 전후 1~2년은 교운(交運) 과도기로, 이직·이사·관계를 한꺼번에 밀지 않는 편이 안정에 가깝습니다.`,
        );
      }
    }
  }

  const monthlyLines = parseMonthlyBlock(query);
  const seun = parseSeunYear(query);
  const monthly = parseMonthlyHighlights(query);
  if (seun || monthlyLines.length || monthly.good.length || monthly.caution.length) {
    lines.push('', '◆ 올해·월운');
    if (seun) lines.push(`— 세운: ${seun}`);
    const h1 = summarizeMonthlyHalf(monthlyLines, 1, 6);
    const h2 = summarizeMonthlyHalf(monthlyLines, 7, 12);
    if (h1) lines.push(`— 상반기: ${h1}`);
    if (h2) lines.push(`— 하반기: ${h2}`);
    for (const g of monthly.good) {
      lines.push(`— 좋은 달: ${g.slice(0, 110)}`);
    }
    for (const c of monthly.caution) {
      lines.push(`— 주의 달: ${c.slice(0, 110)}`);
    }
    if (!h1 && !h2 && !monthly.good.length && !monthly.caution.length && yongsinElem) {
      lines.push(`— 상반기는 기반을 다지고, 하반기는 용신 ${yongsinElem} 쪽 실행·정리에 맞추면 좋습니다.`);
    }
  }

  if (stemKo) {
    lines.push('', '◆ 실천 포인트');
    lines.push(`— ${stemKo} 일간은 ${yongsinElem ?? '용신'} 기운을 생활 습관으로 옮길 때 대운을 타기 쉽습니다.`);
    lines.push('— 급한 결정은 피하고, 몸과 마음의 리듬을 맞추면 변화를 더 잘 받아들일 수 있습니다.');
  }

  return lines.join('\n');
}
