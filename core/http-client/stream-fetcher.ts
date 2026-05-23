/**
 * AI Saju Stream Fetcher - v2.0.3
 * 
 * - 클라이언트 측 스트리밍 데이터 수신 및 버퍼링
 * - Draft-Review-Type 워크플로우를 위한 전체 데이터 수집 지원
 */
// 한국어 외 언어 토큰 제거 (일본어 가나, 베트남 전용 자모, CJK 확장)
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
  onDone:  () => void;
  onError: (err: Error) => void;
  onMeta?: (meta: {
    councilBadge: SajuCouncilBadgeLevel;
    knowledgeCount: number;
    fortuneMode?: SajuFortuneMode;
  }) => void;
}

export async function fetchStream(prompt: string, callbacks: StreamCallbacks): Promise<void> {
  const { onChunk, onDone, onError, onMeta } = callbacks;

  try {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? '';
    const res = await fetch(`${base}/api/fortune-stream`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ prompt }),
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
    });

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') { onDone(); return; }
        try {
          const json = JSON.parse(raw);
          const raw2 = json.choices?.[0]?.delta?.content;
          if (raw2) onChunk(filterLeaked(raw2));
        } catch { /* skip */ }
      }
    }
    onDone();
  } catch (e) {
    onError(e instanceof Error ? e : new Error(String(e)));
  }
}
