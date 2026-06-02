/**
 * AI 심층 풀이 프롬프트 → 4구간 분할 (Groq 키별 병렬 생성용)
 */
const SECTION_GROUPS = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8],
  [9, 10],
] as const;

function extractNumberedBlock(fullPrompt: string, n: number): string {
  const start = fullPrompt.indexOf(`[${n}]`);
  if (start < 0) return '';
  const nextMarker = fullPrompt.indexOf(`[${n + 1}]`, start + 3);
  const end = nextMarker > start ? nextMarker : fullPrompt.length;
  return fullPrompt.slice(start, end).trim();
}

/** buildPrompt() 결과를 4개 user 프롬프트로 분할. 실패 시 null */
export function splitFortunePromptIntoSections(fullPrompt: string): string[] | null {
  const firstSection = fullPrompt.indexOf('[1]');
  if (firstSection < 0) return null;

  const preamble = fullPrompt.slice(0, firstSection).trimEnd();
  const sections: string[] = [];

  for (const nums of SECTION_GROUPS) {
    const blocks = nums.map((n) => extractNumberedBlock(fullPrompt, n)).filter(Boolean);
    if (blocks.length === 0) return null;

    const rangeLabel = `[${nums[0]}]~[${nums[nums.length - 1]}]`;
    sections.push(
      `${preamble}\n\n`
      + `━━━ 작성 범위 (이번 요청) ━━━\n`
      + `${rangeLabel} 번 주제만 작성하세요. 다른 번호([1]~[10])는 절대 쓰지 마세요.\n`
      + `섹션 제목([${nums[0]}] 등)은 그대로 포함하고, ◆ 소제목 규칙을 지키세요.\n`
      + `분량은 해당 구간에 맞게 쉽고 자세히(약 ${blocks.length * 500}~${blocks.length * 800}자) 작성하세요. 전문 용어는 쉬운 말 먼저, ◆마다 2문단 이상.\n\n`
      + blocks.join('\n\n'),
    );
  }

  return sections.length === SECTION_GROUPS.length ? sections : null;
}
