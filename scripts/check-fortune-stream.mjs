#!/usr/bin/env node
const res = await fetch('http://127.0.0.1:3001/api/fortune-stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: '테스트: 한 줄로 오늘 운세' }),
});
console.log('STATUS', res.status);
const reader = res.body?.getReader();
if (!reader) {
  console.log('NO_BODY');
  process.exit(1);
}
const dec = new TextDecoder();
let total = '';
for (let i = 0; i < 8; i++) {
  const { done, value } = await reader.read();
  if (done) break;
  total += dec.decode(value, { stream: true });
  if (total.length > 400) break;
}
await reader.cancel();
console.log('SAMPLE', total.slice(0, 400).replace(/\n/g, ' '));
