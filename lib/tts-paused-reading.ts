/**
 * TTS 끊어 읽기 — 문장·단락 단위 + ◆ 주의 면책 구간
 */
export type PausedReadUnit = { text: string; pauseAfterMs: number };

export const PAUSE_BETWEEN_SENTENCES_MS = 580;
export const PAUSE_BETWEEN_PARAGRAPHS_MS = 950;
export const PAUSE_AFTER_SECTION_HEADING_MS = 880;
export const PAUSE_AFTER_CAUTION_HEADING_MS = 1400;
export const SENTENCE_HARD_MAX = 200;

const CAUTION_HEADING_SPLIT_RE = /◆\s*주의(?:\s*\n+|\s+)/;
const SECTION_HEADING_LINE_RE = /^◆\s*(.+)$/;

const KO_SENTENCE_SPLIT_RE =
  /(?<=[.!?。！？…]|다\.|요\.|습니다\.|니다\.|해요\.|네요\.|거예요\.)\s+/;

type TextSegment =
  | { kind: 'normal'; text: string }
  | { kind: 'caution'; body: string };

function cleanForTts(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .trim();
}

function splitLongClause(sentence: string): string[] {
  if (sentence.length <= SENTENCE_HARD_MAX) return [sentence];
  const clauses = sentence.split(/(?<=[,，、])\s*/).map((c) => c.trim()).filter(Boolean);
  if (clauses.length <= 1) return [sentence];
  const out: string[] = [];
  let cur = '';
  for (const c of clauses) {
    if ((cur ? `${cur} ${c}` : c).length > SENTENCE_HARD_MAX && cur) {
      out.push(cur.trim());
      cur = c;
    } else {
      cur = cur ? `${cur} ${c}` : c;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out.length ? out : [sentence];
}

function splitByCautionBlocks(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let rest = text;

  while (rest.length > 0) {
    const m = rest.match(CAUTION_HEADING_SPLIT_RE);
    if (!m || m.index === undefined) {
      if (rest.trim()) segments.push({ kind: 'normal', text: rest });
      break;
    }

    const before = rest.slice(0, m.index);
    if (before.trim()) segments.push({ kind: 'normal', text: before });

    rest = rest.slice(m.index + m[0].length);
    const nextBreak = rest.search(/\n\s*\n|(?=\n◆)/);
    let body: string;
    if (nextBreak >= 0) {
      body = rest.slice(0, nextBreak).trim();
      rest = rest.slice(nextBreak).replace(/^\s*\n+/, '');
    } else {
      body = rest.trim();
      rest = '';
    }
    if (body) segments.push({ kind: 'caution', body });
  }

  return segments;
}

function paragraphToUnits(paragraph: string): PausedReadUnit[] {
  const para = paragraph.replace(/\n+/g, ' ').trim();
  if (!para) return [];

  const rawSentences = para
    .split(KO_SENTENCE_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean);
  const sentences = (rawSentences.length ? rawSentences : [para]).flatMap(splitLongClause);

  return sentences.map((text, si) => ({
    text,
    pauseAfterMs: si === sentences.length - 1 ? PAUSE_BETWEEN_PARAGRAPHS_MS : PAUSE_BETWEEN_SENTENCES_MS,
  }));
}

function sectionBlockToUnits(block: string): PausedReadUnit[] {
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const head = lines[0] ?? '';
  const m = head.match(SECTION_HEADING_LINE_RE);
  if (!m) return paragraphToUnits(block);

  const heading = m[1]!.trim();
  const body = lines.slice(1).join('\n').trim();
  const units: PausedReadUnit[] = [{ text: heading, pauseAfterMs: PAUSE_AFTER_SECTION_HEADING_MS }];
  if (body) units.push(...textToUnits(body));
  return units;
}

function textToUnits(text: string): PausedReadUnit[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const units: PausedReadUnit[] = [];
  for (const para of paragraphs) {
    if (SECTION_HEADING_LINE_RE.test(para.split('\n')[0]?.trim() ?? '')) {
      units.push(...sectionBlockToUnits(para));
    } else {
      units.push(...paragraphToUnits(para));
    }
  }
  return units;
}

export function splitForPausedReading(text: string): PausedReadUnit[] {
  const cleaned = cleanForTts(text);
  if (!cleaned) return [];

  const segments = splitByCautionBlocks(cleaned);
  const units: PausedReadUnit[] = [];

  for (const seg of segments) {
    if (seg.kind === 'caution') {
      units.push({ text: '주의', pauseAfterMs: PAUSE_AFTER_CAUTION_HEADING_MS });
      units.push(...textToUnits(seg.body));
      continue;
    }
    units.push(...textToUnits(seg.text));
  }

  if (units.length > 0) units[units.length - 1].pauseAfterMs = 0;
  return units;
}
