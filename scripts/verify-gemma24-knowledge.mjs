import { buildGemma24KnowledgeResult, searchGemma24SajuKnowledge } from '../core/gemma24/saju-knowledge.ts';

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

const result = buildGemma24KnowledgeResult(sample);
const cards = searchGemma24SajuKnowledge(sample);

console.log('=== Gemma24 + Council ===');
console.log('badge:', result.badge, 'cards:', result.cardCount);
cards.forEach((c) => console.log(' -', c.id, c.title, c.councilCertified ? '[인증]' : ''));
console.log('injected:', result.systemAppend.length > 0 ? 'YES' : 'NO');
