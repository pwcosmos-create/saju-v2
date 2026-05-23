import { tryCouncilFreeFortune } from '../core/gemma24/council-fortune-compose.ts';

process.env.GEMMA24_SAJU_CARDS_PATH =
  '/home/ubuntu/coupax-homepage/board/data/saju_learning/cards.json';

const stems = ['甲子', '乙卯', '丙寅', '丁亥', '戊辰', '己未', '庚申', '辛酉', '壬子', '癸亥'];
for (const p of stems) {
  const prompt = `연주: ${p} / 월주: 丙寅 / 일주: ${p} / 시주: 甲子`;
  const r = tryCouncilFreeFortune(prompt);
  console.log(p, r ? `OK ${r.cardCount}장` : 'MISS');
}
