#!/usr/bin/env node
/** fortune-text-quality 스모크 테스트 */
import {
  isBrokenPlaceholderText,
  isGenericTemplateOnlyBody,
  isLowQualityFortuneBody,
  pruneFortuneSectionBody,
  promptHasHourPillar,
  removeFortuneSectionBlocks,
} from '../core/gemma24/fortune-text-quality.ts';

const broken = [
  '오늘은 귀하의 사주에서 에 해당하는 기운을 중심으로',
  '일간·월지·격국·용신·대운·세운과 함께 으로만 서술한다.',
  '◆ 격국\n월급·저축',
  '◆ 명식·구조',
];

let fail = 0;
for (const s of broken) {
  const pruned = pruneFortuneSectionBody(s);
  if (pruned && /에 해당하는 기운|으로만 서술/.test(pruned)) {
    console.error('FAIL still broken:', pruned.slice(0, 60));
    fail++;
  }
}

if (!isBrokenPlaceholderText('에 해당하는 기운')) {
  console.error('FAIL should detect placeholder');
  fail++;
}

if (!promptHasHourPillar('연주: 갑인 | 일주: 경술 | 시주: 병술')) {
  console.error('FAIL hour pillar detect');
  fail++;
}

const withHour = pruneFortuneSectionBody('시주를 모르시면 일주만 보세요.\n\n◆ 인사\n— 본문입니다.', {
  hasHourPillar: true,
});
if (/시주를 모르/.test(withHour)) {
  console.error('FAIL hour strip');
  fail++;
}

const low = isLowQualityFortuneBody('◆ a\n— 짧음');
if (!low) {
  console.error('FAIL low quality');
  fail++;
}

const stripped = removeFortuneSectionBlocks('[1] ok\n\n[4] bad\n\n[2] ok2', ['4']);
if (/^\[4\]/m.test(stripped)) {
  console.error('FAIL section remove');
  fail++;
}

const genericOnly = `◆ 명식·구조\n년주는 유년\n\n◆ 실천 조언\n습관\n\n◆ 주의\n참고`;
if (!isGenericTemplateOnlyBody(genericOnly)) {
  console.error('FAIL generic template detect');
  fail++;
}

if (!isBrokenPlaceholderText('격과 용신 견해가 충돌할 때는 을 분명히 하고')) {
  console.error('FAIL 을 분명히 detect');
  fail++;
}

if (fail) {
  console.error(`\n${fail} failure(s)`);
  process.exit(1);
}
console.log('OK: fortune-text-quality');
