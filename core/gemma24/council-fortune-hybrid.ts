/**
 * 인증 카드 조합 + Groq/Gemini 보충 (빈 섹션만, 토큰 절약)
 */
import { fetchLlmCompletionText } from '../config/llm';
import type { Gemma24SajuCard } from './saju-knowledge';
import { cardKind, searchCouncilContextCards, searchCouncilDisplayCards } from './saju-knowledge';
import { buildOfflineHybridSupplement } from './council-fortune-enrich';
import {
  canComposeCouncilFreeFortune,
  composeCouncilFreeFortune,
  type CouncilFreeFortuneResult,
} from './council-fortune-compose';

const SECTION_COVER: Record<string, string[]> = {
  '[1]': ['stem-day', 'stem-chen'],
  '[2]': ['stem-day', 'stem-chen'],
  '[3]': ['gyeok'],
  '[4]': ['stem-day', 'stem-chen'],
  '[5]': ['un-yongsin', 'un-gisin'],
  '[7]': ['branch'],
};

/** 직업·재물·월별·대운만 항상 AI 보충 (인증 카드에 없음) */
const ALWAYS_SUPPLEMENT = ['[6]', '[8]', '[9]', '[10]'] as const;

const SUPPLEMENT_SYSTEM = `당신은 사주팔자 전문가입니다.
이미 「사주위원회 인증」 지식 카드로 작성된 본문이 있습니다. 그 내용을 반복·요약하지 마세요.
지시된 번호 섹션만 추가 작성하세요. ◆ 소제목 사용. 평어체(~해요).
전문 용어는 쉬운 풀이 후 괄호 한자. [1][2] 같은 각주·출처 표시 금지.`;

function hybridGroqEnabled(): boolean {
  return process.env.GEMMA24_HYBRID_GROQ !== '0';
}

export function getGroqSupplementSections(cards: Gemma24SajuCard[]): string[] {
  const kinds = new Set(cards.map((c) => cardKind(c)));
  const fromGaps = Object.entries(SECTION_COVER)
    .filter(([, cover]) => !cover.some((k) => kinds.has(k)))
    .map(([sec]) => sec);
  return [...new Set([...fromGaps, ...ALWAYS_SUPPLEMENT])];
}

function isOverloadText(text: string): boolean {
  return text.includes('과부하') || text.includes('한도 초과');
}

export type CouncilHybridResult = {
  composed: CouncilFreeFortuneResult;
  missingSections: string[];
  contextCards?: import('./saju-knowledge').Gemma24SajuCard[];
};

export function tryCouncilHybridBase(query: string): CouncilHybridResult | null {
  const displayCards = searchCouncilDisplayCards(query);
  if (!canComposeCouncilFreeFortune(displayCards)) return null;
  const composed = composeCouncilFreeFortune(displayCards, query);
  const missingSections = hybridGroqEnabled()
    ? getGroqSupplementSections(displayCards)
    : [];
  return { composed, missingSections, contextCards: searchCouncilContextCards(query) };
}

export async function buildCouncilHybridFortune(
  query: string,
  base: CouncilHybridResult,
): Promise<{ text: string; mode: 'council-compose' | 'council-hybrid' | 'council-hybrid-pending'; cardCount: number }> {
  const { composed, missingSections, contextCards } = base;
  const baseFooter = '참고용 풀이이며 전문 상담을 대체하지 않습니다.';

  if (!missingSections.length) {
    return { text: composed.text, mode: 'council-compose', cardCount: composed.cardCount };
  }

  const sectionList = missingSections.join(', ');
  const frameHint = (contextCards ?? [])
    .filter((c) => cardKind(c) === 'foundation')
    .map((c) => c.title)
    .join(', ');

  const userBlock = [
    '【이미 제공된 인증 지식 — 반복 금지】',
    composed.text.slice(0, 5000),
    frameHint ? `(참고 프레임만: ${frameHint})` : '',
    '',
    '【원본 사주 데이터 — 아래만 근거로 보충 작성】',
    query.slice(0, 10000),
    '',
    `【작성할 섹션만】 ${sectionList}`,
    '각 섹션 제목([6] 등)을 넣고, 월별·대운 데이터가 있으면 그대로 반영하세요. 약 1200~2000자.',
  ].join('\n');

  const supplement = await fetchLlmCompletionText(
    {
      max_tokens: 2000,
      temperature: 0.65,
      messages: [
        { role: 'system', content: SUPPLEMENT_SYSTEM },
        { role: 'user', content: userBlock },
      ],
    },
    { geminiFirst: true },
  );

  if (!supplement || isOverloadText(supplement)) {
    const offline = buildOfflineHybridSupplement(query);
    const text = [
      composed.text.replace(baseFooter, '').trim(),
      '',
      '━━━ 맞춤 풀이 (사주 데이터 기반) ━━━',
      '',
      offline,
      '',
      '※ AI 서버 한도로 위는 확정 사주 데이터 기반 초안입니다. 2~3분 후 「다시 분석하기」로 AI 맞춤 보충을 시도할 수 있습니다.',
      '',
      '—',
      baseFooter,
    ].join('\n');
    return { text, mode: 'council-hybrid-pending', cardCount: composed.cardCount };
  }

  const text = [
    composed.text.replace(baseFooter, '').trim(),
    '',
    '━━━ 맞춤 보충 풀이 (인증 지식 + AI) ━━━',
    '',
    supplement,
    '',
    '—',
    '인증 카드와 사주 데이터를 바탕으로 작성되었습니다. 추가 질문은 AI 심층 상담을 이용해 주세요.',
  ].join('\n');

  return { text, mode: 'council-hybrid', cardCount: composed.cardCount };
}

export async function tryCouncilHybridFortune(
  query: string,
): Promise<{ text: string; mode: 'council-compose' | 'council-hybrid' | 'council-hybrid-pending'; cardCount: number } | null> {
  const base = tryCouncilHybridBase(query);
  if (!base) return null;
  return buildCouncilHybridFortune(query, base);
}
