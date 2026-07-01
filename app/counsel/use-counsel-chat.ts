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
import { SAJU_WAITING_LABEL } from '../../core/user-messages';
import { buildChatContext } from './build-saju-context';
import { dailyFortune } from '../../core/daily-fortune';
import { dailyFortuneToCounselPayload } from '../../core/daily-fortune/counsel-format';
import { resolveDailyFortuneDate } from '../../core/gemma24/is-today-fortune-question';
import { tossChat } from '../../lib/toss-http';

const APPS_IN_TOSS = process.env.NEXT_PUBLIC_APPS_IN_TOSS === '1';

export type Msg = { role: 'user' | 'assistant'; content: string; thought?: string };

const API_PATH = '/api/saju-chat';
const TIMEOUT_MS = 90_000;
/** 답변 표시 전 최소 대기(ms) — 즉시 튀어나오는 느낌 완화 */
const REPLY_MIN_DELAY_MS = 1000;

function waitMinReplyDelay(startedAt: number): Promise<void> {
  const remain = REPLY_MIN_DELAY_MS - (Date.now() - startedAt);
  if (remain <= 0) return Promise.resolve();
  return new Promise((resolve) => window.setTimeout(resolve, remain));
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
    if (sessionStartedAt && isCounselSessionExpired(sessionStartedAt)) {
      throw new Error(COUNSEL_SESSION_EXPIRED_MESSAGE);
    }

    const current = msgsRef.current;
    const userMsg: Msg = { role: 'user', content: trimmed };
    const apiMessages = [
      ...buildApiMessages(current),
      { role: 'user', content: trimmed },
    ];

    const withLoading: Msg[] = [...current, userMsg, { role: 'assistant', content: '', thought: '사주 분석을 시작합니다...' }];
    applyMsgs(withLoading);
    setLoading(true);

    const ac = new AbortController();
    const timeoutId = window.setTimeout(() => ac.abort(), TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const base = process.env.NEXT_PUBLIC_API_BASE ?? '';
      const response = await fetch(`${base}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ac.signal,
        body: JSON.stringify({
          messages: apiMessages,
          sajuContext: buildChatContext(result),
          counselorName: counselorRef.current,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalContent = '';
      let lastThought = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith('data: ')) continue;
          const jsonStr = trimmedLine.slice(6);
          try {
            const data = JSON.parse(jsonStr);
            if (data.type === 'thought') {
              lastThought = data.text;
              const updated = [...msgsRef.current];
              const last = updated[updated.length - 1];
              if (last && last.role === 'assistant') {
                updated[updated.length - 1] = {
                  ...last,
                  thought: lastThought
                };
                applyMsgs(updated);
              }
            } else if (data.type === 'result') {
              finalContent += data.text;
              const updated = [...msgsRef.current];
              const last = updated[updated.length - 1];
              if (last && last.role === 'assistant') {
                updated[updated.length - 1] = {
                  ...last,
                  thought: undefined, // Clear thought once result starts arriving
                  content: finalContent
                };
                applyMsgs(updated);
              }
            }
          } catch {
            // parsing error, skip
          }
        }
      }

      await waitMinReplyDelay(startedAt);
      return finalContent.trim();
    } catch (e) {
      const isAbort = e instanceof DOMException && e.name === 'AbortError';
      const msg = e instanceof Error ? e.message : '';
      const errContent = msg === COUNSEL_SESSION_EXPIRED_MESSAGE
        ? msg
        : isAbort
          ? '응답 시간이 초과되었습니다. 잠시 후 다시 질문해 주세요.'
          : '답변을 불러오지 못했습니다. 일일 사용 한도가 초과되었을 수 있습니다.';

      const errored: Msg[] = [...msgsRef.current];
      const last = errored[errored.length - 1];
      if (last?.role === 'assistant') errored[errored.length - 1] = { role: 'assistant', content: errContent };
      applyMsgs(errored);
      return null;
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [result, aiSummaryReady, loading, applyMsgs, sessionStartedAt]);

  return { msgs, loading, send, reset, applyMsgs };
}
