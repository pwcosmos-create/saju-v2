/**
 * 사주위원회 인증(PASS) 카드 조합 — 사용자-facing 풀이 (프레임 카드 제외)
 */
import type { Gemma24SajuCard } from './saju-knowledge';
import { cardKind, searchCouncilDisplayCards } from './saju-knowledge';
import { buildPromptEnrichedSections } from './council-fortune-enrich';
import {
  FORTUNE_DISPLAY_ORDER,
  FORTUNE_SECTION_KINDS,
  FORTUNE_SECTION_TITLES,
  formatFortuneSectionHeader,
  sortFortuneSectionBlocks,
} from './fortune-display-order';
import { mergeOptimizedCardBodies, sanitizeCardBody } from './optimize-card-body';
import {
  isLowQualityFortuneBody,
  promptHasHourPillar,
  pruneFortuneSectionBody,
  sectionBlockHasBrokenFragments,
} from './fortune-text-quality';

/** 화면용 카드 1장 이상이면 조합 (프레임 카드로 수만 채우지 않음) */
const MIN_DISPLAY_CARDS = 1;
const MAX_CARDS_PER_SECTION = 3;

const COMPOSE_SECTIONS = FORTUNE_DISPLAY_ORDER.map((id) => ({
  id,
  title: FORTUNE_SECTION_TITLES[id],
  kinds: FORTUNE_SECTION_KINDS[id],
}));

function councilComposeEnabled(): boolean {
  return process.env.GEMMA24_COUNCIL_COMPOSE_FREE !== '0';
}

function cardPriority(c: Gemma24SajuCard): number {
  const k = cardKind(c);
  if (k === 'gyeok' || k === 'branch' || k === 'stem-day' || k === 'stem-chen') return 0;
  if (k === 'un-yongsin' || k === 'un-gisin') return 1;
  if (k.startsWith('deep-')) return 2;
  return 3;
}

function pickSectionCards(cards: Gemma24SajuCard[], kinds: string[]): Gemma24SajuCard[] {
  return [...cards]
    .filter((c) => kinds.includes(cardKind(c)))
    .sort((a, b) => cardPriority(a) - cardPriority(b))
    .slice(0, MAX_CARDS_PER_SECTION);
}

export { sanitizeCardBody };

const MIN_SECTION_BODY_CHARS = Number(process.env.GEMMA24_SECTION_MIN_CHARS ?? 220);

export type CouncilFreeFortuneResult = {
  text: string;
  cardCount: number;
  cardIds: number[];
  /** 조합 본문에 포함된 섹션 id */
  filledSectionIds: string[];
  /** 비었거나 본문이 짧아 Groq 보충 대상 */
  needsSupplementIds: string[];
};

export function canComposeCouncilFreeFortune(cards: Gemma24SajuCard[]): boolean {
  if (!councilComposeEnabled()) return false;
  const display = cards.filter((c) => cardKind(c) !== 'foundation');
  if (display.length < MIN_DISPLAY_CARDS) return false;
  return display.every((c) => c.councilCertified === true);
}

/** 인증 카드 → [1]~[10] 섹션 (표시 순서: 1,2,4,3,5,9,8,7,6,10) */
export function composeCouncilFreeFortune(
  cards: Gemma24SajuCard[],
  query = '',
): CouncilFreeFortuneResult {
  const displayCards = cards.filter((c) => cardKind(c) !== 'foundation');
  const usedIds: number[] = [];
  const sectionTexts: string[] = [];
  const filledIds = new Set<string>();
  const sectionBodyChars: Record<string, number> = {};

  const hasHourPillar = promptHasHourPillar(query);

  for (const block of COMPOSE_SECTIONS) {
    const matched = pickSectionCards(displayCards, block.kinds);
    if (!matched.length) continue;

    const rawBody = mergeOptimizedCardBodies(matched);
    const body = pruneFortuneSectionBody(rawBody, { hasHourPillar });
    if (!body || isLowQualityFortuneBody(body)) continue;

    for (const c of matched) usedIds.push(c.id);
    filledIds.add(block.id);
    sectionBodyChars[block.id] = body.length;
    sectionTexts.push(`${formatFortuneSectionHeader(block.id, block.title)}\n\n${body}`);
  }

  if (query.trim()) {
    for (const sec of buildPromptEnrichedSections(query, filledIds)) {
      if (filledIds.has(sec.id)) continue;
      filledIds.add(sec.id);
      sectionBodyChars[sec.id] = sec.body.length;
      sectionTexts.push(`${formatFortuneSectionHeader(sec.id, sec.title)}\n\n${sec.body}`);
    }
  }

  const needsSupplementIds = FORTUNE_DISPLAY_ORDER.filter((id) => {
    if (!filledIds.has(id)) return true;
    if ((sectionBodyChars[id] ?? 0) < MIN_SECTION_BODY_CHARS) return true;
    const block = sectionTexts.find((s) => s.startsWith(`[${id}]`));
    if (block && sectionBlockHasBrokenFragments(block)) return true;
    return false;
  });

  const orderedSections = sortFortuneSectionBlocks(sectionTexts);

  const text = [
    '✦ AI 심층 풀이 — ✓ 사주위원회 인증',
    '',
    '입력하신 사주에 맞춰 인증 지식·심층 카드를 조합했습니다.',
    '',
    ...orderedSections,
    '',
    '—',
    '참고용 풀이이며 전문 상담을 대체하지 않습니다.',
  ].join('\n');

  return {
    text,
    cardCount: [...new Set(usedIds)].length,
    cardIds: [...new Set(usedIds)],
    filledSectionIds: [...filledIds],
    needsSupplementIds: [...needsSupplementIds],
  };
}

export function tryCouncilFreeFortune(query: string): CouncilFreeFortuneResult | null {
  if (!councilComposeEnabled()) return null;
  const cards = searchCouncilDisplayCards(query);
  if (!canComposeCouncilFreeFortune(cards)) return null;
  return composeCouncilFreeFortune(cards, query);
}
