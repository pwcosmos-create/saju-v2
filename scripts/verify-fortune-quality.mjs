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
import { buildDaeunFortuneBody, parseDaeunFromQuery } from '../core/gemma24/council-fortune-daeun.ts';
import {
  buildTodayFortuneCardDraft,
  buildTodayFortuneCounselReply,
} from '../core/daily-fortune/counsel-format.ts';
import { optimizeCardBodyForDisplay } from '../core/gemma24/optimize-card-body.ts';
import { buildDayFortuneCounselReply } from '../core/daily-fortune/counsel-format.ts';
import { parseDayFortuneOffset } from '../core/gemma24/is-today-fortune-question.ts';
import { extractCounselVoiceAnswer } from '../lib/counsel-voice-answer.ts';
import { prepareTextForTts } from '../lib/prepare-text-for-tts.ts';
import { splitForPausedReading } from '../lib/tts-paused-reading.ts';
import { extractPromptFacts } from '../core/gemma24/saju-knowledge.ts';

const DAEUN_SAMPLE = `
생년월일: 1974년 3월 10일
대운: 4세: 갑자 / 14세: 을축 / 24세: 병인 (순행)
【월별 엔진 데이터】
1월: 보통 ★★
3월: 매우 좋음 ★★★★★
8월: 매우 주의 ★
【대운 데이터(누락 금지)】
- 4세(1978~1987): 갑자(甲子)
- 14세(1988~1997): 을축(乙丑)
- 24세(1998~2007): 병인(丙寅)
`;

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

const fixed = polishFortuneText('— 경금 일간의 강점을 살리되, 용신 토(土을(를) 일상');
if (!fixed.includes('토(土)을(를)')) {
  console.error('FAIL yongsin paren repair:', fixed);
  fail++;
}

const daeunParsed = parseDaeunFromQuery(DAEUN_SAMPLE);
if (daeunParsed.periods.length < 3) {
  console.error('FAIL parseDaeunFromQuery periods:', daeunParsed.periods.length);
  fail++;
}
const daeunBody = buildDaeunFortuneBody({
  ...daeunParsed,
  yongsinElem: '토',
  gisinElems: ['화'],
  stemKo: '경금',
  query: DAEUN_SAMPLE,
});
if (!daeunBody || !/10년 대운|구간별 흐름|4세\(1978/.test(daeunBody)) {
  console.error('FAIL daeun body:', daeunBody?.slice(0, 80));
  fail++;
}
if (!/상반기:|주의 달:|좋은 달:/.test(daeunBody)) {
  console.error('FAIL daeun monthly summary');
  fail++;
}
const genericDaeun =
  '◆ 대운·세운\n— 세운·월운은 확정 데이터와 함께 읽을 때 정확합니다. 상반기는 기반을 다지고, 하반기는 용신 방향으로 실행·정리하는 흐름이 맞습니다.';
if (!isLowQualityFortuneBody(genericDaeun, DAEUN_SAMPLE)) {
  console.error('FAIL generic daeun detect');
  fail++;
}

const todayPayload = {
  date: '2026-05-25',
  dayLabel: '己亥',
  dayHanja: '己亥',
  level: '보통',
  score: 0,
  sipsin: '정인',
  action: '휴식·학습·회복 유리',
  oneLiner: '편인 흐름에 정인일 · 특이 사항 없음 · 보통',
  eventsSummary: '특이 사항 없음',
  daewoonSipsin: '정재',
  yearSipsin: '편인',
  monthSipsin: '식신',
};
const todayDraft = buildTodayFortuneCardDraft(todayPayload);
const todayCard = {
  id: 9001,
  title: todayDraft.title,
  body: todayDraft.body,
  summary: todayDraft.summary,
  councilCertified: false,
};
const todayOptimized = optimizeCardBodyForDisplay(todayCard);
if (!/◆\s*핵심|일진 십신|◆\s*실천/.test(todayOptimized)) {
  console.error('FAIL today fortune card body:', todayOptimized.slice(0, 120));
  fail++;
}
const todayReply = buildTodayFortuneCounselReply(todayPayload, '유진');
if (!/◆\s*오늘의 기운|◆\s*흐름 한눈에|◆\s*오늘 이렇게/.test(todayReply)) {
  console.error('FAIL today fortune counsel reply');
  fail++;
}

if (parseDayFortuneOffset('내일은 어때?') !== 1) {
  console.error('FAIL tomorrow question detect');
  fail++;
}
if (parseDayFortuneOffset('내일의 사주') !== 1) {
  console.error('FAIL 내일의 사주 detect');
  fail++;
}
const tomorrowReply = buildDayFortuneCounselReply(todayPayload, '유진', '내일');
if (!/내일의 운세|◆\s*내일의 기운/.test(tomorrowReply)) {
  console.error('FAIL tomorrow counsel reply');
  fail++;
}

const counselRaw = `『유진』입니다. 질문하신 「오늘의 운세」에 대해 풀어 보았습니다.

◆ 오늘의 기운
2026-05-25 · 보통
무리하지 않고 리듬을 맞추면 좋은 날입니다.

위 내용은 오늘 일진과 사주 흐름을 바탕으로 한 참고 풀이입니다.`;
const voiceOnly = extractCounselVoiceAnswer(counselRaw);
if (/질문하신|위 내용은/.test(voiceOnly)) {
  console.error('FAIL counsel voice extract:', voiceOnly);
  fail++;
}
if (!/오늘의 기운/.test(voiceOnly)) {
  console.error('FAIL counsel voice missing body');
  fail++;
}
const ttsReady = prepareTextForTts(counselRaw);
if (!/2026년 5월 25일/.test(ttsReady) || /己亥|★/.test(ttsReady)) {
  console.error('FAIL prepareTextForTts:', ttsReady);
  fail++;
}
const ttsUnits = splitForPausedReading(ttsReady);
if (ttsUnits.length < 2 || !ttsUnits.some((u) => u.text.includes('오늘의 기운'))) {
  console.error('FAIL splitForPausedReading units:', ttsUnits.length);
  fail++;
}

if (fail) {
  console.error(`\n${fail} failure(s)`);
  process.exit(1);
}
console.log('OK: fortune-text-quality');
