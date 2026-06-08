/**
 * 인증 카드가 적을 때 프롬프트 확정 데이터로 섹션 보강 (LLM 없음)
 */
import { buildDaeunFortuneBody, parseDaeunFromQuery } from './council-fortune-daeun';
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
        `◆ 타고난 기질과 성향`,
        `— 귀하의 타고난 본질을 상징하는 일간은 **${facts.stemKo}${hanja}**이에요.`,
        `— ${blurb}`,
        ctx.strength ? `— 사주의 균형과 강도는 **${ctx.strength}**의 상태를 보여줍니다.` : '',
        ctx.pillars ? `— 년·월·일·시의 균형 잡힌 기운은 **${ctx.pillars}**의 조합으로 구성되어 있어요.` : '',
      ].filter(Boolean).join('\n');
    }
    case '2':
      return ctx.pillars
        ? [
            header('2'),
            '',
            `◆ 사주 기둥 구성`,
            `— 태어난 연도, 월, 일, 시간의 기운인 **${ctx.pillars}**이 모여 나만의 고유한 인생 지도를 만듭니다.`,
            `— 네 개의 기둥(연주·월주·일주·시주)은 각각 유년기, 사회활동, 본인과 가정, 그리고 말년의 삶과 내면을 상징해요.`,
            `— 이 기둥들을 바탕으로 분석한 격국, 오행 분포, 용신을 읽으며 나를 더 깊이 이해하는 시간을 가져보세요.`
          ].join('\n')
        : null;
    case '4':
      return (ctx.dominant || ctx.lacking || ctx.ohaengSummary)
        ? [
            header('4'),
            '',
            '◆ 오행의 조화와 균형',
            ctx.ohaengSummary ? `— 우리 몸과 마음의 조화를 이루는 다섯 가지 기운(목, 화, 토, 금, 수)의 분포는 **${ctx.ohaengSummary}**의 모습을 보이고 있네요.` : '',
            ctx.dominant ? `— 상대적으로 기운이 뚜렷한 **${ctx.dominant}**은 귀하만의 훌륭한 재능이자 적극적인 추진력으로 활용하기 좋습니다.` : '',
            ctx.lacking ? `— 에너지를 더해줄 보완 오행인 **${ctx.lacking}**은 일상 속에서 의식적으로 채워주면 삶의 리듬이 훨씬 부드러워질 거예요.` : '',
            facts.stemKo
              ? `— **${facts.stemKo}** 일간을 기준으로, 부족한 기운(특히 ${ctx.lacking?.replace(/.*?:\s*/, '') ?? '금·수'})에 어울리는 색상, 음식, 생활 습관을 곁들이면 전체적인 사주의 균형을 맞추는 데 긍정적인 도움이 됩니다.`
              : '— 넘치는 기운은 과해지지 않도록 스스로 조율하고, 부족한 기운은 일상의 소소한 습관과 태도로 채워나가면 삶에 편안한 안정이 찾아옵니다.',
          ].filter(Boolean).join('\n')
        : null;
    case '3':
      return [
        header('3'),
        '',
        `◆ 사회적 역할과 강점`,
        `— 타고난 성향의 중심 틀이자 직업적 재능을 보여주는 격국은 **${gyeok}**이에요.`,
        facts.stemKo ? `— **${gyeok}**의 기운이 **${facts.stemKo}** 일간의 특성과 맞물리며, 사회에서 나만의 고유한 강점과 가치를 드러낼 수 있도록 든든하게 받쳐 줍니다.` : `— **${gyeok}**의 기운이 일간과 맞물리며, 내가 어떤 환경에서 직업적 완성도와 만족감을 높일 수 있는지 큰 방향을 제시해 줍니다.`,
        '— 사주를 구성하는 여러 기운(비겁, 식상, 재성, 관성, 인성)은 저마다의 역할이 있으니, 단편적인 길흉보다는 조화롭게 활용하는 것이 명리 공부의 참된 지혜랍니다.'
      ].join('\n');
    case '5':
      return (ctx.yongsinLine || ctx.gisinLine)
        ? [
            header('5'),
            '',
            '◆ 행운의 열쇠와 마음 조율',
            ctx.yongsinLine ? `— 사주의 치우침을 바로잡아주고 긍정적인 변화를 불러오는 으뜸 기운(용신)은 **${ctx.yongsinLine}**이에요.` : '',
            ctx.huisinLine ? `— 용신을 돕고 인생의 든든한 조력자 역할을 해주는 기운(희신)은 **${ctx.huisinLine}**이에요.` : '',
            ctx.gisinLine ? `— 에너지가 과할 때 주의하고 조절해 주면 좋은 기운(기신)은 **${ctx.gisinLine}**입니다.` : '',
            `— **실천 팁:** ${yTip}`,
          ].filter(Boolean).join('\n')
        : null;
    case '6':
      return [
        header('6'),
        '',
        `◆ 직업과 커리어 조언`,
        `— 귀하의 핵심 재능인 **${gyeok}**은 나에게 잘 맞는 환경을 만날 때 진정한 강점과 빛을 발하는 기질이에요. ${ctx.strength ? `현재 사주는 **${ctx.strength}**의 상태이므로, 과한 확장이나 무리한 모험보다는 본연의 전문성을 다지는 데 집중하시는 편이 유리합니다.` : ''}`,
        `— **커리어 실천:** ${yTip}`,
      ].join('\n');
    case '9': {
      const daeun = parseDaeunFromQuery(query);
      const body = buildDaeunFortuneBody({
        ...daeun,
        yongsinElem: facts.yongsinElem,
        gisinElems: facts.gisinElems,
        stemKo: facts.stemKo,
        query,
      });
      if (!body) {
        return [
          header('9'),
          '',
          '◆ 대운과 세운의 흐름',
          '— 큰 환경을 조율하는 10년의 대운과 매년 찾아오는 세운·월운의 변화는 나의 타고난 기질과 상호작용해요. 상반기에는 무리한 도전보다 내실을 탄탄히 다지고, 하반기에는 내 사주에 이로운 용신 방향으로 차분하게 실행하고 정리하는 흐름이 안전합니다.',
          '— 성급하거나 즉흥적인 판단은 피하시고, 몸과 마음의 리듬을 평화롭게 맞추어 나갈 때 다가오는 행운의 변화를 훨씬 더 매끄럽게 받아들일 수 있어요.',
        ].join('\n');
      }
      return [header('9'), '', body].join('\n');
    }
    case '8':
      return [
        header('8'),
        '',
        '◆ 풍요로운 재물 흐름',
        ctx.dominant ? `— 귀하의 사주에서 주도적인 **${ctx.dominant}** 기운이 든든한 기반인 만큼, 나에게 가장 익숙하고 확실한 방식으로 수입의 통로를 다져나갈 때 한결 큰 심리적 안정감과 결실을 맺게 될 거예요.` : '— 지출과 수입을 꼼꼼하게 기록하며 불필요한 누수를 막는 작은 생활 습관부터 시작해 보시는 것이 아주 좋습니다.',
        '— 일확천금을 노리는 무리한 투자나 과도한 확장은 피하시고, 내 사주에 도움을 주는 용신 기운에 맞추어 차근차근 자산을 쌓아가는 건강한 습관을 만들어 보세요.',
      ].join('\n');
    case '7':
      return [
        header('7'),
        '',
        '◆ 조화로운 인연과 관계',
        '— 대인관계나 연인 관계에서는 서로의 차이를 인정하고 배려하는 마음이 가장 아름다운 만남의 첫걸음이 되어 줍니다. 특정한 인연이나 타이밍을 섣불리 단정하기보다, 마음의 여유를 두고 편안하게 교감하는 편이 인연을 지키는 데 훨씬 이로워요.',
        facts.stemKo ? `— 특히 **${facts.stemKo}** 일간의 기질은 타인의 흐름에 쉽게 휩쓸리지 않고, 스스로의 평온한 리듬과 일상 공간을 조화롭게 지켜낼 때 관계에서도 가장 큰 중심을 잡을 수 있습니다.` : '',
      ].filter(Boolean).join('\n');
    case '10': {
      const yHint = formatYongsinHint(ctx);
      return [
        header('10'),
        '',
        '◆ 일상 속 실천과 마무리 조언',
        facts.stemKo
          ? `— **${facts.stemKo}** 일간의 타고난 장점을 힘차게 살리면서, 귀하에게 행운을 가져다주는 용신 **${yHint}** 기운을 일상 속의 소소한 습관(색상, 공간, 리프레시 등)으로 직접 옮겨 실천해 보시는 것이 이번 풀이의 가장 핵심적인 제안이에요.`
          : `— 나에게 긍정적인 도움을 주는 용신 **${yHint}** 기운을 일상의 작은 루틴으로 직접 옮겨 꾸준히 실천해 보시는 것이 핵심적인 비결이랍니다.`,
        '— 중요한 판단을 내리기 전에는 최소 하루 동안 충분히 생각을 숙성시킨 뒤 차분하게 결정해 주시길 권해 드립니다.',
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
      lines: (() => {
        const daeun = parseDaeunFromQuery(query);
        const body = buildDaeunFortuneBody({
          ...daeun,
          yongsinElem: facts.yongsinElem,
          gisinElems: facts.gisinElems,
          stemKo: facts.stemKo,
          query,
        });
        return body ? body.split('\n') : [
          '◆ 시기별 조언',
          '— 세운·월운은 확정 데이터와 함께 읽을 때 정확합니다.',
        ];
      })(),
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
