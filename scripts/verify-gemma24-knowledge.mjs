import { buildGemma24KnowledgeForSystem, searchGemma24SajuKnowledge } from '../core/gemma24/saju-knowledge.ts';

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
신살:
  - 역마: 이동·변화
`.trim();

const cards = searchGemma24SajuKnowledge(sample);
const block = buildGemma24KnowledgeForSystem(sample);

console.log('=== Precise Gemma24 match ===');
console.log('matched:', cards.length);
cards.forEach((c) => console.log(' -', c.id, c.title));
console.log('injected:', block.length > 0 ? 'YES' : 'NO (accurate match only)');
if (block) console.log(block.slice(0, 500));
