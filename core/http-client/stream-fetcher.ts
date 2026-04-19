// 한국어 외 언어 토큰 제거 (일본어 가나, 베트남 전용 자모, CJK 확장)
const LEAKED = /[\u3040-\u30FF\u3400-\u4DBF]|[ăâêôơưđ]/gi;
function filterLeaked(text: string): string {
  return text.replace(LEAKED, '');
}

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone:  () => void;
  onError: (err: Error) => void;
}

export async function fetchStream(prompt: string, callbacks: StreamCallbacks): Promise<void> {
  const { onChunk, onDone, onError } = callbacks;

  try {
    const res = await fetch('/api/fortune-stream', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ prompt }),
    });

    if (!res.ok || !res.body) {
      onError(new Error(`서버 오류: ${res.status}`));
      return;
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      // SSE 파싱: "data: {...}\n\n"
      for (const line of chunk.split('\n')) {
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
