/**
 * 사주위원회 인증(PASS) 카드 조합 — 사용자-facing 풀이 (프레임 카드 제외)
 */
import type { Gemma24SajuCard } from './saju-knowledge';
import { cardKind, searchCouncilDisplayCards } from './saju-knowledge';
import { buildPromptEnrichedSections } from './council-fortune-enrich';
import { mergeOptimizedCardBodies, sanitizeCardBody } from './optimize-card-body';

/** 화면용 카드 1장 이상이면 조합 (프레임 카드로 수만 채우지 않음) */
const MIN_DISPLAY_CARDS = 1;

/** 화면에 넣을 섹션 — AiRenderer [N] + 이미지와 매칭 */
const COMPOSE_SECTIONS: { id: string; title: string; kinds: string[] }[] = [
  { id: '1', title: '이 사주의 핵심 성향', kinds: ['stem-day', 'stem-chen'] },
  { id: '3', title: '격국(格局)과 기질', kinds: ['gyeok'] },
  { id: '5', title: '용신·기신과 에너지 조언', kinds: ['un-yongsin', 'un-gisin'] },
  { id: '7', title: '지지 관계와 인연 흐름', kinds: ['branch'] },
];

function councilComposeEnabled(): boolean {
  return process.env.GEMMA24_COUNCIL_COMPOSE_FREE !== '0';
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

/** 인증 카드 → [1][3][5][7] 섹션 + 프롬프트 확정 데이터 보강 */
export function composeCouncilFreeFortune(
  cards: Gemma24SajuCard[],
  query = '',
): CouncilFreeFortuneResult {
  const displayCards = cards.filter((c) => cardKind(c) !== 'foundation');
  const usedIds: number[] = [];
  const sectionTexts: string[] = [];
  const filledIds = new Set<string>();

  for (const block of COMPOSE_SECTIONS) {
    const matched = displayCards.filter((c) => block.kinds.includes(cardKind(c)));
    if (!matched.length) continue;

    const body = mergeOptimizedCardBodies(matched);
    if (!body) continue;

    for (const c of matched) usedIds.push(c.id);
    filledIds.add(block.id);
    sectionTexts.push(`[${block.id}] ${block.title}\n\n${body}`);
  }

  if (query.trim()) {
    for (const sec of buildPromptEnrichedSections(query, filledIds)) {
      sectionTexts.push(`[${sec.id}] ${sec.title}\n\n${sec.body}`);
    }
  }

  sectionTexts.sort((a, b) => sectionId(a) - sectionId(b));

  const text = [
    '✦ AI 심층 풀이 — ✓ 사주위원회 인증',
    '',
    '입력하신 사주에 맞춰 인증 지식을 요약·조합했습니다.',
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
