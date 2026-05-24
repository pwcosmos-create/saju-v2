/**
 * 음성 상담 TTS용 — 질문에 대한 답 본문만 추출 (인트로·면책·◆ 제목·푸터 제외)
 */

const INTRO_LINE_RE =
  /^(『[^』]+』입니다\.?\s*)?(질문하신\s*「[^」]+」에 대해 풀어 보았습니다\.?|『[^』]+』\s*기준으로\s*)?두 분 사주를 비교해 보았습니다\.?$/;

const FOOTER_LINE_RE =
  /^(위 내용은 입력하신 사주|더 궁금한 점이 있으면|참고용 풀이|본 내용은 명리|운영 후원|💛)/;

const SECTION_HEADER_RE = /^\*\*(강점|주의점|실천 팁)\*\*\s*$/;

const CAUTION_BLOCK_RE = /◆\s*주의[\s\S]*?(?=(\n\s*\n)|$)/g;

function bodyFromCardBlock(block: string): string {
  const lines = block.split('\n');
  if (!lines[0]?.trim().startsWith('◆')) return block;
  const body = lines.slice(1).join('\n').trim();
  return body || block.replace(/^◆\s*[^\n]+\n?/, '').trim();
}

/** 화면용 상담 답변 → 음성으로 읽을 본문만 */
export function extractCounselVoiceAnswer(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return '';

  let text = trimmed.replace(CAUTION_BLOCK_RE, '').trim();
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const kept: string[] = [];

  for (const block of blocks) {
    const flat = block.replace(/\*\*/g, '').trim();
    const firstLine = block.split('\n')[0]?.replace(/\*\*/g, '').trim() ?? '';

    if (INTRO_LINE_RE.test(flat) || INTRO_LINE_RE.test(firstLine)) continue;
    if (FOOTER_LINE_RE.test(flat) || FOOTER_LINE_RE.test(firstLine)) continue;
    if (SECTION_HEADER_RE.test(block.trim())) continue;
    if (/^◆\s*주의/.test(block)) continue;

    if (block.startsWith('◆')) {
      const body = bodyFromCardBlock(block);
      if (body && !FOOTER_LINE_RE.test(body.split('\n')[0] ?? '')) kept.push(body);
      continue;
    }

    kept.push(block.replace(/\*\*(.+?)\*\*/g, '$1'));
  }

  const answer = kept.join('\n\n').trim();
  return answer || trimmed;
}
