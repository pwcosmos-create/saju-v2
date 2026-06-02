import fs from 'fs';

const p =
  process.env.GEMMA24_SAJU_CARDS_PATH
  || '/home/ubuntu/coupax-homepage/board/data/saju_learning/cards.json';

const d = JSON.parse(fs.readFileSync(p, 'utf8'));
const cards = (d.cards || []).filter((c) => (c.title || '').trim().startsWith('심층·['));

cards.sort((a, b) => {
  const na = parseInt(a.title.match(/\[(\d+)\]/)?.[1] ?? '99', 10);
  const nb = parseInt(b.title.match(/\[(\d+)\]/)?.[1] ?? '99', 10);
  return na - nb;
});

console.log(`심층·[1]~[10] PASS 카드 — ${cards.length}장\n`);
for (const c of cards) {
  const n = c.title.match(/\[(\d+)\]/)?.[1] ?? '?';
  const pass = c.council_pass === true || c.council_status === 'pass';
  console.log(`[${n}] id=${c.id} ${pass ? 'PASS' : c.council_status || '-'}`);
  console.log(`    제목: ${c.title.trim()}`);
  const sum = (c.summary || '').trim();
  if (sum) console.log(`    summary: ${sum.slice(0, 120)}${sum.length > 120 ? '…' : ''}`);
  console.log('');
}
