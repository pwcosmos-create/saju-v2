/**
 * 사주위원회 인증(PASS) 카드 조합 — 사용자-facing 풀이 (프레임 카드 제외)
 */
import type { Gemma24SajuCard } from './saju-knowledge';
import { cardKind, searchCouncilDisplayCards } from './saju-knowledge';
import { buildPromptEnrichedSections } from './council-fortune-enrich';
import { mergeOptimizedCardBodies, sanitizeCardBody } from './optimize-card-body';

/** 화면용 카드 1장 이상이면 조합 (프레임 카드로 수만 채우지 않음) */
const MIN_DISPLAY_CARDS = 1;
const MAX_CARDS_PER_SECTION = 3;

/** [N] 섹션 ↔ 카드 kind (변수· + 심층·) */
const COMPOSE_SECTIONS: { id: string; title: string; kinds: string[] }[] = [
  { id: '1', title: '이 사주의 핵심 성향', kinds: ['stem-day', 'stem-chen', 'deep-1'] },
  { id: '2', title: '사주 원국과 패턴', kinds: ['deep-2'] },
  { id: '3', title: '격국(格局)과 기질', kinds: ['gyeok', 'deep-4'] },
  { id: '4', title: '오행 균형과 보완', kinds: ['deep-3'] },
  { id: '5', title: '용신·기신과 에너지 조언', kinds: ['un-yongsin', 'un-gisin', 'deep-5'] },
  { id: '6', title: '직업과 적성', kinds: ['deep-9'] },
  { id: '7', title: '지지 관계와 인연 흐름', kinds: ['branch', 'deep-8'] },
  { id: '8', title: '돈과 재물', kinds: ['deep-7'] },
  { id: '9', title: '대운·세운·올해 흐름', kinds: ['deep-6'] },
  { id: '10', title: '실천 전략과 주의', kinds: ['deep-10'] },
];

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

export type CouncilFreeFortuneResult = {
  text: string;
  cardCount: number;
  cardIds: number[];
};

export function canComposeCouncilFreeFortune(cards: Gemma24SajuCard[]): boolean {
  if (!councilComposeEnabled()) return false;
  const display = cards.filter((c) => cardKind(c) !== 'foundation');
  if (display.length < MIN_DISPLAY_CARDS) return false;
  return display.every((c) => c.councilCertified === true);
}

function sectionId(line: string): number {
  return parseInt(line.match(/^\[(\d+)\]/)?.[1] ?? '99', 10);
}

/** 인증 카드 → [1]~[10] 섹션 + 프롬프트 확정 데이터 보강 */
export function composeCouncilFreeFortune(
  cards: Gemma24SajuCard[],
  query = '',
): CouncilFreeFortuneResult {
  const displayCards = cards.filter((c) => cardKind(c) !== 'foundation');
  const usedIds: number[] = [];
  const sectionTexts: string[] = [];
  const filledIds = new Set<string>();

  for (const block of COMPOSE_SECTIONS) {
    const matched = pickSectionCards(displayCards, block.kinds);
    if (!matched.length) continue;

    const body = mergeOptimizedCardBodies(matched);
    if (!body) continue;

    for (const c of matched) usedIds.push(c.id);
    filledIds.add(block.id);
    sectionTexts.push(`[${block.id}] ${block.title}\n\n${body}`);
  }

  if (query.trim()) {
    for (const sec of buildPromptEnrichedSections(query, filledIds)) {
      if (filledIds.has(sec.id)) continue;
      filledIds.add(sec.id);
      sectionTexts.push(`[${sec.id}] ${sec.title}\n\n${sec.body}`);
    }
  }

  sectionTexts.sort((a, b) => sectionId(a) - sectionId(b));

  const text = [
    '✦ AI 심층 풀이 — ✓ 사주위원회 인증',
    '',
    '입력하신 사주에 맞춰 인증 지식·심층 카드를 조합했습니다.',
    '',
    ...sectionTexts,
    '',
    '—',
    '참고용 풀이이며 전문 상담을 대체하지 않습니다.',
  ].join('\n');

  return {
    text,
    cardCount: [...new Set(usedIds)].length,
    cardIds: [...new Set(usedIds)],
  };
}

export function tryCouncilFreeFortune(query: string): CouncilFreeFortuneResult | null {
  if (!councilComposeEnabled()) return null;
  const cards = searchCouncilDisplayCards(query);
  if (!canComposeCouncilFreeFortune(cards)) return null;
  return composeCouncilFreeFortune(cards, query);
}
