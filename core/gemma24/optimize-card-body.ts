/**
 * 인증 카드 본문 → 화면용 풀이 (중복·면책·메타 제거, 변수 카드 구조 보존)
 */
import { isTodayFortuneDisplayCard } from '../daily-fortune/counsel-format';
import type { Gemma24SajuCard } from './saju-knowledge';
import { humanizeDeepSectionLabel, humanizeDeepSectionText } from './fortune-display-order';
import {
  isAuthoringMetaText,
  isBrokenPlaceholderText,
  isTruncatedFortuneLine,
  pruneFortuneSectionBody,
} from './fortune-text-quality';

const DEFAULT_CARD_MIN = 520;
const DEFAULT_CARD_MAX = 2400;
const DEFAULT_VARIABLE_MIN = 720;
const DEFAULT_VARIABLE_MAX = 3200;
const DEFAULT_SECTION_MIN = 1100;
const DEFAULT_SECTION_MAX = 5200;
const DEFAULT_MAX_PARAS = 4;
const DEFAULT_MAX_PARAS_CAP = 10;

function readLimit(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function cardCharBounds(isVariable: boolean): { min: number; max: number } {
  if (isVariable) {
    return {
      min: readLimit('GEMMA24_VARIABLE_CARD_CHARS_MIN', DEFAULT_VARIABLE_MIN),
      max: readLimit('GEMMA24_VARIABLE_CARD_CHARS_MAX', DEFAULT_VARIABLE_MAX),
    };
  }
  return {
    min: readLimit('GEMMA24_CARD_CHARS_MIN', DEFAULT_CARD_MIN),
    max: readLimit('GEMMA24_CARD_CHARS_MAX', DEFAULT_CARD_MAX),
  };
}

function sectionCharBounds(): { min: number; max: number } {
  return {
    min: readLimit('GEMMA24_SECTION_CHARS_MIN', DEFAULT_SECTION_MIN),
    max: readLimit('GEMMA24_SECTION_CHARS_MAX', DEFAULT_SECTION_MAX),
  };
}

/** 원본 본문 길이에 비례해 표시 상한을 올림 (짧은 카드는 기존 min 유지) */
function dynamicCharLimit(rawLen: number, min: number, max: number): number {
  if (rawLen <= min) return min;
  return Math.min(Math.max(rawLen, min), max);
}

function dynamicMaxParagraphs(rawLen: number): number {
  const base = readLimit('GEMMA24_CARD_PARAS_MIN', DEFAULT_MAX_PARAS);
  const cap = readLimit('GEMMA24_CARD_PARAS_MAX', DEFAULT_MAX_PARAS_CAP);
  const scaled = Math.ceil(rawLen / 380);
  return Math.min(cap, Math.max(base, scaled));
}

function dynamicSectionLimit(cards: Gemma24SajuCard[]): number {
  const { min, max } = sectionCharBounds();
  if (!cards.length) return min;
  let budget = 0;
  for (const card of cards) {
    const rawLen = (sanitizeCardBody(card.body) || card.body).length;
    const { min: cMin, max: cMax } = cardCharBounds(isVariableCard(card));
    budget += dynamicCharLimit(rawLen, cMin, cMax);
  }
  budget += Math.max(0, cards.length - 1) * 2;
  return dynamicCharLimit(budget, min, max);
}

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

function isVariableCard(card: Gemma24SajuCard): boolean {
  const t = card.title.trim();
  return t.startsWith('변수·') || t.startsWith('심층·[');
}

/** 카드 제목에서 화면용 짧은 소제목 */
export function shortCardSubtitle(title: string): string {
  let t = title
    .replace(/【[^】]+】/g, '')
    .replace(/^해석·\s*/, '')
    .replace(/^변수·격\s+/, '')
    .replace(/^변수·지지관계\s+/, '')
    .replace(/^변수·천간\s+/, '')
    .replace(/\s*[·•]\s*[^·•]+지식\s*카드.*$/i, '')
    .replace(/\s*지식\s*카드\s*$/i, '')
    .replace(/\s*[·•]\s*오행[\s\S]*$/i, '')
    .replace(/\s*샘플\s*$/i, '')
    .trim();
  if (t.length > 36) t = `${t.slice(0, 34)}…`;
  return t;
}

export function sanitizeCardBody(body: string): string {
  let t = humanizeDeepSectionText(body)
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
    .replace(/^◆\s*(?:테마\s*풀이|해석·)[^\n]*\n?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 변수·카드 【개요】【핵심】 블록 → ◆ 소제목 (내용 보존) */
function formatVariableCardBody(body: string): string {
  const cleaned = humanizeDeepSectionText(body)
    .replace(DISCLAIMER_RE, '')
    .replace(META_TAIL_RE, '')
    .replace(/「[^」]+」/g, '')
    .trim();

  const blocks: string[] = [];
  const re = /【([^】]+)】\s*([^【]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    const label = humanizeDeepSectionLabel(m[1].trim());
    let content = m[2].trim().replace(/\s+/g, ' ');
    if (!content || /^(PASS|FAIL|판정|검증)$/i.test(label)) continue;
    if (/^개요$/.test(label) && /변수는 사주 풀이에서/.test(content)) {
      const cap = Math.max(180, Math.min(480, Math.floor(cleaned.length * 0.35)));
      if (content.length > cap) content = `${content.slice(0, cap - 1)}…`;
    }
    blocks.push(`◆ ${label}\n${content}`);
  }

  if (blocks.length) return blocks.join('\n\n');
  return formatReadableBody(body);
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
    slice.lastIndexOf('\n\n'),
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
  if (isVariableCard(card) || isTodayFortuneDisplayCard(card)) return card.body;
  const summary = card.summary?.trim();
  const body = sanitizeCardBody(card.body);
  if (summary && summary.length >= 24 && summary.length <= 320 && body.length <= summary.length * 1.5) {
    const kw = extractKeywordLine(body);
    return kw ? `${summary}\n\n${kw}` : summary;
  }
  return body;
}

function isMetaOnlyParagraph(p: string): boolean {
  return /별도\s*(검토|확인)|판정\s*근거|위원회\s*검증|PASS|FAIL/.test(p)
    || isAuthoringMetaText(p)
    || isBrokenPlaceholderText(p);
}

function scoreParagraph(p: string): number {
  let s = 0;
  if (/키워드|핵심|특징|성향|격국|용신|기신|육합|충|합/.test(p)) s += 2;
  if (isMetaOnlyParagraph(p)) s -= 5;
  if (/참고용|위원회/.test(p)) s -= 3;
  if (p.length > 20 && p.length < 320) s += 1;
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
  if (paragraphs.length <= 1) {
    const only = paragraphs[0] ?? '';
    return only.length > 90 ? formatDenseProse(only) : (only ? `— ${only}` : '');
  }
  return paragraphs.map((p) => (p.length > 90 ? formatDenseProse(p) : `— ${p}`)).join('\n');
}

/** 긴 한 덩어리 본문 → 문장·이면-절 단위 불릿 */
function splitKoSentences(text: string): string[] {
  const t = normalizeParagraph(text);
  const parts = t
    .split(/(?<=[.!?。！？])\s+|(?<=[다요음니다]\.)(?=\s*[가-힣「])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 10);
  return parts.length ? parts : [t];
}

function splitClauseBullets(sentence: string): string[] {
  if (!/이면.+,.+이면/.test(sentence)) return [sentence];
  const clauses = sentence.split(
    /,\s*(?=(?:관성|식상|인성|편재|비겁|재성|용신|기신|역마|충|희신|월지|일간))/,
  );
  return clauses.length > 1 ? clauses.map((c) => c.trim()).filter(Boolean) : [sentence];
}

function formatDenseProse(paragraph: string): string {
  const lines: string[] = [];
  for (const sentence of splitKoSentences(paragraph)) {
    const clauses = splitClauseBullets(sentence);
    for (const c of clauses) {
      lines.push(`— ${c.replace(/^[,.]\s*/, '')}`);
    }
  }
  return lines.join('\n');
}

function formatReadableBody(body: string): string {
  const cleaned = sanitizeCardBody(body);
  if (!cleaned) return '';
  if (/^◆\s/m.test(cleaned)) return cleaned;

  const paras = splitParagraphs(cleaned);
  if (paras.length <= 1) {
    const single = paras[0] ?? cleaned;
    return single.length > 90 ? formatDenseProse(single) : `— ${single}`;
  }
  return paras
    .map((p) => (p.length > 90 ? formatDenseProse(p) : `— ${p}`))
    .join('\n');
}

/** 카드 1장 → 화면용 본문 */
export function optimizeCardBodyForDisplay(card: Gemma24SajuCard): string {
  const rawLen = (sanitizeCardBody(card.body) || card.body).length;
  const variable = isVariableCard(card) || isTodayFortuneDisplayCard(card);
  const { min, max } = cardCharBounds(variable);
  const charLimit = dynamicCharLimit(rawLen, min, max);
  const maxParas = dynamicMaxParagraphs(rawLen);

  if (variable) {
    const sub = shortCardSubtitle(card.title);
    const body = formatVariableCardBody(card.body);
    const text = body.startsWith('◆') ? body : `◆ ${sub}\n${body}`;
    return truncateAtSentence(text, charLimit);
  }

  const raw = preferSummaryOrBody(card);
  const kwLine = extractKeywordLine(raw);
  const core = stripKeywordBlock(raw);

  const titleNorm = normalizeParagraph(card.title.replace(/【[^】]+】/g, ''));
  const paras = splitParagraphs(core).filter(
    (p) => paragraphKey(p) !== paragraphKey(titleNorm),
  );

  const substantive = paras.filter((p) => !isMetaOnlyParagraph(p));
  const pool = (substantive.length ? substantive : paras).filter(
    (p) => !/별도\s*(검토|확인)|학파·환경/.test(p),
  );
  let text: string;
  if (charLimit >= 1200 && core.length >= 800) {
    text = formatReadableBody(core);
  } else {
    const picked = rawLen > 1200
      ? (pool.length ? pool : [core]).slice(0, maxParas)
      : pickTopParagraphs(pool.length ? pool : [core], maxParas);
    text = picked.length ? formatAsBullets(picked) : formatReadableBody(core);
  }
  if (kwLine) text = `${text}\n\n${kwLine}`;
  return truncateAtSentence(text, charLimit);
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
      if (isVariableCard(c) && body.startsWith('◆')) return body;
      const sub = shortCardSubtitle(c.title);
      return `◆ ${sub}\n${body}`;
    }),
  );
  const joined = parts.join('\n\n');
  const capped = truncateAtSentence(joined, dynamicSectionLimit(cards));
  const tailSafe = capped
    .split('\n')
    .filter((line) => !isTruncatedFortuneLine(line))
    .join('\n')
    .trim();
  return pruneFortuneSectionBody(tailSafe || capped, { skipIntroDedupe: true });
}
