import fs from 'fs';

const cardsPath = process.env.GEMMA24_SAJU_CARDS_PATH
  || '/home/ubuntu/coupax-homepage/board/data/saju_learning/cards.json';
const packPath = process.env.GEMMA24_SAJU_KNOWLEDGE_PATH
  || '/home/ubuntu/coupax-homepage/board/data/saju_learning/saju_knowledge_pack.json';

function countFile(p, requireConfirmed) {
  if (!fs.existsSync(p)) return null;
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  const cards = d.cards || [];
  const confirmed = requireConfirmed
    ? cards.filter((c) => !c.status || c.status === 'confirmed')
    : cards;
  return {
    path: p,
    mtime: fs.statSync(p).mtime.toISOString(),
    updated_at: d.updated_at || d.exported_at || null,
    total: confirmed.length,
  };
}

const live = countFile(cardsPath, true);
const pack = countFile(packPath, false);

console.log('=== Gemma24 Saju Knowledge (live sync) ===');
console.log('LIVE cards.json (saju-v2 reads this first):');
console.log(live || '  (not found)');
console.log('FALLBACK saju_knowledge_pack.json:');
console.log(pack || '  (not found)');
