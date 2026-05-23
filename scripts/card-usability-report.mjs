/**
 * live cards.json 사용 가능 카드 실시간 집계
 * node scripts/card-usability-report.mjs
 * npx tsx scripts/card-usability-report.mjs  (권장)
 */
import { collectGemma24CardStats } from '../core/gemma24/card-stats.ts';

const stats = collectGemma24CardStats();

console.log('=== saju-v2 사용 가능 카드 (실시간) ===');
console.log('수집 시각:', stats.collectedAt);
console.log('파일:', stats.source);
console.log('mtime:', stats.fileMtime);
if (stats.updatedAt) console.log('updated_at:', stats.updatedAt);
console.log('');
console.log('전체 카드:', stats.total);
console.log('confirmed:', stats.confirmed);
console.log('saju-v2 주입 가능:', stats.usable);
console.log('  ├─ 위원회 PASS (인증):', stats.certified);
console.log('  └─ 검수만:', stats.reviewed);
console.log('제외 — FAIL:', stats.excludedFail);
console.log('제외 — test:', stats.excludedTest);
console.log('');
console.log('축별 (주입 가능):');
const kindOrder = ['other', 'stem-day', 'stem-chen', 'gyeok', 'branch', 'yongsin', 'gisin'];
for (const k of kindOrder) {
  const v = stats.byKind[k];
  if (v.total > 0) console.log(`  ${k}: ${v.total} (PASS ${v.certified})`);
}
console.log('');
if (stats.certifiedCards.length) {
  console.log('PASS 카드 목록:');
  for (const c of stats.certifiedCards) {
    console.log(`  [${c.id}] ${c.title} (${c.kind})`);
  }
} else {
  console.log('PASS 카드: 없음');
}
