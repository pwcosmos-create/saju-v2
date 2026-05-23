/**
 * 인증 카드가 적을 때 프롬프트 확정 데이터로 섹션 보강 (LLM 없음)
 */
import { extractPromptFacts } from './saju-knowledge';

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

function parsePromptContext(query: string) {
  const facts = extractPromptFacts(query);
  const strength = query.match(/최종 판정:\s*★\s*([^★\n]+)/)?.[1]?.trim() ?? null;
  const dominant = query.match(/지배 오행:\s*([^\n]+)/)?.[1]?.trim() ?? null;
  const lacking = query.match(/부족 오행:\s*([^\n]+)/)?.[1]?.trim() ?? null;
  const yongsinLine = query.match(/용신\(用神\)\s*=\s*([^\n]+)/)?.[1]?.trim() ?? null;
  const huisinLine = query.match(/희신\(喜神\)\s*=\s*([^\n]+)/)?.[1]?.trim() ?? null;
  const gisinLine = query.match(/기신\(忌神\)\s*=\s*([^\n]+)/)?.[1]?.trim() ?? null;
  const pillars = query.match(/연주:[^\n]+/)?.[0]?.trim() ?? null;
  const gyeokLine = query.match(/▶ 격국[^]*?\n\s*([^\n※]+)/)?.[1]?.trim()
    ?? facts.gyeokguk
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
  };
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
      title: '이 사주의 핵심 성향',
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
      title: '사주 원국 한눈에',
      body: `◆ 사주 구성\n— ${ctx.pillars}\n— 아래 격국·오행·용신 해석은 이 원국을 기준으로 읽으시면 됩니다.`,
    });
  }

  if (!filledSectionIds.has('4') && (ctx.dominant || ctx.lacking)) {
    out.push({
      id: '4',
      title: '오행 균형과 보완',
      body: [
        '◆ 오행 분포',
        ctx.dominant ? `— 넘치는 기운: ${ctx.dominant}` : '',
        ctx.lacking ? `— 보완하면 좋은 기운: ${ctx.lacking}` : '',
        '— 넘치는 오행은 강점으로 쓰되 과하면 조절하고, 부족한 오행은 생활 습관으로 채우면 균형이 맞습니다.',
      ].filter(Boolean).join('\n'),
    });
  }

  if (!filledSectionIds.has('5') && (ctx.yongsinLine || ctx.gisinLine)) {
    const yElem = facts.yongsinElem;
    const tip = yElem ? ELEM_TIP[yElem] : '';
    out.push({
      id: '5',
      title: '용신·기신과 에너지 조언',
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

/** LLM 보충 실패 시 [6][8][9][10] 규칙 기반 초안 */
export function buildOfflineHybridSupplement(query: string): string {
  const ctx = parsePromptContext(query);
  const { facts } = ctx;
  const yTip = facts.yongsinElem ? ELEM_TIP[facts.yongsinElem] : '용신 방향으로 일·관계를 맞추면 흐름이 부드러워집니다.';
  const gyeok = ctx.gyeokLine ?? facts.gyeokguk ?? '격국';

  const blocks: string[] = [];

  blocks.push(
    '[6] 직업과 적성',
    '',
    `◆ ${gyeok}이 말하는 일의 방향`,
    `— ${gyeok}은 타고난 일 처리 방식과 맞는 환경을 가리킵니다. ${ctx.strength ? `현재 ${ctx.strength}이므로,` : ''} 무리한 확장보다 강점이 드러나는 분야에 집중하면 좋습니다.`,
    `— ${yTip}`,
    '',
    '[8] 돈과 재물',
    '',
    '◆ 재물 흐름',
    `— ${ctx.dominant ? `지배 오행(${ctx.dominant})이 강한 만큼,` : ''} 익숙한 방식으로 수입을 만들 때 안정감이 큽니다.`,
    '— 지출·투자는 기신 방향(과한 욕심·무리한 레버리지)을 피하고, 용신 에너지에 맞는 속도로 쌓는 편이 유리합니다.',
    '',
    '[9] 올해·월별 흐름',
    '',
    '◆ 시기별 조언',
    '— 세운·월운은 확정 데이터와 함께 읽을 때 정확합니다. 상반기는 기반을 다지고, 하반기는 용신 방향으로 실행·정리하는 흐름이 맞습니다.',
    '— 급한 결정은 피하고, 몸과 마음의 리듬을 맞추면 운의 변화를 더 잘 타실 수 있습니다.',
    '',
    '[10] 인생 전략 한 줄',
    '',
    '◆ 평생 기억할 원칙',
    `— ${facts.stemKo ? `${facts.stemKo} 일간의 강점을 살리되,` : ''} 용신(${ctx.yongsinLine ?? '확정 용신'})을 일상 습관으로 옮기는 것이 이 사주의 핵심 전략입니다.`,
  );

  return blocks.join('\n');
}
