/**
 * 젬마24 사주 지식 RAG — 정확히 일치하는 카드만 system 프롬프트에 주입
 *
 * 실시간: cards.json(confirmed) 우선 (mtime 캐시)
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

type PromptFacts = {
  stemKo: string | null;
  stemHanja: string | null;
  gyeokguk: string | null;
  yongsinElem: string | null;
  gisinElems: string[];
  branchRelations: Set<string>;
};

const STEM_KO = [
  '갑목', '을목', '병화', '정화', '무토', '기토', '경금', '신금', '임수', '계수',
] as const;

const STEM_HANJA = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;

const ELEM_CHARS = ['목', '화', '토', '금', '수'] as const;

const GYEOK_NAMES = [
  '건록격', '월겁격', '식신격', '상관격', '편재격', '정재격', '칠살격', '정관격',
  '편인격', '정인격',
] as const;

const BRANCH_REL = ['충', '합', '형', '파', '해', '삼합', '방합', '육합'] as const;

const MAX_STEM_CARDS = 1;
const MAX_GYEOK_CARDS = 1;
const MAX_BRANCH_CARDS = 1;
const MAX_ELEM_CARDS = 1;
const MAX_BODY_PER_CARD = 650;
const MAX_BLOCK_CHARS = 2400;

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

function loadFromFile(filePath: string, requireConfirmed: boolean): KnowledgePack | null {
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

function isTestCard(card: Gemma24SajuCard): boolean {
  const t = card.title.trim().toLowerCase();
  return t === 'test' || t.startsWith('test ');
}

function extractPromptFacts(query: string): PromptFacts {
  let stemHanja: string | null = null;
  let resolvedStemKo: string | null = null;

  const dayMatch = query.match(/일주:\s*([^\s/|]+)/);
  if (dayMatch) {
    const hanjaStem = dayMatch[1].charAt(0);
    if (hanjaStem) {
      stemHanja = hanjaStem;
      const idx = STEM_HANJA.indexOf(hanjaStem as (typeof STEM_HANJA)[number]);
      if (idx >= 0) resolvedStemKo = STEM_KO[idx];
    }
  }

  let gyeokguk: string | null = null;
  for (const name of GYEOK_NAMES) {
    if (query.includes(name)) {
      gyeokguk = name;
      break;
    }
  }

  let yongsinElem: string | null = null;
  const yongsinMatch = query.match(/용신\(用神\)\s*=\s*([^\n]+)/);
  if (yongsinMatch) {
    const line = yongsinMatch[1];
    yongsinElem = ELEM_CHARS.find((e) => line.includes(e)) ?? null;
  }

  const gisinElems: string[] = [];
  const gisinMatch = query.match(/기신\(忌神\)\s*=\s*([^\n]+)/);
  if (gisinMatch) {
    for (const e of ELEM_CHARS) {
      if (gisinMatch[1].includes(e)) gisinElems.push(e);
    }
  }

  const branchRelations = new Set<string>();
  const shinsalBlock = query.match(/신살[^]*?(?=대운:|━━━|▶|$)/);
  const relationHay = `${shinsalBlock?.[0] ?? ''}\n${query}`;
  for (const rel of BRANCH_REL) {
    if (rel === '합') {
      if (/육합|삼합|방합|반합/.test(relationHay)) branchRelations.add(rel);
    } else if (relationHay.includes(`${rel}(`) || relationHay.includes(`${rel}·`) || relationHay.includes(`${rel} `)) {
      branchRelations.add(rel);
    } else if (rel === '충' && /충|공충|자오충|묘유충|인신충/.test(relationHay)) {
      branchRelations.add(rel);
    } else if (rel === '형' && /형|삼형|자형/.test(relationHay)) {
      branchRelations.add(rel);
    } else if (rel === '파' && /파|파(破)/.test(relationHay)) {
      branchRelations.add(rel);
    } else if (rel === '해' && /해|해(害)/.test(relationHay)) {
      branchRelations.add(rel);
    }
  }

  return {
    stemKo: resolvedStemKo,
    stemHanja,
    gyeokguk,
    yongsinElem,
    gisinElems,
    branchRelations,
  };
}

function cardKind(card: Gemma24SajuCard): string {
  const t = card.title.trim();
  if (t.startsWith('변수·격 ')) return 'gyeok';
  if (t.startsWith('변수·지지관계 ')) return 'branch';
  if (t.includes('변수·운 용신')) return 'un-yongsin';
  if (t.includes('변수·운 기신')) return 'un-gisin';
  if (STEM_KO.some((s) => t.includes(s)) && t.includes('일주')) return 'stem-day';
  return 'other';
}

/** 프롬프트 확정 데이터와 정확히 맞는 카드만 true */
function isPreciseMatch(card: Gemma24SajuCard, facts: PromptFacts): boolean {
  if (isTestCard(card)) return false;

  const kind = cardKind(card);
  const title = card.title;
  const body = card.body;

  if (kind === 'stem-day') {
    if (!facts.stemKo) return false;
    return title.includes(facts.stemKo) && title.includes('일주');
  }

  if (kind === 'gyeok') {
    if (!facts.gyeokguk) return false;
    const cardGyeok = title.replace(/^변수·격\s*/, '').trim();
    return cardGyeok === facts.gyeokguk || cardGyeok.startsWith(facts.gyeokguk);
  }

  if (kind === 'branch') {
    const rel = title.replace(/^변수·지지관계\s*/, '').trim();
    return facts.branchRelations.has(rel);
  }

  if (kind === 'un-yongsin') {
    if (!facts.yongsinElem) return false;
    return body.includes(facts.yongsinElem) || body.includes(`(${facts.yongsinElem})`);
  }

  if (kind === 'un-gisin') {
    if (!facts.gisinElems.length) return false;
    return facts.gisinElems.some((e) => body.includes(e));
  }

  return false;
}

export function searchGemma24SajuKnowledge(query: string): Gemma24SajuCard[] {
  const pack = loadKnowledge();
  if (!pack?.cards.length) return [];

  const facts = extractPromptFacts(query);
  const precise = pack.cards.filter((c) => isPreciseMatch(c, facts));

  const stem = precise.filter((c) => cardKind(c) === 'stem-day').slice(0, MAX_STEM_CARDS);
  const gyeok = precise.filter((c) => cardKind(c) === 'gyeok').slice(0, MAX_GYEOK_CARDS);
  const branch = precise.filter((c) => cardKind(c) === 'branch').slice(0, MAX_BRANCH_CARDS);
  const elem = precise
    .filter((c) => cardKind(c) === 'un-yongsin' || cardKind(c) === 'un-gisin')
    .slice(0, MAX_ELEM_CARDS);

  return [...stem, ...gyeok, ...branch, ...elem];
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
    '【젬마24 참고 지식 — 확정 데이터와 일치하는 항목만】',
    '아래 카드는 이 사주의 일주·격국·관계·용신/기신과 정확히 맞는 자료입니다. 확정 데이터와 모순되면 확정 데이터를 따르세요.',
    '문장을 그대로 복사하지 말고 논리와 톤만 참고하세요.',
    '',
    ...sections,
  ].join('\n');
}

export function buildGemma24KnowledgeForSystem(query: string): string {
  if (!knowledgeEnabled()) return '';
  const cards = searchGemma24SajuKnowledge(query);
  return formatGemma24KnowledgeBlock(cards);
}
