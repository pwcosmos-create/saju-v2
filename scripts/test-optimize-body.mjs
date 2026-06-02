/**
 * 카드 본문 최적화 before/after 미리보기
 * npx tsx scripts/test-optimize-body.mjs
 */
import fs from 'fs';
import { optimizeCardBodyForDisplay } from '../core/gemma24/optimize-card-body.ts';

const p =
  process.env.GEMMA24_SAJU_CARDS_PATH
  || '/home/ubuntu/coupax-homepage/board/data/saju_learning/cards.json';

if (!fs.existsSync(p)) {
  console.log('cards.json 없음:', p);
  process.exit(0);
}

const { cards } = JSON.parse(fs.readFileSync(p, 'utf8'));
const pass = cards.filter((c) => c.council_pass === true || c.council_status === 'pass');

for (const c of pass.slice(0, 3)) {
  const card = {
    id: c.id,
    title: c.title,
    body: c.body,
    summary: c.summary,
    councilCertified: true,
  };
  const opt = optimizeCardBodyForDisplay(card);
  console.log('\n========', c.title, '========');
  console.log('원본', c.body.length, '자 → 최적화', opt.length, '자');
  console.log(opt);
}
