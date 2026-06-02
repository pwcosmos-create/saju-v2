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

/** 화면 [N] ↔ 인증 심층 카드 제목 (주제 기준, deep-N kind와 동일) */
export const FORTUNE_SECTION_TITLES: Record<FortuneSectionId, string> = {
  '1': '심층·[1] 인사·성향',
  '2': '심층·[2] 사주팔자',
  '4': '심층·[3] 오행 균형',
  '3': '심층·[4] 십신·격국',
  '5': '심층·[5] 용신·기신',
  '9': '심층·[6] 대운·세운',
  '8': '심층·[7] 재물',
  '7': '심층·[8] 연애·관계',
  '6': '심층·[9] 직업',
  '10': '심층·[10] 실천·주의',
};

/** 심층·[N] 카드 본문 — "심층 섹션 N" 대신 쓸 주제명 */
export const DEEP_CARD_TOPICS: Record<string, string> = {
  '1': '인사·성향',
  '2': '사주팔자',
  '3': '오행 균형',
  '4': '십신·격국',
  '5': '용신·기신',
  '6': '대운·세운',
  '7': '재물',
  '8': '연애·관계',
  '9': '직업',
  '10': '실천·주의',
};

/** 【심층 섹션 6】 등 카드 메타 라벨 → 주제명 */
export function humanizeDeepSectionLabel(label: string): string {
  const t = label.trim();
  const m = t.match(/^(?:심층\s*)?섹션\s*(\d+)$/i);
  if (m) return DEEP_CARD_TOPICS[m[1]] ?? t;
  return t;
}

export function humanizeDeepSectionText(text: string): string {
  return text.replace(/심층\s*섹션\s*(\d+)/gi, (_, n) => DEEP_CARD_TOPICS[n] ?? `심층·[${n}]`);
}

/** 화면 나열 순서 기준 1~10 (본문 [N] id와 별개) */
export function fortuneSectionDisplayNumber(sectionId: string): number {
  const idx = (FORTUNE_DISPLAY_ORDER as readonly string[]).indexOf(sectionId);
  return idx >= 0 ? idx + 1 : Number.parseInt(sectionId, 10) || 0;
}

function formatTopicReadable(topic: string): string {
  return topic.replace(/·/g, ' ').replace(/\s+/g, ' ').trim();
}

export function fortuneSectionTopicTitle(sectionId: string, parsedTitle?: string): string {
  const t = (parsedTitle ?? '').trim();
  const fromNumbered = t
    .replace(/^(?:섹션\s*)?\d+\s*[.·]\s*/, '')
    .replace(/^\d+\.\s*/, '')
    .trim();
  if (fromNumbered && fromNumbered !== t) return formatTopicReadable(fromNumbered);
  const full = fortuneSectionDisplayTitle(sectionId, parsedTitle);
  const topic = full.replace(/^심층·\[\d+\]\s*/, '').trim();
  return formatTopicReadable(topic || full);
}

/** 헤더: 3. 오행 균형 */
export function fortuneSectionNumberedLabel(sectionId: string, parsedTitle?: string): string {
  const n = fortuneSectionDisplayNumber(sectionId);
  const topic = fortuneSectionTopicTitle(sectionId, parsedTitle);
  return n > 0 ? `${n}. ${topic}` : topic;
}

/** 본문 첫 줄: [4] 3. 오행 균형 */
export function formatFortuneSectionHeader(sectionId: string, parsedTitle?: string): string {
  return `[${sectionId}] ${fortuneSectionNumberedLabel(sectionId, parsedTitle)}`;
}

export function fortuneSectionDisplayTitle(sectionId: string, parsedTitle?: string): string {
  const canonical = FORTUNE_SECTION_TITLES[sectionId as FortuneSectionId];
  if (canonical) return canonical;
  const t = (parsedTitle ?? '').trim();
  if (t.startsWith('심층·[')) return t;
  return t || `심층·[${sectionId}]`;
}

/** 조합 시 카드 kind 매핑 */
export const FORTUNE_SECTION_KINDS: Record<FortuneSectionId, string[]> = {
  '1': ['stem-day', 'stem-chen', 'deep-1'],
  '2': ['deep-2'],
  '4': ['deep-3'],
  '3': ['gyeok', 'deep-4'],
  '5': ['un-yongsin', 'un-gisin', 'un-huisin', 'deep-5'],
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
  '각 섹션 제목 형식: [본문id] 표시번호. 주제 (예: [1] 1. 인사 성향, [4] 3. 오행 균형, [9] 6. 대운 세운).',
  '표시번호는 읽는 순서 1~10, [본문id]는 위 순서의 번호를 그대로 유지하세요.',
  '1~10번 각 섹션: 쉬운 평어체(~해요)로, 일상 예시·비유를 넣어 **자세히**(섹션당 450자 이상, ◆마다 2문단 이상) 작성.',
].join('\n');
