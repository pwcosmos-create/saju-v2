/**
 * TTS 끊어 읽기 — 문장·단락 단위 + ◆ 주의 면책 구간
 */
export type PausedReadUnit = { text: string; pauseAfterMs: number };

/** 문장 사이 쉼 (ms) */
export const PAUSE_BETWEEN_SENTENCES_MS = 650;
/** 단락 사이 쉼 (ms) */
export const PAUSE_BETWEEN_PARAGRAPHS_MS = 1100;
/** 「주의」 제목만 읽은 뒤 본문 전 쉼 (ms) */
export const PAUSE_AFTER_CAUTION_HEADING_MS = 1500;
/** 한 utterance 상한 */
export const SENTENCE_HARD_MAX = 200;

const CAUTION_HEADING_SPLIT_RE = /◆\s*주의(?:\s*\n+|\s+)/;

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

/** ◆ 주의 … 면책 본문을 일반 본문과 분리 */
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
    .split(/(?<=[.!?。！？…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const sentences = (rawSentences.length ? rawSentences : [para]).flatMap(splitLongClause);

  return sentences.map((text, si) => ({
    text,
    pauseAfterMs: si === sentences.length - 1 ? PAUSE_BETWEEN_PARAGRAPHS_MS : PAUSE_BETWEEN_SENTENCES_MS,
  }));
}

function textToUnits(text: string): PausedReadUnit[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const units: PausedReadUnit[] = [];
  for (const para of paragraphs) {
    units.push(...paragraphToUnits(para));
  }
  return units;
}

/** 마크다운 제거 후 문장·단락·주의 면책 단위로 분할 */
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
