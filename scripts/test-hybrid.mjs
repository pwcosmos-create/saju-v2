import fs from 'fs';
import path from 'path';
import { tryCouncilHybridFortune } from '../core/gemma24/council-fortune-hybrid.ts';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const k = t.slice(0, i);
    const v = t.slice(i + 1);
    if (!process.env[k]) process.env[k] = v;
  }
}

process.env.GEMMA24_SAJU_CARDS_PATH =
  '/home/ubuntu/coupax-homepage/board/data/saju_learning/cards.json';

const prompt = `
연주: 甲子(甲子) / 월주: 丙寅(丙寅) / 일주: 甲子(甲子) / 시주: 甲子
▶ 격국 (格局):
  정관격(正官格)
▶ 오행 분류 확정
  용신(用神) = 수(水)
  기신(忌神) = 금(金)
【월별 엔진 데이터】
1월: 테스트
【대운 데이터(누락 금지)】
10~19세: 테스트
`.trim();

console.log('HYBRID_GROQ', process.env.GEMMA24_HYBRID_GROQ ?? '(default on)');
const r = await tryCouncilHybridFortune(prompt);
console.log('mode:', r?.mode);
console.log('length:', r?.text?.length);
console.log('has supplement:', r?.text?.includes('맞춤 보충'));
if (r?.text?.includes('과부하') || r?.text?.includes('한도')) {
  console.log('WARNING: overload text in result');
}
console.log('--- tail ---');
console.log(r?.text?.slice(-400));
