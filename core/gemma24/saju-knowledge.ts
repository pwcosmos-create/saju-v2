/**
 * 젬마24 사주 지식팩 RAG — Groq/Gemini 프롬프트 주입용 (로컬 JSON, API 비용 없음)
 *
 * Oracle: GEMMA24_SAJU_KNOWLEDGE_PATH=/home/ubuntu/coupax-homepage/board/data/saju_learning/saju_knowledge_pack.json
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

type KnowledgePack = {
  cards: Gemma24SajuCard[];
};

const STEM_KO = [
  '갑목', '을목', '병화', '정화', '무토', '기토', '경금', '신금', '임수', '계수',
] as const;

const STEM_HANJA = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;

const MAX_CARDS = 3;
const MAX_BODY_PER_CARD = 650;
const MAX_BLOCK_CHARS = 2000;

let cache: { filePath: string; mtimeMs: number; pack: KnowledgePack } | null = null;

function knowledgeEnabled(): boolean {
  return process.env.GEMMA24_SAJU_KNOWLEDGE_ENABLED !== '0';
}

function candidatePaths(): string[] {
  const fromEnv = process.env.GEMMA24_SAJU_KNOWLEDGE_PATH?.trim();
  return [
    fromEnv,
    '/home/ubuntu/coupax-homepage/board/data/saju_learning/saju_knowledge_pack.json',
    path.join(process.cwd(), 'core/data/gemma24-saju-knowledge-pack.sample.json'),
  ].filter(Boolean) as string[];
}

function loadPack(): KnowledgePack | null {
  for (const filePath of candidatePaths()) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const stat = fs.statSync(filePath);
      if (cache && cache.filePath === filePath && cache.mtimeMs === stat.mtimeMs) {
        return cache.pack;
      }
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { cards?: Gemma24SajuCard[] };
      const cards = (raw.cards ?? []).filter((c) => typeof c.body === 'string' && c.body.trim());
      cache = { filePath, mtimeMs: stat.mtimeMs, pack: { cards } };
      return cache.pack;
    } catch (e) {
      console.warn('Gemma24 saju knowledge load failed:', filePath, e);
    }
  }
  return null;
}

function scoreCard(card: Gemma24SajuCard, query: string): number {
  let score = 0;
  const blob = `${card.title}\n${card.body}\n${(card.tags ?? []).join(' ')}`;

  for (const tag of card.tags ?? []) {
    if (query.includes(tag)) score += 3;
  }

  for (let i = 0; i < STEM_KO.length; i += 1) {
    const ko = STEM_KO[i];
    const hj = STEM_HANJA[i];
    if ((query.includes(ko) || query.includes(hj)) && blob.includes(ko)) {
      score += 10;
    }
  }

  const titleParts = card.title.split(/[\s·]+/).filter((w) => w.length >= 2);
  for (const part of titleParts) {
    if (query.includes(part)) score += 2;
  }

  if (card.title.toLowerCase().includes('test') && score < 2) {
    score = 0;
  }

  return score;
}

export function searchGemma24SajuKnowledge(query: string, topK = MAX_CARDS): Gemma24SajuCard[] {
  const pack = loadPack();
  if (!pack?.cards.length) return [];

  return pack.cards
    .map((c) => ({ c, score: scoreCard(c, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.id - b.c.id)
    .slice(0, topK)
    .map((x) => x.c);
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

/** fortune-stream system 프롬프트에 붙일 참고 지식 (병렬 섹션마다 중복되지 않음) */
export function buildGemma24KnowledgeForSystem(query: string): string {
  if (!knowledgeEnabled()) return '';
  const cards = searchGemma24SajuKnowledge(query);
  return formatGemma24KnowledgeBlock(cards);
}
