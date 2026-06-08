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

const CURRENT_DAEUN_ADVICE: Record<string, { flow: string; action: string }> = {
  '목_yongsin': {
    flow: '성장의 나무 기운이 용신으로 작용하여, 새로운 배움이나 새로운 사람을 사귀며 영역을 넓히는 데 최상의 기류를 탑니다.',
    action: '새로운 공부나 취미, 대인 관계의 영역 확장을 주저하지 말고 적극적으로 추진하세요.'
  },
  '목_gisin': {
    flow: '나무 기운이 과해지면 시작은 거창하지만 끝이 흐지부지되고 에너지만 낭비하게 될 염려가 큽니다.',
    action: '무리하게 일을 벌리지 말고, 기존에 하던 일의 마무리에 80% 이상의 에너지를 집중하세요.'
  },
  '목_neutral': {
    flow: '조화와 조율이 관건입니다. 급격한 모험을 하기보다 기존의 인맥과 자원을 조용히 가꾸는 단계입니다.',
    action: '지식 습득이나 자격 취득에 집중하고, 주변 사람들과 긴밀히 조율하며 조용히 내실을 다지세요.'
  },
  '화_yongsin': {
    flow: '화사한 불의 기운이 행운으로 작용하여, 나 자신을 대외적으로 널리 알리고 브랜딩하며 존재감을 드러내기에 아주 좋습니다.',
    action: '나의 재능 and 성과를 적극적으로 홍보하고, 밝은 대외 활동과 소통의 기회를 늘려보세요.'
  },
  '화_gisin': {
    flow: '감정이 지나치게 과열되거나 성급한 결정으로 후회할 일이 생기기 쉽고, 마음만 바쁘고 번아웃이 올 수 있습니다.',
    action: '충동적인 결정을 피하기 위해 10초간 심호흡을 하거나, 중요한 판단은 반드시 하루 숙성한 뒤 내리세요.'
  },
  '화_neutral': {
    flow: '대외적인 화려함에 휩쓸리지 않고, 실행과 휴식의 밸런스를 고르게 맞추며 기반을 닦는 시기입니다.',
    action: '무작정 추진하기보다 속도를 다소 조율하면서 내실 있는 성과를 만드는 데 전념하세요.'
  },
  '토_yongsin': {
    flow: '안정적이고 든든한 흙의 기운이 마음의 중심을 잡아주어, 꾸준하게 노력해 온 일에서 큰 신뢰와 신용을 쌓게 됩니다.',
    action: '자산 관리, 중장기 계약 등 묵직하게 가치를 축적할 수 있는 일에 정성을 쏟으세요.'
  },
  '토_gisin': {
    flow: '고집과 독단이 강해져 주변과 소통이 막히거나, 생각이 과도하게 많아져 실천이 늦어지고 답답해질 수 있습니다.',
    action: '타인의 비판이나 피드백을 유연하게 수용하고, 완벽주의에 갇히기 전에 가벼운 실행부터 즉시 착수하세요.'
  },
  '토_neutral': {
    flow: '세상의 변화 속에서도 내 자리를 평온하게 지키며, 주변 사람들과의 두터운 신뢰를 쌓아가는 구간입니다.',
    action: '변화를 서두르기보다 평화롭고 규칙적인 생활 리듬을 사수하며 기반을 다듬어 보세요.'
  },
  '금_yongsin': {
    flow: '결단력과 원칙을 세우는 쇠의 기운이 기회로 작동하여, 비효율적인 일이나 이롭지 않은 관계를 시원하게 정리하게 됩니다.',
    action: '소신을 가지고 복잡한 일을 과감히 쳐내며, 가장 핵심적인 프로젝트에 역량을 올인하세요.'
  },
  '금_gisin': {
    flow: '완벽주의 성향이 지나치게 발동해 본인과 대상을 엄격한 잣대로 재단하고 차가운 말로 주변에 상처를 주기 쉽습니다.',
    action: '나와 타인의 실수를 너그럽게 품는 여유를 가지고, 옳고 그름을 들이대기 전에 따뜻하게 공감해 주세요.'
  },
  '금_neutral': {
    flow: '규칙적이고 합리적인 시스템을 구축하는 때로, 실속을 챙기면서 향후 도약을 위한 기반을 닦아가는 구간입니다.',
    action: '정리정돈과 시간 관리 등 사소한 일상의 질서를 바로잡으며 미래의 칼날을 정교하게 갈아두세요.'
  },
  '수_yongsin': {
    flow: '깊고 차분한 물의 지혜가 행운이 되어, 번잡한 생각들이 깔끔히 정돈되고 지혜롭고 깊이 있는 기획과 전략이 빛을 봅니다.',
    action: '외부 활동의 양을 조절하는 대신 조용한 공부, 글쓰기, 전략 수립에 집중적인 시간을 투자해 보세요.'
  },
  '수_gisin': {
    flow: '부정적인 잡념이나 우울감에 사로잡혀 생각의 동굴 속으로 파고들고, 대외 활동을 과도하게 피할 우려가 있습니다.',
    action: '일부러 야외로 나가 햇볕을 쬐며 30분 이상 걸어주고, 신뢰하는 이들과 속 깊은 대화를 자주 나누세요.'
  },
  '수_neutral': {
    flow: '밖으로 쏟아붓기보다는 힘을 충전하고 삶의 큰 물줄기를 조용히 관조하며 내적 공력을 채우는 시기입니다.',
    action: '마음의 여백을 두고 책을 읽거나 수영, 명상 등을 즐기며 건강과 정신적 평안을 채워가세요.'
  }
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

  // 1. Introduction
  lines.push(
    `사주 명리학에서 운(運)의 흐름을 읽는 것은 내 삶의 계절과 날씨 변화를 파악하는 것과 같습니다.`,
    '',
    `* 🌊 **10년 대운(大運):** 10년 주기로 바뀌는 내 삶의 '거시적인 계절'이자 환경입니다. 어떤 대운이 들어왔는지에 따라 내가 활동할 무대의 성격이 크게 달라집니다.`,
    `* ☀️ **매년 세운(歲運):** 1년 주기로 매해 찾아오는 '날씨'입니다. 대운이라는 계절 안에서 비가 내리거나 햇볕이 내리쬐는 일년 단위의 흐름을 보여줍니다.`,
    `* 🌙 **매월 월운(月運):** 한 달 단위로 불어오는 '바람'과 같아서, 일상 속의 소소한 리듬과 길흉의 기복을 알려줍니다.`,
    ''
  );

  // 2. 10-Year Daeun Cycle
  lines.push(
    `### 🗓️ 귀하의 10년 대운 흐름`,
    '',
    `귀하의 대운은 **${dir}**하는 흐름을 타며, **${periods[0]!.age}세**부터 새로운 10년 주기의 구간으로 나뉘어 흐릅니다. 10년 단위의 흐름과 각 시기에 맞는 삶의 자세는 다음과 같습니다.`,
    ''
  );

  for (const p of periods) {
    const elem = stemElemFromLabel(p.label);
    const elemName = elem === '목' ? '목(木·나무)' :
                     elem === '화' ? '화(火·불)' :
                     elem === '토' ? '토(土·흙)' :
                     elem === '금' ? '금(金·쇠)' :
                     elem === '수' ? '수(水·물)' : '';
    const stemInfo = elemName ? ` [${elemName} 기운]` : '';
    lines.push(
      `* **${p.age}세 (${p.startYear}~${p.endYear}) ${p.label} 대운:**${stemInfo} ${adviseDaeunPeriod(p, yongsinElem, gisinElems)}`
    );
  }

  // 3. Current Daeun Focus
  if (birthYear) {
    const cur = findCurrentPeriod(periods, birthYear);
    const age = new Date().getFullYear() - birthYear;
    if (cur) {
      lines.push(
        '',
        `### 🎯 지금 나에게 작용하는 운: **${cur.label}** 대운 (현재 ${age}세)`,
        '',
        `현재 귀하는 **${cur.age}세(${cur.startYear}~${cur.endYear}) ${cur.label} 대운**의 한가운데를 지나고 있습니다. 이 시기에는 아래의 포인트에 초점을 맞추어 행동하는 것이 대단히 유리합니다.`,
        ''
      );

      const pe = stemElemFromLabel(cur.label);
      const status = (pe === yongsinElem) ? 'yongsin' : (gisinElems.includes(pe ?? '') ? 'gisin' : 'neutral');
      const adviceKey = `${pe}_${status}`;
      const customAdvice = CURRENT_DAEUN_ADVICE[adviceKey];

      if (customAdvice) {
        lines.push(
          `* 🌊 **현재 대운의 핵심 흐름:** ${customAdvice.flow}`,
          `* 💡 **현재 대운에서의 행동 요령:** ${customAdvice.action}`
        );
      } else {
        lines.push(
          `* 🌊 **현재 대운의 핵심 흐름:** ${adviseDaeunPeriod(cur, yongsinElem, gisinElems)}`,
          yongsinElem ? `* 💡 **현재 대운에서의 행동 요령:** 내 행운의 기운인 ${yongsinElem}의 기류에 맞춰 안정적인 환경을 구축하고 무리한 확장을 자제하는 편이 이롭습니다.` : `* 💡 **현재 대운에서의 행동 요령:** 흐름을 성급하게 재촉하지 말고 차근차근 내실을 쌓아나가는 것이 좋습니다.`
        );
      }

      const next = periods.find((p) => p.age === cur.age + 10);
      if (next && age >= cur.age + 7) {
        lines.push(
          '',
          `> ⚠️ **교운기(交運期) 주의:**`,
          `> 귀하는 현재 다음 대운인 **${next.label} 대운**으로 넘어가는 과도기(교운기)를 지나고 있거나 진입을 앞두고 있습니다. 대운이 바뀌는 전후 1~2년은 삶의 큰 환경적 변화(이직, 이사, 중요한 인간관계의 정리 등)나 가치관의 대전환이 일어나는 과도기입니다. 무리한 확장이나 성급한 결정을 피하고 완급을 조율하시는 것을 권장합니다.`
        );
      }
    }
  }

  // 4. Annual & Monthly Flow
  const monthlyLines = parseMonthlyBlock(query);
  const seun = parseSeunYear(query);
  const monthly = parseMonthlyHighlights(query);
  if (seun || monthlyLines.length || monthly.good.length || monthly.caution.length) {
    lines.push(
      '',
      `### 🗓️ 올해(세운)와 월별 운세 흐름`,
      '',
      `일 년 단위의 세운(歲運)은 나에게 주어지는 단기적인 계절 날씨이며, 월운(月운)은 그 아래에서 부는 일상의 바람과 같습니다.`,
      ''
    );

    if (seun) {
      lines.push(`* 🌟 **올해의 세운:** **${seun}**의 기운을 만나 현실적인 환경 속에서 나만의 역할을 조율하는 해입니다.`);
    }

    const h1 = summarizeMonthlyHalf(monthlyLines, 1, 6);
    const h2 = summarizeMonthlyHalf(monthlyLines, 7, 12);
    if (h1 || h2) {
      lines.push('');
      if (h1) lines.push(`* **상반기 흐름:** ${h1}`);
      if (h2) lines.push(`* **하반기 흐름:** ${h2}`);
    }

    if (monthly.good.length) {
      lines.push(
        '',
        `#### 🌟 올해 나를 돕는 활력의 시기 (Good Months)`,
        `가장 흐름이 매끄럽고 나에게 든든한 조력이나 기회가 찾아오기 좋은 시기입니다. 중요한 프로젝트의 론칭, 계약, 적극적인 홍보나 새로운 도전은 가급적 이 시기를 조준해 보세요.`
      );
      for (const g of monthly.good) {
        lines.push(`* **${g.trim()}**`);
      }
    }

    if (monthly.caution.length) {
      lines.push(
        '',
        `#### ⚠️ 반 박자 쉬어가는 조율의 시기 (Caution Months)`,
        `기운의 불균형이 강해지거나 예상치 못한 감정적 마찰, 체력 저하가 일어나기 쉬운 시기입니다. 무리한 행동을 삼가고 내실과 휴식을 채우는 안정의 타이밍으로 활용하는 것이 현명합니다.`
      );
      for (const c of monthly.caution) {
        lines.push(`* **${c.trim()}**`);
      }
    }
  }

  // 5. Daily Mindset & Habit Remedy Guide
  lines.push(
    '',
    `### 💡 대운과 세운을 내 편으로 만드는 개운(開運) 습관`,
    '',
    `나에게 이로운 운이 찾아왔을 때는 날개를 펼치고, 조율해야 하는 운이 찾아왔을 때는 돛을 내리는 지혜가 필요합니다. **${stemKo || '일간'}**의 기질을 건강하게 살리기 위해 일상 속에서 아래 실천 행동을 마음에 새겨두세요.`,
    '',
    `1. ⚖️ **속도보다 방향이 중요합니다:** 대운의 큰 파도 위에서 조급함에 못 이겨 내리는 결정은 대개 악수가 되기 쉽습니다. 특히 주의해야 할 기신 기운이 강해지는 타이밍에는 결정을 최소 24시간 미루는 습관을 들여보세요.`,
    `2. 🧘 **일상의 환경과 소품 조율:** ${yongsinElem ? `내 행운의 기운인 **${yongsinElem}**의 요소(색상, 공간 환경, 습관 등)를 가까이 두어 내면의 기류가 흩어지지 않도록 단단히 다잡아 줍니다.` : '내 사주의 에너지가 고르게 흐를 수 있도록 든든하고 안정적인 하루 루틴을 일정하게 고수해 보세요.'}`,
    `3. 🌱 **몸과 마음의 신호에 귀 기울이기:** 세운과 대운이 교차할 때는 건강과 수면이 기운을 방어하는 최전선이 됩니다. 마음이 불안할 때는 깊은 호흡을 하고, 충분한 휴식과 수분 섭취로 몸의 에너지를 맑게 유지해 보세요.`
  );

  return lines.join('\n');
}
