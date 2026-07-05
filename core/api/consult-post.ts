import { fetchLlmStream } from '../config/llm';
import { tryCouncilCounselReply, type CouncilCounselReply } from '../gemma24/council-counsel-reply';
import { applyCounselGeminiCoach } from '../gemma24/counsel-gemini-coach';
import {
  buildGreetingReply,
  isCounselGreetingMessage,
  isCounselGreetingReply,
  isCounselTtsReadRequest,
} from '../counsel-greeting';
import {
  getCounselGeminiApiKey,
  isPaidCounselSession,
  shouldUseCounselLlmFallback,
  useCounselGeminiLlm,
} from '../gemma24/counsel-llm-fallback';
import {
  formatDailyFortuneCounselForLlm,
  formatDailyFortuneFactsForPaidLlm,
  buildDayFortuneCounselReply,
  type DailyFortuneCounselPayload,
} from '../daily-fortune/counsel-format';
import { tryDailyFortuneFromSajuContext } from '../daily-fortune/from-saju-context';
import { kstCalendarDatePlusDays } from '../daily-fortune/kst-date';
import { parseDayFortuneTarget, resolveDailyFortuneDate } from '../gemma24/is-today-fortune-question';
import { buildConsultCouncilKnowledgeResult } from '../gemma24/saju-knowledge';
import { SAJU_WAITING_LABEL } from '../user-messages';
import { makeRateLimiter } from '../http-client/rate-limit';
import { COUNSELOR_ALLOWLIST } from '../counselor-config';
import {
  COUNSEL_SESSION_EXPIRED_MESSAGE,
  isCounselSessionExpired,
} from '../counsel-session';

function llmCounselFallbackEnabled(sessionStartedAt: number | null): boolean {
  return shouldUseCounselLlmFallback(sessionStartedAt);
}

const checkConsultRateLimit = makeRateLimiter(20, 60_000);

function isInstantCounselReply(userMessage: string, reply: CouncilCounselReply): boolean {
  if (isCounselGreetingMessage(userMessage) || isCounselGreetingReply(reply.content)) return true;
  return reply.cardCount === 0 && reply.draftCardCount === 0 && reply.content.trim().length <= 300;
}

function counselJsonHeaders(reply: CouncilCounselReply, extra?: Record<string, string>): Record<string, string> {
  return {
    'X-Gemma24-Knowledge-Count': String(reply.cardCount),
    'X-Saju-Council-Badge': reply.draftCardCount > 0 ? 'reviewed' : 'certified',
    'X-Saju-Counsel-Mode': reply.mode,
    ...(reply.draftCardCount > 0 ? { 'X-Saju-Card-Draft-Count': String(reply.draftCardCount) } : {}),
    ...(reply.draftCardCount > 0 ? { 'X-Saju-Card-Request-Queued': '1' } : {}),
    ...extra,
  };
}

function extractCompletionText(json: unknown): string {
  const j = json as {
    content?: string;
    choices?: Array<{
      message?: { content?: string | Array<{ type?: string; text?: string }> };
    }>;
    error?: { message?: string };
  };
  if (j.error?.message) return '';
  if (typeof j.content === 'string' && j.content.trim()) return j.content;
  const raw = j.choices?.[0]?.message?.content ?? '';
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return raw.map((p) => (typeof p === 'string' ? p : p?.text ?? '')).join('');
  }
  return '';
}

export type ConsultRequestBody = {
  messages?: { role: string; content: string }[];
  sajuContext?: string;
  compareSajuContext?: string;
  chatMode?: 'single' | 'compatibility';
  counselorName?: string;
  stream?: boolean;
  dailyFortune?: DailyFortuneCounselPayload | null;
  /** 상담 패널 열린 시각(ms) — 10분 세션 검증 */
  sessionStartedAt?: number;
  /** @internal 서버에서 상담 LLM을 Gemini 우선/전용 쓸 때 설정 */
  geminiFirst?: boolean;
  geminiOnly?: boolean;
};

export async function postConsult(
  ip: string,
  body: ConsultRequestBody,
): Promise<Response> {
  if (!checkConsultRateLimit(ip)) {
    return new Response(JSON.stringify({ error: '요청 한도 초과. 1분 후 다시 시도해주세요.' }), { status: 429 });
  }

  const { messages = [], sajuContext = '', compareSajuContext = '', chatMode = 'single' } = body;
  const counselorRaw = typeof body.counselorName === 'string' ? body.counselorName.trim() : '';
  const counselorName = COUNSELOR_ALLOWLIST.has(counselorRaw) ? counselorRaw : '';
  const chatMessages = messages.filter(
    (m) => typeof m.content === 'string' && m.content.trim().length > 0,
  );
  if (!chatMessages.length) {
    return new Response(JSON.stringify({ error: 'messages 없음' }), { status: 400 });
  }

  const sessionStartedAt =
    typeof body.sessionStartedAt === 'number' && Number.isFinite(body.sessionStartedAt)
      ? body.sessionStartedAt
      : null;
  if (sessionStartedAt && isCounselSessionExpired(sessionStartedAt)) {
    return new Response(JSON.stringify({ error: COUNSEL_SESSION_EXPIRED_MESSAGE }), { status: 403 });
  }

  const counselorPersona = counselorName
    ? `【배정 상담사 — 세션 고정】
- 이번 상담 세션이 끝날 때까지 당신은 이름이 「${counselorName}」인 AI 심층 사주 상담사입니다.
- 모든 해설과 답변을 이 상담사의 시각·말투로 일관되게 전달하세요.
- 다른 이름의 상담사를 소개하거나 역할을 바꾸지 마세요.
- 매 답변마다 이름을 반복해 밝히지 마세요. 필요할 때만 자연스럽게 언급하세요.
`
    : '';

  const modeGuide = chatMode === 'compatibility'
    ? `【비교 상담 모드 규칙】
- 두 사람의 사주 데이터를 비교해 궁합/관계 중심으로 답변하세요.
- 반드시 "강점 3가지 / 주의점 3가지 / 실천 팁 3가지"를 포함하세요.
- 단정적인 파국/운명 표현은 피하고, 선택 가능한 행동 조언으로 마무리하세요.

【비교 대상 데이터】
${compareSajuContext}
`
    : '';

  // 서버 사이드에서 한국 시간(KST) 기준 날짜 생성
  const now = new Date();
  const kstFormatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: 'long', day: 'numeric',
    weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const todayStr = kstFormatter.format(now); // 예: 2026년 5월 17일 일요일 21:52

  const lastUserMessage = [...chatMessages].reverse().find((m) => m.role === 'user')?.content?.trim() ?? '';

  if (isCounselGreetingMessage(lastUserMessage)) {
    const greetingContent = buildGreetingReply(counselorName);
    return Response.json(
      { content: greetingContent },
      {
        headers: {
          'X-Gemma24-Knowledge-Count': '0',
          'X-Saju-Council-Badge': 'certified',
          'X-Saju-Counsel-Mode': 'council-counsel',
        },
      },
    );
  }

  if (isCounselTtsReadRequest(lastUserMessage)) {
    return Response.json(
      {
        content: '방금 답변은 상담창의 「읽기」 버튼을 누르시면 음성으로 들으실 수 있어요.',
      },
      {
        headers: {
          'X-Gemma24-Knowledge-Count': '0',
          'X-Saju-Council-Badge': 'certified',
          'X-Saju-Counsel-Mode': 'council-counsel',
        },
      },
    );
  }

  const dailyFortune =
    body.dailyFortune && typeof body.dailyFortune === 'object' && body.dailyFortune.date
      ? body.dailyFortune
      : null;

  const paidCounsel = isPaidCounselSession(sessionStartedAt);

  const dayTarget = parseDayFortuneTarget(lastUserMessage);
  if (dayTarget && !paidCounsel) {
    const fortuneWhen = dayTarget.kind === 'date' ? dayTarget.date : dayTarget.offset;
    const fortunePayload =
      dailyFortune
      ?? tryDailyFortuneFromSajuContext(sajuContext, fortuneWhen);
    if (fortunePayload) {
      const content = buildDayFortuneCounselReply(
        fortunePayload,
        counselorName,
        dayTarget.label,
      );
      return Response.json(
        { content },
        {
          headers: counselJsonHeaders({
            content,
            cardCount: 0,
            draftCardCount: 0,
            mode: 'council-counsel',
          }),
        },
      );
    }
  }

  const compareCtx = chatMode === 'compatibility' ? compareSajuContext : '';

  const geminiOnlyCounsel = useCounselGeminiLlm(sessionStartedAt);

  if (!geminiOnlyCounsel) {
    const cardReply = await tryCouncilCounselReply(sajuContext, lastUserMessage, {
      compareSajuContext: compareCtx,
      counselorName,
      chatMode,
      dailyFortune,
    });

    if (cardReply) {
      if (isInstantCounselReply(lastUserMessage, cardReply)) {
        return Response.json(
          { content: cardReply.content },
          { headers: counselJsonHeaders(cardReply) },
        );
      }
      const finalReply = await applyCounselGeminiCoach({
        reply: cardReply,
        userMessage: lastUserMessage,
        counselorName,
        sajuContextSnippet: sajuContext.slice(0, 1200),
      });
      return Response.json(
        { content: finalReply.content },
        {
          headers: {
            'X-Gemma24-Knowledge-Count': String(finalReply.cardCount),
            'X-Saju-Council-Badge': finalReply.draftCardCount > 0 ? 'reviewed' : 'certified',
            'X-Saju-Counsel-Mode': finalReply.mode,
            ...(finalReply.geminiCoached ? { 'X-Saju-Counsel-Coached': '1' } : {}),
            ...(finalReply.draftCardCount > 0 ? {
              'X-Saju-Card-Draft-Count': String(finalReply.draftCardCount),
            } : {}),
            ...(finalReply.cardRequestQueued > 0 || finalReply.draftCardCount > 0
              ? { 'X-Saju-Card-Request-Queued': '1' }
              : {}),
          },
        },
      );
    }

  }

  if (!llmCounselFallbackEnabled(sessionStartedAt)) {
    const missingKey = useCounselGeminiLlm(sessionStartedAt) && !getCounselGeminiApiKey();
    return Response.json(
      {
        content: missingKey
          ? '상담 AI(Gemini) 키가 설정되지 않았습니다. 잠시 후 다시 시도해 주세요.'
          : SAJU_WAITING_LABEL,
      },
      {
        headers: {
          'X-Gemma24-Knowledge-Count': '0',
          'X-Saju-Council-Badge': 'reviewed',
          'X-Saju-Counsel-Mode': 'council-counsel-pending',
        },
      },
    );
  }

  const cardKnowledge = paidCounsel
    ? { systemAppend: '', badge: 'none' as const, cardCount: 0 }
    : buildConsultCouncilKnowledgeResult(
      sajuContext,
      lastUserMessage,
      chatMode === 'compatibility' ? compareSajuContext : '',
    );

  let dailyFortuneBlock = '';
  if (geminiOnlyCounsel) {
    const fortuneWhen = dayTarget
      ? (dayTarget.kind === 'date' ? dayTarget.date : kstCalendarDatePlusDays(dayTarget.offset))
      : resolveDailyFortuneDate(lastUserMessage);
    const fortunePayload =
      dailyFortune
      ?? (fortuneWhen ? tryDailyFortuneFromSajuContext(sajuContext, fortuneWhen) : null);
    if (fortunePayload) {
      dailyFortuneBlock = paidCounsel && dayTarget
        ? `\n${formatDailyFortuneFactsForPaidLlm(fortunePayload, dayTarget.label)}\n`
        : `\n${formatDailyFortuneCounselForLlm(fortunePayload)}\n`;
    }
  }

  const dayFortuneGuide = paidCounsel && dayTarget
    ? `【유료 실시간 일운 상담 — 필수】
- 사주 카드·정해진 템플릿·저장된 해석 문구를 쓰지 마세요. 아래 실시간 일운 계산과 명식만으로 **지금 대화하듯** 답하세요.
- 사용자 질문 주제: 「${dayTarget.label}」 — **이 날짜의 일운**만 다루세요. 올해·대운 전체 풀이로 새지 마세요.
- 일진·십신·행동 조언·주의할 점을 상담사 말투로 4~8문장 이상 풀어 쓰고, 반드시 완결된 문장으로 끝내세요.

`
    : '';

  const counselModeHeader = paidCounsel ? 'counsel-gemini' : 'gemini';

  const system = `【오늘 날짜 및 시간】
- 현재 날짜·시각(KST): ${todayStr}
- 이 날짜를 기준으로 오늘의 운세, 올해 운, 현재 시기의 흐름을 답변하세요.
- 사용자가 "오늘", "요즘", "지금", "이번 달", "올해" 등을 언급할 때 반드시 이 날짜를 기준으로 하세요.

【상담 원칙】
- **오직 사주 명리학 및 운세와 관련된 질문에만 답변하세요. 절대 다른 주제에 대답하지 마세요.**
- 사용자가 정치, 경제, 사회 이슈, 프로그래밍, 수학, 일상 생활의 단순 조언 등 사주와 무관한 질문을 하거나, 교묘하게 다른 주제를 사주와 엮어서 물어볼 경우 **무조건 단호하게 거절**하세요.
- 거절할 때는 "저는 사주 명리 상담을 위한 AI입니다. 사주나 운세에 관한 질문을 해주시면 정성껏 답변해 드리겠습니다."라고만 정중히 안내하세요.
- **인사**(안녕하세요, 반갑습니다, 하이, dkssud, hello 등)에는 거절하지 말고, 상담사로서 따뜻하게 짧게 맞이한 뒤 이어서 사주·오늘의 기운·궁금한 운세를 편하게 물어보도록 자연스럽게 유도하세요.
- 사용자의 사주 데이터를 바탕으로 분석하여 답변하세요.

${counselorPersona}
말하는 방식:
- 강의하듯 설명하지 말고, 조용히 대화하듯 건네세요
- 단정 짓기보다 "~할 수 있어요", "~인 경향이 있어요" 처럼 여지를 남기세요
- 어려운 용어는 쉬운 말로 먼저 풀어주고, 필요할 때만 한글 뒤에 한자를 병기하세요
- 가벼운 확인·짧은 꼬리 질문에는 3~6문장 정도로 핵심만 말해도 됩니다.
- 사용자가 **운세·풀이를 길게 요청**하면 충분히 길게 쓰되, 소제목 또는 단락을 나누어 품 있는 분량으로 마무리하세요.
- 따뜻하고 세련된 어투로, 듣는 사람이 위로받는 느낌이 들게 해주세요
- 답변은 반드시 완성된 문장으로 끝내고, 문장 중간에서 끊기지 않게 마무리하세요

사용자가 한국어로 질문하면 한국어로, 다른 언어로 질문하면 그 언어로 답변하세요. 단, 사주 용어는 한국 명리학 용어를 기준으로 유지하세요.

${dayFortuneGuide}${modeGuide}
${cardKnowledge.systemAppend ? `\n${cardKnowledge.systemAppend}\n` : ''}${dailyFortuneBlock}【사주 데이터】
${sajuContext}`;


  const llmMessages = [
    { role: 'system', content: system },
    ...chatMessages.slice(-10),
  ];
  const streamRequested = body.stream !== false;
  const isDayFortuneAsk = Boolean(dayTarget);
  const counselShortInput = lastUserMessage.length <= 40 && !isDayFortuneAsk;

  const upstream = await fetchLlmStream({
    stream: streamRequested,
    max_tokens: counselShortInput ? 720 : isDayFortuneAsk ? 2048 : 8192,
    temperature: 0.7,
    messages: llmMessages,
    /** 심층 상담 — Gemini 2.5 Flash 전용 (Groq/Llama 폴백 없음) */
    geminiFirst: true,
    geminiOnly: true,
    counselSession: Boolean(sessionStartedAt),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return new Response(JSON.stringify({ error: `오류: ${err}` }), { status: 502 });
  }

  if (!streamRequested) {
    try {
      const json = await upstream.json();
      const content = extractCompletionText(json);
      if (!content.trim()) {
        return new Response(JSON.stringify({ error: '빈 응답' }), { status: 502 });
      }
      return Response.json({ content }, {
        headers: {
          'X-Gemma24-Knowledge-Count': String(cardKnowledge.cardCount),
          'X-Saju-Council-Badge': cardKnowledge.badge,
          'X-Saju-Counsel-Mode': counselModeHeader,
        },
      });
    } catch {
      return new Response(JSON.stringify({ error: '응답 파싱 실패' }), { status: 502 });
    }
  }

  if (!upstream.body) {
    return new Response(JSON.stringify({ error: '스트림 본문 없음' }), { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
      'X-Gemma24-Knowledge-Count': String(cardKnowledge.cardCount),
      'X-Saju-Council-Badge': cardKnowledge.badge,
      'X-Saju-Counsel-Mode': counselModeHeader,
    },
  });
}
