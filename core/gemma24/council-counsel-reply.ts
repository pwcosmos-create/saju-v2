/**
 * AI 심층 상담 — 서버 인증 카드 + 즉석 초안 카드 조합 (Groq/Gemini 미사용)
 */
import {
  buildCouncilCardDrafts,
  draftsToSajuCards,
  inferCounselFallbackNeeds,
  prepareCounselSupplementalCards,
} from './council-card-request';
import type { Gemma24SajuCard } from './saju-knowledge';
import {
  buildConsultCardSearchQuery,
  cardKind,
  searchConsultCouncilCards,
} from './saju-knowledge';
import { optimizeCardBodyForDisplay, shortCardSubtitle } from './optimize-card-body';

const MAX_CARDS_IN_REPLY = 4;

const GREETING_RE =
  /^(안녕|안뇽|하이|헬로|hello|hi|반가|ㅎㅇ|하이요|안녕하세요|안녕하십니까|반갑)[\s!.?~]*$/i;

const OFF_TOPIC_RE =
  /맛집|맛있는\s*집|날씨|주식\s*(추천|종목)|코딩|프로그래밍|레시피|영화\s*추천|드라마\s*추천|번역해|코드\s*짜|숙제\s*해/;

const TOPIC_LABEL: Record<number, string> = {
  1: '성향',
  2: '사주 전체',
  4: '오행',
  3: '격국·십신',
  5: '용신·기신',
  6: '대운·세운',
  7: '재물',
  8: '연애·관계',
  9: '직업',
  10: '건강·실천',
};

function counselCardOnlyEnabled(): boolean {
  return process.env.GEMMA24_COUNSEL_CARD_ONLY !== '0';
}

function isGreeting(message: string): boolean {
  const t = message.trim();
  return t.length > 0 && t.length <= 24 && GREETING_RE.test(t);
}

function isLikelyOffTopic(message: string): boolean {
  return OFF_TOPIC_RE.test(message);
}

function topicLabelFromMessage(message: string): string {
  for (const [re, id] of [
    [/연애|애인|결혼|짝|궁합|관계|배우자/, 8],
    [/재물|돈|금전|투자|수입/, 7],
    [/직업|커리어|사업|취업|이직/, 9],
    [/건강|몸|질병/, 10],
    [/대운|세운|올해|월운|시기|흐름|오늘/, 6],
    [/용신|기신|희신/, 5],
    [/오행|균형/, 4],
    [/격국|십신/, 3],
    [/성격|성향/, 1],
  ] as const) {
    if (re.test(message)) return TOPIC_LABEL[id] ?? '사주';
  }
  return '사주';
}

function rankCounselCards(cards: Gemma24SajuCard[]): Gemma24SajuCard[] {
  const score = (c: Gemma24SajuCard): number => {
    if (c.councilCertified === false) return 5;
    const k = cardKind(c);
    if (k.startsWith('deep-')) return 0;
    if (k === 'gyeok' || k === 'un-yongsin' || k === 'un-gisin') return 1;
    if (k === 'stem-day' || k === 'stem-chen') return 2;
    if (k === 'branch') return 3;
    return 4;
  };
  return [...cards].sort((a, b) => score(a) - score(b));
}

function mergeCardsByTitle(pass: Gemma24SajuCard[], extra: Gemma24SajuCard[]): Gemma24SajuCard[] {
  const seen = new Set<string>();
  const out: Gemma24SajuCard[] = [];
  for (const c of [...pass, ...extra]) {
    const key = c.title.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function pickCardsForReply(cards: Gemma24SajuCard[]): Gemma24SajuCard[] {
  const seen = new Set<number>();
  const out: Gemma24SajuCard[] = [];
  for (const c of rankCounselCards(cards)) {
    const key = c.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= MAX_CARDS_IN_REPLY) break;
  }
  return out;
}

function formatCardSection(card: Gemma24SajuCard): string {
  const sub = shortCardSubtitle(card.title);
  const body = optimizeCardBodyForDisplay(card);
  const tag = card.councilCertified === false ? ' (맞춤 제작)' : '';
  return `◆ ${sub}${tag}\n${body}`;
}

function buildGreetingReply(counselorName: string): string {
  const who = counselorName ? `『${counselorName}』입니다. ` : '';
  return [
    `안녕하세요. ${who}사주위원회 인증 지식을 바탕으로 상담해 드립니다.`,
    '연애, 재물, 직업, 올해·시기 운세처럼 궁금한 점을 말씀해 주시면, 맞는 인증 카드로 풀어 드릴게요.',
  ].join('\n');
}

function buildOffTopicReply(): string {
  return [
    '저는 사주·운세 상담만 도와드립니다.',
    '연애, 재물, 직업, 건강, 올해·시기 흐름처럼 사주와 연결된 질문을 해 주시면 인증 카드로 답해 드릴게요.',
  ].join('\n');
}

function buildCompatibilityReply(cards: Gemma24SajuCard[], counselorName: string): string {
  const picked = pickCardsForReply(
    cards.filter((c) => /궁합|관계|연애|비교/.test(c.title)).length
      ? cards.filter((c) => /궁합|관계|연애|비교/.test(c.title))
      : cards,
  );
  const sections = picked.map(formatCardSection);
  const who = counselorName ? `『${counselorName}』 기준으로 ` : '';
  return [
    `${who}두 분 사주를 인증·맞춤 지식 카드로 비교해 보았습니다.`,
    '',
    '**강점**',
    sections[0] ?? '— 두 분의 오행·일주 조합에서 서로를 보완하는 지점이 있습니다.',
    '',
    '**주의점**',
    sections[1] ?? '— 감정 표현 방식이나 속도 차이를 존중할 필요가 있습니다.',
    '',
    '**실천 팁**',
    sections.slice(2).join('\n\n') || '— 중요한 결정은 서로의 기운이 안정된 때 맞춰 논의해 보세요.',
    '',
    '참고용 풀이이며 전문 상담을 대체하지 않습니다.',
  ].join('\n');
}

function buildCardReply(
  cards: Gemma24SajuCard[],
  userMessage: string,
  counselorName: string,
  draftCount: number,
): string {
  const picked = pickCardsForReply(cards);
  if (!picked.length) return '';

  const topic = topicLabelFromMessage(userMessage);
  const who = counselorName ? `『${counselorName}』입니다. ` : '';
  const sections = picked.map(formatCardSection);
  const intro = draftCount > 0
    ? `${who}질문하신 「${topic}」 주제에 맞춰 인증 카드와 방금 맞춤 제작한 지식을 조합했습니다.`
    : `${who}질문하신 「${topic}」 주제에 맞춰 사주위원회 인증 카드를 조합했습니다.`;

  return [
    intro,
    '',
    ...sections,
    '',
    '위 내용은 입력하신 사주와 지식 카드를 바탕으로 한 참고 풀이입니다. 더 궁금한 점이 있으면 이어서 물어봐 주세요.',
  ].join('\n');
}

export type CouncilCounselReply = {
  content: string;
  cardCount: number;
  draftCardCount: number;
  mode: 'council-counsel';
};

export async function tryCouncilCounselReply(
  sajuContext: string,
  userMessage: string,
  options?: {
    compareSajuContext?: string;
    counselorName?: string;
    chatMode?: 'single' | 'compatibility';
  },
): Promise<CouncilCounselReply | null> {
  if (!counselCardOnlyEnabled()) return null;

  const trimmed = userMessage.trim();
  if (!trimmed) return null;

  const compareSajuContext = options?.compareSajuContext ?? '';
  const counselorName = options?.counselorName ?? '';
  const chatMode = options?.chatMode ?? 'single';

  if (isGreeting(trimmed)) {
    return { content: buildGreetingReply(counselorName), cardCount: 0, draftCardCount: 0, mode: 'council-counsel' };
  }

  if (isLikelyOffTopic(trimmed)) {
    return { content: buildOffTopicReply(), cardCount: 0, draftCardCount: 0, mode: 'council-counsel' };
  }

  const query = buildConsultCardSearchQuery(sajuContext, trimmed, compareSajuContext);
  const passCards = searchConsultCouncilCards(query, trimmed);
  const { cards: supplemental, queuedCount } = await prepareCounselSupplementalCards({
    sajuContext,
    userMessage: trimmed,
    compareSajuContext,
    matchedCards: passCards,
  });

  let allCards = mergeCardsByTitle(passCards, supplemental);
  if (!allCards.length) {
    allCards = draftsToSajuCards(buildCouncilCardDrafts(inferCounselFallbackNeeds(trimmed)));
  }
  if (!allCards.length) return null;

  const draftCardCount = supplemental.length;
  const content =
    chatMode === 'compatibility' && compareSajuContext.trim()
      ? buildCompatibilityReply(allCards, counselorName)
      : buildCardReply(allCards, trimmed, counselorName, draftCardCount);

  if (!content.trim()) return null;

  const picked = pickCardsForReply(allCards);
  const certifiedCount = picked.filter((c) => c.councilCertified !== false).length;

  return {
    content,
    cardCount: certifiedCount,
    draftCardCount: picked.length - certifiedCount,
    mode: 'council-counsel',
  };
}
