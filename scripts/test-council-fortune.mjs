/**
 * 인증 카드 조합 풀이 미리보기
 * npx tsx scripts/test-council-fortune.mjs
 */
import { tryCouncilHybridFortune } from '../core/gemma24/council-fortune-hybrid.ts';
import { searchCouncilDisplayCards } from '../core/gemma24/saju-knowledge.ts';
import { buildPrompt } from '../core/ai-templates/blueprints.ts';

process.env.GEMMA24_SAJU_CARDS_PATH =
  process.env.GEMMA24_SAJU_CARDS_PATH
  || '/home/ubuntu/coupax-homepage/board/data/saju_learning/cards.json';

const sample = {
  pillars: [
    { s: 0, b: 0 },
    { s: 2, b: 2 },
    { s: 2, b: 4 },
    { s: 8, b: 0 },
  ],
  input: { year: 1990, month: 5, day: 15, gender: '남' },
  ohaeng: { counts: [2, 1, 2, 1, 2] },
  shinsal: [],
  sipsin: ['비견', '식신', '비견', '편인'],
  daeun: { forward: true, cycles: [] },
};

const prompt = buildPrompt(sample);
const cards = searchCouncilDisplayCards(prompt);
console.log('PASS cards matched:', cards.length);
console.log(cards.map((c) => `[${c.id}] ${c.title}`).join('\n'));

const r = await tryCouncilHybridFortune(prompt);
if (!r) {
  console.log('\nCouncil compose: FAILED (no hybrid)');
  process.exit(1);
}
console.log('\nmode:', r.mode, '| cards used:', r.cardCount, '| chars:', r.text.length);
console.log('\n--- preview (2000 chars) ---\n');
console.log(r.text.slice(0, 2000));
