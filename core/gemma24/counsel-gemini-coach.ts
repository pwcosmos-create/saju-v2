import { coachCounselDraftWithGemini } from '../config/llm';
import type { CouncilCounselReply } from './council-counsel-reply';
import { counselIntentTopicLabel } from './parse-counsel-intent';

export type CounselGeminiCoachMode = '0' | '1' | 'auto';

export function counselGeminiCoachMode(): CounselGeminiCoachMode {
  const raw = (process.env.GEMMA24_COUNSEL_GEMINI_COACH ?? 'auto').trim();
  if (raw === '1') return '1';
  if (raw === '0') return '0';
  return 'auto';
}

function hasGeminiKey(): boolean {
  return Boolean(process.env.GOOGLE_AI_API_KEY?.trim());
}

/** Gemini 코칭 적용 여부 */
export function shouldCoachCounselReply(reply: CouncilCounselReply): boolean {
  const mode = counselGeminiCoachMode();
  if (mode === '0' || !hasGeminiKey()) return false;
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

export type CoachedCounselResult = CouncilCounselReply & { geminiCoached: boolean };

/** 젬마24 답변에 Gemini 코칭(표현만) 적용 */
export async function applyCounselGeminiCoach(params: {
  reply: CouncilCounselReply;
  userMessage: string;
  counselorName?: string;
  sajuContextSnippet?: string;
}): Promise<CoachedCounselResult> {
  const { reply } = params;
  if (!shouldCoachCounselReply(reply)) {
    return { ...reply, geminiCoached: false };
  }

  const coached = await coachCounselDraftWithGemini({
    draft: reply.content,
    userMessage: params.userMessage,
    topicLabel: counselIntentTopicLabel(params.userMessage),
    counselorName: params.counselorName,
    sajuContextSnippet: params.sajuContextSnippet,
  });

  if (!coached.trim() || coached.trim() === reply.content.trim()) {
    return { ...reply, geminiCoached: false };
  }

  return {
    ...reply,
    content: coached,
    geminiCoached: true,
  };
}
