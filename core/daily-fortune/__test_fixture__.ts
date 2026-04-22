/**
 * 1974-03-10 남 검증 케이스 (§14 부록)
 * npx tsx core/daily-fortune/__test_fixture__.ts
 */
import { STEM_ELEM } from '../pillar-calc/korean-calendar-engine';
import { calcStrength, classifyElements, getSipsin } from './classifier';
import { dailyFortune } from './index';
import type { SajuResult } from '../pillar-calc/main-calculator';

// ── 픽스처 구성
// 갑인 / 정묘 / 경술 / 병술
const pillars = [
  { s: 0, b: 2  },  // 갑인 (년)
  { s: 3, b: 3  },  // 정묘 (월)
  { s: 6, b: 10 },  // 경술 (일)
  { s: 2, b: 10 },  // 병술 (시)
] as const;

// ohaeng.counts: [목, 화, 토, 금, 수]
// 갑인: 목+목=2, 정묘: 화+목=3목/1화, 경술: 금+토, 병술: 화+토
// 목: 갑(0)+인(0)+묘(0) = 3개
// 화: 정(1)+병(1) = 2개
// 토: 술(2)+술(2) = 2개
// 금: 경(3) = 1개
// 수: 0개
const elemCounts = [3, 2, 2, 1, 0];

const natal = {
  pillars:  pillars as any,
  ohaeng:   { counts: elemCounts, strongest: 0, weakest: 4, detail: '' },
  daeun:    { pillars: [{ s: 4, b: 4 }], startAge: 3, forward: false },
  shinsal:  [],
  input:    { year: 1974, month: 3, day: 10, hourTotalMin: 480, gender: '남' },
} as unknown as SajuResult;

// ── 검증
const dayStemIdx = 6; // 경
const dayElemIdx = STEM_ELEM[dayStemIdx]; // 3 = 금

const { score, isWeak } = calcStrength(pillars as any, dayElemIdx);
const cls = classifyElements(dayStemIdx, isWeak, elemCounts);

console.log('=== 1974-03-10 남 검증 ===\n');
console.log(`신강/신약 점수: ${score} → isWeak: ${isWeak}`);
console.log(`용신(yongsin): ${cls.yongsin}  (기대: 2=토)`);
console.log(`희신(huisin):  [${cls.huisin}]  (기대: [3,4] 금·수)`);
console.log(`기신(gisin):   [${cls.gisin}]  (기대: [0,1] 목·화)`);
console.log(`구신(gusin):   ${cls.gusin}  (기대: null)`);
console.log(`한신(hansin):  [${cls.hansin}]`);

console.log('\n── 체크리스트 ──');
const checks = [
  ['isWeak === true',     isWeak === true],
  ['yongsin === 2(토)',   cls.yongsin === 2],
  ['huisin ∋ 3(금)',      cls.huisin.includes(3)],
  ['huisin ∋ 4(수=조후)', cls.huisin.includes(4)],
  ['gisin ∋ 0(목)',       cls.gisin.includes(0)],
  ['gisin ∋ 1(화=구신승격)', cls.gisin.includes(1)],
  ['gusin === null',      cls.gusin === null],
] as [string, boolean][];

let pass = 0;
for (const [label, ok] of checks) {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  if (ok) pass++;
}
console.log(`\n결과: ${pass}/${checks.length} 통과`);

// 십신 샘플
console.log('\n── 십신 샘플 (경금 기준) ──');
for (let t = 0; t < 10; t++) {
  console.log(`  경 vs ${['갑','을','병','정','무','기','경','신','임','계'][t]}: ${getSipsin(6, t)}`);
}

// 오늘의 운세 샘플
console.log('\n── dailyFortune(2026-04-19) ──');
const result = dailyFortune(natal, new Date('2026-04-19'));
const STEMS_DBG = ['갑','을','병','정','무','기','경','신','임','계'];
const BRANCHES_DBG = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
console.log(`일진: ${STEMS_DBG[result.dayGanji.s]}${BRANCHES_DBG[result.dayGanji.b]}`);
console.log(`십신: ${result.sipsin}`);
console.log(`점수: ${result.score.toFixed(2)}`);
console.log(`수준: ${result.level}`);
console.log(`행동: ${result.action}`);
console.log(`배경: 대운=${result.background.daewoonSipsin} 세운=${result.background.yearSipsin} 월운=${result.background.monthSipsin}`);
console.log(`이벤트: ${result.events.length}개`);
console.log(`한줄: ${result.oneLiner}`);
