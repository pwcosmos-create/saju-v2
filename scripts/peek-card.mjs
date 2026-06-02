import fs from 'fs';
const p = process.argv[2] || '/home/ubuntu/coupax-homepage/board/data/saju_learning/cards.json';
const id = Number(process.argv[3] || 79);
const d = JSON.parse(fs.readFileSync(p, 'utf8'));
const c = d.cards.find((x) => x.id === id);
console.log(JSON.stringify(c, null, 2));
