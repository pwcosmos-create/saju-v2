/**
 * 인증 카드가 적을 때 프롬프트 확정 데이터로 섹션 보강 (LLM 없음)
 */
import { extractPromptFacts } from './saju-knowledge';
import { FORTUNE_SECTION_TITLES, formatFortuneSectionHeader } from './fortune-display-order';

const STEM_BLURB: Record<string, string> = {
  갑목: '큰 나무처럼 성장·개척 욕구가 강하고, 시작과 리더십에 유리한 기운입니다.',
  을목: '부드러운 풀처럼 유연하고 적응력이 좋으며, 조율·협력에 강점이 있습니다.',
  병화: '태양처럼 밝고 표현력이 강하며, 추진력과 존재감이 두드러집니다.',
  정화: '촛불처럼 섬세하고 직관이 뛰어나며, 디테일·감성 영역에 강합니다.',
  무토: '큰 산처럼 안정적이고 책임감이 강하며, 신뢰를 쌓는 데 유리합니다.',
  기토: '밭 흙처럼 포용력이 있고 실무·중재에 강하며, 끈기 있는 관리가 특징입니다.',
  경금: '쇠처럼 결단력과 원칙이 분명하며, 정리·실행력이 강합니다.',
  신금: '보석처럼 섬세하고 완성도를 중시하며, 분석·미감에 강점이 있습니다.',
  임수: '큰 물처럼 포용·유통이 넓고, 변화 속에서 기회를 보는 편입니다.',
  계수: '이슬·지하수처럼 섬세하고 통찰력이 있으며, 내면·기획에 강합니다.',
};

const ELEM_TIP: Record<string, string> = {
  목: '성장·학습·인맥 확장에 에너지를 쓰면 좋습니다.',
  화: '표현·브랜딩·대외 활동에서 강점이 드러납니다.',
  토: '안정·신뢰·꾸준한 관리가 핵심입니다.',
  금: '정리·결단·원칙 있는 선택이 도움이 됩니다.',
  수: '휴식·학습·유연한 전략 수정이 균형을 맞춥니다.',
};

export type EnrichedSection = { id: string; title: string; body: string };

const PILLAR_BOILERPLATE_RE = /년주는\s*유년|월주는\s*사회|일주는\s*본인·배우자궁/;
const ENCYCLOPEDIC_RE =
  /십신\(十神\)은\s*일간을\s*중심으로|사주팔자\(四柱八字\)는\s*태어난|대운\(大運\)은\s*약\s*10년/;

/** 프롬프트 명식(일간·일주·용신)이 본문에 반영됐는지 */
export function lacksChartPersonalization(body: string, query: string): boolean {
  const q = query.trim();
  if (!q) return false;

  const { facts } = parsePromptContext(q);
  if (facts.stemKo && body.includes(facts.stemKo)) {
    if (/【[^】]+】|◆\s*테마\s*풀이|골라\s*말씀드립니다|오늘은\s*귀하의\s*사주에서/.test(body)) return true;
    if ((body.match(/^◆\s*/gm) ?? []).length >= 3) return true;
    return false;
  }
  if (facts.stemHanja && body.includes(facts.stemHanja)) return false;
  if (facts.gyeokguk && body.includes(facts.gyeokguk)) return false;

  const dayPillar = q.match(/일주:\s*([^\s|/·]+)/)?.[1]?.trim();
  if (dayPillar && dayPillar.length >= 2 && body.includes(dayPillar)) return false;

  const yongsin = q.match(/용신\(用神\)\s*=\s*([^\n]+)/)?.[1]?.trim();
  if (yongsin && body.includes(yongsin.slice(0, 1))) return false;

  if (PILLAR_BOILERPLATE_RE.test(body) && !/일간|일주|용신|기신/.test(body)) return true;
  if (ENCYCLOPEDIC_RE.test(body) && lacksPersonalizationForEncyclopedia(body, facts.stemKo)) return true;
  if (/관성이 강하면 조직·공무·규율·책임, 식상이면 기술·교육·창업·콘텐츠/.test(body)) return true;
  if (facts.stemKo || dayPillar) return true;

  return false;
}

function lacksPersonalizationForEncyclopedia(body: string, stemKo: string | null): boolean {
  if (!stemKo) return true;
  return !body.includes(stemKo);
}

function parsePromptContext(query: string) {
  const facts = extractPromptFacts(query);
  const strength = query.match(/최종 판정:\s*★\s*([^★\n]+)/)?.[1]?.trim() ?? null;
  const dominant = query.match(/지배 오행:\s*([^\n]+)/)?.[1]?.trim()
    ?? query.match(/지배 오행\(([^)]+)\)/)?.[1]?.trim()
    ?? null;
  const lacking = query.match(/부족 오행:\s*([^\n]+)/)?.[1]?.trim()
    ?? query.match(/보완 오행:\s*([^\n]+)/)?.[1]?.trim()
    ?? null;
  const yongsinLine = query.match(/용신\(用神\)\s*=\s*([^\n]+)/)?.[1]?.trim() ?? null;
  const huisinLine = query.match(/희신\(喜神\)\s*=\s*([^\n]+)/)?.[1]?.trim() ?? null;
  const gisinLine = query.match(/기신\(忌神\)\s*=\s*([^\n]+)/)?.[1]?.trim() ?? null;
  const pillars = query.match(/연주:[^\n]+/)?.[0]?.trim() ?? null;
  const gyeokLine = query.match(/▶ 격국[^]*?\n\s*([^\n※]+)/)?.[1]?.trim()
    ?? query.match(/격국:\s*([^\n]+)/)?.[1]?.trim()
    ?? facts.gyeokguk
    ?? null;
  const gyeokClean = gyeokLine?.replace(/\(\s*\)/g, '').replace(/\s+/g, ' ').trim() || null;

  const ohaengSummary = query.match(/목\s*\d+\s*개[^·\n]*·[^·\n]*·[^·\n]*·[^·\n]*·\s*수\s*\d+\s*개/)?.[0]?.trim()
    ?? query.match(/【오행 분포】[^]*?목[^]*?수[^]*?개/)?.[0]?.slice(0, 120)?.trim()
    ?? null;

  return {
    facts,
    strength,
    dominant,
    lacking,
    yongsinLine,
    huisinLine,
    gisinLine,
    pillars,
    gyeokLine,
    gyeokClean,
    ohaengSummary,
  };
}

const ELEM_HANJA: Record<string, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };

function formatYongsinHint(ctx: ReturnType<typeof parsePromptContext>): string {
  const raw = ctx.yongsinLine?.split(/[/·]/)[0]?.trim() ?? '';
  const elem = raw.match(/([목화토금수])/)?.[1] ?? ctx.facts.yongsinElem;
  if (!elem) return '확정 용신';
  const hanja =
    raw.match(/\(([土金水木火])\)/)?.[1]
    ?? raw.match(/\(([土金水木火])/)?.[1]
    ?? ELEM_HANJA[elem]
    ?? '';
  return hanja ? `${elem}(${hanja})` : elem;
}

function cleanGyeokLabel(gyeok: string | null | undefined): string {
  const g = (gyeok ?? '격국')
    .replace(/[（(]\s*[）)]/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return g || '격국';
}

/** 카드 조합 후 빈 [1][4][5][2] 등 채우기 */
export function buildPromptEnrichedSections(
  query: string,
  filledSectionIds: Set<string>,
): EnrichedSection[] {
  const ctx = parsePromptContext(query);
  const { facts } = ctx;
  const out: EnrichedSection[] = [];

  if (!filledSectionIds.has('1') && facts.stemKo) {
    const blurb = STEM_BLURB[facts.stemKo] ?? '일간 기운이 사주 전체 해석의 중심이 됩니다.';
    const hanja = facts.stemHanja ? `(${facts.stemHanja})` : '';
    out.push({
      id: '1',
      title: FORTUNE_SECTION_TITLES['1'],
      body: [
        `◆ 일간 ${facts.stemKo}${hanja}`,
        `— ${blurb}`,
        ctx.strength ? `— 신강·신약: ${ctx.strength}` : '',
        ctx.pillars ? `— 사주: ${ctx.pillars}` : '',
      ].filter(Boolean).join('\n'),
    });
  }

  if (!filledSectionIds.has('2') && ctx.pillars) {
    out.push({
      id: '2',
      title: FORTUNE_SECTION_TITLES['2'],
      body: `◆ 사주 구성\n— ${ctx.pillars}\n— 아래 격국·오행·용신 해석은 이 원국을 기준으로 읽으시면 됩니다.`,
    });
  }

  if (!filledSectionIds.has('4') && (ctx.dominant || ctx.lacking || ctx.ohaengSummary)) {
    out.push({
      id: '4',
      title: FORTUNE_SECTION_TITLES['4'],
      body: [
        '◆ 오행 분포',
        ctx.ohaengSummary ? `— ${ctx.ohaengSummary}` : '',
        ctx.dominant ? `— 넘치는 기운: ${ctx.dominant}` : '',
        ctx.lacking ? `— 보완하면 좋은 기운: ${ctx.lacking}` : '',
        facts.stemKo
          ? `— ${facts.stemKo} 일간 기준, 부족한 오행을 색·음식·리듬으로 보완하면 균형에 가깝습니다.`
          : '— 넘치는 오행은 강점으로 쓰되 과하면 조절하고, 부족한 오행은 생활 습관으로 채우면 균형이 맞습니다.',
      ].filter(Boolean).join('\n'),
    });
  }

  if (!filledSectionIds.has('5') && (ctx.yongsinLine || ctx.gisinLine)) {
    const yElem = facts.yongsinElem;
    const tip = yElem ? ELEM_TIP[yElem] : '';
    out.push({
      id: '5',
      title: FORTUNE_SECTION_TITLES['5'],
      body: [
        '◆ 확정 오행 분류',
        ctx.yongsinLine ? `— 용신: ${ctx.yongsinLine}` : '',
        ctx.huisinLine ? `— 희신: ${ctx.huisinLine}` : '',
        ctx.gisinLine ? `— 기신: ${ctx.gisinLine}` : '',
        tip ? `— 활용: ${tip}` : '',
      ].filter(Boolean).join('\n'),
    });
  }

  return out;
}

/** 절 id별 규칙 기반 초안 (LLM·카드 실패 시) */
export function buildOfflineFortuneSection(query: string, sectionId: string): string | null {
  const ctx = parsePromptContext(query);
  const { facts } = ctx;
  const yTip = facts.yongsinElem ? ELEM_TIP[facts.yongsinElem] : '용신 방향으로 일·관계를 맞추면 흐름이 부드러워집니다.';
  const gyeok = cleanGyeokLabel(ctx.gyeokClean ?? ctx.gyeokLine ?? facts.gyeokguk);

  const header = (id: keyof typeof FORTUNE_SECTION_TITLES) =>
    formatFortuneSectionHeader(id, FORTUNE_SECTION_TITLES[id]);

  switch (sectionId) {
    case '1': {
      if (!facts.stemKo) return null;
      const blurb = STEM_BLURB[facts.stemKo] ?? '일간 기운이 사주 전체 해석의 중심이 됩니다.';
      const dayToken = query.match(/일주:\s*([^\s/|·]+)/)?.[1] ?? '';
      const pillarHanja = dayToken.match(/\(([^)]+)\)/)?.[1]?.trim();
      const hanja = pillarHanja
        ? `(${pillarHanja})`
        : facts.stemHanja
          ? `(${facts.stemHanja})`
          : '';
      return [
        header('1'),
        '',
        `◆ 일간 ${facts.stemKo}${hanja}`,
        `— ${blurb}`,
        ctx.strength ? `— 신강·신약: ${ctx.strength}` : '',
        ctx.pillars ? `— 사주: ${ctx.pillars}` : '',
      ].filter(Boolean).join('\n');
    }
    case '2':
      return ctx.pillars
        ? [header('2'), '', `◆ 사주 구성\n— ${ctx.pillars}\n— 격국·용신·운세는 이 네 기둥을 기준으로 읽습니다.`].join('\n')
        : null;
    case '4':
      return (ctx.dominant || ctx.lacking || ctx.ohaengSummary)
        ? [
            header('4'),
            '',
            '◆ 오행 분포',
            ctx.ohaengSummary ? `— ${ctx.ohaengSummary}` : '',
            ctx.dominant ? `— 넘치는 기운: ${ctx.dominant}` : '',
            ctx.lacking ? `— 보완하면 좋은 기운: ${ctx.lacking}` : '',
            facts.stemKo
              ? `— ${facts.stemKo} 일간 기준, 부족한 오행(특히 ${ctx.lacking?.replace(/.*?:\s*/, '') ?? '금·수'})을 색·음식·리듬으로 보완하면 균형에 가깝습니다.`
              : '',
          ].filter(Boolean).join('\n')
        : null;
    case '3':
      return [
        header('3'),
        '',
        `◆ 십신·격국`,
        `— ${gyeok}은(는) ${facts.stemKo ? `${facts.stemKo} 일간` : '일간'}과 맞물릴 때 직업·재물의 큰 틀을 보여 줍니다.`,
        '— 십신은 비겁·식상·재성·관성·인성 조합으로 읽으며, 한 가지만으로 길흉을 단정하지 않습니다.',
      ].join('\n');
    case '5':
      return (ctx.yongsinLine || ctx.gisinLine)
        ? [
            header('5'),
            '',
            '◆ 용신·기신',
            ctx.yongsinLine ? `— 용신: ${ctx.yongsinLine}` : '',
            ctx.huisinLine ? `— 희신: ${ctx.huisinLine}` : '',
            ctx.gisinLine ? `— 기신: ${ctx.gisinLine}` : '',
            `— ${yTip}`,
          ].filter(Boolean).join('\n')
        : null;
    case '6':
      return [
        header('6'),
        '',
        `◆ ${gyeok}과 직업`,
        `— ${gyeok}은 맞는 환경에서 강점이 드러나는 편입니다. ${ctx.strength ? `현재 ${ctx.strength}입니다.` : ''}`,
        `— ${yTip}`,
      ].join('\n');
    case '9':
      return [
        header('9'),
        '',
        '◆ 대운·세운',
        '— 세운·월운은 확정 데이터와 함께 읽을 때 정확합니다. 상반기는 기반을 다지고, 하반기는 용신 방향으로 실행·정리하는 흐름이 맞습니다.',
        '— 급한 결정은 피하고, 몸과 마음의 리듬을 맞추면 운의 변화를 더 잘 타실 수 있습니다.',
      ].join('\n');
    case '8':
      return [
        header('8'),
        '',
        '◆ 재물',
        ctx.dominant ? `— 지배 오행(${ctx.dominant})이 강한 만큼 익숙한 방식으로 수입을 만들 때 안정감이 큽니다.` : '— 수입·지출을 한 달 단위로 기록하면 흐름이 보입니다.',
        '— 무리한 투자보다 용신 방향에 맞는 속도로 쌓는 편이 유리합니다.',
      ].join('\n');
    case '7':
      return [
        header('7'),
        '',
        '◆ 연애·관계',
        '— 일지(日支)와의 합·충을 참고로 쓰되, 특정 인연·이별 시기는 단정하지 않습니다.',
        facts.stemKo ? `— ${facts.stemKo} 일간은 관계에서도 본인의 리듬을 지키는 편이 안정에 가깝습니다.` : '',
      ].filter(Boolean).join('\n');
    case '10': {
      const yHint = formatYongsinHint(ctx);
      return [
        header('10'),
        '',
        '◆ 실천·마무리',
        facts.stemKo
          ? `— ${facts.stemKo} 일간의 강점을 살리되, 용신 ${yHint}을(를) 일상 습관으로 옮기는 것이 핵심입니다.`
          : `— 용신 ${yHint}을(를) 작은 습관으로 옮기는 것이 핵심입니다.`,
        '— 중요한 결정은 하루 이상 숙성한 뒤 판단해 주세요.',
      ].join('\n');
    }
    default:
      return null;
  }
}

/** LLM 보충 실패 시 [6][8][9][10] 규칙 기반 초안 */
export function buildOfflineHybridSupplement(query: string): string {
  const ctx = parsePromptContext(query);
  const { facts } = ctx;
  const yTip = facts.yongsinElem ? ELEM_TIP[facts.yongsinElem] : '용신 방향으로 일·관계를 맞추면 흐름이 부드러워집니다.';
  const gyeok = cleanGyeokLabel(ctx.gyeokClean ?? ctx.gyeokLine ?? facts.gyeokguk);

  const sections: { id: keyof typeof FORTUNE_SECTION_TITLES; lines: string[] }[] = [
    {
      id: '9',
      lines: [
        '◆ 시기별 조언',
        '— 세운·월운은 확정 데이터와 함께 읽을 때 정확합니다. 상반기는 기반을 다지고, 하반기는 용신 방향으로 실행·정리하는 흐름이 맞습니다.',
        '— 급한 결정은 피하고, 몸과 마음의 리듬을 맞추면 운의 변화를 더 잘 타실 수 있습니다.',
      ],
    },
    {
      id: '8',
      lines: [
        '◆ 재물 흐름',
        `— ${ctx.dominant ? `지배 오행(${ctx.dominant})이 강한 만큼,` : ''} 익숙한 방식으로 수입을 만들 때 안정감이 큽니다.`,
        '— 지출·투자는 기신 방향(과한 욕심·무리한 레버리지)을 피하고, 용신 에너지에 맞는 속도로 쌓는 편이 유리합니다.',
      ],
    },
    {
      id: '7',
      lines: [
        '◆ 인연·관계 흐름',
        '— 지지 합·충은 특정 시기·상대와의 궁합 참고로 쓰면 좋습니다. 단정보다 「이럴 때 조심」 톤으로 읽어 주세요.',
      ],
    },
    {
      id: '6',
      lines: [
        `◆ ${gyeok}이 말하는 일의 방향`,
        `— ${gyeok}은 타고난 일 처리 방식과 맞는 환경을 가리킵니다. ${ctx.strength ? `현재 ${ctx.strength}이므로,` : ''} 무리한 확장보다 강점이 드러나는 분야에 집중하면 좋습니다.`,
        `— ${yTip}`,
      ],
    },
    {
      id: '10',
      lines: [
        '◆ 평생 기억할 원칙',
        `— ${facts.stemKo ? `${facts.stemKo} 일간의 강점을 살리되,` : ''} 용신(${ctx.yongsinLine ?? '확정 용신'})을 일상 습관으로 옮기는 것이 이 사주의 핵심 전략입니다.`,
      ],
    },
  ];

  const blocks: string[] = [];
  for (const sec of sections) {
    blocks.push(formatFortuneSectionHeader(sec.id, FORTUNE_SECTION_TITLES[sec.id]), '', ...sec.lines, '');
  }
  return blocks.join('\n').trim();
}
