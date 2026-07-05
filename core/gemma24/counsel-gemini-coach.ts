import { coachCounselDraftWithGemini } from '../config/llm';
import {
  autoEnqueueCouncilCardProductionBackground,
  councilCardAutoRequestEnabled,
  inferCounselFallbackNeeds,
  inferCounselReplyCardGaps,
  type CouncilCardNeed,
} from './council-card-request';
import {
  isCounselGreetingMessage,
  isCounselGreetingReply,
  type CouncilCounselReply,
} from './council-counsel-reply';
import { counselIntentTopicLabel } from './parse-counsel-intent';

/** 상담 코칭 전용 — GOOGLE_AI_API_KEY 와 분리 */
export function getCounselCoachGeminiApiKey(): string {
  return process.env.GEMINI_COUNSEL_COACH_API_KEY?.trim() ?? '';
}

export type CounselGeminiCoachMode = '0' | '1' | 'auto';

export function counselGeminiCoachMode(): CounselGeminiCoachMode {
  const raw = (process.env.GEMMA24_COUNSEL_GEMINI_COACH ?? 'auto').trim();
  if (raw === '1') return '1';
  if (raw === '0') return '0';
  return 'auto';
}

function hasCounselCoachKey(): boolean {
  return Boolean(getCounselCoachGeminiApiKey());
}

/** Gemini 코칭 적용 여부 */
export function shouldCoachCounselReply(
  reply: CouncilCounselReply,
  userMessage = '',
): boolean {
  const mode = counselGeminiCoachMode();
  if (mode === '0' || !hasCounselCoachKey()) return false;
  /** 인사·짧은 고정 답 — 카드 즉시 반환 (유료 상담 실시간 응답) */
  if (isCounselGreetingMessage(userMessage) || isCounselGreetingReply(reply.content)) {
    return false;
  }
  if (reply.cardCount === 0 && reply.draftCardCount === 0 && reply.content.trim().length <= 300) {
    return false;
  }
  if (mode === '1') return true;

  const t = reply.content.trim();
  if (!t || t.length < 60) return false;
  if (reply.draftCardCount > 0) return true;
  if (t.length < 520) return true;
  if (/일간\(日干\).{0,80}월지\(月支\)|상담 맥락에서 필요한 지식/.test(t.slice(0, 500))) {
    return true;
  }
  if ((t.match(/◆/g) ?? []).length < 2 && t.length > 200) return true;
  return false;
}

export type CoachedCounselResult = CouncilCounselReply & {
  geminiCoached: boolean;
  cardRequestQueued: number;
};

/** 코칭에 쓰인 주제·초안 카드 → PASS 인증 카드 제작 요청 */
export function inferCounselCoachCardNeeds(
  userMessage: string,
  reply: CouncilCounselReply,
): CouncilCardNeed[] {
  let gaps = inferCounselReplyCardGaps(userMessage, [], []);
  if (!gaps.length && reply.draftCardCount > 0) {
    gaps = inferCounselFallbackNeeds(userMessage);
  }
  return gaps.map((n) => ({
    ...n,
    priority: 'P0' as const,
    reason: `코칭에 활용한 주제(${n.title}) PASS 인증 카드 제작`,
  }));
}

function enqueueCounselCoachCardProduction(params: {
  userMessage: string;
  sajuContextSnippet?: string;
  counselorName?: string;
  reply: CouncilCounselReply;
}): number {
  if (!councilCardAutoRequestEnabled()) return 0;
  const needs = inferCounselCoachCardNeeds(params.userMessage, params.reply);
  if (!needs.length) return 0;
  autoEnqueueCouncilCardProductionBackground({
    needs,
    source: 'counsel',
    userMessage: params.userMessage,
    sajuContextSnippet: params.sajuContextSnippet ?? '',
    counselorName: params.counselorName,
  });
  return needs.length;
}

/** 젬마24 답변에 Gemini 코칭(표현만) 적용 */
export async function applyCounselGeminiCoach(params: {
  reply: CouncilCounselReply;
  userMessage: string;
  counselorName?: string;
  sajuContextSnippet?: string;
}): Promise<CoachedCounselResult> {
  const { reply } = params;
  const coachContext = {
    userMessage: params.userMessage,
    sajuContextSnippet: params.sajuContextSnippet,
    counselorName: params.counselorName,
    reply,
  };

  if (!shouldCoachCounselReply(reply, params.userMessage)) {
    return { ...reply, geminiCoached: false, cardRequestQueued: 0 };
  }

  const greetingOnly =
    isCounselGreetingMessage(params.userMessage)
    || isCounselGreetingReply(reply.content);

  const coached = await coachCounselDraftWithGemini(
    {
      draft: reply.content,
      userMessage: params.userMessage,
      topicLabel: greetingOnly ? '인사' : counselIntentTopicLabel(params.userMessage),
      counselorName: params.counselorName,
      sajuContextSnippet: greetingOnly ? undefined : params.sajuContextSnippet,
      mode: greetingOnly ? 'greeting' : 'standard',
    },
    getCounselCoachGeminiApiKey(),
  );

  const cardRequestQueued = greetingOnly
    ? 0
    : enqueueCounselCoachCardProduction(coachContext);

  if (!coached.trim() || coached.trim() === reply.content.trim()) {
    return { ...reply, geminiCoached: false, cardRequestQueued };
  }

  return {
    ...reply,
    content: coached,
    geminiCoached: true,
    cardRequestQueued,
  };
}
