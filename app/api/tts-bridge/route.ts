import { NextRequest } from 'next/server';
import { tossBridgeHtml } from '../../../core/http-client/toss-bridge-html';

type TtsReq = { text?: string; counselorName?: string; ttsContext?: string };

/** 토스 WebView: /api/tts를 hidden iframe form POST로 우회 */
export async function POST(req: NextRequest) {
  let body: TtsReq = {};
  try {
    const ct = req.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      body = (await req.json()) as TtsReq;
    } else {
      const fd = await req.formData();
      const raw = fd.get('payload');
      if (!raw || typeof raw !== 'string') {
        return tossBridgeHtml({ ok: false, error: 'payload 없음' }, 400);
      }
      body = JSON.parse(raw) as TtsReq;
    }
  } catch {
    return tossBridgeHtml({ ok: false, error: '잘못된 요청 형식' }, 400);
  }

  const text = (body.text ?? '').trim();
  if (!text) return tossBridgeHtml({ ok: false, error: 'text 없음' }, 400);

  try {
    const upstream = await fetch(new URL('/api/tts', req.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        counselorName: body.counselorName ?? '',
        ttsContext: body.ttsContext ?? 'single',
      }),
    });
    const json = await upstream.json() as { audioBase64?: string; mimeType?: string; error?: string };
    if (!upstream.ok || json.error || !json.audioBase64 || !json.mimeType) {
      return tossBridgeHtml({ ok: false, error: json.error ?? `TTS 오류 (${upstream.status})` }, upstream.status || 502);
    }
    // toss-http에서 기존 BridgePayload(content:string)로 받기 때문에 JSON 문자열로 래핑
    return tossBridgeHtml({ ok: true, content: JSON.stringify({ audioBase64: json.audioBase64, mimeType: json.mimeType }) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return tossBridgeHtml({ ok: false, error: msg }, 500);
  }
}

export function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
