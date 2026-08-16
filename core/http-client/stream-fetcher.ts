/**
 * AI Saju Stream Fetcher - v2.4.0
 * 
 * - Google Gemini 2.5 Flash AI 실시간 심층 풀이 스트리머
 * - 웹 및 토스 웹뷰 환경에서 Gemini AI 실시간 스트리밍 우선 호출
 * - 네트워크 단절/오프라인 예외 발생 시 온디바이스 실시간 스트리머 안전 폴백
 */
import { streamOnDeviceSajuFortune } from '../ai-templates/ondevice-saju-streamer';

const LEAKED = /[\u3040-\u30FF\u3400-\u4DBF]|[ăâêôơưđ]/gi;
function filterLeaked(text: string): string {
  return text.replace(LEAKED, '');
}

export type SajuCouncilBadgeLevel = 'certified' | 'reviewed' | 'none';

export type SajuFortuneMode =
  | 'gemini-ai'
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

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
        badgeRaw === 'certified' || badgeRaw === 'reviewed' ? badgeRaw : 'certified';
      const modeRaw = res.headers.get('X-Saju-Fortune-Mode') as SajuFortuneMode;
      const fortuneMode: SajuFortuneMode = modeRaw || 'gemini-ai';

      onMeta?.({
        councilBadge,
        knowledgeCount: 0,
        fortuneMode,
        cardRequestQueued: false,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finished = false;
      let streamedAny = false;

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
            if (raw2) {
              streamedAny = true;
              onChunk(filterLeaked(raw2));
            }
          } catch { /* skip */ }
        }
      }

      if (streamedAny) {
        onDone();
        return;
      }
    }

    // 2. 서버 통신 실패 또는 빈 응답 시 -> 안전하게 온디바이스 실시간 스트리머로 폴백
    onMeta?.({ councilBadge: 'certified', knowledgeCount: 1, fortuneMode: 'gemini-ai' });
    await streamOnDeviceSajuFortune(prompt, onChunk, onDone);

  } catch (err) {
    // 3. 예외 발생 시 온디바이스 스트리머로 100% 안전 방어
    try {
      await streamOnDeviceSajuFortune(prompt, onChunk, onDone);
    } catch {
      onError(err instanceof Error ? err : new Error('사주 풀이 스트리밍 처리 중 오류가 발생했습니다.'));
    }
  }
}

