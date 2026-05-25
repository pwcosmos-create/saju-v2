import { extractPromptFacts } from '../gemma24/saju-knowledge';
import type { CounselTopicIntent } from '../gemma24/parse-counsel-intent';
import { adviseDaeunPeriod, parseDaeunFromQuery } from '../gemma24/council-fortune-daeun';

const TOPIC_SECTION: Record<
  number,
  (facts: ReturnType<typeof extractPromptFacts>) => string[]
> = {
  8: (f) => [
    '관계에서는 속도 차이·표현 방식 차이를 먼저 맞추는 것이 중요합니다.',
    f.yongsinElem
      ? `용신 ${f.yongsinElem} 기운에 맞게 안정·신뢰를 쌓을수록 인연이 부드럽습니다.`
      : '상대와의 리듬을 존중하면 갈등이 줄어듭니다.',
    '중요한 약속·고백은 기운이 안정된 날에 맞추면 좋습니다.',
  ],
  7: (f) => [
    '재물은 한 번에 크게 벌기보다 흐름을 읽고 관리·저축 습관이 핵심입니다.',
    f.gyeokguk ? `${f.gyeokguk} 명식에서는 역할에 맞는 수입 구조를 만드는 것이 유리합니다.` : '',
    f.gisinElems.length
      ? `기신 ${f.gisinElems.join('·')} 기운이 강할 때는 투자·대출을 보수적으로 접근하세요.`
      : '지출과 수입의 균형을 주기적으로 점검하세요.',
  ],
  9: (f) => [
    '직업·사업은 역할과 강점이 드러나는 분야에서 성과가 나기 쉽습니다.',
    f.stemKo ? `${f.stemKo.split('')[0]} 일간의 추진 방식에 맞는 업무 환경을 선택하세요.` : '',
    '이직·전환은 대운·세운이 바뀌는 시기 전후 1~2년을 의식해 무리하지 않는 편이 좋습니다.',
  ],
  10: () => [
    '건강은 과로·불규칙한 수면을 줄이고, 몸의 신호에 맞춰 리듬을 조절하세요.',
    '무리한 다이어트·과한 운동보다 꾸준한 습관이 장기적으로 유리합니다.',
    '스트레스는 대화·기록으로 풀어내는 것이 도움이 됩니다.',
  ],
  6: (f) => [
    '시기는 10년 대운 → 1년 세운 → 월운 순으로 읽는 것이 정확합니다.',
    f.yongsinElem
      ? `용신 ${f.yongsinElem} 방향에 맞춘 선택이 흐름을 태우기 쉽습니다.`
      : '급한 결정보다 기반을 다진 뒤 실행하는 편이 안정에 가깝습니다.',
    '올해·내년 운세는 연도·월 단위로 따로 질문하시면 더 구체적으로 풀어 드립니다.',
  ],
  1: (f) => [
    f.stemKo
      ? `일간 ${f.stemKo}의 성향은 표현·추진 방식의 기본 틀입니다.`
      : '일주(日柱)를 중심으로 성향과 관계 습관을 읽습니다.',
    '성격만으로 모든 것을 단정하지 않고, 격·용신·대운과 함께 보세요.',
  ],
  5: (f) => [
    f.yongsinElem
      ? `용신 ${f.yongsinElem}은 보완·균형의 기준입니다.`
      : '용신·기신은 명식마다 달라 확정 데이터를 기준으로 합니다.',
    f.gisinElems.length ? `기신 ${f.gisinElems.join('·')}은 과할 때 조절이 필요합니다.` : '',
  ],
  4: () => [
    '오행은 과다·부족을 보완하는 방향으로 생활 습관을 맞추면 좋습니다.',
    '한 가지 오행만 강조하기보다 전체 균형을 봅니다.',
  ],
  3: (f) => [
    f.gyeokguk ? `격국 ${f.gyeokguk}에 맞는 역할·재물·관계 패턴이 있습니다.` : '십신·격국은 사회·일의 역할을 읽는 데 씁니다.',
    '격과 용신이 충돌하지 않게 선택을 조율하세요.',
  ],
  2: () => [
    '사주팔자는 년·월·일·시 네 기둥이 각각 가문·사회·본인·말년을 가리킵니다.',
    '시주가 없으면 일·월주를 중심으로 해석합니다.',
  ],
};

/** 인증 카드 없을 때 — 명식 데이터 기반 주제 맞춤 상담 (LLM 없음) */
export function buildTopicCounselReply(
  sajuContext: string,
  userMessage: string,
  counselorName: string,
  intent: CounselTopicIntent,
): string | null {
  if (!sajuContext.trim()) return null;

  const facts = extractPromptFacts(sajuContext);
  const { periods, birthYear } = parseDaeunFromQuery(sajuContext);
  const who = counselorName ? `『${counselorName}』입니다. ` : '';
  const topic = intent.label;

  const lines = [
    `${who}질문하신 「${topic}」를 입력하신 사주 명식으로 풀어 보았습니다.`,
    '',
    `◆ ${topic} 한눈에`,
  ];

  if (facts.stemKo || facts.gyeokguk) {
    const bits = [
      facts.stemKo ? `일주 ${facts.stemKo}` : '',
      facts.gyeokguk ? `격 ${facts.gyeokguk}` : '',
      facts.yongsinElem ? `용신 ${facts.yongsinElem}` : '',
    ].filter(Boolean);
    if (bits.length) lines.push(`— ${bits.join(' · ')}`);
  }

  const primaryId = intent.deepIds[0] ?? 6;
  const tips = (TOPIC_SECTION[primaryId] ?? TOPIC_SECTION[6]!)(facts).filter(Boolean);
  lines.push('', `◆ ${topic}에서 참고할 점`);
  for (const tip of tips.slice(0, 4)) {
    lines.push(`— ${tip}`);
  }

  if (birthYear && periods.length) {
    const age = new Date().getFullYear() - birthYear;
    const cur = periods.find((p) => age >= p.age && age < p.age + 10) ?? periods[0];
    if (cur) {
      lines.push('', '◆ 지금 대운과의 관계');
      lines.push(
        `— ${cur.age}세(${cur.startYear}~${cur.endYear}) ${cur.label}: ${adviseDaeunPeriod(cur, facts.yongsinElem, facts.gisinElems)}`,
      );
    }
  }

  lines.push(
    '',
    `◆ 실천`,
    '— 중요한 결정은 서두르지 말고, 몸과 마음의 리듬을 맞춘 뒤 진행하세요.',
    '— 더 구체적인 날짜·연도 운세는 「오늘 운세」「2027년 운세」처럼 질문해 주시면 이어서 풀어 드립니다.',
    '',
    `위 내용은 ${topic} 주제와 사주 데이터를 바탕으로 한 참고 풀이입니다.`,
  );

  return lines.join('\n');
}
