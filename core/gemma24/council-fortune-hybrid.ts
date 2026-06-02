/**
 * 인증 카드 조합 + Groq/Gemini 보충 (빈·짧은 섹션만)
 */
import { fetchLlmCompletionText } from '../config/llm';
import type { Gemma24SajuCard } from './saju-knowledge';
import { cardKind, searchCouncilContextCards, searchCouncilDisplayCards } from './saju-knowledge';
import { buildOfflineFortuneSection, buildOfflineHybridSupplement } from './council-fortune-enrich';
import {
  canComposeCouncilFreeFortune,
  composeCouncilFreeFortune,
  type CouncilFreeFortuneResult,
} from './council-fortune-compose';
import {
  FORTUNE_DISPLAY_ORDER,
  FORTUNE_DISPLAY_ORDER_HINT,
  formatFortuneSectionHeader,
  fortuneSectionNumberedLabel,
  humanizeDeepSectionText,
  sortFortuneSectionBlocks,
} from './fortune-display-order';
import {
  extractSectionBody,
  fortuneOutputHasDefects,
  isCardScaffoldBody,
  isLowQualityFortuneBody,
  isTruncatedFortuneLine,
  polishFortuneText,
  pruneFortuneSectionBody,
  promptHasHourPillar,
  sanitizeMixedScript,
  stripFortuneFooters,
} from './fortune-text-quality';

function splitFortuneIntro(text: string): { intro: string; body: string } {
  const m = text.match(/^([\s\S]*?)(?=^(?:\[\d+\]|\d{1,2}\.)\s)/m);
  if (m) {
    return { intro: m[1]?.trim() ?? '', body: text.slice(m[0].length) };
  }
  return { intro: '', body: text };
}

function parseFortuneSectionBlocks(text: string, query = ''): Map<string, string> {
  const blocks = new Map<string, string>();
  const parts = text
    .split(/(?=^(?:\[\d+\]|\d{1,2}\.)\s)/m)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    let id: string | null = null;
    const bracket = part.match(/^\[(\d+)\]/);
    if (bracket) {
      id = bracket[1]!;
    } else {
      const dotted = part.match(/^(\d{1,2})\.\s/);
      if (dotted) {
        const displayNum = Number.parseInt(dotted[1]!, 10);
        id = FORTUNE_DISPLAY_ORDER[displayNum - 1] ?? dotted[1]!;
      }
    }
    if (!id) continue;

    const body = part
      .replace(/^\[\d+\][^\n]*\n?/, '')
      .replace(/^\d{1,2}\.\s*[^\n]*\n?/, '')
      .trim();
    const pruned = pruneFortuneSectionBody(body, { hasHourPillar: promptHasHourPillar(query) });
    
    // 오프라인 규칙 기반 초안이 품질 검사에서 짧아서 필터링되는 문제 방지 (N자 이하 필터링 바이패스)
    const isOfflineFallback = pruned.includes('◆') && pruned.length < 200;
    if (!pruned || (!isOfflineFallback && isLowQualityFortuneBody(pruned, query))) continue;

    blocks.set(
      id,
      `${formatFortuneSectionHeader(id, fortuneSectionNumberedLabel(id))}\n\n${pruned}`,
    );
  }
  return blocks;
}

function mergeFortuneWithSupplement(
  baseText: string,
  supplementText: string,
  replaceIds: string[],
): string {
  const { intro, body: baseBody } = splitFortuneIntro(baseText);

  const baseBlocks = parseFortuneSectionBlocks(baseBody);
  const supBlocks = parseFortuneSectionBlocks(supplementText);
  const replace = new Set(replaceIds);

  for (const id of replace) baseBlocks.delete(id);
  for (const [id, block] of supBlocks) baseBlocks.set(id, block);

  const ordered = FORTUNE_DISPLAY_ORDER.map((id) => baseBlocks.get(id)).filter(Boolean);

  return [
    intro || '✦ AI 심층 풀이 — ✓ 사주위원회 인증\n\n입력하신 사주에 맞춰 인증 지식·심층 카드를 조합했습니다.',
    '',
    ...ordered,
  ].join('\n');
}

/** 병합 후 절별 품질 검사 → 부족분은 규칙 기반 초안으로 교체 */
function finalizeCouncilFortuneText(query: string, text: string): string {
  const cleaned = stripFortuneFooters(text);
  const { intro, body: baseBody } = splitFortuneIntro(cleaned);

  const blocks = parseFortuneSectionBlocks(baseBody, query);
  const merged = new Map<string, string>();

  for (const id of FORTUNE_DISPLAY_ORDER) {
    const block = blocks.get(id);
    const bodyOnly = block ? extractSectionBody(block) : '';
    const hasTruncatedLine = bodyOnly.split('\n').some((line) => isTruncatedFortuneLine(line));
    const weak =
      !block
      || (id === '1' && isCardScaffoldBody(bodyOnly))
      || (id === '10' && hasTruncatedLine)
      || isLowQualityFortuneBody(bodyOnly, query)
      || fortuneOutputHasDefects(bodyOnly);

    if (id === '9' || id === '10') {
      const offline = buildOfflineFortuneSection(query, id);
      if (offline) {
        merged.set(id, offline);
        continue;
      }
    }

    if (weak) {
      const offline = buildOfflineFortuneSection(query, id);
      if (offline) merged.set(id, offline);
      else if (block) merged.set(id, block);
      continue;
    }
    if (block) merged.set(id, block);
  }

  for (const id of FORTUNE_DISPLAY_ORDER) {
    if (!merged.has(id)) {
      const offline = buildOfflineFortuneSection(query, id);
      if (offline) merged.set(id, offline);
    }
  }

  const footer = '—\n참고용 풀이이며 전문 상담을 대체하지 않습니다.';
  const ordered = FORTUNE_DISPLAY_ORDER.map((id) => merged.get(id)).filter(Boolean);

  return polishFortuneText(
    sanitizeMixedScript(
      [
        intro || '✦ AI 심층 풀이 — ✓ 사주위원회 인증\n\n입력하신 사주에 맞춰 인증 지식·심층 카드를 조합했습니다.',
        '',
        ...ordered,
        '',
        footer,
      ].join('\n'),
    ),
  );
}

function pickSupplementText(query: string, llmText: string, neededIds: string[]): string {
  if (!llmText || fortuneOutputHasDefects(llmText)) {
    const parts = neededIds
      .map((id) => buildOfflineFortuneSection(query, id))
      .filter(Boolean) as string[];
    if (parts.length) return parts.join('\n\n');
    return filterOfflineToNeeded(buildOfflineHybridSupplement(query), neededIds);
  }
  return llmText;
}

const SUPPLEMENT_SYSTEM = `당신은 사주팔자를 쉽고 따뜻하게 풀어주는 전문가입니다.
이미 「사주위원회 인증」 지식 카드로 작성된 본문이 있습니다. 그 내용을 반복·요약하지 마세요.
지시된 번호 섹션만 추가 작성하세요. ◆ 소제목 사용. 평어체(~해요, ~네요).
전문 용어는 쉬운 말을 먼저 쓰고 괄호에 한자 병기. 출처·각주 표시 금지.
각 섹션은 반드시 [본문id] 표시번호. 주제 형식으로 시작하세요.
예: [2] 2. 사주팔자, [5] 5. 용신 기신 (반드시 대괄호 id 사용)
작성 톤: 초보자도 이해할 **쉬운 설명** + 직장·연애·돈 등 **구체 예시**로 **자세히**(◆마다 2~3문단).
금지: "에 해당하는 기운", 빈 칸, "으로만 서술", 카드 제작 지시문, 시주 미입력 가정(프롬프트에 시주가 있으면).
한국어만 사용(중국어 단어 금지). 일간·연월일시·용신·기신을 프롬프트 숫자와 맞출 것.`;

function hybridGroqEnabled(): boolean {
  return process.env.GEMMA24_HYBRID_GROQ !== '0';
}

/** 조합 결과 기준 — 카드 풀에 심층 카드가 있어도 본문이 비거나 짧으면 보충 */
export function getGroqSupplementSections(composed: CouncilFreeFortuneResult): string[] {
  return composed.needsSupplementIds.map((id) => `[${id}]`);
}

function formatSupplementSectionBrief(composed: CouncilFreeFortuneResult): string {
  return composed.needsSupplementIds
    .map((id) => {
      const filled = composed.filledSectionIds.includes(id);
      const note = filled ? '(인증 카드만 있어 짧음 — 맞춤 확장)' : '(본문 없음 — 새로 작성)';
      return `${formatFortuneSectionHeader(id)} ${note}`;
    })
    .join('\n');
}

function isOverloadText(text: string): boolean {
  return text.includes('과부하') || text.includes('한도 초과');
}

/** 보충 블록을 표시 순서로 정렬 */
function sortSupplementBlocks(text: string): string {
  const blocks = text
    .split(/(?=^\[\d+\])/m)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length <= 1) return text.trim();
  return sortFortuneSectionBlocks(blocks).join('\n\n');
}

export type CouncilHybridResult = {
  composed: CouncilFreeFortuneResult;
  missingSections: string[];
  contextCards?: Gemma24SajuCard[];
};

export function tryCouncilHybridBase(query: string): CouncilHybridResult | null {
  const displayCards = searchCouncilDisplayCards(query);
  // 카드 개수나 인증 여부와 관계없이 싱글 프롬프트 스트리밍 시 중간 잘림/타임아웃 현상을 방지하기 위해
  // 개별 섹션 쪼개기(Parallel LLM/Offline) 하이브리드 엔진을 항상 활성화합니다.
  const composed = composeCouncilFreeFortune(displayCards, query);
  const missingSections = hybridGroqEnabled() ? getGroqSupplementSections(composed) : [];
  return { composed, missingSections, contextCards: searchCouncilContextCards(query) };
}

export async function buildCouncilHybridFortune(
  query: string,
  base: CouncilHybridResult,
): Promise<{ text: string; mode: 'council-compose' | 'council-hybrid' | 'council-hybrid-pending'; cardCount: number }> {
  const { composed, missingSections, contextCards } = base;
  const baseFooter = '참고용 풀이이며 전문 상담을 대체하지 않습니다.';

  if (!missingSections.length) {
    return {
      text: finalizeCouncilFortuneText(query, composed.text),
      mode: 'council-compose',
      cardCount: composed.cardCount,
    };
  }

  const frameHint = (contextCards ?? [])
    .filter((c) => cardKind(c) === 'foundation')
    .map((c) => c.title)
    .join(', ');

  // 쪼개기(Split) 적용: 각 미채움 섹션을 개별 LLM 병렬 호출로 처리하여 잘림과 한도 초과 근본 해결
  let usedLlmCount = 0;
  const supplementTasks = composed.needsSupplementIds.map(async (id) => {
    const note = composed.filledSectionIds.includes(id)
      ? '(인증 카드만 있어 짧음 — 맞춤 확장)'
      : '(본문 없음 — 새로 작성)';
    const singleSectionBrief = `${formatFortuneSectionHeader(id)} ${note}`;

    const userBlock = [
      '【이미 제공된 인증 지식 — 반복·요약 금지】',
      composed.text.slice(0, 5000),
      frameHint ? `(참고 프레임만: ${frameHint})` : '',
      '',
      '【원본 사주 데이터 — 아래만 근거로 보충 작성】',
      query.slice(0, 10000),
      '',
      '【작성할 섹션】',
      singleSectionBrief,
      '',
      FORTUNE_DISPLAY_ORDER_HINT,
      '',
      '지정된 단 하나의 섹션만 500~750자 내외로, 쉬운 말과 일상 예시를 넣어 **자세히** 작성해 주세요. ◆ 소제목마다 2~3문단. 평어체(~해요). 월별·대운 데이터가 프롬프트에 있으면 반드시 반영.',
    ].join('\n');

    try {
      const singleSupplement = await fetchLlmCompletionText(
        {
          max_tokens: 1000,
          temperature: 0.65,
          messages: [
            { role: 'system', content: SUPPLEMENT_SYSTEM },
            { role: 'user', content: userBlock },
          ],
        },
        { geminiFirst: true },
      );

      if (singleSupplement && !isOverloadText(singleSupplement)) {
        const cleaned = humanizeDeepSectionText(singleSupplement.trim());
        const bodyOnly = cleaned.replace(/^\[\d+\][^\n]*\n?/, '').trim();
        // 개별 품질 및 결함 체크 통과 시 실시간 풀이로 적용
        if (!fortuneOutputHasDefects(cleaned) && !isLowQualityFortuneBody(bodyOnly, query)) {
          usedLlmCount++;
          return cleaned;
        }
      }
    } catch (e) {
      console.error(`[buildCouncilHybridFortune] Section ${id} LLM failed:`, e);
    }

    // 실패 혹은 결함 발견 시 안전한 규칙 기반 오프라인 초안으로 1차 백업
    return buildOfflineFortuneSection(query, id) ?? '';
  });

  const supplements = await Promise.all(supplementTasks);
  const supplementMerged = supplements.filter(Boolean).join('\n\n');

  const merged = mergeFortuneWithSupplement(
    composed.text.replace(baseFooter, '').trim(),
    supplementMerged,
    composed.needsSupplementIds,
  );

  const text = finalizeCouncilFortuneText(query, merged);
  const mode = usedLlmCount > 0 ? 'council-hybrid' : 'council-hybrid-pending';

  return { text, mode, cardCount: composed.cardCount };
}

function filterOfflineToNeeded(offline: string, neededIds: string[]): string {
  if (!neededIds.length) return offline;
  const blocks = offline
    .split(/(?=^\[\d+\])/m)
    .map((b) => b.trim())
    .filter(Boolean);
  const need = new Set(neededIds);
  const picked = blocks.filter((b) => {
    const id = b.match(/^\[(\d+)\]/)?.[1];
    return id && need.has(id);
  });
  return picked.length ? sortFortuneSectionBlocks(picked).join('\n\n') : '';
}

/** LLM 보충 없이 규칙 기반으로 6~10번 등 빈 섹션을 채움 (토스 브릿지 타임아웃 폴백) */
export function buildCouncilHybridFortuneOfflineOnly(
  query: string,
  base: CouncilHybridResult,
): { text: string; mode: 'council-hybrid-pending'; cardCount: number } {
  const { composed } = base;
  const baseFooter = '참고용 풀이이며 전문 상담을 대체하지 않습니다.';

  if (!composed.needsSupplementIds.length) {
    return {
      text: finalizeCouncilFortuneText(query, composed.text),
      mode: 'council-hybrid-pending',
      cardCount: composed.cardCount,
    };
  }

  const supplementMerged = pickSupplementText(query, '', composed.needsSupplementIds);
  const merged = mergeFortuneWithSupplement(
    composed.text.replace(baseFooter, '').trim(),
    supplementMerged,
    composed.needsSupplementIds,
  );

  return {
    text: finalizeCouncilFortuneText(query, merged),
    mode: 'council-hybrid-pending',
    cardCount: composed.cardCount,
  };
}

export async function tryCouncilHybridFortune(
  query: string,
): Promise<{ text: string; mode: 'council-compose' | 'council-hybrid' | 'council-hybrid-pending'; cardCount: number } | null> {
  const base = tryCouncilHybridBase(query);
  if (!base) return null;
  return buildCouncilHybridFortune(query, base);
}
