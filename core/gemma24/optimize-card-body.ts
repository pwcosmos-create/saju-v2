/**
 * 인증 카드 본문 → 화면용 짧은 풀이 (중복·면책·메타 제거)
 */
import type { Gemma24SajuCard } from './saju-knowledge';

const MAX_CARD_CHARS = 420;
const MAX_SECTION_CHARS = 900;
const MAX_PARAS = 3;

const DISCLAIMER_RE =
  /본 내용은 명리 참고용이며[\s\S]*?달라질 수 있습니다\.?/g;

const STRIP_LINE_PATTERNS: RegExp[] = [
  /^본 내용은/,
  /^본 카드는/,
  /^※\s/,
  /^참고\s*[:：]/,
  /^출처\s*[:：]/,
  /^\(출처/,
  /^PASS\s*[:：]/i,
  /^FAIL\s*[:：]/i,
  /^판정\s*[:：]/,
  /^검증\s*[:：]/,
  /^#+\s/,
  /^>\s/,
  /^\[\d+\]\s*$/,
  /^---+$/,
];

const META_TAIL_RE =
  /(?:학파|환경|해석)에 따라[\s\S]*?달라질 수 있습니다\.?/g;

/** 카드 제목에서 화면용 짧은 소제목 */
export function shortCardSubtitle(title: string): string {
  let t = title
    .replace(/【[^】]+】/g, '')
    .replace(/\s*[·•]\s*[^·•]+지식\s*카드.*$/i, '')
    .replace(/\s*지식\s*카드\s*$/i, '')
    .replace(/\s*[·•]\s*오행[\s\S]*$/i, '')
    .replace(/\s*샘플\s*$/i, '')
    .trim();
  if (t.length > 36) t = `${t.slice(0, 34)}…`;
  return t;
}

export function sanitizeCardBody(body: string): string {
  let t = body
    .replace(DISCLAIMER_RE, '')
    .replace(META_TAIL_RE, '')
    .replace(/【[^】]+】/g, '')
    .replace(/\(출처[^)]*\)/g, '')
    .replace(/\r\n/g, '\n');

  const lines = t.split('\n').filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    return !STRIP_LINE_PATTERNS.some((re) => re.test(trimmed));
  });

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function truncateAtSentence(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const cut = Math.max(
    slice.lastIndexOf('.'),
    slice.lastIndexOf('!'),
    slice.lastIndexOf('?'),
    slice.lastIndexOf('요 '),
    slice.lastIndexOf('다 '),
  );
  if (cut > max * 0.45) return `${slice.slice(0, cut + 1).trim()}…`;
  return `${slice.trim()}…`;
}

function normalizeParagraph(p: string): string {
  return p.replace(/\s+/g, ' ').trim();
}

function paragraphKey(p: string): string {
  return normalizeParagraph(p).replace(/[^\p{L}\p{N}]/gu, '').slice(0, 40);
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map(normalizeParagraph)
    .filter((p) => p.length >= 12);
}

function extractKeywordLine(text: string): string | null {
  const m = text.match(/(?:^|\n)\s*키워드\s*[:：]\s*([^\n]+)/i);
  if (!m) return null;
  const kw = m[1].trim().replace(/[.。]+$/, '');
  return kw ? `키워드 — ${kw}` : null;
}

function stripKeywordBlock(text: string): string {
  return text.replace(/(?:^|\n)\s*키워드\s*[:：][^\n]+/gi, '').trim();
}

function preferSummaryOrBody(card: Gemma24SajuCard): string {
  const summary = card.summary?.trim();
  const body = sanitizeCardBody(card.body);
  if (summary && summary.length >= 24 && summary.length <= 320) {
    const kw = extractKeywordLine(body);
    return kw ? `${summary}\n\n${kw}` : summary;
  }
  return body;
}

function isMetaOnlyParagraph(p: string): boolean {
  return /별도\s*(검토|확인)|판정\s*근거|위원회\s*검증|PASS|FAIL/.test(p)
    || (/월지\s*본기|본기로\s*격/.test(p) && p.length < 80);
}

function scoreParagraph(p: string): number {
  let s = 0;
  if (/키워드|핵심|특징|성향|격국|용신|기신|육합|충|합/.test(p)) s += 2;
  if (isMetaOnlyParagraph(p)) s -= 5;
  if (/참고용|위원회/.test(p)) s -= 3;
  if (p.length > 20 && p.length < 220) s += 1;
  if (p.length > 280) s -= 1;
  return s;
}

function pickTopParagraphs(paragraphs: string[], max: number): string[] {
  const ranked = [...paragraphs].sort((a, b) => scoreParagraph(b) - scoreParagraph(a));
  const out: string[] = [];
  const seen = new Set<string>();

  for (const p of ranked) {
    const key = paragraphKey(p);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length >= max) break;
  }
  return out.sort((a, b) => paragraphs.indexOf(a) - paragraphs.indexOf(b));
}

function formatAsBullets(paragraphs: string[]): string {
  if (paragraphs.length <= 1) return paragraphs[0] ?? '';
  return paragraphs.map((p) => `— ${p}`).join('\n');
}

/** 카드 1장 → 화면용 본문 (길이·중복 제한) */
export function optimizeCardBodyForDisplay(card: Gemma24SajuCard): string {
  const raw = preferSummaryOrBody(card);
  const kwLine = extractKeywordLine(raw);
  let core = stripKeywordBlock(raw);

  const titleNorm = normalizeParagraph(card.title.replace(/【[^】]+】/g, ''));
  const paras = splitParagraphs(core).filter(
    (p) => paragraphKey(p) !== paragraphKey(titleNorm),
  );

  const substantive = paras.filter((p) => !isMetaOnlyParagraph(p));
  const pool = (substantive.length ? substantive : paras).filter(
    (p) => !/별도\s*(검토|확인)|학파·환경/.test(p),
  );
  const picked = pickTopParagraphs(pool.length ? pool : [core], MAX_PARAS);
  let text = picked.length ? formatAsBullets(picked) : core;
  if (kwLine) text = `${text}\n\n${kwLine}`;
  text = truncateAtSentence(text, MAX_CARD_CHARS);
  return text.trim();
}

function dedupeAcrossCards(blocks: string[]): string[] {
  const seen = new Set<string>();
  return blocks.map((block) => {
    const lines = block.split('\n');
    const kept: string[] = [];
    for (const line of lines) {
      const plain = line.replace(/^—\s*/, '').trim();
      if (!plain) {
        kept.push(line);
        continue;
      }
      const key = paragraphKey(plain);
      if (key.length >= 12 && seen.has(key)) continue;
      if (key.length >= 12) seen.add(key);
      kept.push(line);
    }
    return kept.join('\n').trim();
  }).filter(Boolean);
}

/** 섹션 내 여러 카드 본문 합치기 */
export function mergeOptimizedCardBodies(cards: Gemma24SajuCard[]): string {
  const parts = dedupeAcrossCards(
    cards.map((c) => {
      const body = optimizeCardBodyForDisplay(c);
      if (!body) return '';
      const sub = shortCardSubtitle(c.title);
      return `◆ ${sub}\n${body}`;
    }),
  );
  const joined = parts.join('\n\n');
  return truncateAtSentence(joined, MAX_SECTION_CHARS);
}
