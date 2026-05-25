/**
 * 음성 상담 TTS용 — 질문에 대한 답 본문만 추출 (인트로·면책·푸터 제외)
 */

function isIntroBlock(block: string): boolean {
  const t = block.replace(/\*\*/g, '').trim();
  if (t.startsWith('◆')) return false;
  return (/질문하신\s*「[^」]+」/.test(t) || /『[^』]+』\s*기준으로/.test(t))
    && (/풀어\s*보았|비교해\s*보았/.test(t));
}

function isFooterBlock(block: string): boolean {
  const first = block.split('\n')[0]?.trim() ?? '';
  return FOOTER_LINE_RE.test(first) || FOOTER_LINE_RE.test(block.trim());
}

const FOOTER_LINE_RE =
  /^(위 내용은(?: 입력하신 사주| 오늘 일진)|더 궁금한 점이 있으면|참고용 풀이|본 내용은 명리|운영 후원|💛|saju\.coupax)/i;

const SECTION_HEADER_RE = /^\*\*(강점|주의점|실천 팁)\*\*\s*$/;

const CAUTION_BLOCK_RE = /◆\s*주의[\s\S]*?(?=(\n\s*\n)|$)/g;

const SKIP_LINE_RE =
  /^(키워드\s*[:：]|PASS\s*[:：]|FAIL\s*[:：]|—\s*saju\.)/i;

function flattenBullets(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^—\s*/, '').trim())
    .filter((line) => line && !SKIP_LINE_RE.test(line))
    .join('\n');
}

/** ◆ 소제목 + 본문 → "소제목. 본문" (음성용) */
function bodyFromCardBlock(block: string): string {
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return '';

  const head = lines[0] ?? '';
  const m = head.match(/^◆\s*(.+)$/);
  const label = m?.[1]?.trim() ?? '';
  const rest = flattenBullets(lines.slice(1).join('\n'));

  if (label && rest) return `${label}. ${rest}`;
  if (label) return label;
  if (rest) return rest;
  return flattenBullets(block.replace(/^◆\s*[^\n]+\n?/, ''));
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

    if (isIntroBlock(block) || isIntroBlock(firstLine)) continue;
    if (isFooterBlock(block)) continue;
    if (SECTION_HEADER_RE.test(block.trim())) continue;
    if (/^◆\s*주의/.test(block)) continue;

    if (block.startsWith('◆')) {
      const body = bodyFromCardBlock(block);
      if (body && !FOOTER_LINE_RE.test(body.split('\n')[0] ?? '')) kept.push(body);
      continue;
    }

    const plain = flattenBullets(block.replace(/\*\*(.+?)\*\*/g, '$1'));
    if (plain && !FOOTER_LINE_RE.test(plain.split('\n')[0] ?? '')) kept.push(plain);
  }

  const answer = kept.join('\n\n').trim();
  return answer || flattenBullets(trimmed.replace(CAUTION_BLOCK_RE, ''));
}
