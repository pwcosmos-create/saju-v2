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
import { buildChatContext } from './build-saju-context';

export type Msg = { role: 'user' | 'assistant'; content: string };

const API_PATH = '/api/saju-chat';
const TIMEOUT_MS = 90_000;
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
) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [counselor, setCounselor] = useState('도화');

  /**
   * msgsRef: React 상태 타이밍과 무관하게 현재 메시지 목록을 동기적으로 읽기 위한 ref.
   * setMsgs 를 호출할 때마다 함께 갱신한다.
   */
  const msgsRef = useRef<Msg[]>([]);

  /** 상태와 ref를 동시에 갱신하는 헬퍼 */
  const applyMsgs = useCallback((next: Msg[]) => {
    msgsRef.current = next;
    setMsgs(next);
  }, []);

  const reset = useCallback(() => {
    applyMsgs([]);
    setLoading(false);
  }, [applyMsgs]);

  /** 성공 시 응답 content 반환, 실패 시 null 반환 */
  const send = useCallback(async (text: string): Promise<string | null> => {
    const trimmed = text.trim();
    if (!trimmed || !result || !aiSummaryReady || loading) return null;

    // ── 1. 현재 메시지 목록을 ref에서 동기적으로 읽는다 ──
    const current = msgsRef.current;

    // ── 2. API에 보낼 히스토리를 즉시 계산 (React 상태에 의존하지 않음) ──
    const userMsg: Msg = { role: 'user', content: trimmed };
    const apiMessages = [
      ...buildApiMessages(current),
      { role: 'user', content: trimmed },
    ];

    // ── 3. UI 업데이트: 유저 버블 + 빈 어시스턴트 버블 추가 ──
    const withLoading: Msg[] = [...current, userMsg, { role: 'assistant', content: '' }];
    applyMsgs(withLoading);
    setLoading(true);

    const ac = new AbortController();
    const timeoutId = window.setTimeout(() => ac.abort(), TIMEOUT_MS);

    try {
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
          counselorName: counselor,
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
      const content = (data.content ?? '').trim();
      if (!content) throw new Error('빈 응답');

      // ── 4. 성공: 마지막 어시스턴트 버블을 응답으로 교체 ──
      const answered: Msg[] = [...msgsRef.current];
      const last = answered[answered.length - 1];
      if (last?.role === 'assistant') answered[answered.length - 1] = { role: 'assistant', content };
      applyMsgs(answered);
      return content;  // ← 호출자가 TTS에 사용
    } catch (e) {
      const isAbort = e instanceof DOMException && e.name === 'AbortError';
      const errContent = isAbort
        ? '응답 시간이 초과됐습니다. 다시 질문해 주세요.'
        : '답변을 불러오지 못했습니다. 다시 질문해 주세요.';

      // ── 5. 실패: 마지막 어시스턴트 버블을 에러 메시지로 교체 ──
      const errored: Msg[] = [...msgsRef.current];
      const last = errored[errored.length - 1];
      if (last?.role === 'assistant') errored[errored.length - 1] = { role: 'assistant', content: errContent };
      applyMsgs(errored);
      return null;
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [result, aiSummaryReady, loading, counselor, applyMsgs]);

  return { msgs, loading, counselor, setCounselor, send, reset, applyMsgs };
}
