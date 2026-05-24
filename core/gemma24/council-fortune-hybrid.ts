/**
 * 인증 카드 조합 + Groq/Gemini 보충 (빈·짧은 섹션만)
 */
import { fetchLlmCompletionText } from '../config/llm';
import type { Gemma24SajuCard } from './saju-knowledge';
import { cardKind, searchCouncilContextCards, searchCouncilDisplayCards } from './saju-knowledge';
import { buildOfflineHybridSupplement } from './council-fortune-enrich';
import {
  canComposeCouncilFreeFortune,
  composeCouncilFreeFortune,
  type CouncilFreeFortuneResult,
} from './council-fortune-compose';
import {
  FORTUNE_DISPLAY_ORDER_HINT,
  formatFortuneSectionHeader,
  humanizeDeepSectionText,
  sortFortuneSectionBlocks,
} from './fortune-display-order';

const SUPPLEMENT_SYSTEM = `당신은 사주팔자 전문가입니다.
이미 「사주위원회 인증」 지식 카드로 작성된 본문이 있습니다. 그 내용을 반복·요약하지 마세요.
지시된 번호 섹션만 추가 작성하세요. ◆ 소제목 사용. 평어체(~해요).
전문 용어는 쉬운 풀이 후 괄호 한자. 출처·각주 표시 금지.
각 섹션은 반드시 [본문id] 표시번호. 주제 형식으로 시작하세요.
예: [1] 1. 인사 성향, [4] 3. 오행 균형, [9] 6. 대운 세운`;

function hybridGroqEnabled(): boolean {
  return process.env.GEMMA24_HYBRID_GROQ !== '0';
}

/** 조합 결과 기준 — 카드 풀에 심층 카드가 있어도 본문이 비거나 짧으면 보충 */
export function getGroqSupplementSections(composed: CouncilFreeFortuneResult): string[] {
  return composed.needsSupplementIds.map((id) => `[${id}]`);
}

function formatSupplementSectionBrief(composed: CouncilFreeFortuneResult): string {
  return composed.needsSupplementIds
    .map((id) => {
      const filled = composed.filledSectionIds.includes(id);
      const note = filled ? '(인증 카드만 있어 짧음 — 맞춤 확장)' : '(본문 없음 — 새로 작성)';
      return `${formatFortuneSectionHeader(id)} ${note}`;
    })
    .join('\n');
}

function isOverloadText(text: string): boolean {
  return text.includes('과부하') || text.includes('한도 초과');
}

/** 보충 블록을 표시 순서로 정렬 */
function sortSupplementBlocks(text: string): string {
  const blocks = text
    .split(/(?=^\[\d+\])/m)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length <= 1) return text.trim();
  return sortFortuneSectionBlocks(blocks).join('\n\n');
}

export type CouncilHybridResult = {
  composed: CouncilFreeFortuneResult;
  missingSections: string[];
  contextCards?: Gemma24SajuCard[];
};

export function tryCouncilHybridBase(query: string): CouncilHybridResult | null {
  const displayCards = searchCouncilDisplayCards(query);
  if (!canComposeCouncilFreeFortune(displayCards)) return null;
  const composed = composeCouncilFreeFortune(displayCards, query);
  const missingSections = hybridGroqEnabled() ? getGroqSupplementSections(composed) : [];
  return { composed, missingSections, contextCards: searchCouncilContextCards(query) };
}

export async function buildCouncilHybridFortune(
  query: string,
  base: CouncilHybridResult,
): Promise<{ text: string; mode: 'council-compose' | 'council-hybrid' | 'council-hybrid-pending'; cardCount: number }> {
  const { composed, missingSections, contextCards } = base;
  const baseFooter = '참고용 풀이이며 전문 상담을 대체하지 않습니다.';

  if (!missingSections.length) {
    return { text: composed.text, mode: 'council-compose', cardCount: composed.cardCount };
  }

  const sectionBrief = formatSupplementSectionBrief(composed);
  const frameHint = (contextCards ?? [])
    .filter((c) => cardKind(c) === 'foundation')
    .map((c) => c.title)
    .join(', ');

  const userBlock = [
    '【이미 제공된 인증 지식 — 반복·요약 금지】',
    composed.text.slice(0, 5000),
    frameHint ? `(참고 프레임만: ${frameHint})` : '',
    '',
    '【원본 사주 데이터 — 아래만 근거로 보충 작성】',
    query.slice(0, 10000),
    '',
    '【작성할 섹션】',
    sectionBrief,
    '',
    FORTUNE_DISPLAY_ORDER_HINT,
    '',
    '각 섹션 300~500자. 월별·대운 데이터가 프롬프트에 있으면 반드시 반영.',
  ].join('\n');

  const supplement = await fetchLlmCompletionText(
    {
      max_tokens: 2800,
      temperature: 0.65,
      messages: [
        { role: 'system', content: SUPPLEMENT_SYSTEM },
        { role: 'user', content: userBlock },
      ],
    },
    { geminiFirst: false },
  );

  if (!supplement || isOverloadText(supplement)) {
    const offline = buildOfflineHybridSupplement(query);
    const offlineFiltered = filterOfflineToNeeded(offline, composed.needsSupplementIds);
    const text = [
      composed.text.replace(baseFooter, '').trim(),
      '',
      '━━━ 맞춤 풀이 (사주 데이터 기반) ━━━',
      '',
      offlineFiltered || offline,
      '',
      '※ 지금은 맞춤 보충이 잠시 어렵습니다. 위는 사주 데이터 기반 풀이이며, 1~2분 뒤 「다시 분석하기」를 눌러 주세요.',
      '',
      '—',
      baseFooter,
    ].join('\n');
    return { text, mode: 'council-hybrid-pending', cardCount: composed.cardCount };
  }

  const sortedSupplement = humanizeDeepSectionText(sortSupplementBlocks(supplement));

  const text = [
    composed.text.replace(baseFooter, '').trim(),
    '',
    '━━━ 맞춤 보충 풀이 ━━━',
    '',
    sortedSupplement,
    '',
    '—',
    '인증 카드와 사주 데이터를 바탕으로 작성되었습니다. 추가 질문은 AI 심층 상담을 이용해 주세요.',
  ].join('\n');

  return { text, mode: 'council-hybrid', cardCount: composed.cardCount };
}

function filterOfflineToNeeded(offline: string, neededIds: string[]): string {
  if (!neededIds.length) return offline;
  const blocks = offline
    .split(/(?=^\[\d+\])/m)
    .map((b) => b.trim())
    .filter(Boolean);
  const need = new Set(neededIds);
  const picked = blocks.filter((b) => {
    const id = b.match(/^\[(\d+)\]/)?.[1];
    return id && need.has(id);
  });
  return picked.length ? sortFortuneSectionBlocks(picked).join('\n\n') : '';
}

export async function tryCouncilHybridFortune(
  query: string,
): Promise<{ text: string; mode: 'council-compose' | 'council-hybrid' | 'council-hybrid-pending'; cardCount: number } | null> {
  const base = tryCouncilHybridBase(query);
  if (!base) return null;
  return buildCouncilHybridFortune(query, base);
}
