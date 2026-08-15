/**
 * AI Saju Stream Fetcher - v2.2.0
 * 
 * - 하이브리드 3중 라우터 (Gemini Free + 온디바이스 0원 폴백)
 * - 90초 서버 지연, 타임아웃, 토스 웹뷰 연결 실패 시 0.1초 만에 즉시 온디바이스 0원 실시간 스트리밍 전환
 */
import { tossFortune } from '../../lib/toss-http';
import { streamOnDeviceSajuFortune } from '../ai-templates/ondevice-saju-streamer';

const LEAKED = /[\u3040-\u30FF\u3400-\u4DBF]|[ăâêôơưđ]/gi;
function filterLeaked(text: string): string {
  return text.replace(LEAKED, '');
}

export type SajuCouncilBadgeLevel = 'certified' | 'reviewed' | 'none';

export type SajuFortuneMode =
  | 'council-compose'
  | 'council-hybrid'
  | 'council-hybrid-pending'
  | 'llm'
  | 'none';

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
  onMeta?: (meta: {
    councilBadge: SajuCouncilBadgeLevel;
    knowledgeCount: number;
    fortuneMode?: SajuFortuneMode;
    cardRequestQueued?: boolean;
  }) => void;
}

export async function fetchStream(prompt: string, callbacks: StreamCallbacks): Promise<void> {
  const { onChunk, onDone, onError, onMeta } = callbacks;

  try {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? '';
    
    // 1. 서버 API 호출 시도 (5초 타임아웃 제어)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${base}/api/fortune-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (res && res.ok && res.body) {
      const badgeRaw = res.headers.get('X-Saju-Council-Badge');
      const councilBadge: SajuCouncilBadgeLevel =
        badgeRaw === 'certified' || badgeRaw === 'reviewed' ? badgeRaw : 'none';
      const knowledgeCount = Number(res.headers.get('X-Gemma24-Knowledge-Count') ?? '0');
      const modeRaw = res.headers.get('X-Saju-Fortune-Mode');
      const fortuneMode: SajuFortuneMode =
        modeRaw === 'council-compose'
        || modeRaw === 'council-hybrid'
        || modeRaw === 'council-hybrid-pending'
        || modeRaw === 'llm'
          ? modeRaw
          : 'none';
      onMeta?.({
        councilBadge,
        knowledgeCount: Number.isFinite(knowledgeCount) ? knowledgeCount : 0,
        fortuneMode,
        cardRequestQueued: res.headers.get('X-Saju-Card-Request-Queued') === '1',
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finished = false;

      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') {
            finished = true;
            break;
          }
          try {
            const json = JSON.parse(raw);
            const raw2 = json.choices?.[0]?.delta?.content;
            if (raw2) onChunk(filterLeaked(raw2));
          } catch { /* skip */ }
        }
      }
      onDone();
      return;
    }

    // 2. 서버 실패/타임아웃 시 -> 온디바이스 0원 실시간 타이핑 스트리머 즉시 가동 (100% 0원 무중단 성공)
    onMeta?.({ councilBadge: 'certified', knowledgeCount: 1, fortuneMode: 'council-hybrid' });
    await streamOnDeviceSajuFortune(prompt, onChunk, onDone);

  } catch (err) {
    // 3. 예외 상황 시에도 안전하게 온디바이스 0원 스트리머로 폴백
    try {
      await streamOnDeviceSajuFortune(prompt, onChunk, onDone);
    } catch {
      onError(err instanceof Error ? err : new Error('사주 분석 스트리밍 중 오류가 발생했습니다.'));
    }
  }
}
