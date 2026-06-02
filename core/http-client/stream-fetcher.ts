/**
 * AI Saju Stream Fetcher - v2.0.3
 */
import { tossFortune } from '../../lib/toss-http';

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
    if (process.env.NEXT_PUBLIC_APPS_IN_TOSS === '1') {
      const result = await tossFortune(prompt);
      if (!result.ok) {
        onError(new Error(result.error));
        return;
      }
      onMeta?.({ councilBadge: 'certified', knowledgeCount: 0, fortuneMode: 'council-compose' });
      onChunk(filterLeaked(result.content));
      onDone();
      return;
    }

    const base = process.env.NEXT_PUBLIC_API_BASE ?? '';
    const res = await fetch(`${base}/api/fortune-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok || !res.body) {
      onError(new Error(`서버 오류: ${res.status}`));
      return;
    }

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

    const processSseLine = (line: string): boolean => {
      if (!line.startsWith('data: ')) return false;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') {
        finished = true;
        return true;
      }
      try {
        const json = JSON.parse(raw);
        const raw2 = json.choices?.[0]?.delta?.content;
        if (raw2) onChunk(filterLeaked(raw2));
      } catch { /* skip */ }
      return false;
    };

    const drainBuffer = (final = false) => {
      const lines = buffer.split('\n');
      buffer = final ? '' : (lines.pop() ?? '');
      for (const line of lines) {
        if (processSseLine(line)) return;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        drainBuffer(false);
      }
      if (finished) break;
      if (done) {
        drainBuffer(true);
        if (buffer.trim()) processSseLine(buffer.trim());
        break;
      }
    }
    onDone();
  } catch (e) {
    onError(e instanceof Error ? e : new Error(String(e)));
  }
}
