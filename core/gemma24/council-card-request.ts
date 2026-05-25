/**
 * 상담 중 누락 인증 카드 추론 · 즉석 제작 요청 · 초안(draft) 생성
 */
import fs from 'fs/promises';
import path from 'path';
import { collectGemma24CardStats } from './card-stats';
import { FORTUNE_SECTION_TITLES } from './fortune-display-order';
import {
  buildDayFortuneCardDraft,
  dayFortuneCardTitle,
  dayFortuneTopic,
  offsetToDayLabel,
  TOMORROW_FORTUNE_CARD_TITLE,
  TODAY_FORTUNE_CARD_TITLE,
  type DailyFortuneCounselPayload,
} from '../daily-fortune/counsel-format';
import {
  dayFortuneTopicLabel,
  isDayFortuneQuestion,
  parseDayFortuneTarget,
  type DayFortuneTarget,
} from './is-today-fortune-question';
import { dayFortuneCardTitleForTarget } from '../daily-fortune/counsel-format';
import { extractPromptFacts, pickConsultDeepIds, type Gemma24SajuCard } from './saju-knowledge';

export type CouncilCardNeed = {
  title: string;
  kind: string;
  priority: 'P0' | 'P1';
  reason: string;
};

export type CouncilCardDraft = {
  title: string;
  summary: string;
  body: string;
  tags: string[];
};

export type CouncilCardRequestRecord = {
  id: string;
  createdAt: string;
  source: 'counsel' | 'fortune' | 'api';
  userMessage: string;
  sajuContextSnippet: string;
  counselorName?: string;
  needs: CouncilCardNeed[];
  drafts: CouncilCardDraft[];
};

const DEEP_SECTION_LABEL: Record<number, string> = {
  1: '심층·[1] 인사·성향',
  2: '심층·[2] 사주팔자',
  3: '심층·[3] 오행 균형',
  4: '심층·[4] 십신·격국',
  5: '심층·[5] 용신·기신',
  6: '심층·[6] 대운·세운',
  7: '심층·[7] 재물',
  8: '심층·[8] 연애·관계',
  9: '심층·[9] 직업',
  10: '심층·[10] 실천·주의',
};

const INTERPRET_BY_TOPIC: [RegExp, string][] = [
  [/내일|다음\s*날|tomorrow/i, TOMORROW_FORTUNE_CARD_TITLE],
  [/오늘의?\s*운세|오늘\s*운|일운|금일\s*운/, TODAY_FORTUNE_CARD_TITLE],
  [/궁합|연애|애인|결혼|짝|관계|배우자/, '해석·궁합·연인 비교'],
  [/올해|세운|월운|시기|흐름|요즘/, '해석·세운·올해 흐름'],
  [/대운|전환/, '해석·대운 전환기'],
  [/용신|기신|희신/, '해석·용신·기신 실전'],
];

function certifiedTitles(): string[] {
  try {
    return collectGemma24CardStats({ includeLists: true }).certifiedCards.map((c) => c.title.trim());
  } catch {
    return [];
  }
}

function hasPassTitle(titles: string[], pred: (t: string) => boolean): boolean {
  return titles.some(pred);
}

function pushNeed(
  out: CouncilCardNeed[],
  seen: Set<string>,
  need: CouncilCardNeed,
): void {
  if (seen.has(need.title)) return;
  seen.add(need.title);
  out.push(need);
}

/** 사주 맥락·질문으로 필요한데 PASS 카드가 없는 항목 */
export function inferCouncilCardNeeds(
  sajuContext: string,
  userMessage: string,
  compareSajuContext = '',
): CouncilCardNeed[] {
  const query = [sajuContext.trim(), compareSajuContext.trim(), userMessage.trim()]
    .filter(Boolean)
    .join('\n\n');
  const titles = certifiedTitles();
  const facts = extractPromptFacts(query);
  const out: CouncilCardNeed[] = [];
  const seen = new Set<string>();

  if (facts.gyeokguk) {
    const title = `변수·격 ${facts.gyeokguk}`;
    if (!hasPassTitle(titles, (t) => t === title || t.startsWith(`변수·격 ${facts.gyeokguk}`))) {
      pushNeed(out, seen, {
        title,
        kind: 'gyeok',
        priority: 'P0',
        reason: `명식 격국(${facts.gyeokguk})에 맞는 인증 변수 카드가 없습니다.`,
      });
    }
  }

  if (facts.stemKo) {
    const dayTitle = `${facts.stemKo} 일주 · 성향과 삶의 패턴`;
    if (!hasPassTitle(titles, (t) => t.includes(facts.stemKo!) && t.includes('일주'))) {
      pushNeed(out, seen, {
        title: dayTitle,
        kind: 'stem-day',
        priority: 'P0',
        reason: `일주(${facts.stemKo}) 해석 카드가 없습니다.`,
      });
    }
    const chenTitle = `변수·천간 ${facts.stemKo}`;
    if (!hasPassTitle(titles, (t) => t.startsWith(chenTitle))) {
      pushNeed(out, seen, {
        title: chenTitle,
        kind: 'stem-chen',
        priority: 'P1',
        reason: `천간(${facts.stemKo}) 변수 카드가 없습니다.`,
      });
    }
  }

  if (facts.yongsinElem) {
    const title = `변수·운 용신 ${facts.yongsinElem}`;
    if (!hasPassTitle(titles, (t) => t.includes(title))) {
      pushNeed(out, seen, {
        title,
        kind: 'un-yongsin',
        priority: 'P0',
        reason: `용신 오행(${facts.yongsinElem}) 변수 카드가 없습니다.`,
      });
    }
  }

  if (facts.huisinElem) {
    const title = `변수·운 희신 ${facts.huisinElem}`;
    if (!hasPassTitle(titles, (t) => t.includes(title))) {
      pushNeed(out, seen, {
        title,
        kind: 'un-huisin',
        priority: 'P1',
        reason: `희신 오행(${facts.huisinElem}) 변수 카드가 없습니다.`,
      });
    }
  }

  for (const e of facts.gisinElems) {
    const title = `변수·운 기신 ${e}`;
    if (!hasPassTitle(titles, (t) => t.includes(title))) {
      pushNeed(out, seen, {
        title,
        kind: 'un-gisin',
        priority: 'P0',
        reason: `기신 오행(${e}) 변수 카드가 없습니다.`,
      });
    }
  }

  for (const rel of facts.branchRelations) {
    const title = `변수·지지관계 ${rel}`;
    if (!hasPassTitle(titles, (t) => t.startsWith(title))) {
      pushNeed(out, seen, {
        title,
        kind: 'branch',
        priority: 'P1',
        reason: `지지 관계(${rel}) 변수 카드가 없습니다.`,
      });
    }
  }

  for (const n of pickConsultDeepIds(userMessage)) {
    const prefix = `심층·[${n}]`;
    const label = DEEP_SECTION_LABEL[n] ?? prefix;
    if (!hasPassTitle(titles, (t) => t.startsWith(prefix))) {
      pushNeed(out, seen, {
        title: label,
        kind: `deep-${n}`,
        priority: 'P0',
        reason: `질문 주제에 맞는 ${label} 인증 카드가 없습니다.`,
      });
    }
  }

  for (const [re, interpretTitle] of INTERPRET_BY_TOPIC) {
    if (!re.test(userMessage)) continue;
    if (!hasPassTitle(titles, (t) => t === interpretTitle || t.startsWith(interpretTitle))) {
      pushNeed(out, seen, {
        title: interpretTitle,
        kind: 'interpret',
        priority: 'P1',
        reason: `주제 맞춤 해석 카드(${interpretTitle})가 없습니다.`,
      });
    }
  }

  return out.slice(0, 6);
}

function draftGyeok(title: string): CouncilCardDraft {
  const name = title.replace(/^변수·격\s*/, '').trim();
  return {
    title,
    summary: `${name} 격의 핵심 성향·강점·주의점을 한눈에 정리한 변수 카드입니다.`,
    body: `「${title}」
【개요】${name}은 월지 본기와 십신 구조에 따라 잡는 격입니다. 이 명식의 ${name}에 맞춰 해석합니다.
【핵심】자립·역할·재물·관계에서 이 격이 드러나는 패턴을 참고하세요. 과하면 균형을, 부족하면 보완 오행을 의식하세요.
키워드: ${name}, 격국, 십신, 균형`,
    tags: ['격국', '변수', '명리'],
  };
}

function draftElemVar(prefix: string, elem: string, role: string): CouncilCardDraft {
  return {
    title: `${prefix} ${elem}`,
    summary: `${role}이 ${elem}(오행)일 때 이 명식에 맞는 실전 해석 요약입니다.`,
    body: `「${prefix} ${elem}」
【개요】${role}이 ${elem}일 때 선택·행동·시기 판단의 기준이 됩니다.
【핵심】${elem} 기운을 보강·조절하는 방향을 참고하세요. 과한 상극·상생 불균형은 주의가 필요합니다.
키워드: ${role}, ${elem}, 오행, 명리`,
    tags: [role, '오행', '명리'],
  };
}

function draftStemDay(stemKo: string): CouncilCardDraft {
  const title = `${stemKo} 일주 · 성향과 삶의 패턴`;
  return {
    title,
    summary: `${stemKo} 일주의 성향·관계·일·재물 패턴을 실생활 톤으로 정리한 해석 카드입니다.`,
    body: `「${title}」
【개요】일주(日柱)는 하루의 기운과 삶의 기본 리듬을 보여 줍니다. ${stemKo} 일주의 특성을 중심으로 해석합니다.
【핵심】강점은 일관된 추진·표현 방식에, 주의는 고집·속도 차이·에너지 소모에 있습니다. 상대와의 리듬을 맞추는 것이 관건입니다.
키워드: ${stemKo}, 일주, 성향, 관계`,
    tags: ['일주', '해석', '명리'],
  };
}

function draftDeep(label: string): CouncilCardDraft {
  return {
    title: label,
    summary: `${label} 주제의 심층 풀이용 인증 카드 초안입니다. summary·【핵심】을 위원회 검수 후 확정하세요.`,
    body: `「${label}」
【개요】이 섹션은 심층 풀이·상담에서 해당 주제를 풀 때 사용합니다.
【핵심】입력 명식의 확정 데이터(격·용신·오행)와 모순 없이 서술하세요. 단정보다 경향·선택 가능한 조언으로 마무리하세요.
키워드: 심층, 상담, 참고`,
    tags: ['심층', '명리'],
  };
}

function draftInterpret(title: string): CouncilCardDraft {
  return {
    title,
    summary: `${title} 주제 맞춤 해석 카드 초안입니다.`,
    body: `「${title}」
【개요】상담·심층 풀이에서 이 주제 질문에 대응하는 해석 카드입니다.
【핵심】명식 데이터와 인증 변수 카드를 바탕으로, 실천 가능한 조언 3~5문장으로 구성하세요.
키워드: 해석, 상담, 참고`,
    tags: ['해석', '명리'],
  };
}

/** 제목 규격에 맞는 초안 본문 (LLM 없음 — 위원회 검수 후 cards.json 반영) */
export function buildCouncilCardDraft(need: CouncilCardNeed): CouncilCardDraft {
  const { title, kind } = need;

  if (kind === 'gyeok') return draftGyeok(title);
  if (kind === 'un-yongsin') {
    const elem = title.replace(/^변수·운 용신\s*/, '').trim();
    return draftElemVar('변수·운 용신', elem, '용신');
  }
  if (kind === 'un-gisin') {
    const elem = title.replace(/^변수·운 기신\s*/, '').trim();
    return draftElemVar('변수·운 기신', elem, '기신');
  }
  if (kind === 'un-huisin') {
    const elem = title.replace(/^변수·운 희신\s*/, '').trim();
    return draftElemVar('변수·운 희신', elem, '희신');
  }
  if (kind === 'stem-day') {
    const stem = title.split(' ')[0] ?? '일주';
    return draftStemDay(stem);
  }
  if (kind.startsWith('deep-')) return draftDeep(title);
  if (kind === 'interpret') return draftInterpret(title);
  if (kind === 'today-fortune') return draftInterpret(title);

  return {
    title,
    summary: `${title} — 상담 중 요청된 인증 카드 초안입니다.`,
    body: `「${title}」
【개요】상담 맥락에서 필요한 지식 카드입니다.
【핵심】확정 사주 데이터와 일치하도록 작성·검수하세요.
키워드: 변수, 명리`,
    tags: ['명리'],
  };
}

export function buildCouncilCardDrafts(needs: CouncilCardNeed[]): CouncilCardDraft[] {
  return needs.map(buildCouncilCardDraft);
}

let draftCardIdSeq = -1;

/** 상담 즉시 사용 — PASS 전 초안 카드 */
export function draftsToSajuCards(drafts: CouncilCardDraft[]): Gemma24SajuCard[] {
  return drafts.map((d) => {
    draftCardIdSeq -= 1;
    return {
      id: draftCardIdSeq,
      title: d.title,
      body: d.body,
      summary: d.summary,
      tags: d.tags,
      councilCertified: false,
    };
  });
}

function mergeCouncilCardNeeds(...groups: CouncilCardNeed[][]): CouncilCardNeed[] {
  const seen = new Set<string>();
  const out: CouncilCardNeed[] = [];
  for (const group of groups) {
    for (const n of group) {
      if (seen.has(n.title)) continue;
      seen.add(n.title);
      out.push(n);
    }
  }
  return out.slice(0, 8);
}

function cardCoversNeed(card: Gemma24SajuCard, need: CouncilCardNeed): boolean {
  const t = card.title.trim();
  if (need.kind.startsWith('deep-')) {
    const id = need.kind.replace('deep-', '');
    return t.startsWith(`심층·[${id}]`) || t === need.title;
  }
  if (need.kind === 'gyeok') return t.startsWith('변수·격');
  if (need.kind === 'un-yongsin') return /변수·운 용신/.test(t);
  if (need.kind === 'un-gisin') return /변수·운 기신/.test(t);
  if (need.kind === 'un-huisin') return /변수·운 희신/.test(t);
  if (need.kind === 'stem-day') return t.includes('일주');
  if (need.kind === 'stem-chen') return t.startsWith('변수·천간');
  if (need.kind === 'branch') return t.startsWith('변수·지지관계');
  if (need.kind === 'interpret') return t === need.title || t.startsWith(need.title);
  return t === need.title;
}

function cardsCoverNeed(cards: Gemma24SajuCard[], need: CouncilCardNeed): boolean {
  return cards.some((c) => cardCoversNeed(c, need));
}

/** 질문 주제 심층·[N] — 검색 결과에 없을 때 */
function inferCounselTopicDeepGaps(
  userMessage: string,
  matchedCards: Gemma24SajuCard[],
): CouncilCardNeed[] {
  const titles = certifiedTitles();
  const out: CouncilCardNeed[] = [];
  const seen = new Set<string>();

  for (const id of pickConsultDeepIds(userMessage)) {
    if (matchedCards.some((c) => c.title.trim().startsWith(`심층·[${id}]`))) continue;
    const label = DEEP_SECTION_LABEL[id];
    if (!label) continue;
    const inCatalog = hasPassTitle(titles, (t) => t.startsWith(`심층·[${id}]`) || t === label);
    pushNeed(out, seen, {
      title: label,
      kind: `deep-${id}`,
      priority: inCatalog ? 'P1' : 'P0',
      reason: inCatalog
        ? `질문 주제(${label}) 카드가 검색에 잡히지 않아 맞춤 보강합니다.`
        : `질문 주제에 맞는 ${label} 카드가 없습니다.`,
    });
  }
  return out;
}

/** jsonl에 방금 접수된 초안 재사용 (동일 상담 세션) */
export async function loadRecentDraftCards(
  titles: string[],
  maxAgeMs = 30 * 60 * 1000,
): Promise<Gemma24SajuCard[]> {
  if (!titles.length) return [];
  const want = new Set(titles);
  const found = new Map<string, Gemma24SajuCard>();
  try {
    const raw = await fs.readFile(requestLogPath(), 'utf-8');
    const lines = raw.slice(-120_000).split('\n').filter(Boolean).reverse();
    const cutoff = Date.now() - maxAgeMs;
    for (const line of lines) {
      try {
        const rec = JSON.parse(line) as CouncilCardRequestRecord;
        if (new Date(rec.createdAt).getTime() < cutoff) continue;
        for (const d of rec.drafts) {
          if (!want.has(d.title) || found.has(d.title)) continue;
          found.set(d.title, draftsToSajuCards([d])[0]);
          if (found.size >= want.size) return [...found.values()];
        }
      } catch {
        /* skip */
      }
    }
  } catch {
    /* no log yet */
  }
  return [...found.values()];
}

/**
 * 상담 — 누락 카드 초안 즉시 생성·재사용 + 백그라운드 접수
 */
export async function prepareCounselSupplementalCards(params: {
  sajuContext: string;
  userMessage: string;
  compareSajuContext?: string;
  matchedCards: Gemma24SajuCard[];
}): Promise<{ cards: Gemma24SajuCard[]; queuedCount: number }> {
  const compare = params.compareSajuContext ?? '';
  const allNeeds = mergeCouncilCardNeeds(
    inferCouncilCardNeeds(params.sajuContext, params.userMessage, compare),
    inferCounselTopicDeepGaps(params.userMessage, params.matchedCards),
  );

  let gaps = allNeeds.filter((n) => !cardsCoverNeed(params.matchedCards, n));
  if (!gaps.length && params.matchedCards.length < 2) {
    gaps = inferCounselFallbackNeeds(params.userMessage);
  }
  if (!gaps.length) return { cards: [], queuedCount: 0 };

  const fromLog = await loadRecentDraftCards(gaps.map((g) => g.title));
  const coveredByLog = new Set(fromLog.map((c) => c.title));
  const stillNeed = gaps.filter((g) => !coveredByLog.has(g.title));

  const freshDrafts = buildCouncilCardDrafts(stillNeed);
  const freshCards = draftsToSajuCards(freshDrafts);

  if (stillNeed.length && councilCardAutoRequestEnabled()) {
    autoEnqueueCouncilCardProductionBackground({
      needs: stillNeed,
      source: 'counsel',
      userMessage: params.userMessage,
      sajuContextSnippet: params.sajuContext,
    });
  }

  return {
    cards: [...fromLog, ...freshCards],
    queuedCount: stillNeed.length,
  };
}

function requestLogPath(): string {
  return path.join(process.cwd(), 'council-card-requests.jsonl');
}

const RECENT_REQUEST_MS = 6 * 60 * 60 * 1000;

export function councilCardAutoRequestEnabled(): boolean {
  return process.env.GEMMA24_CARD_REQUEST_AUTO !== '0';
}

/** 최근 접수된 동일 제목은 재요청하지 않음 */
async function filterRecentlyRequestedTitles(
  needs: CouncilCardNeed[],
): Promise<CouncilCardNeed[]> {
  if (!needs.length) return [];
  try {
    const fp = requestLogPath();
    const raw = await fs.readFile(fp, 'utf-8');
    const tail = raw.slice(-96_000);
    const cutoff = Date.now() - RECENT_REQUEST_MS;
    const recent = new Set<string>();
    for (const line of tail.split('\n')) {
      if (!line.trim()) continue;
      try {
        const rec = JSON.parse(line) as CouncilCardRequestRecord;
        if (new Date(rec.createdAt).getTime() < cutoff) continue;
        for (const n of rec.needs) recent.add(n.title);
      } catch {
        /* skip bad line */
      }
    }
    return needs.filter((n) => !recent.has(n.title));
  } catch {
    return needs;
  }
}

/** 초안 생성 + jsonl 접수 (동기) */
export async function autoEnqueueCouncilCardProduction(params: {
  needs: CouncilCardNeed[];
  source: 'counsel' | 'fortune' | 'api';
  userMessage: string;
  sajuContextSnippet: string;
  counselorName?: string;
  drafts?: CouncilCardDraft[];
}): Promise<string | null> {
  if (!councilCardAutoRequestEnabled()) return null;

  const needs = await filterRecentlyRequestedTitles(params.needs);
  if (!needs.length) return null;

  const record = await submitCouncilCardRequest({
    source: params.source,
    userMessage: params.userMessage,
    sajuContextSnippet: params.sajuContextSnippet.slice(0, 1200),
    counselorName: params.counselorName,
    needs,
    drafts: params.drafts ?? buildCouncilCardDrafts(needs),
  });
  return record.id;
}

function isDayFortuneKnowledgeCard(card: Gemma24SajuCard, target: DayFortuneTarget): boolean {
  const t = card.title.trim();
  if (/^심층·\[6\]/.test(t)) return false;
  const want = dayFortuneCardTitleForTarget(target);
  if (t === want || want.includes(t) || t.includes(want)) return true;
  if (target.kind === 'date') {
    const y = target.date.getUTCFullYear();
    const m = target.date.getUTCMonth() + 1;
    const d = target.date.getUTCDate();
    return new RegExp(`해석·${y}년\\s*${m}월\\s*${d}일\\s*일운`).test(t);
  }
  const dayOffset = target.offset;
  const day = offsetToDayLabel(dayOffset);
  if (new RegExp(`해석·${day}\\s*일운`).test(t)) return true;
  if (dayOffset === 0) return /일운|오늘의?\s*운세|금일\s*운|일진/.test(t) && /오늘|일운/.test(t);
  return /일운|내일|모레/.test(t);
}

function hasPassDayFortuneCard(
  titles: string[],
  matched: Gemma24SajuCard[],
  target: DayFortuneTarget,
): boolean {
  const want = dayFortuneCardTitleForTarget(target);
  const passTitle = (t: string) => t === want || t.includes(want) || want.includes(t);
  if (titles.some(passTitle)) return true;
  return matched.some(
    (c) => c.councilCertified !== false && isDayFortuneKnowledgeCard(c, target),
  );
}

/**
 * 오늘·내일 일운 — PASS 카드 우선, 없으면 일진 엔진 데이터로 초안 제작
 */
export async function prepareDayFortuneCounselCards(params: {
  sajuContext: string;
  userMessage: string;
  counselorName?: string;
  dailyFortune: DailyFortuneCounselPayload | null;
  searchedCards: Gemma24SajuCard[];
  dayOffset?: number;
}): Promise<{ cards: Gemma24SajuCard[]; queuedCount: number }> {
  const target =
    params.dayOffset !== undefined
      ? {
          kind: 'offset' as const,
          offset: params.dayOffset,
          label: dayFortuneTopicLabel(params.dayOffset),
        }
      : parseDayFortuneTarget(params.userMessage);
  if (!target) {
    return { cards: [], queuedCount: 0 };
  }

  const day = target.kind === 'date'
    ? `${target.date.getUTCFullYear()}년 ${target.date.getUTCMonth() + 1}월 ${target.date.getUTCDate()}일`
    : offsetToDayLabel(target.offset);
  const cardTitle = dayFortuneCardTitleForTarget(target);
  const passDay = params.searchedCards.filter((c) => isDayFortuneKnowledgeCard(c, target));
  const titles = certifiedTitles();

  if (hasPassDayFortuneCard(titles, passDay, target) && passDay.length) {
    return { cards: passDay, queuedCount: 0 };
  }

  const need: CouncilCardNeed = {
    title: cardTitle,
    kind: 'today-fortune',
    priority: 'P0',
    reason: `${target.label}(${params.dailyFortune?.date ?? day}) 맞춤 인증 카드가 없어 즉석 제작합니다.`,
  };

  const fromLog = await loadRecentDraftCards([cardTitle]);
  let draftCards: Gemma24SajuCard[];
  let draftsForQueue: CouncilCardDraft[];

  if (fromLog.length) {
    draftCards = fromLog;
    draftsForQueue = [];
  } else if (params.dailyFortune) {
    const draftDay =
      target.kind === 'date'
        ? `${target.date.getUTCFullYear()}년 ${target.date.getUTCMonth() + 1}월 ${target.date.getUTCDate()}일`
        : offsetToDayLabel(target.offset);
    draftsForQueue = [buildDayFortuneCardDraft(params.dailyFortune, draftDay)];
    draftCards = draftsToSajuCards(draftsForQueue);
  } else {
    draftsForQueue = [];
    draftCards = [];
  }

  let queuedCount = 0;
  if (councilCardAutoRequestEnabled() && draftsForQueue.length) {
    autoEnqueueCouncilCardProductionBackground({
      needs: [need],
      drafts: draftsForQueue,
      source: 'counsel',
      userMessage: params.userMessage,
      sajuContextSnippet: params.sajuContext,
      counselorName: params.counselorName,
    });
    queuedCount = 1;
  } else if (councilCardAutoRequestEnabled() && !fromLog.length) {
    autoEnqueueCouncilCardProductionBackground({
      needs: [need],
      source: 'counsel',
      userMessage: params.userMessage,
      sajuContextSnippet: params.sajuContext,
      counselorName: params.counselorName,
    });
    queuedCount = 1;
  }

  const merged = [...passDay];
  const seen = new Set(passDay.map((c) => c.title.trim()));
  for (const c of draftCards) {
    if (seen.has(c.title.trim())) continue;
    seen.add(c.title.trim());
    merged.push(c);
  }

  return { cards: merged.length ? merged : draftCards, queuedCount };
}

/** @deprecated prepareDayFortuneCounselCards 사용 */
export const prepareTodayFortuneCounselCards = prepareDayFortuneCounselCards;

/** 교육용·템플릿 카드(질문 주제 맞춤 카드 아님) */
export function isEncyclopediaCounselCard(card: Gemma24SajuCard): boolean {
  const t = card.title.trim();
  if (/^해석·\d{4}년/.test(t) && /일운/.test(t)) return false;
  if (/^해석·(?:오늘|내일|모레)\s*일운$/.test(t)) return false;
  if (/^심층·\[1\]/.test(t)) return true;
  if (/^변수·운\s+(용신|기신|희신)\s/.test(t)) return true;
  if (/인사·성향|사주팔자|명식·구조|실천 조언|^주의$/.test(t)) return true;
  const head = card.body.slice(0, 280);
  if (/일간\(日干\).{0,60}월지\(月支\)/.test(head)) return true;
  if (/년주=유년|월급·저축|본 내용은 명리 참고용/.test(head)) return true;
  if (/상담 맥락에서 필요한 지식 카드/.test(head)) return true;
  return false;
}

function cardCoversTitle(cards: Gemma24SajuCard[], title: string): boolean {
  const want = title.trim();
  return cards.some((c) => {
    const t = c.title.trim();
    return t === want || t.includes(want) || want.includes(t);
  });
}

function dayFortuneCardNeed(target: DayFortuneTarget, userMessage: string): CouncilCardNeed {
  const title = dayFortuneCardTitleForTarget(target);
  return {
    title,
    kind: 'today-fortune',
    priority: 'P0',
    reason: `질문(${userMessage.slice(0, 48)})에 맞는 인증 일운 카드(${title})가 없어 제작 요청합니다.`,
  };
}

/** 답변에 쓸 주제 맞춤 카드가 없을 때 제작 요청 */
export function inferCounselReplyCardGaps(
  userMessage: string,
  pickedCards: Gemma24SajuCard[],
  poolCards: Gemma24SajuCard[],
): CouncilCardNeed[] {
  const target = parseDayFortuneTarget(userMessage);
  const all = [...poolCards, ...pickedCards];

  if (target) {
    const need = dayFortuneCardNeed(target, userMessage);
    if (!cardCoversTitle(all, need.title)) return [need];
    if (!pickedCards.some((c) => !isEncyclopediaCounselCard(c))) return [need];
    return [];
  }

  const substantive = pickedCards.filter((c) => !isEncyclopediaCounselCard(c));
  if (substantive.length >= 1) return [];

  return inferCounselFallbackNeeds(userMessage)
    .filter((n) => !cardCoversTitle(all, n.title))
    .map((n) => ({
      ...n,
      reason: `질문 주제(${n.title}) 인증 카드가 없어 제작 요청합니다.`,
    }));
}

/** 응답 지연 없이 백그라운드 접수 */
export function autoEnqueueCouncilCardProductionBackground(
  params: Parameters<typeof autoEnqueueCouncilCardProduction>[0],
): void {
  void autoEnqueueCouncilCardProduction(params).catch((err) => {
    console.error('[council-card-request] background enqueue failed:', err);
  });
}

export async function submitCouncilCardRequest(
  record: Omit<CouncilCardRequestRecord, 'id' | 'createdAt'>,
): Promise<CouncilCardRequestRecord> {
  const full: CouncilCardRequestRecord = {
    ...record,
    id: `ccr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  const line = `${JSON.stringify(full)}\n`;
  await fs.appendFile(requestLogPath(), line, 'utf-8');
  if (process.env.NODE_ENV === 'development') {
    console.log('[council-card-request]', full.id, full.needs.map((n) => n.title).join(', '));
  }
  return full;
}

/** AI 심층 풀이 — 빈·짧은 섹션 + 명식 변수 카드 누락 */
export function inferCouncilCardNeedsForFortune(
  prompt: string,
  needsSupplementIds: string[] = [],
): CouncilCardNeed[] {
  const titles = certifiedTitles();
  const out: CouncilCardNeed[] = [];
  const seen = new Set<string>();

  for (const id of needsSupplementIds) {
    const cardTitle = FORTUNE_SECTION_TITLES[id as keyof typeof FORTUNE_SECTION_TITLES];
    if (!cardTitle) continue;
    const hasDeep = hasPassTitle(
      titles,
      (t) => t.startsWith(`심층·[${id}]`) || t === cardTitle,
    );
    pushNeed(out, seen, {
      title: cardTitle,
      kind: `deep-${id}`,
      priority: hasDeep ? 'P1' : 'P0',
      reason: hasDeep
        ? `심층 풀이 [${id}]번 섹션 본문이 짧아 인증 카드 보강이 필요합니다.`
        : `심층 풀이 [${id}]번 섹션용 인증 카드가 없습니다.`,
    });
  }

  for (const n of inferCouncilCardNeeds(prompt, '')) {
    pushNeed(out, seen, n);
  }

  return out.slice(0, 8);
}

export function parseCardRequestsHeader(raw: string | null): CouncilCardNeed[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as CouncilCardNeed[];
    return Array.isArray(parsed) ? parsed.filter((n) => n?.title) : [];
  } catch {
    return [];
  }
}

export function formatCardRequestsHeader(needs: CouncilCardNeed[]): string | undefined {
  if (!needs.length) return undefined;
  return encodeURIComponent(JSON.stringify(needs.slice(0, 8)));
}

/** 검색·갭 추론으로도 카드가 없을 때 — 질문 주제 맞춤 최소 1장 */
export function inferCounselFallbackNeeds(userMessage: string): CouncilCardNeed[] {
  const t = userMessage.trim();
  if (!t) return [];

  const rules: [RegExp, string, string][] = [
    [/내일|다음\s*날|tomorrow/i, TOMORROW_FORTUNE_CARD_TITLE, 'today-fortune'],
    [/오늘의?\s*운세|오늘\s*운|일운|금일\s*운/, TODAY_FORTUNE_CARD_TITLE, 'today-fortune'],
    [/운세|요즘|지금|이번\s*달|올해|세운|월운|시기|흐름/, '해석·세운·올해 흐름', 'interpret'],
    [/연애|애인|결혼|짝|궁합|관계|배우자/, '해석·궁합·연인 비교', 'interpret'],
    [/재물|돈|금전|투자|수입/, '심층·[7] 재물', 'deep-7'],
    [/직업|커리어|사업|취업|이직/, '심층·[9] 직업', 'deep-9'],
    [/건강|몸|질병/, '심층·[10] 실천·주의', 'deep-10'],
    [/대운|전환/, '해석·대운 전환기', 'interpret'],
    [/용신|기신|희신/, '해석·용신·기신 실전', 'interpret'],
  ];

  for (const [re, title, kind] of rules) {
    if (re.test(t)) {
      return [{
        title,
        kind,
        priority: 'P0',
        reason: `질문 주제(${title}) 맞춤 카드를 즉석 제작합니다.`,
      }];
    }
  }

  return [{
    title: '심층·[1] 인사·성향',
    kind: 'deep-1',
    priority: 'P0',
    reason: '상담 맞춤 카드를 즉석 제작합니다.',
  }];
}

/** 매칭 카드가 약할 때 보강 제안 (심층·주제 해석 위주) */
export function inferCouncilCardNeedsForWeakMatch(
  userMessage: string,
  matchedCards: Gemma24SajuCard[],
): CouncilCardNeed[] {
  const kinds = new Set(matchedCards.map((c) => c.title));
  const hasDeep = matchedCards.some((c) => /^심층·\[\d+\]/.test(c.title.trim()));
  if (hasDeep && kinds.size >= 2) return [];

  const needs = inferCouncilCardNeeds('', userMessage);
  return needs.filter((n) => n.kind.startsWith('deep-') || n.kind === 'interpret').slice(0, 3);
}
