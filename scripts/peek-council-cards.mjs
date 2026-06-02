import fs from 'fs';

const p = process.env.GEMMA24_SAJU_CARDS_PATH
  || '/home/ubuntu/coupax-homepage/board/data/saju_learning/cards.json';
const d = JSON.parse(fs.readFileSync(p, 'utf8'));
const cards = d.cards || [];
const pass = cards.filter((c) => c.council_pass === true || c.council_status === 'pass');
const fail = cards.filter((c) => c.council_pass === false || c.council_status === 'fail');
const none = cards.filter((c) => c.council_pass == null && !c.council_status);
console.log('total', cards.length, 'pass', pass.length, 'fail', fail.length, 'no_council', none.length);
