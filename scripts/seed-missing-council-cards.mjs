/**
 * cards.json — 격국·용신·기신 누락 축 보강
 * npx tsx scripts/seed-missing-council-cards.mjs
 */
import fs from 'fs';

const cardsPath =
  process.env.GEMMA24_SAJU_CARDS_PATH
  || '/home/ubuntu/coupax-homepage/board/data/saju_learning/cards.json';

const NEW_CARDS = [
  {
    title: '변수·격 건록격',
    summary: '월지 비견 본기의 건록격. 자립·주관이 강하고 협력·분배 규칙이 관건입니다.',
    body: `「변수·격 건록격」
【개요】건록격(乾祿格)은 월지 본기가 비견(比肩)일 때 잡는 격입니다. 자립·주관·경쟁·동료와 연결됩니다.
【핵심】스스로 밀고 나가는 힘이 강합니다. 협력은 가능하나 역할·분배를 분명히 하지 않으면 분쟁·지출이 커질 수 있습니다.
키워드: 자립, 주관, 경쟁, 동료, 고집`,
    tags: ['격국', '변수', '명리'],
  },
  {
    title: '변수·격 월겁격',
    summary: '월지 겁재 본기의 월겁격. 기회·추진과 함께 분산·경쟁 관리가 필요합니다.',
    body: `「변수·격 월겁격」
【개요】월겁격(月劫格)은 월지 본기가 겁재(劫財)일 때 잡는 겝입니다. 기회·속도·경쟁·재물 이동과 연결됩니다.
【핵심】추진력과 과감함이 강하나, 무리한 확장·동업·보증은 손실로 이어질 수 있습니다.
키워드: 겁재, 기회, 경쟁, 재물 이동, 속도`,
    tags: ['격국', '변수', '명리'],
  },
  {
    title: '변수·운 용신 목',
    summary: '용신이 목(木)일 때 성장·학습·인맥 확장에 에너지를 쓰면 유리합니다.',
    body: `「변수·운 용신 목」
【개요】용신(用神)이 목(木)이면 성장·시작·학습·인맥 쪽으로 기운을 보강하는 방향이 맞습니다.
【핵심】교육·기획·콘텐츠·녹색·동쪽 방향이 도움이 됩니다. 금(金)이 과하면 목을 눌러 답답함이 생길 수 있습니다.
키워드: 성장, 학습, 인맥, 기획`,
    tags: ['용신', '오행', '명리'],
  },
  {
    title: '변수·운 용신 화',
    summary: '용신이 화(火)일 때 표현·브랜딩·대외 활동에서 강점이 드러납니다.',
    body: `「변수·운 용신 화」
【개요】용신(用神)이 화(火)이면 표현·홍보·열정·가시성을 키우는 선택이 맞습니다.
【핵심】발표·마케팅·남쪽·빛·따뜻한 색이 도움이 됩니다. 수(水)가 과하면 열정이 꺼질 수 있습니다.
키워드: 표현, 브랜딩, 열정, 홍보`,
    tags: ['용신', '오행', '명리'],
  },
  {
    title: '변수·운 용신 토',
    summary: '용신이 토(土)일 때 안정·신뢰·꾸준한 관리가 핵심입니다.',
    body: `「변수·운 용신 토」
【개요】용신(用神)이 토(土)이면 안정·중재·실무·신뢰 축적이 유리합니다.
【핵심】부동산·관리·조직·황토·중앙이 도움이 됩니다. 목(木)이 과하면 토를 파고 불안정해질 수 있습니다.
키워드: 안정, 신뢰, 관리, 중재`,
    tags: ['용신', '오행', '명리'],
  },
  {
    title: '변수·운 용신 금',
    summary: '용신이 금(金)일 때 정리·결단·원칙 있는 선택이 도움이 됩니다.',
    body: `「변수·운 용신 금」
【개요】용신(用神)이 금(金)이면 정리·실행·결단·완성도를 높이는 방향이 맞습니다.
【핵심】법·회계·IT·서쪽·금속·흰색이 도움이 됩니다. 화(火)가 과하면 금이 녹아 산만해질 수 있습니다.
키워드: 결단, 정리, 실행, 원칙`,
    tags: ['용신', '오행', '명리'],
  },
  {
    title: '변수·운 용신 수',
    summary: '용신이 수(水)일 때 유연·학습·휴식·전략 수정이 균형을 맞춥니다.',
    body: `「변수·운 용신 수」
【개요】용신(用神)이 수(水)이면 유연·지혜·휴식·정보 수집이 유리합니다.
【핵심】연구·무역·북쪽·검정·파랑·물가 근처가 도움이 됩니다. 토(土)가 과하면 수를 막아 답답함이 생길 수 있습니다.
키워드: 유연, 지혜, 휴식, 전략`,
    tags: ['용신', '오행', '명리'],
  },
  {
    title: '변수·운 기신 목',
    summary: '기신이 목(木)일 때 과한 확장·고집·경쟁 심화를 조절하세요.',
    body: `「변수·운 기신 목」
【개요】기신(忌神)이 목(木)이면 성장 욕구·고집·경쟁이 과해질 때 균형이 깨집니다.
【핵심】무리한 사업 확장·동업 분쟁·과한 학습 부담을 줄이면 좋습니다.
키워드: 과확장, 고집, 경쟁`,
    tags: ['기신', '오행', '명리'],
  },
  {
    title: '변수·운 기신 화',
    summary: '기신이 화(火)일 때 과열·성급함·감정 소모를 주의하세요.',
    body: `「변수·운 기신 화」
【개요】기신(忌神)이 화(火)이면 조급함·과열·말실수·번아웃이 생기기 쉽습니다.
【핵심】충동적 결정·과한 야근·감정 대립을 피하고 휴식 리듬을 만드세요.
키워드: 과열, 성급, 번아웃`,
    tags: ['기신', '오행', '명리'],
  },
  {
    title: '변수·운 기신 토',
    summary: '기신이 토(土)일 때 우유부단·지체·답답함을 줄이세요.',
    body: `「변수·운 기신 토」
【개요】기신(忌神)이 토(土)이면 걱정·집착·변화 거부·지체가 커질 수 있습니다.
【핵심】결정 미루기·과한 걱정·무거운 환경에 머무르지 않도록 하세요.
키워드: 지체, 걱정, 답답함`,
    tags: ['기신', '오행', '명리'],
  },
  {
    title: '변수·운 기신 금',
    summary: '기신이 금(金)일 때 냉정·비판·압박이 과해지지 않게 하세요.',
    body: `「변수·운 기신 금」
【개요】기신(忌神)이 금(金)이면 냉정·비판·완벽주의·압박이 강해질 수 있습니다.
【핵심】지나친 자기비판·경직된 규칙·관계 냉각을 완화하는 것이 좋습니다.
키워드: 냉정, 비판, 압박`,
    tags: ['기신', '오행', '명리'],
  },
  {
    title: '변수·운 기신 수',
    summary: '기신이 수(水)일 때 불안·우유부단·정보 과다를 조절하세요.',
    body: `「변수·운 기신 수」
【개요】기신(忌神)이 수(水)이면 불안·의심·우유부단·정보 과부하가 생기기 쉽습니다.
【핵심】과한 걱정·밤샘·결정 회피를 줄이고 실행 단계를 작게 나누세요.
키워드: 불안, 우유부단, 정보 과다`,
    tags: ['기신', '오행', '명리'],
  },
];

if (!fs.existsSync(cardsPath)) {
  console.error('cards.json 없음:', cardsPath);
  process.exit(1);
}

const backup = `${cardsPath}.bak-${Date.now()}`;
fs.copyFileSync(cardsPath, backup);
console.log('backup:', backup);

const pack = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
const cards = pack.cards || [];
const titles = new Set(cards.map((c) => (c.title || '').trim()));
let nextId = Math.max(0, ...cards.map((c) => Number(c.id) || 0)) + 1;
let added = 0;

for (const spec of NEW_CARDS) {
  if (titles.has(spec.title)) {
    console.log('skip (exists):', spec.title);
    continue;
  }
  cards.push({
    id: nextId++,
    title: spec.title,
    body: spec.body,
    summary: spec.summary,
    tags: spec.tags,
    status: 'confirmed',
    council_pass: true,
    council_status: 'pass',
  });
  titles.add(spec.title);
  added += 1;
  console.log('added:', spec.title);
}

pack.cards = cards;
pack.card_count = cards.length;
pack.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 16);

fs.writeFileSync(cardsPath, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');
console.log('\n완료: 추가', added, '장 / 전체', cards.length, '장');
