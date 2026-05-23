/**
 * 홈페이지 AI 심층 풀이 — 섹션 표시 순서 (번호 [N]은 유지, 나열 순서만 고정)
 * 1 → 2 → 4 → 3 → 5 → 9 → 8 → 7 → 6 → 10
 */
export const FORTUNE_DISPLAY_ORDER = [
  '1',
  '2',
  '4',
  '3',
  '5',
  '9',
  '8',
  '7',
  '6',
  '10',
] as const;

export type FortuneSectionId = (typeof FORTUNE_DISPLAY_ORDER)[number];

export const FORTUNE_SECTION_TITLES: Record<FortuneSectionId, string> = {
  '1': '이 사주의 핵심 성향',
  '2': '사주 원국과 패턴',
  '4': '오행 균형과 보완',
  '3': '격국(格局)과 기질',
  '5': '용신·기신과 에너지 조언',
  '9': '대운·세운·올해 흐름',
  '8': '돈과 재물',
  '7': '지지 관계와 인연 흐름',
  '6': '직업과 적성',
  '10': '실천 전략과 주의',
};

/** 조합 시 카드 kind 매핑 */
export const FORTUNE_SECTION_KINDS: Record<FortuneSectionId, string[]> = {
  '1': ['stem-day', 'stem-chen', 'deep-1'],
  '2': ['deep-2'],
  '4': ['deep-3'],
  '3': ['gyeok', 'deep-4'],
  '5': ['un-yongsin', 'un-gisin', 'deep-5'],
  '9': ['deep-6'],
  '8': ['deep-7'],
  '7': ['branch', 'deep-8'],
  '6': ['deep-9'],
  '10': ['deep-10'],
};

export function fortuneSectionSortIndex(sectionId: string): number {
  const i = (FORTUNE_DISPLAY_ORDER as readonly string[]).indexOf(sectionId);
  return i >= 0 ? i : 99;
}

export function sortFortuneSectionBlocks(sectionTexts: string[]): string[] {
  const idOf = (line: string) => line.match(/^\[(\d+)\]/)?.[1] ?? '99';
  return [...sectionTexts].sort(
    (a, b) => fortuneSectionSortIndex(idOf(a)) - fortuneSectionSortIndex(idOf(b)),
  );
}

export const FORTUNE_DISPLAY_ORDER_HINT = [
  '━━━ 섹션 출력 순서 (반드시 준수) ━━━',
  '아래 번호 순서대로만 작성하세요. 번호 자체는 바꾸지 마세요:',
  '[1] → [2] → [4] → [3] → [5] → [9] → [8] → [7] → [6] → [10]',
].join('\n');
