#!/usr/bin/env node
/** fortune-text-quality 스모크 테스트 */
import {
  isBrokenPlaceholderText,
  isGenericTemplateOnlyBody,
  isLowQualityFortuneBody,
  pruneFortuneSectionBody,
  promptHasHourPillar,
  removeFortuneSectionBlocks,
  isCardScaffoldBody,
  isTruncatedFortuneLine,
  polishFortuneText,
  stripFortuneFooters,
} from '../core/gemma24/fortune-text-quality.ts';
import { extractPromptFacts } from '../core/gemma24/saju-knowledge.ts';

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

if (!isBrokenPlaceholderText('칠살격()은(는) 일간과')) {
  console.error('FAIL empty parens gyeok');
  fail++;
}

const dupFooter = stripFortuneFooters('본문\n\n—\n참고용 풀이 A\n\n—\n참고용 풀이 B');
if (/참고용/.test(dupFooter)) {
  console.error('FAIL footer strip');
  fail++;
}

const jobEncy = '◆ 직업\n— 관성이 강하면 조직·공무·규율·책임, 식상이면 기술·교육·창업·콘텐츠, 인성이면 연구';
if (!isLowQualityFortuneBody(jobEncy, '일주: 기미')) {
  console.error('FAIL encyclopedic job');
  fail++;
}

const polished = polishFortuneText('— 용신: 화(火) ← 이 일간에게\n— 칠살격()은(는)');
if (/←|칠살격\(\)/.test(polished)) {
  console.error('FAIL polish:', polished);
  fail++;
}

const facts = extractPromptFacts('일주: 기미(己未) / 시주: 무진');
if (facts.stemKo !== '기토') {
  console.error('FAIL stemKo from 기미(己未):', facts.stemKo);
  fail++;
}

const scaffold = '◆ 해석·기토\n【일주】\n◆ 테마 풀이\n골라 말씀드립니다';
if (!isCardScaffoldBody(scaffold)) {
  console.error('FAIL scaffold detect');
  fail++;
}

if (!isBrokenPlaceholderText('용신(화(火)')) {
  console.error('FAIL unclosed paren');
  fail++;
}

if (!isTruncatedFortuneLine('— 기토 일간의 강점을 살리되, 용신 화(火)')) {
  console.error('FAIL truncated yongsin line');
  fail++;
}

if (isTruncatedFortuneLine('— 기토 일간의 강점을 살리되, 용신 화(火)을(를) 일상 습관으로 옮기는 것이 핵심입니다.')) {
  console.error('FAIL full line marked truncated');
  fail++;
}

if (fail) {
  console.error(`\n${fail} failure(s)`);
  process.exit(1);
}
console.log('OK: fortune-text-quality');
