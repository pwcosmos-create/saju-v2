'use client';
/**
 * useCounselChat — AI 심층 상담 훅 (재구축)
 *
 * 핵심 수정: snapshotForStream 패턴 제거.
 * React 18 자동 배치로 인해 setMsgs 업데이터가 즉시 실행되지 않아
 * 스냅샷이 항상 빈 배열로 남아 API 요청이 전혀 안 가던 버그를 수정.
 * 대신 메시지 배열을 useRef로 동기적으로 관리.
 */
import { useState, useRef, useCallback } from 'react';
import type { SajuResult } from '../../core/pillar-calc/main-calculator';
import {
  COUNSEL_SESSION_EXPIRED_MESSAGE,
  isCounselSessionExpired,
} from '../../core/counsel-session';
import { buildChatContext } from './build-saju-context';
import { dailyFortune } from '../../core/daily-fortune';
import { dailyFortuneToCounselPayload } from '../../core/daily-fortune/counsel-format';
import { resolveDailyFortuneDate } from '../../core/gemma24/is-today-fortune-question';
import { buildGreetingReply, isCounselGreetingMessage } from '../../core/counsel-greeting';
import { tossSajuCounsel } from '../../lib/toss-http';

export type Msg = { role: 'user' | 'assistant'; content: string; thought?: string };

const TIMEOUT_MS = 60_000;

function isShortCounselInput(text: string): boolean {
  const t = text.trim();
  return t.length > 0 && t.length <= 24;
}
/** 인트로 말풍선은 API에 포함하지 않음 */
const INTRO_PREFIX = '안녕하세요! AI 심층 상담입니다';

function buildApiMessages(msgs: Msg[]): { role: string; content: string }[] {
  return msgs.filter(
    m => m.content.trim().length > 0 &&
      !(m.role === 'assistant' && m.content.startsWith(INTRO_PREFIX)),
  );
}

export function useCounselChat(
  result: SajuResult | null,
  aiSummaryReady: boolean,
  counselorName: string,
  sessionStartedAt: number | null,
  purchasedMinutes = 10,
) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const counselorRef = useRef(counselorName);
  counselorRef.current = counselorName;

  const msgsRef = useRef<Msg[]>([]);

  const applyMsgs = useCallback((next: Msg[]) => {
    msgsRef.current = next;
    setMsgs(next);
  }, []);

  const reset = useCallback(() => {
    applyMsgs([]);
    setLoading(false);
  }, [applyMsgs]);

  const send = useCallback(async (text: string): Promise<string | null> => {
    const trimmed = text.trim();
    if (!trimmed || !result || !aiSummaryReady || loading) return null;
    if (sessionStartedAt && isCounselSessionExpired(sessionStartedAt, purchasedMinutes)) {
      throw new Error(COUNSEL_SESSION_EXPIRED_MESSAGE);
    }

    const current = msgsRef.current;

    if (isCounselGreetingMessage(trimmed)) {
      const userMsg: Msg = { role: 'user', content: trimmed };
      const greeting = buildGreetingReply(counselorRef.current);
      applyMsgs([...current, userMsg, { role: 'assistant', content: greeting }]);
      return greeting;
    }

    const userMsg: Msg = { role: 'user', content: trimmed };
    const apiMessages = [
      ...buildApiMessages(current),
      { role: 'user', content: trimmed },
    ];

    const withLoading: Msg[] = [
      ...current,
      userMsg,
      {
        role: 'assistant',
        content: '',
        thought: isShortCounselInput(trimmed) ? undefined : '사주 분석을 시작합니다...',
      },
    ];
    applyMsgs(withLoading);
    setLoading(true);

    const ac = new AbortController();
    const timeoutId = window.setTimeout(() => ac.abort(), TIMEOUT_MS);

    try {
      const sajuContext = buildChatContext(result);
      const fortuneWhen = resolveDailyFortuneDate(trimmed);
      let dailyFortunePayload = null;
      if (fortuneWhen) {
        try {
          dailyFortunePayload = dailyFortuneToCounselPayload(dailyFortune(result, fortuneWhen));
        } catch {
          /* 일운 질문이 아니거나 계산 불가 */
        }
      }

      const payload = await tossSajuCounsel({
        messages: apiMessages,
        sajuContext,
        counselorName: counselorRef.current,
        chatMode: 'single',
        sessionStartedAt: sessionStartedAt ?? undefined,
        dailyFortune: dailyFortunePayload,
      });

      if (ac.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      if (!payload.ok) {
        throw new Error(payload.error);
      }

      const content = payload.content.trim();
      if (!content) throw new Error('빈 응답');

      const finalMsgs = [...msgsRef.current];
      const last = finalMsgs[finalMsgs.length - 1];
      if (last?.role === 'assistant') {
        finalMsgs[finalMsgs.length - 1] = { role: 'assistant', content };
      }
      applyMsgs(finalMsgs);
      return content;
    } catch (e) {
      const isAbort = e instanceof DOMException && e.name === 'AbortError';
      const msg = e instanceof Error ? e.message : '';
      const errContent = msg === COUNSEL_SESSION_EXPIRED_MESSAGE
        ? msg
        : isAbort
          ? '응답 시간이 초과되었습니다. 잠시 후 다시 질문해 주세요.'
          : msg.includes('429') || msg.includes('한도')
            ? '지금은 상담 요청이 많습니다. 잠시 후 다시 질문해 주세요.'
            : msg || '답변을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';

      const errored: Msg[] = [...msgsRef.current];
      const last = errored[errored.length - 1];
      if (last?.role === 'assistant') errored[errored.length - 1] = { role: 'assistant', content: errContent };
      applyMsgs(errored);
      return null;
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [result, aiSummaryReady, loading, applyMsgs, sessionStartedAt, purchasedMinutes]);

  return { msgs, loading, send, reset, applyMsgs };
}
