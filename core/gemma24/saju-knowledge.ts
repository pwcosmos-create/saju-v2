/**
 * 젬마24 사주 지식 RAG — 정확히 일치하는 카드만 system 프롬프트에 주입
 *
 * 실시간: cards.json(confirmed) 우선 (mtime 캐시)
 */
import fs from 'fs';
import path from 'path';
import { liveCardsPaths } from './cards-path';
import { isTodayFortuneQuestion } from './is-today-fortune-question';

export type Gemma24SajuCard = {
  id: number;
  title: string;
  body: string;
  tags?: string[];
  summary?: string;
  councilCertified?: boolean;
};

type RawCard = Gemma24SajuCard & {
  status?: string;
  council_pass?: boolean;
  council_status?: string;
};

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
  huisinElem: string | null;
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
const MAX_STEM_CHEN_CARDS = 1;
const MAX_GYEOK_CARDS = 1;
const MAX_BRANCH_CARDS = 1;
const MAX_ELEM_CARDS = 1;
const MAX_FOUNDATION_CARDS = 2;

/** 인증 조합 풀이용 공통 프레임 카드 (제목 정확 일치) */
const COMPOSE_FOUNDATION_TITLES = [
  '무료 사주 풀이 글 구조',
  '오행 상생·상극·균형',
  '격국·십신 핵심 프레임',
  '용신·기신 선정 원칙',
  '대운·세운·월운 읽는 순서',
] as const;
const MAX_BODY_PER_CARD = 650;
const MAX_BLOCK_CHARS = 2400;

let cache: { filePath: string; mtimeMs: number; pack: KnowledgePack } | null = null;

function knowledgeEnabled(): boolean {
  return process.env.GEMMA24_SAJU_KNOWLEDGE_ENABLED !== '0';
}

function isCouncilApproved(raw: RawCard): boolean {
  if (raw.council_pass === false) return false;
  if (raw.council_status === 'fail') return false;
  return true;
}

function isCouncilCertified(raw: RawCard): boolean {
  return raw.council_pass === true || raw.council_status === 'pass';
}

function normalizeCards(raw: RawCard[], requireConfirmed: boolean): Gemma24SajuCard[] {
  return raw
    .filter((c) => {
      if (typeof c.body !== 'string' || !c.body.trim()) return false;
      if (requireConfirmed && c.status && c.status !== 'confirmed') return false;
      if (!isCouncilApproved(c)) return false;
      return true;
    })
    .map((c) => ({
      id: c.id,
      title: c.title,
      body: c.body.trim(),
      tags: c.tags,
      summary: c.summary,
      councilCertified: isCouncilCertified(c),
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
  if (process.env.NODE_ENV !== 'production') {
    const pass = pack.cards.filter((c) => c.councilCertified).length;
    console.info(`[gemma24] cards loaded: ${pack.cards.length} (${pass} PASS) ← ${filePath}`);
  }
  return pack;
}

/** 현재 로드된 cards.json 경로 (없으면 null) */
export function getLoadedLiveCardsSource(): string | null {
  return cache?.filePath ?? null;
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
  console.warn(
    '[gemma24] Server cards.json not found. Set GEMMA24_SAJU_CARDS_PATH to Oracle live path.',
  );
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

export function extractPromptFacts(query: string): PromptFacts {
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

  if (!resolvedStemKo) {
    const chatDay = query.match(/일주\s+(\S)/);
    if (chatDay) {
      const ch = chatDay[1];
      const idx = STEM_KO.findIndex((s) => s.startsWith(ch));
      if (idx >= 0) {
        resolvedStemKo = STEM_KO[idx];
        stemHanja = STEM_HANJA[idx];
      }
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
  if (!yongsinElem) {
    const chatYong = query.match(/용신\(用神\):\s*(\S+)/);
    if (chatYong) {
      yongsinElem = ELEM_CHARS.find((e) => chatYong[1].includes(e)) ?? null;
    }
  }

  const gisinElems: string[] = [];
  const gisinMatch = query.match(/기신\(忌神\)\s*=\s*([^\n]+)/);
  if (gisinMatch) {
    for (const e of ELEM_CHARS) {
      if (gisinMatch[1].includes(e)) gisinElems.push(e);
    }
  }
  if (!gisinElems.length) {
    const chatGisin = query.match(/기신\(忌神\):\s*([^\n]+)/);
    if (chatGisin) {
      for (const e of ELEM_CHARS) {
        if (chatGisin[1].includes(e)) gisinElems.push(e);
      }
    }
  }

  let huisinElem: string | null = null;
  const huisinMatch = query.match(/희신\(喜神\)\s*=\s*([^\n]+)/);
  if (huisinMatch) {
    huisinElem = ELEM_CHARS.find((e) => huisinMatch[1].includes(e)) ?? null;
  }
  if (!huisinElem) {
    const chatHui = query.match(/희신\(喜神\):\s*(\S+)/);
    if (chatHui) {
      huisinElem = ELEM_CHARS.find((e) => chatHui[1].includes(e)) ?? null;
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
    huisinElem,
    gisinElems,
    branchRelations,
  };
}

export function cardKind(card: Gemma24SajuCard): string {
  const t = card.title.trim();
  const deepSec = t.match(/^심층·\[(\d+)\]/);
  if (deepSec) return `deep-${deepSec[1]}`;
  if (t.startsWith('변수·격 ')) return 'gyeok';
  if (t.startsWith('변수·지지관계 ')) return 'branch';
  if (/변수·운 용신/.test(t)) return 'un-yongsin';
  if (/변수·운 기신/.test(t)) return 'un-gisin';
  if (t.startsWith('변수·희신 ') || /변수·운 희신/.test(t)) return 'un-huisin';
  if (t.startsWith('변수·천간 ')) return 'stem-chen';
  if (STEM_KO.some((s) => t.includes(s)) && t.includes('일주')) return 'stem-day';
  if (COMPOSE_FOUNDATION_TITLES.includes(t as (typeof COMPOSE_FOUNDATION_TITLES)[number])) {
    return 'foundation';
  }
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

  if (kind === 'stem-chen') {
    if (!facts.stemKo) return false;
    return title.startsWith('변수·천간 ') && title.includes(facts.stemKo);
  }

  if (kind === 'gyeok') {
    if (!facts.gyeokguk) return false;
    const cardGyeok = title.replace(/^변수·격\s*/, '').trim();
    if (cardGyeok === facts.gyeokguk || cardGyeok.startsWith(facts.gyeokguk)) return true;
    const alias: Record<string, string> = { 칠살격: '편관격', 편관격: '칠살격' };
    const alt = alias[facts.gyeokguk];
    return Boolean(alt && (cardGyeok === alt || cardGyeok.startsWith(alt)));
  }

  if (kind === 'branch') {
    const rel = title.replace(/^변수·지지관계\s*/, '').trim();
    return facts.branchRelations.has(rel);
  }

  if (kind === 'un-yongsin') {
    if (!facts.yongsinElem) return false;
    return (
      title.includes(facts.yongsinElem)
      || body.includes(facts.yongsinElem)
      || body.includes(`(${facts.yongsinElem})`)
    );
  }

  if (kind === 'un-gisin') {
    if (!facts.gisinElems.length) return false;
    return facts.gisinElems.some(
      (e) => title.includes(e) || body.includes(e) || body.includes(`(${e})`),
    );
  }

  if (kind === 'un-huisin') {
    const elem = facts.huisinElem ?? facts.yongsinElem;
    if (!elem) return false;
    return title.includes(elem) || body.includes(elem) || body.includes(`(${elem})`);
  }

  return false;
}

export function searchGemma24SajuKnowledge(query: string): Gemma24SajuCard[] {
  const pack = loadKnowledge();
  if (!pack?.cards.length) return [];

  const facts = extractPromptFacts(query);
  const precise = pack.cards.filter((c) => isPreciseMatch(c, facts));

  const stem = precise
    .filter((c) => cardKind(c) === 'stem-day')
    .sort((a, b) => Number(b.councilCertified) - Number(a.councilCertified))
    .slice(0, MAX_STEM_CARDS);
  const gyeok = precise
    .filter((c) => cardKind(c) === 'gyeok')
    .sort((a, b) => Number(b.councilCertified) - Number(a.councilCertified))
    .slice(0, MAX_GYEOK_CARDS);
  const branch = precise
    .filter((c) => cardKind(c) === 'branch')
    .sort((a, b) => Number(b.councilCertified) - Number(a.councilCertified))
    .slice(0, MAX_BRANCH_CARDS);
  const elem = precise
    .filter((c) => {
      const k = cardKind(c);
      return k === 'un-yongsin' || k === 'un-gisin' || k === 'un-huisin';
    })
    .sort((a, b) => Number(b.councilCertified) - Number(a.councilCertified))
    .slice(0, MAX_ELEM_CARDS);

  const stemChen = precise
    .filter((c) => cardKind(c) === 'stem-chen')
    .sort((a, b) => Number(b.councilCertified) - Number(a.councilCertified))
    .slice(0, MAX_STEM_CHEN_CARDS);

  return [...stem, ...stemChen, ...gyeok, ...branch, ...elem];
}

function pushCouncilCard(
  out: Gemma24SajuCard[],
  seen: Set<number>,
  c: Gemma24SajuCard | undefined,
): void {
  if (!c || seen.has(c.id) || !c.councilCertified) return;
  seen.add(c.id);
  out.push(c);
}

function bestCouncilCard(
  pack: KnowledgePack,
  pred: (c: Gemma24SajuCard) => boolean,
): Gemma24SajuCard | undefined {
  return pack.cards
    .filter((c) => pred(c) && c.councilCertified)
    .sort((a, b) => b.body.length - a.body.length)[0];
}

function enrichCouncilStemCards(
  pack: KnowledgePack,
  facts: ReturnType<typeof extractPromptFacts>,
  out: Gemma24SajuCard[],
  seen: Set<number>,
): void {
  if (!facts.stemKo) return;
  pushCouncilCard(
    out,
    seen,
    bestCouncilCard(
      pack,
      (c) => cardKind(c) === 'stem-chen' && c.title.includes(facts.stemKo!),
    ),
  );
  pushCouncilCard(
    out,
    seen,
    bestCouncilCard(
      pack,
      (c) =>
        cardKind(c) === 'stem-day'
        && c.title.includes(facts.stemKo!)
        && c.title.includes('일주'),
    ),
  );
}

/** 서버 cards.json에서 사주 팩트(격·용신·기신·지지) 카드 보강 */
function enrichCouncilFactCards(
  pack: KnowledgePack,
  facts: ReturnType<typeof extractPromptFacts>,
  out: Gemma24SajuCard[],
  seen: Set<number>,
): void {
  if (facts.gyeokguk) {
    const alias: Record<string, string> = { 칠살격: '편관격', 편관격: '칠살격' };
    const names = [facts.gyeokguk, alias[facts.gyeokguk]].filter(Boolean) as string[];
    const gyeok = bestCouncilCard(pack, (c) => {
      if (cardKind(c) !== 'gyeok') return false;
      const cardGyeok = c.title.replace(/^변수·격\s*/, '').trim();
      return names.some((g) => cardGyeok === g || cardGyeok.startsWith(g));
    });
    pushCouncilCard(out, seen, gyeok);
  }

  if (facts.yongsinElem) {
    pushCouncilCard(
      out,
      seen,
      bestCouncilCard(
        pack,
        (c) => cardKind(c) === 'un-yongsin' && c.title.includes(facts.yongsinElem!),
      ),
    );
  }

  if (facts.huisinElem) {
    pushCouncilCard(
      out,
      seen,
      bestCouncilCard(
        pack,
        (c) => cardKind(c) === 'un-huisin' && c.title.includes(facts.huisinElem!),
      ),
    );
  }

  for (const e of facts.gisinElems) {
    pushCouncilCard(
      out,
      seen,
      bestCouncilCard(pack, (c) => cardKind(c) === 'un-gisin' && c.title.includes(e)),
    );
  }

  for (const rel of facts.branchRelations) {
    pushCouncilCard(
      out,
      seen,
      bestCouncilCard(pack, (c) => cardKind(c) === 'branch' && c.title.includes(rel)),
    );
  }
}

/** 심층·[1]~[10] 인증 카드 — 섹션별 풍부한 본문 */
function enrichCouncilDeepCards(
  pack: KnowledgePack,
  out: Gemma24SajuCard[],
  seen: Set<number>,
): void {
  for (let n = 1; n <= 10; n += 1) {
    const prefix = `심층·[${n}]`;
    const deep = pack.cards.find(
      (c) => c.title.trim().startsWith(prefix) && c.councilCertified,
    );
    pushCouncilCard(out, seen, deep);
  }
}

/** PASS(인증) 카드만 — 조합·표시용 */
export function filterCouncilCertifiedCards(cards: Gemma24SajuCard[]): Gemma24SajuCard[] {
  return cards.filter((c) => c.councilCertified === true);
}

/** 화면 조합용 — PASS만, 프레임 제외, 일주·격국·용신·심층 섹션 */
export function searchCouncilDisplayCards(query: string): Gemma24SajuCard[] {
  const pack = loadKnowledge();
  if (!pack?.cards.length) return [];

  const facts = extractPromptFacts(query);
  const matched = filterCouncilCertifiedCards(searchGemma24SajuKnowledge(query)).filter(
    (c) => cardKind(c) !== 'foundation',
  );
  const seen = new Set(matched.map((c) => c.id));
  const out = [...matched];

  enrichCouncilStemCards(pack, facts, out, seen);
  enrichCouncilFactCards(pack, facts, out, seen);
  enrichCouncilDeepCards(pack, out, seen);

  return filterCouncilCertifiedCards(out);
}

/** Groq 보충 컨텍스트용 — 프레임 카드 포함 (반복 금지 참고용) */
export function searchCouncilContextCards(query: string): Gemma24SajuCard[] {
  const pack = loadKnowledge();
  if (!pack?.cards.length) return [];

  const facts = extractPromptFacts(query);
  const out = searchCouncilDisplayCards(query);
  const seen = new Set(out.map((c) => c.id));

  for (const title of COMPOSE_FOUNDATION_TITLES) {
    if (out.filter((c) => cardKind(c) === 'foundation').length >= MAX_FOUNDATION_CARDS) break;
    const f = pack.cards.find((c) => c.title.trim() === title);
    pushCouncilCard(out, seen, f);
  }

  if (out.length < 2) {
    enrichCouncilStemCards(pack, facts, out, seen);
  }

  return out;
}

/** @deprecated searchCouncilDisplayCards / searchCouncilContextCards 사용 */
export function searchCouncilComposeCards(query: string): Gemma24SajuCard[] {
  return searchCouncilContextCards(query);
}

export type SajuCouncilBadgeLevel = 'certified' | 'reviewed' | 'none';

export type Gemma24KnowledgeResult = {
  systemAppend: string;
  badge: SajuCouncilBadgeLevel;
  cardCount: number;
};

export function buildGemma24KnowledgeResult(
  query: string,
  opts?: { certifiedOnly?: boolean },
): Gemma24KnowledgeResult {
  if (!knowledgeEnabled()) {
    return { systemAppend: '', badge: 'none', cardCount: 0 };
  }
  const certifiedOnly = opts?.certifiedOnly !== false
    && process.env.GEMMA24_COUNCIL_CERTIFIED_ONLY !== '0';
  let cards = searchGemma24SajuKnowledge(query);
  if (certifiedOnly) {
    cards = filterCouncilCertifiedCards(cards);
    if (!cards.length) {
      return { systemAppend: '', badge: 'none', cardCount: 0 };
    }
  }
  const hasCertified = cards.some((c) => c.councilCertified);
  const systemAppend = formatGemma24KnowledgeBlock(cards, hasCertified);
  return {
    systemAppend,
    badge: cards.length === 0 ? 'none' : hasCertified ? 'certified' : 'reviewed',
    cardCount: cards.length,
  };
}

function formatGemma24KnowledgeBlock(cards: Gemma24SajuCard[], councilCertified: boolean): string {
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

  const headerLines = councilCertified
    ? [
      '【젬마24 참고 지식 — ✓ 사주위원회 인증】',
      '아래 카드는 명리 사주위원회 검증(PASS)을 받은 자료입니다. 확정 데이터와 모순되면 확정 데이터를 따르세요.',
    ]
    : [
      '【젬마24 참고 지식 — 사주위원회 검수 반영】',
      '아래 카드는 확정 데이터와 일치하는 검수 지식입니다. 위원회 FAIL 항목은 제외되었습니다.',
    ];

  return [
    ...headerLines,
    '문장을 그대로 복사하지 말고 논리와 톤만 참고하세요.',
    '',
    ...sections,
  ].join('\n');
}

export function buildGemma24KnowledgeForSystem(query: string): string {
  return buildGemma24KnowledgeResult(query).systemAppend;
}

/** 상담(채팅) 질문 주제 → 심층·[N] 카드 id */
const CONSULT_TOPIC_DEEP: [RegExp, number][] = [
  [/연애|애인|결혼|짝|궁합|관계|배우자|이별|썸/, 8],
  [/재물|돈|금전|투자|수입|벌이|재테크/, 7],
  [/직업|커리어|사업|취업|이직|승진|직장/, 9],
  [/건강|몸|질병|컨디션|체력/, 10],
  [/대운|세운|올해|월운|시기|흐름|언제|요즘/, 6],
  [/성격|성향|처음|타인/, 1],
  [/오행|균형/, 4],
  [/용신|기신|희신/, 5],
  [/사주팔자|팔자|명식/, 2],
];

export function pickConsultDeepIds(userMessage: string): number[] {
  if (isTodayFortuneQuestion(userMessage)) return [];

  const ids: number[] = [];
  for (const [re, id] of CONSULT_TOPIC_DEEP) {
    if (re.test(userMessage) && !ids.includes(id)) ids.push(id);
    if (ids.length >= 2) break;
  }
  return ids;
}

export function buildConsultCardSearchQuery(
  sajuContext: string,
  userMessage: string,
  compareSajuContext = '',
): string {
  return [sajuContext.trim(), compareSajuContext.trim(), userMessage.trim()].filter(Boolean).join('\n\n');
}

/** 음성·텍스트 상담 — 매칭 PASS 카드 목록 (AI 없이 조합용) */
export function searchConsultCouncilCards(
  query: string,
  userMessage: string,
): Gemma24SajuCard[] {
  if (!knowledgeEnabled()) return [];

  const pack = loadKnowledge();
  if (!pack?.cards.length) return [];

  const certifiedOnly = process.env.GEMMA24_COUNCIL_CERTIFIED_ONLY !== '0';
  const facts = extractPromptFacts(query);
  const seen = new Set<number>();
  const out: Gemma24SajuCard[] = [];

  for (const c of filterCouncilCertifiedCards(searchGemma24SajuKnowledge(query))) {
    pushCouncilCard(out, seen, c);
  }
  enrichCouncilStemCards(pack, facts, out, seen);
  enrichCouncilFactCards(pack, facts, out, seen);

  for (const n of pickConsultDeepIds(userMessage)) {
    const prefix = `심층·[${n}]`;
    const deep = pack.cards.find(
      (c) => c.title.trim().startsWith(prefix) && c.councilCertified,
    );
    pushCouncilCard(out, seen, deep);
  }

  if (!out.some((c) => cardKind(c).startsWith('deep-'))) {
    const fallback = pack.cards.find(
      (c) => c.title.trim().startsWith('심층·[1]') && c.councilCertified,
    );
    pushCouncilCard(out, seen, fallback);
  }

  const cards = filterCouncilCertifiedCards(out);
  if (certifiedOnly && !cards.length) return [];
  return cards;
}

/** 음성·텍스트 상담 — PASS 카드 RAG (LLM 보조용) */
export function buildConsultCouncilKnowledgeResult(
  sajuContext: string,
  userMessage: string,
  compareSajuContext = '',
): Gemma24KnowledgeResult {
  if (!knowledgeEnabled()) {
    return { systemAppend: '', badge: 'none', cardCount: 0 };
  }

  const query = buildConsultCardSearchQuery(sajuContext, userMessage, compareSajuContext);
  const cards = searchConsultCouncilCards(query, userMessage);

  if (!cards.length) {
    return { systemAppend: '', badge: 'none', cardCount: 0 };
  }

  const hasCertified = cards.some((c) => c.councilCertified);
  const systemAppend = formatGemma24KnowledgeBlock(cards, hasCertified);
  return {
    systemAppend,
    badge: hasCertified ? 'certified' : 'reviewed',
    cardCount: cards.length,
  };
}
