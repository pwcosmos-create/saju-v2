import { tryCouncilFreeFortune } from '../core/gemma24/council-fortune-compose.ts';
import { searchCouncilDisplayCards } from '../core/gemma24/saju-knowledge.ts';

process.env.GEMMA24_SAJU_CARDS_PATH =
  process.env.GEMMA24_SAJU_CARDS_PATH
  || '/home/ubuntu/coupax-homepage/board/data/saju_learning/cards.json';

const sample = `
일주: 甲子(甲子) / 월주: 丙寅(丙寅)
▶ 격국 (格局):
  정관격(正官格)
▶ 오행 분류 확정
  용신(用神) = 수(水)
  기신(忌神) = 금(金)
`.trim();

const cards = searchCouncilDisplayCards(sample);
const free = tryCouncilFreeFortune(sample);

console.log('=== Council compose (display cards, no foundation) ===');
console.log('matched:', cards.length, cards.map((c) => `[${c.id}] ${c.title}`).join('\n  '));
console.log('free compose:', free ? `YES (${free.cardCount} cards, ${free.text.length} chars)` : 'NO → LLM fallback');
if (free) {
  console.log('\n--- preview ---\n');
  console.log(free.text.slice(0, 1200));
}
