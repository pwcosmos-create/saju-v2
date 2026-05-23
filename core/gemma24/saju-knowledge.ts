/**
 * 젬마24 사주 지식 RAG — Groq/Gemini system 프롬프트 주입 (로컬 JSON, API 비용 없음)
 *
 * 실시간: cards.json(confirmed) 우선 → export 없이 add 직후 반영 (mtime 캐시)
 * Oracle:
 *   GEMMA24_SAJU_CARDS_PATH=/home/ubuntu/coupax-homepage/board/data/saju_learning/cards.json
 *   GEMMA24_SAJU_KNOWLEDGE_PATH=.../saju_knowledge_pack.json (fallback)
 */
import fs from 'fs';
import path from 'path';

export type Gemma24SajuCard = {
  id: number;
  title: string;
  body: string;
  tags?: string[];
  summary?: string;
};

type RawCard = Gemma24SajuCard & { status?: string };

type KnowledgePack = {
  cards: Gemma24SajuCard[];
  source: string;
  updatedAt: string;
};

const STEM_KO = [
  '갑목', '을목', '병화', '정화', '무토', '기토', '경금', '신금', '임수', '계수',
] as const;

const STEM_HANJA = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;

const GENERIC_TAGS = new Set([
  '오행', '십신', '일주', '대운', '세운', '용신', '기신', '명리',
  '재성', '관성', '비겁', '식상', '인성', '월운', '천간지지',
]);

const MAX_STEM_CARDS = 2;
const MAX_TOPIC_CARDS = 2;
const MAX_BODY_PER_CARD = 650;
const MAX_BLOCK_CHARS = 2800;

let cache: { filePath: string; mtimeMs: number; pack: KnowledgePack } | null = null;

function knowledgeEnabled(): boolean {
  return process.env.GEMMA24_SAJU_KNOWLEDGE_ENABLED !== '0';
}

function liveCardsPaths(): string[] {
  const fromEnv = process.env.GEMMA24_SAJU_CARDS_PATH?.trim();
  return [
    fromEnv,
    '/home/ubuntu/coupax-homepage/board/data/saju_learning/cards.json',
  ].filter(Boolean) as string[];
}

function packPaths(): string[] {
  const fromEnv = process.env.GEMMA24_SAJU_KNOWLEDGE_PATH?.trim();
  return [
    fromEnv,
    '/home/ubuntu/coupax-homepage/board/data/saju_learning/saju_knowledge_pack.json',
    path.join(process.cwd(), 'core/data/gemma24-saju-knowledge-pack.sample.json'),
  ].filter(Boolean) as string[];
}

function normalizeCards(raw: RawCard[], requireConfirmed: boolean): Gemma24SajuCard[] {
  return raw
    .filter((c) => {
      if (typeof c.body !== 'string' || !c.body.trim()) return false;
      if (requireConfirmed && c.status && c.status !== 'confirmed') return false;
      return true;
    })
    .map((c) => ({
      id: c.id,
      title: c.title,
      body: c.body.trim(),
      tags: c.tags,
      summary: c.summary,
    }));
}

function loadFromFile(
  filePath: string,
  requireConfirmed: boolean,
): KnowledgePack | null {
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  if (cache && cache.filePath === filePath && cache.mtimeMs === stat.mtimeMs) {
    return cache.pack;
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
    cards?: RawCard[];
    updated_at?: string;
    exported_at?: string;
  };
  const cards = normalizeCards(raw.cards ?? [], requireConfirmed);
  if (!cards.length) return null;
  const pack: KnowledgePack = {
    cards,
    source: filePath,
    updatedAt: raw.updated_at ?? raw.exported_at ?? stat.mtime.toISOString(),
  };
  cache = { filePath, mtimeMs: stat.mtimeMs, pack };
  return pack;
}

/** cards.json(실시간) → pack.json(fallback) 순으로 로드 */
function loadKnowledge(): KnowledgePack | null {
  for (const filePath of liveCardsPaths()) {
    try {
      const pack = loadFromFile(filePath, true);
      if (pack) return pack;
    } catch (e) {
      console.warn('Gemma24 live cards load failed:', filePath, e);
      cache = null;
    }
  }
  for (const filePath of packPaths()) {
    try {
      const pack = loadFromFile(filePath, false);
      if (pack) return pack;
    } catch (e) {
      console.warn('Gemma24 knowledge pack load failed:', filePath, e);
      cache = null;
    }
  }
  return null;
}

export function getGemma24KnowledgeMeta(): { count: number; source: string; updatedAt: string } | null {
  const pack = loadKnowledge();
  if (!pack) return null;
  return { count: pack.cards.length, source: pack.source, updatedAt: pack.updatedAt };
}

function extractDayStemHints(query: string): string[] {
  const hints = new Set<string>();
  const dayMatch = query.match(/일주:\s*([^\s/|]+)/);
  if (dayMatch) {
    const pillar = dayMatch[1];
    hints.add(pillar);
    const hanjaStem = pillar.charAt(0);
    if (hanjaStem) {
      hints.add(hanjaStem);
      const idx = STEM_HANJA.indexOf(hanjaStem as (typeof STEM_HANJA)[number]);
      if (idx >= 0) hints.add(STEM_KO[idx]);
    }
  }
  return [...hints];
}

function cardMatchesStem(card: Gemma24SajuCard, stemHints: string[]): boolean {
  if (!stemHints.length) return false;
  const blob = `${card.title}\n${card.body}`;
  return stemHints.some((h) => h.length >= 1 && blob.includes(h));
}

function isTestCard(card: Gemma24SajuCard): boolean {
  const t = card.title.trim().toLowerCase();
  return t === 'test' || t.startsWith('test ');
}

function scoreCard(card: Gemma24SajuCard, query: string, stemHints: string[]): number {
  if (isTestCard(card)) return 0;

  let score = 0;
  const blob = `${card.title}\n${card.body}\n${(card.tags ?? []).join(' ')}`;

  if (cardMatchesStem(card, stemHints)) score += 25;

  for (const tag of card.tags ?? []) {
    if (!query.includes(tag)) continue;
    score += GENERIC_TAGS.has(tag) ? 1 : 4;
  }

  for (let i = 0; i < STEM_KO.length; i += 1) {
    const ko = STEM_KO[i];
    const hj = STEM_HANJA[i];
    if ((query.includes(ko) || query.includes(hj)) && blob.includes(ko)) {
      score += 8;
    }
  }

  const titleParts = card.title.split(/[\s·]+/).filter((w) => w.length >= 2);
  for (const part of titleParts) {
    if (query.includes(part)) score += 2;
  }

  return score;
}

export function searchGemma24SajuKnowledge(query: string): Gemma24SajuCard[] {
  const pack = loadKnowledge();
  if (!pack?.cards.length) return [];

  const stemHints = extractDayStemHints(query);
  const ranked = pack.cards
    .map((c) => ({ c, score: scoreCard(c, query, stemHints) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.id - b.c.id);

  const stemPool = (stemHints.length
    ? ranked.filter((x) => cardMatchesStem(x.c, stemHints))
    : ranked
  ).slice(0, MAX_STEM_CARDS);

  const stemIds = new Set(stemPool.map((x) => x.c.id));
  const topicPool = ranked
    .filter((x) => !stemIds.has(x.c.id) && !cardMatchesStem(x.c, stemHints))
    .slice(0, MAX_TOPIC_CARDS);

  const merged = [...stemPool, ...topicPool];
  if (merged.length) return merged.map((x) => x.c);

  return ranked.slice(0, MAX_STEM_CARDS).map((x) => x.c);
}

export function formatGemma24KnowledgeBlock(cards: Gemma24SajuCard[]): string {
  if (!cards.length) return '';

  const sections: string[] = [];
  let total = 0;

  for (let i = 0; i < cards.length; i += 1) {
    const c = cards[i];
    const body = c.body.trim().slice(0, MAX_BODY_PER_CARD);
    const section = `(${i + 1}) ${c.title}\n${body}`;
    if (total + section.length > MAX_BLOCK_CHARS) break;
    sections.push(section);
    total += section.length;
  }

  if (!sections.length) return '';

  return [
    '【젬마24 참고 지식 — 해석 스타일·명리 원칙 참고용】',
    '아래는 축적된 명리 해석 사례입니다. 사용자 프롬프트의 확정 데이터(용신·신강·격국 등)와 모순되면 확정 데이터를 따르세요.',
    '참고 지식의 문장을 그대로 복사하지 말고, 톤과 논리 구조만 참고하세요.',
    '',
    ...sections,
  ].join('\n');
}

/** fortune-stream system 프롬프트에 붙일 참고 지식 */
export function buildGemma24KnowledgeForSystem(query: string): string {
  if (!knowledgeEnabled()) return '';
  const cards = searchGemma24SajuKnowledge(query);
  return formatGemma24KnowledgeBlock(cards);
}
