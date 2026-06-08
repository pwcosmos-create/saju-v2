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


const STEM_DETAILS: Record<string, {
  intro: string;
  traits: { title: string; desc: string; tendency: string }[];
  warnings: { title: string; desc: string }[];
  iljuVariants: { name: string; desc: string }[];
}> = {
  갑목: {
    intro: "하늘의 기운(천간) 중 첫 번째 글자인 **갑목(甲木)**은 오행 중 **'목(木)'**에 속하며, 그중에서도 **'양(陽)의 목'**입니다. 자연물에 비유하면 **'하늘을 향해 곧게 뻗어 올라가는 낙락장송이나 기둥용 아름드리 큰 나무'**를 상징합니다. (부드럽고 끈질기게 넝쿨을 지어 번식하는 乙목과 대비됩니다.)",
    traits: [
      { title: "성장과 진취적 욕구", desc: "새로운 하늘을 향해 계속 뻗어가는 성장의 에너지가 가득합니다.", tendency: "적극적으로 삶을 개척하고 늘 배움과 자기계발에 힘쓰며 발전하고자 합니다." },
      { title: "리더십과 당당함", desc: "숲의 대장 소나무처럼 어디서든 머리가 되고자 하는 기질이 있습니다.", tendency: "책임감이 강하고 당당한 매력으로 사람들을 이끄는 원동력을 가집니다." },
      { title: "뚜렷한 주관과 강직함", desc: "외부 압박에도 꺾이지 않고 자신만의 기조와 원칙을 지키는 뚝심이 있습니다.", tendency: "자신이 옳다고 믿는 가치에 대해서는 쉽게 양보하거나 굽히지 않는 올곧음을 보여줍니다." },
      { title: "시작하는 힘과 개척 정신", desc: "맨 처음 문을 열고 새로운 분야에 도전하는 선구자적 역량이 있습니다.", tendency: "남들이 가지 않은 길을 두려워하지 않고 추진해 내는 기획과 추진력이 있습니다." }
    ],
    warnings: [
      { title: "꺾이기 쉬운 고집", desc: "큰 나무는 강풍을 맞아 부러지기 쉽듯, 주관이 강해 부러지는 상황이 올 수 있습니다. 타인의 의견에 유연해질 필요가 있습니다." },
      { title: "2인자의 삶에 대한 거부", desc: "남 밑에 있거나 통제받는 것을 몹시 힘들어해 조직 생활에서 불필요한 갈등을 초래하기 쉽습니다." }
    ],
    iljuVariants: [
      { name: "갑자(甲子) 일주", desc: "깊은 학업 능력과 지혜, 섬세한 모성애와 안정감" },
      { name: "갑술(甲戌) 일주", desc: "실리적이고 끈기 있으며 강직한 신뢰와 현실성" },
      { name: "갑신(甲申) 일주", desc: "강인한 자기 통제력과 원칙, 절제된 리더십" },
      { name: "갑오(甲午) 일주", desc: "화사하고 빠른 추진력, 뛰어난 예술성 및 활동성" },
      { name: "갑진(甲辰) 일주", desc: "배포가 크고 뚝심 있으며 현실 관리에 강함" },
      { name: "갑인(甲寅) 일주", desc: "강직한 주체성과 추진력, 남다른 고집과 주관" }
    ]
  },
  을목: {
    intro: "하늘의 기운(천간) 중 두 번째 글자인 **을목(乙木)**은 오행 중 **'목(木)'**에 속하며, 그중에서도 **'음(陰)의 목'**입니다. 자연물에 비유하면 **'부드러운 잔디, 들판의 야생화, 넝쿨손을 뻗어 담벼락을 넘는 넝쿨식물'**을 상징합니다. (강하게 솟구치다 꺾이기 쉬운 甲목과 대비됩니다.)",
    traits: [
      { title: "끈질긴 생명력과 적응력", desc: "밟혀도 다시 일어나는 야생초처럼 어떤 환경에서도 적응해 냅니다.", tendency: "외유내강형의 기질로 겉은 부드럽지만 속은 누구보다 독하게 버티는 힘이 있습니다." },
      { title: "뛰어난 친화력과 협동성", desc: "주변 식물들과 얽히며 조화를 이루듯 인간관계의 친화력이 뛰어납니다.", tendency: "대립보다 조화를 선택하며 상대에 맞춰 부드럽게 융화되는 처세에 강합니다." },
      { title: "철저한 실용주의와 현실 감각", desc: "넝쿨손이 지지대를 잡고 올라가듯 생존과 이익에 대단히 명민합니다.", tendency: "명분보다 실리를 추구하며 기회가 오면 빠르게 포착하는 생존 본능이 훌륭합니다." },
      { title: "예술성과 풍부한 표현력", desc: "예쁘게 꽃을 피우는 형상으로 타고난 미감과 예술적 끼를 품고 있습니다.", tendency: "감수성이 풍부하고 부드러운 대화로 타인의 감정을 편안하게 어루만집니다." }
    ],
    warnings: [
      { title: "줏대 없는 의존 기질", desc: "기둥(지지대)을 찾아 감고 오르려는 기질이 있어 자칫 주체성이 약하고 타인에게 지나치게 의지하기 쉽습니다." },
      { title: "감정의 기복과 질투", desc: "환경에 민감하다 보니 자잘한 스트레스에 쉽게 흔들리며, 남과의 비교와 은근한 시기·질투로 번민할 수 있습니다." }
    ],
    iljuVariants: [
      { name: "을축(乙丑) 일주", desc: "끈기 있고 성실하며 은근한 저력과 생활력" },
      { name: "을해(乙亥) 일주", desc: "따뜻한 지혜와 배움, 유연하고 평화로운 성품" },
      { name: "을유(乙酉) 일주", desc: "예리하고 꼼꼼하며 높은 완벽주의와 긴장감" },
      { name: "을미(乙未) 일주", desc: "온화하지만 속에 고집이 있는 든든한 현실주의" },
      { name: "을사(乙巳) 일주", desc: "화사하고 재치 넘치며 뛰어난 말재주와 예술성" },
      { name: "을묘(乙卯) 일주", desc: "강인한 독립심과 꺾이지 않는 자존심, 끈기" }
    ]
  },
  병화: {
    intro: "하늘의 기운(천간) 중 세 번째 글자인 **병화(丙火)**는 오행 중 **'화(火)'**에 속하며, 그중에서도 **'양(陽)의 화'**입니다. 자연물에 비유하면 **'대지를 따뜻하게 비추는 태양이나 모든 것을 녹일 듯 타오르는 광활한 불꽃'**을 상징합니다. (어둠 속을 밝히는 은근한 촛불이나 등대인 丁화와 대비됩니다.)",
    traits: [
      { title: "밝고 긍정적인 화사함", desc: "태양처럼 숨김없이 드러나며 어두운 분위기를 환하게 바꿉니다.", tendency: "적극적이고 유쾌하며 열정이 넘쳐 주변 사람들에게 에너지를 뿜어냅니다." },
      { title: "강한 추진력과 당당한 존재감", desc: "거침없이 확장하는 불길처럼 하고자 하는 일에 강한 드라이브를 겁니다.", tendency: "남들의 눈을 의식하기보다 자신을 자신감 있게 어필하며 리더 자리에 섭니다." },
      { title: "정직함과 뒤끝 없는 담백함", desc: "빛으로 세상을 비추듯 감정을 숨기지 못하고 투명하게 드러냅니다.", tendency: "속에 꿍하게 비밀을 담아두지 않으며, 화가 나도 한 번 터뜨리고 나면 뒤끝이 없습니다." },
      { title: "넓은 오지랖과 공익적 마인드", desc: "만인에게 골고루 빛을 주는 태양처럼 타인을 도우려는 본능이 큽니다.", tendency: "공익적이거나 리더의 책임을 다하고자 하며 주변을 챙기는 포용력이 있습니다." }
    ],
    warnings: [
      { title: "성급함과 용두사미", desc: "시작은 화려하지만 끈기가 부족해 쉽게 식어버리거나 흐지부지 마무리가 약할 수 있습니다." },
      { title: "직설과 비밀 유출", desc: "속마음이 입으로 바로 나오기 쉽고, 자신도 모르게 타인의 비밀을 털어놓아 대인관계 갈등을 빚을 수 있습니다." }
    ],
    iljuVariants: [
      { name: "병자(丙子) 일주", desc: "다정다감하고 정직하며 예의를 중시하는 단정함" },
      { name: "병술(丙戌) 일주", desc: "따뜻한 인간미와 탁월한 손재주, 예술적 감각" },
      { name: "병신(丙申) 일주", desc: "이권과 비즈니스 감각이 발달한 다재다능함" },
      { name: "병오(丙午) 일주", desc: "활활 타오르는 거대한 열정과 승부욕, 강인함" },
      { name: "병진(丙辰) 일주", desc: "지혜롭고 베풀기 좋아하며 기획 능력이 뛰어남" },
      { name: "병인(丙寅) 일주", desc: "든든한 학업 운과 지적인 후원, 당당한 자신감" }
    ]
  },
  정화: {
    intro: "하늘의 기운(천간) 중 네 번째 글자인 **정화(丁火)**는 오행 중 **'화(火)'**에 속하며, 그중에서도 **'음(陰)의 화'**입니다. 자연물에 비유하면 **'밤하늘의 은은한 별빛, 등대, 촛불, 혹은 내실 있게 타오르는 모닥불과 풀무불'**을 상징합니다. (만인을 비추는 하늘 위의 강렬한 태양인 丙화와 대비됩니다.)",
    traits: [
      { title: "섬세하고 정교한 관찰력", desc: "구석구석을 비추는 촛불처럼 작고 세세한 부분을 포착하는 눈이 있습니다.", tendency: "사려 깊고 세밀하며, 학업이나 기술적 정밀함에서 탁월한 완벽주의를 보입나다." },
      { title: "예의 바르고 헌신적인 따뜻함", desc: "추운 어둠을 밝혀 온기를 나누는 모닥불처럼 정이 아주 깊습니다.", tendency: "예의를 중요시하며, 자신이 마음을 준 사람에게는 묵묵히 희생하고 돕습니다." },
      { title: "은근한 집념과 뛰어난 직관력", desc: "겉은 부드러워 보이지만 속에는 활활 타오르는 강한 불씨를 지녔습니다.", tendency: "직관과 통찰력이 뛰어나 사람의 속내를 간파하며 끈기 있게 목표를 달성합니다." },
      { title: "조력자와 참모형 기질", desc: "나서서 대장을 하기보다 2인자로서 중요한 브레인 역할을 더 잘 소화합니다.", tendency: "논리적이고 빈틈이 없으며 남을 뒤에서 빛내주는 현명한 서포터가 됩니다." }
    ],
    warnings: [
      { title: "내면의 분노와 예민함", desc: "겉은 예의 바르지만 속으로 서운함이나 화를 차곡차곡 쌓아두다 한 번에 폭발하여 주변을 놀라게 합니다." },
      { title: "좁고 깊은 인간관계", desc: "사람을 깊게 보지만 동시에 편애가 심해 마음을 잘 닫아 소외감을 느끼기 쉽습니다." }
    ],
    iljuVariants: [
      { name: "정축(丁丑) 일주", desc: "끈기 있게 연구하는 탐구 정신과 은근한 재물복" },
      { name: "정해(丁亥) 일주", desc: "단정하고 신중하며 타인에게 신뢰와 품위를 줌" },
      { name: "정유(丁酉) 일주", desc: "귀인의 혜택과 귀티가 나며 센스 있고 꼼꼼함" },
      { name: "정미(丁未) 일주", desc: "고집과 독립심이 강하고 은근히 거침없는 추진력" },
      { name: "정사(丁巳) 일주", desc: "경쟁심과 뚝심이 있으며 열정이 가득한 외유내강" },
      { name: "정묘(丁卯) 일주", desc: "남다른 아이디어와 감수성, 다정다감한 학업 기질" }
    ]
  },
  무토: {
    intro: "하늘의 기운(천간) 중 다섯 번째 글자인 **무토(戊土)**는 오행 중 **'토(土)'**에 속하며, 그중에서도 **'양(陽)의 토'**입니다. 자연물에 비유하면 **'흔들림 없이 솟아 있는 거대한 산, 광활한 만주 벌판, 깊고 두터운 흙(황토)'**을 상징합니다. (작고 습하며 언제든 씨앗을 길러낼 준비가 된 비옥한 정원 흙 己토와 대비됩니다.)",
    traits: [
      { title: "묵직하고 흔들리지 않는 신용", desc: "거대한 산처럼 상황이 변해도 한 자리를 묵묵히 지키는 듬직함이 있습니다.", tendency: "약속을 반드시 지키며 남의 속사정을 끝까지 묻어주는 무거운 입을 가졌습니다." },
      { title: "강한 책임감과 은근한 인내심", desc: "온갖 풍파를 겪어도 변치 않는 산처럼 어려운 임무도 끝까지 감당합니다.", tendency: "힘든 내색을 잘 하지 않고 포기하지 않는 강직한 뚝심이 뛰어납니다." },
      { title: "중재자 역할과 넓은 배포", desc: "모든 만물과 짐승이 기대어 사는 산처럼 타인을 조율하는 포용력이 큽니다.", tendency: "스케일이 크고 사소한 시비에 휘말리지 않으며 대국적으로 상황을 봅니다." },
      { title: "안정적인 보수성과 신중함", desc: "무모한 모험을 꺼리고 철저히 계산하고 움직이는 무거움이 있습니다.", tendency: "매사에 신중하며 한 번 결정을 내리면 좀처럼 번복하지 않습니다." }
    ],
    warnings: [
      { title: "지나친 고집과 융통성 결여", desc: "산은 움직이지 않듯 내 의견을 굽히지 않아 고집불통 소리를 듣거나 시대 변화에 뒤처질 수 있습니다." },
      { title: "속내를 알 수 없음", desc: "표정 변화가 적고 속을 드러내지 않아 상대방이 답답해하거나 오해하기 쉽습니다." }
    ],
    iljuVariants: [
      { name: "무인(戊寅) 일주", desc: "기백과 명예를 중시하며 곧은 원칙의 든든한 리더" },
      { name: "무자(戊子) 일주", desc: "현실 감각이 탁월하고 알뜰하며 안정적인 재물 복" },
      { name: "무술(戊戌) 일주", desc: "강직하고 충성스러우며 남다른 의리와 책임감" },
      { name: "무신(戊申) 일주", desc: "다재다능하고 베풀기 좋아하며 손재주가 뛰어남" },
      { name: "무오(戊午) 일주", desc: "한 우물을 파는 고결한 집중력과 깊은 학업 기질" },
      { name: "무진(戊辰) 일주", desc: "끈기 있고 뚝심 넘치며 독립적인 개척가 성향" }
    ]
  },
  기토: {
    intro: "하늘의 기운(천간) 중 여섯 번째 글자인 **기토(己土)**는 오행 중 **'토(土)'**에 속하며, 그중에서도 **'음(陰)의 토'**입니다. 자연물에 비유하면 **'비옥한 논밭, 잘 가꾸어진 정원, 따뜻하고 축축한 흙'**을 상징합니다. (거대하고 마른 산을 뜻하는 戊토와 대비됩니다.)",
    traits: [
      { title: "따뜻하고 부드러운 포용력", desc: "정원에 꽃과 나무가 자라듯, 사람들을 품어주는 능력이 뛰어납니다.", tendency: "모나지 않고 다정다감하며 어머니 같은 따뜻한 모성애적 기질을 가지고 있습니다." },
      { title: "철저한 현실주의와 실리 추구", desc: "논밭은 씨앗을 뿌려 곡식을 수확하는 실용적인 땅입니다.", tendency: "계산이 빠르고 꼼꼼하며, 돈 관리나 실무 능력에서 탁월한 두각을 나타냅니다." },
      { title: "높은 신용과 책임감", desc: "오행에서 토(土)는 '믿음(信)'을 상징합니다.", tendency: "겉으로 화려하게 튀지는 않지만, 묵묵하고 성실하게 맡은 역할을 완수합니다." },
      { title: "뛰어난 적응력과 사교성", desc: "논밭은 벼를 심든 과일을 심든 가리지 않고 싹을 틔웁니다.", tendency: "적을 만들지 않는 처세술이 뛰어나며 협동 작업의 훌륭한 윤활유가 됩니다." }
    ],
    warnings: [
      { title: "우유부단함과 소심함", desc: "흙이 물기를 머금고 있어 생각이 너무 많고 조심성이 과해 결단을 미루는 경향이 있습니다." },
      { title: "속내를 감추는 성향", desc: "겉으로는 웃으며 양보하지만, 속마음을 털어놓지 않고 참다가 화병이 날 수 있습니다." }
    ],
    iljuVariants: [
      { name: "기축(己丑) 일주", desc: "뚝심 있고 끈기 있는 노력파 (자수성가형)" },
      { name: "기묘(己卯) 일주", desc: "인정이 많고 감수성이 풍부한 예술가적 기질" },
      { name: "기사(己巳) 일주", desc: "두뇌 회전이 빠르고 학업 및 지적 능력이 뛰어남" },
      { name: "기미(己未) 일주", desc: "주관과 고집이 강하며 자존심이 매우 센 외유내강형" },
      { name: "기유(己酉) 일주", desc: "끼가 많고 말을 예쁘게 하며 베풀기를 좋아하는 타입" },
      { name: "기해(己亥) 일주", desc: "재물 복이 따르며 현실 감각과 다정함을 모두 갖춤" }
    ]
  },
  경금: {
    intro: "하늘의 기운(천간) 중 일곱 번째 글자인 **경금(庚金)**은 오행 중 **'금(金)'**에 속하며, 그중에서도 **'양(陽)의 금'**입니다. 자연물에 비유하면 **'아직 제련되지 않은 단단한 바위, 철광석, 혹은 차갑고 무시무시하게 벼려진 칼과 도끼'**를 상징합니다. (아름답게 세공되어 빛을 내는 부드러운 보석 辛금과 대비됩니다.)",
    traits: [
      { title: "강인한 결단력과 강직함", desc: "한 번 마음먹은 일은 단칼에 베어내듯 맹렬하게 몰아치는 돌파력이 있습니다.", tendency: "결정을 질질 끌지 않고 즉각 실행에 옮겨 결과를 얻어내는 데 강합니다." },
      { title: "남다른 의리와 굳센 신용", desc: "의리를 삶의 가장 높은 가치로 두며 한 번 믿은 사람은 끝까지 지킵니다.", tendency: "겉은 단단해 보이지만 자신이 인정한 사람에게는 온 마음을 다해 조력합니다." },
      { title: "공정한 시시비비 감각과 구조화", desc: "쓸모없는 것을 잘라내고 정리하는 능력이 대단히 탁월합니다.", tendency: "매사에 맺고 끊음이 확실하며 옳고 그름을 이성적으로 판단하려 합니다." },
      { title: "뚝심 넘치는 책임감과 자립심", desc: "외부의 압박이나 고난에 굴하지 않는 강직한 기백을 지니고 있습니다.", tendency: "남에게 기대지 않고 스스로 내 갈 길을 닦아 성공을 일구려는 성향이 강합니다." }
    ],
    warnings: [
      { title: "융통성 부족과 차가움", desc: "너무 날이 서 있고 맺고 끊음이 강해 주변 사람들에게 피도 눈물도 없는 냉정한 사람으로 보이기 쉽습니다." },
      { title: "직설적인 화법의 상처", desc: "팩트를 정확히 전달하려다 보니 말이 다소 날카롭고 직설적이어서 의도치 않게 주변에 적을 만들기 쉽습니다." }
    ],
    iljuVariants: [
      { name: "경자(庚子) 일주", desc: "두뇌 회전이 빠르고 총명하며 날카로운 언변과 재능" },
      { name: "경술(庚戌) 일주", desc: "은근한 고집과 뚝심, 학구열이 높고 깊은 책임감" },
      { name: "경신(庚申) 일주", desc: "꺾이지 않는 자존심과 승부욕, 강인한 신체와 기백" },
      { name: "경오(庚午) 일주", desc: "단정하고 예의 바르며 원칙과 명예를 지키는 관료형" },
      { name: "경진(庚辰) 일주", desc: "배포가 크고 뚝심 있으며 남을 품어주는 우두머리" },
      { name: "경해(庚亥) 일주", desc: "다정다감하고 표현 재주가 뛰어나며 결실을 잘 봄" }
    ]
  },
  신금: {
    intro: "하늘의 기운(천간) 중 여덟 번째 글자인 **신금(辛金)**은 오행 중 **'금(金)'**에 속하며, 그중에서도 **'음(陰)의 금'**입니다. 자연물에 비유하면 **'정밀하게 가공된 보석, 다이아몬드, 혹은 수술용 메스나 아주 예리한 바늘'**을 상징합니다. (거칠고 투박하며 큰 쇳덩이인 庚금과 대비됩니다.)",
    traits: [
      { title: "정밀하고 섬세한 완벽주의", desc: "흠집 하나 없는 다이아몬드처럼 매사에 대단한 디테일과 높은 완벽함을 추구합니다.", tendency: "일 처리가 깔끔하고 꼼꼼하며, 남들이 보지 못하는 미세한 에러를 잡아내는 눈이 있습니다." },
      { title: "세련된 미적 감각과 자존심", desc: "보석처럼 항상 남들에게 아름답게 보이고 주목받고자 하는 자존감이 있습니다.", tendency: "품위와 체면을 중요하게 생각하며, 스타일이 세련되고 지적인 매력을 풍깁니다." },
      { title: "예리한 관찰력과 날카로운 이성", desc: "바늘처럼 정곡을 찌르는 총명함과 차가운 논리력을 가지고 있습니다.", tendency: "감정에 쉽게 휩쓸리지 않고 이성적으로 구조를 분석하여 최선의 답을 냅니다." },
      { title: "독립심과 깔끔한 관계 맺기", desc: "남에게 구차하게 의지하는 것을 극도로 싫어하며 독립성을 소중히 여깁니다.", tendency: "선을 넘는 사람을 경계하며, 확실히 믿을 수 있는 사람하고만 단정하게 소통합니다." }
    ],
    warnings: [
      { title: "예민함과 까칠함", desc: "자극에 예민하여 스트레스를 쉽게 받고, 남의 사소한 실수에도 까다롭게 굴어 대인관계 장벽을 만들 수 있습니다." },
      { title: "독설과 냉정함", desc: "팩트를 예리하게 꼬집는 버릇이 있어 가슴 아픈 독설을 던지기 쉬우니 한 번 참고 순화하는 연습이 필요합니다." }
    ],
    iljuVariants: [
      { name: "신축(辛丑) 일주", desc: "끈기 있고 은근한 저력이 있으며 지혜로운 학습 능력" },
      { name: "신해(辛亥) 일주", desc: "다재다능하고 예술적 감수성이 뛰어나며 뛰어난 말재주" },
      { name: "신유(辛酉) 일주", desc: "극도의 자존심과 고집, 아주 깔끔하고 순수한 완벽주의" },
      { name: "신미(辛未) 일주", desc: "따뜻한 기운으로 보완되며 끈기 있고 현실성이 좋음" },
      { name: "신사(辛巳) 일주", desc: "품위가 넘치고 예의 바르며 합리적인 성향의 모범생" },
      { name: "신묘(辛卯) 일주", desc: "손재주와 아이디어가 좋고 실리 추구에 대단히 똑똑함" }
    ]
  },
  임수: {
    intro: "하늘의 기운(천간) 중 아홉 번째 글자인 **임수(壬水)**는 오행 중 **'수(水)'**에 속하며, 그중에서도 **'양(陽)의 수'**입니다. 자연물에 비유하면 **'모든 것을 담아내는 거대한 바다, 굽이쳐 흐르는 큰 강, 깊이를 알 수 없는 거대한 호수'**를 상징합니다. (안개를 헤치고 모여 내리는 이슬비나 샘물인 癸수와 대비됩니다.)",
    traits: [
      { title: "넓고 깊은 바다 같은 포용력", desc: "모든 시냇물이 바다로 모이듯 타인을 수용하고 담아내는 도량이 큽니다.", tendency: "성품이 활달하고 배포가 넓으며, 작은 시비에 얽매이지 않고 대범하게 처신합니다." },
      { title: "비상한 지혜와 탁월한 통찰력", desc: "명리학에서 물(水)은 지혜를 뜻합니다. 깊은 통찰과 흐름을 읽는 지능이 우수합니다.", tendency: "멀리 보고 판을 짜는 거시적인 안목이 있으며, 위기 상황에서도 임기응변이 뛰어납니다." },
      { title: "뛰어난 친화력과 유통 에너지", desc: "끊임없이 흘러가는 강물처럼 사람과 재물을 유통하고 소통시키는 데 강합니다.", tendency: "사교성이 풍부하고 활동적이며, 무역·영업·사업 등에서 넓은 판을 짭니다." },
      { title: "자유분방함과 유연한 적응력", desc: "물은 어떤 그릇에 담겨도 형태를 맞추듯 주변 변화에 유연하게 대처합니다.", tendency: "규율에 구속받는 것을 싫어하며 자신만의 독립적인 삶의 방식을 개척합니다." }
    ],
    warnings: [
      { title: "속내를 감추는 성향", desc: "바다 깊은 곳을 알 수 없듯 자신의 속마음을 잘 드러내지 않아 겉과 속이 다른 음험한 사람으로 오해받기 쉽습니다." },
      { title: "통제 불가능한 변덕", desc: "화가 나면 쓰나미처럼 덮쳐 다 쓸어버리듯 감정 조절이 한 번 실패하면 걷잡을 수 없이 극단으로 치달을 수 있습니다." }
    ],
    iljuVariants: [
      { name: "임자(壬子) 일주", desc: "강한 뚝심과 기백, 지혜로우며 리더십이 출중함" },
      { name: "임술(壬戌) 일주", desc: "책임감이 막강하고 신용을 중시하며 은근한 재물 복" },
      { name: "임신(壬申) 일주", desc: "다재다능하고 두뇌 회전이 빠르며 끊임없는 배움의 기질" },
      { name: "임오(壬午) 일주", desc: "현실 감각과 재물 관리가 철저하며 다정한 성품" },
      { name: "임진(壬辰) 일주", desc: "카리스마와 끈기가 있으며 배포가 큰 여장부 기질" },
      { name: "임인(壬寅) 일주", desc: "온화하고 베풀기 좋아하며 사교성과 표현 재주가 훌륭함" }
    ]
  },
  계수: {
    intro: "하늘의 기운(천간) 중 열 번째 글자인 **계수(癸水)**는 오행 중 **'수(水)'**에 속하며, 그중에서도 **'음(陰)의 수'**입니다. 자연물에 비유하면 **'초목을 적셔주는 단비, 아침 이슬, 깊은 산속 옹달샘, 졸졸 흐르는 시냇물'**을 상징합니다. (광활하고 폭발적인 해류와 바다인 壬수와 대비됩니다.)",
    traits: [
      { title: "맑고 깨끗한 섬세함과 친절함", desc: "만물에 자양분을 주듯 남을 도우며 사근사근하고 상냥한 성품을 보입니다.", tendency: "타인의 아픔에 크게 공감하며, 주변 사람들을 조용하고 부드럽게 배려합니다." },
      { title: "뛰어난 지능과 기획력", desc: "아이디어가 샘솟는 옹달샘처럼 두뇌가 몹시 명석하고 기획력이 발달했습니다.", tendency: "상황을 빠르게 캐치하며, 머리 쓰는 일이나 창의적인 설계에서 탁월한 두각을 보입니다." },
      { title: "강한 침투력과 유연함", desc: "물이 틈새를 스며들듯 어떤 관계나 환경에도 슬며시 들어가 융화됩니다.", tendency: "대립하지 않고 우회하여 목적을 달성하며, 뛰어난 중재와 적응력을 뽐냅니다." },
      { title: "자양분이 되어주는 헌신", desc: "식물을 기르는 빗물처럼 생명을 살리는 조용한 헌신과 교육 기질이 있습니다.", tendency: "남을 성장시키고 멘토링해 줄 때 남다른 행복감과 보람을 느낍니다." }
    ],
    warnings: [
      { title: "소심함과 예민함", desc: "빗방울처럼 작은 변화에도 가슴 아파하거나 잡념이 많아 우울감에 빠지기 쉽습니다." },
      { title: "끈기 부족과 변덕", desc: "흘러가는 시냇물처럼 마음이 금방 바뀌어 한 우물을 파지 못하고 중도 포기하기 쉽습니다." }
    ],
    iljuVariants: [
      { name: "계축(癸丑) 일주", desc: "끈기 있고 성실하며 내면의 매서운 뚝심과 저력" },
      { name: "계해(癸亥) 일주", desc: "지혜의 끝판왕이자 사교성과 독립적인 기상을 고루 갖춤" },
      { name: "계유(癸酉) 일주", desc: "지적인 매력과 예술적 예민함, 깔끔한 일 처리" },
      { name: "계미(癸未) 일주", desc: "따뜻한 기운의 흙을 만나 부드럽고 타협에 노련한 성격" },
      { name: "계사(癸巳) 일주", desc: "재물과 명예운이 동시에 따르며 센스 있고 영민함" },
      { name: "계묘(癸卯) 일주", desc: "많은 이에게 사랑을 받는 은근한 인기와 뛰어난 표현력" }
    ]
  }
};

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
      const dayToken = query.match(/일주:\s*([^\s/|·]+)/)?.[1] ?? '';
      const pillarHanja = dayToken.match(/\(([^)]+)\)/)?.[1]?.trim();
      const hanja = pillarHanja
        ? `(${pillarHanja})`
        : facts.stemHanja
          ? `(${facts.stemHanja})`
          : '';

      const stemDetails = STEM_DETAILS[facts.stemKo];
      if (!stemDetails) {
        // Fallback if detail data missing
        const blurb = STEM_BLURB[facts.stemKo] ?? '일간 기운이 사주 전체 해석의 중심이 됩니다.';
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

      const formattedTraits = stemDetails.traits.map((trait, idx) => 
        `### ${idx + 1}. ${trait.title}\n* **특징:** ${trait.desc}\n* **성향:** ${trait.tendency}`
      ).join('\n\n');

      const formattedWarnings = stemDetails.warnings.map(w => 
        `* **${w.title}:** ${w.desc}`
      ).join('\n');

      const formattedVariants = stemDetails.iljuVariants.map(v => 
        `* **${v.name}:** ${v.desc}`
      ).join('\n');

      return [
        header('1'),
        '',
        `◆ 타고난 기질과 성향`,
        `귀하의 타고난 본질을 상징하는 일간은 **${facts.stemKo}${hanja}**이에요.`,
        ctx.strength ? `사주의 균형과 강도는 **${ctx.strength}**의 상태를 보여주고 있습니다.` : '',
        ctx.pillars ? `년·월·일·시의 기운은 **${ctx.pillars}**의 조합으로 구성되어 있어요.` : '',
        '',
        `🌾 ${facts.stemKo}란 어떤 기운인가요?`,
        stemDetails.intro,
        '',
        formattedTraits,
        '',
        `⚠️ 조금 조심하면 좋은 점 (약점 및 보완점)`,
        formattedWarnings,
        '',
        `💡 일지(일주의 두 번째 글자)에 따른 구체적 변화`,
        formattedVariants
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
