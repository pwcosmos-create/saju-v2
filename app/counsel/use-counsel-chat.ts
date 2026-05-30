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
import { SAJU_WAITING_LABEL } from '../../core/user-messages';
import { buildChatContext } from './build-saju-context';
import { dailyFortune } from '../../core/daily-fortune';
import { dailyFortuneToCounselPayload } from '../../core/daily-fortune/counsel-format';
import { resolveDailyFortuneDate } from '../../core/gemma24/is-today-fortune-question';
import { tossChat } from '../../lib/toss-http';

const APPS_IN_TOSS = process.env.NEXT_PUBLIC_APPS_IN_TOSS === '1';

export type Msg = { role: 'user' | 'assistant'; content: string };

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

    const current = msgsRef.current;
    const userMsg: Msg = { role: 'user', content: trimmed };
    const apiMessages = [
      ...buildApiMessages(current),
      { role: 'user', content: trimmed },
    ];

    const withLoading: Msg[] = [...current, userMsg, { role: 'assistant', content: '' }];
    applyMsgs(withLoading);
    setLoading(true);

    const ac = new AbortController();
    const timeoutId = window.setTimeout(() => ac.abort(), TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      let content = '';
      if (APPS_IN_TOSS) {
        const payload = {
          messages: apiMessages,
          sajuContext: buildChatContext(result),
          chatMode: 'single',
          counselorName: counselorRef.current,
          dailyFortune: (() => {
            const targetDate = resolveDailyFortuneDate(trimmed);
            if (!targetDate) return null;
            try {
              return dailyFortuneToCounselPayload(dailyFortune(result, targetDate));
            } catch {
              return null;
            }
          })(),
        };
        const bridged = await tossChat(payload);
        if (!bridged.ok) throw new Error(bridged.error);
        content = bridged.content.trim();
      } else {
        const base = process.env.NEXT_PUBLIC_API_BASE ?? '';
        const res = await fetch(`${base}${API_PATH}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          signal: ac.signal,
          body: JSON.stringify({
            messages: apiMessages,
            sajuContext: buildChatContext(result),
            chatMode: 'single',
            counselorName: counselorRef.current,
            dailyFortune: (() => {
              const targetDate = resolveDailyFortuneDate(trimmed);
              if (!targetDate) return null;
              try {
                return dailyFortuneToCounselPayload(dailyFortune(result, targetDate));
              } catch {
                return null;
              }
            })(),
          }),
        });

        const raw = await res.text();
        if (!res.ok) {
          let errMsg = `서버 오류 (${res.status})`;
          try { errMsg = (JSON.parse(raw) as { error?: string }).error ?? errMsg; } catch { /* noop */ }
          throw new Error(errMsg);
        }

        const data = JSON.parse(raw) as { content?: string; error?: string };
        if (data.error) throw new Error(data.error);
        content = (data.content ?? '').trim();
      }

      if (!content) throw new Error('빈 응답');

      await waitMinReplyDelay(startedAt);

      const answered: Msg[] = [...msgsRef.current];
      const last = answered[answered.length - 1];
      if (last?.role === 'assistant') answered[answered.length - 1] = { role: 'assistant', content };
      applyMsgs(answered);
      return content;
    } catch (e) {
      const isAbort = e instanceof DOMException && e.name === 'AbortError';
      const errContent = SAJU_WAITING_LABEL;

      const errored: Msg[] = [...msgsRef.current];
      const last = errored[errored.length - 1];
      if (last?.role === 'assistant') errored[errored.length - 1] = { role: 'assistant', content: errContent };
      applyMsgs(errored);
      return null;
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [result, aiSummaryReady, loading, applyMsgs]);

  return { msgs, loading, send, reset, applyMsgs };
}
