import { getApiBase } from './api-base';

const APPS_IN_TOSS = process.env.NEXT_PUBLIC_APPS_IN_TOSS === '1';

type BridgePayload = { ok: true; content: string } | { ok: false; error: string };
type TtsBridgePayload =
  | { ok: true; audioBase64: string; mimeType: string }
  | { ok: false; error: string };

/** iframe 브릿지는 동시에 1건만 — postMessage가 섞이면 TTS/채팅이 간헐 실패 */
let bridgeQueue: Promise<unknown> = Promise.resolve();

function enqueueBridge<T>(task: () => Promise<T>): Promise<T> {
  const run = bridgeQueue.then(task, task);
  bridgeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function postViaIframeImpl(path: string, body: unknown, timeoutMs = 90_000): Promise<BridgePayload> {
  return new Promise((resolve, reject) => {
    const base = getApiBase();
    if (!base) {
      reject(new Error('API 주소가 설정되지 않았습니다.'));
      return;
    }
    const url = `${base}${path}`;
    const frameName = `saju-bridge-${Date.now()}`;
    const iframe = document.createElement('iframe');
    iframe.name = frameName;
    iframe.title = 'saju-bridge';
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none';
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    form.target = frameName;
    form.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'payload';
    input.value = JSON.stringify(body);
    form.appendChild(input);

    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      iframe.remove();
      form.remove();
    };

    let settled = false;
    const finish = (payload: BridgePayload) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(payload);
    };
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; payload?: BridgePayload };
      if (data?.type !== 'saju-bridge' || !data.payload) return;
      finish(data.payload);
    };

    const timer = window.setTimeout(() => {
      fail(new Error('서버 응답 시간이 초과되었습니다. (약 90초)'));
    }, timeoutMs);

    window.addEventListener('message', onMessage);
    document.body.appendChild(iframe);
    document.body.appendChild(form);
    form.submit();
  });
}

function postViaIframe(path: string, body: unknown, timeoutMs = 90_000): Promise<BridgePayload> {
  return enqueueBridge(() => postViaIframeImpl(path, body, timeoutMs));
}

async function postJsonFetch(path: string, body: unknown): Promise<BridgePayload> {
  const base = getApiBase();
  if (!base) throw new Error('API 주소가 설정되지 않았습니다.');
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const json = await res.json() as { content?: string; error?: string };
    if (!res.ok || json.error) {
      return { ok: false, error: json.error ?? `연결 실패 (${res.status})` };
    }
    return { ok: true, content: json.content ?? '' };
  }
  const text = await res.text();
  return { ok: false, error: text.slice(0, 200) || `연결 실패 (${res.status})` };
}

/** 토스 WebView: iframe POST (공식 커뮤니티 권장 우회). 일반 브라우저는 fetch */
export async function tossChat(body: Record<string, unknown>): Promise<BridgePayload> {
  if (APPS_IN_TOSS) {
    return postViaIframe('/api/chat-bridge', {
      ...body,
      stream: false,
      geminiFirst: true,
      geminiOnly: true,
    });
  }
  return postJsonFetch('/api/chat', body);
}

export async function tossFortune(prompt: string): Promise<BridgePayload> {
  const trimmed = prompt.slice(0, 16_000);
  if (APPS_IN_TOSS) {
    return postViaIframe('/api/fortune-bridge', { prompt: trimmed }, 90_000);
  }
  const base = getApiBase();
  if (!base) throw new Error('API 주소가 설정되지 않았습니다.');
  const res = await fetch(`${base}/api/fortune-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok || !res.body) return { ok: false, error: `서버 오류: ${res.status}` };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of dec.decode(value, { stream: true }).split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') break;
      try {
        const t = JSON.parse(raw).choices?.[0]?.delta?.content;
        if (t) full += t;
      } catch { /* skip */ }
    }
  }
  return full.trim() ? { ok: true, content: full } : { ok: false, error: '빈 응답' };
}

export async function tossTts(text: string, counselorName: string): Promise<TtsBridgePayload> {
  if (!APPS_IN_TOSS) return { ok: false, error: '브릿지 전용 경로입니다.' };
  const payload = await postViaIframe('/api/tts-bridge', { text: text.slice(0, 520), counselorName }, 45_000);
  if (!payload.ok) return payload;
  try {
    const parsed = JSON.parse(payload.content) as { audioBase64?: string; mimeType?: string };
    if (!parsed.audioBase64 || !parsed.mimeType) return { ok: false, error: '오디오 응답 파싱 실패' };
    return { ok: true, audioBase64: parsed.audioBase64, mimeType: parsed.mimeType };
  } catch {
    return { ok: false, error: '오디오 응답 파싱 실패' };
  }
}
