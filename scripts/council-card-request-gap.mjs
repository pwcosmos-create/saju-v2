/**
 * 명리위원회 카드 제작 요청용 — 누락·보강 목록 산출
 * npx tsx scripts/council-card-request-gap.mjs
 */
import fs from 'fs';
import { collectGemma24CardStats } from '../core/gemma24/card-stats.ts';

const cardsPath =
  process.env.GEMMA24_SAJU_CARDS_PATH
  || '/home/ubuntu/coupax-homepage/board/data/saju_learning/cards.json';

if (!fs.existsSync(cardsPath)) {
  console.error('cards.json 없음:', cardsPath);
  process.exit(1);
}

const stats = collectGemma24CardStats({ includeLists: true });
const titles = stats.certifiedCards.map((c) => c.title);

const GYEOK = [
  '건록격', '월겁격', '식신격', '상관격', '편재격', '정재격', '칠살격', '정관격', '편인격', '정인격',
];
const STEM = ['갑목', '을목', '병화', '정화', '무토', '기토', '경금', '신금', '임수', '계수'];
const BRANCH = ['삼합', '방합', '육합', '충', '형', '파', '해'];
const ELEM = ['목', '화', '토', '금', '수'];

function hasTitle(pred) {
  return titles.some(pred);
}

const missGyeok = GYEOK.filter(
  (g) => !hasTitle((t) => t.startsWith('변수·격 ') && (t.includes(g) || (g === '칠살격' && t.includes('편관격')))),
);

const missStemDay = STEM.filter(
  (s) => !hasTitle((t) => t.includes('일주') && t.includes(s) && !t.startsWith('변수·')),
);

const missStemChen = STEM.filter(
  (s) => !hasTitle((t) => t.startsWith('변수·천간 ') && t.includes(s)),
);

const missBranch = BRANCH.filter(
  (b) => !hasTitle((t) => t.startsWith('변수·지지관계 ') && t.includes(b)),
);

const missYongsin = ELEM.filter(
  (e) => !hasTitle((t) => /변수·운 용신/.test(t) && t.includes(e)),
);

const missGisin = ELEM.filter(
  (e) => !hasTitle((t) => /변수·운 기신/.test(t) && t.includes(e)),
);

const missDeep = [];
for (let n = 1; n <= 10; n += 1) {
  if (!hasTitle((t) => t.startsWith(`심층·[${n}]`))) missDeep.push(n);
}

const weakInterpret = [
  '해석·용신·기신 실전',
  '해석·대운 전환기',
  '해석·세운·올해 흐름',
  '해석·궁합·연인 비교',
].filter((name) => !hasTitle((t) => t === name || t.startsWith(name)));

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  totalPass: stats.certified,
  missGyeok,
  missStemDay,
  missStemChen,
  missBranch,
  missYongsin,
  missGisin,
  missDeep,
  weakInterpret,
}, null, 2));
