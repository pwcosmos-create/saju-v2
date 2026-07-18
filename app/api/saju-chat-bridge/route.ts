import { NextRequest } from 'next/server';
import { postConsult, type ConsultRequestBody } from '../../../core/api/consult-post';
import { tossBridgeHtml } from '../../../core/http-client/toss-bridge-html';

/** 토스 WebView: AI 심층 상담 — 결제 세션은 Gemini 2.5 Flash (카드 RAG 포함) */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  let body: ConsultRequestBody;
  try {
    const ct = req.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      body = await req.json();
    } else {
      const fd = await req.formData();
      const raw = fd.get('payload');
      if (!raw || typeof raw !== 'string') {
        return tossBridgeHtml({ ok: false, error: 'payload 없음' }, 400);
      }
      body = JSON.parse(raw) as ConsultRequestBody;
    }
  } catch {
    return tossBridgeHtml({ ok: false, error: '잘못된 요청 형식' }, 400);
  }

  try {
    const res = await postConsult(ip, { ...body, stream: false });
    const text = await res.text();
    let data: { content?: string; error?: string };
    try {
      data = JSON.parse(text) as { content?: string; error?: string };
    } catch {
      return tossBridgeHtml({ ok: false, error: '응답 파싱 실패' }, 502);
    }
    if (!res.ok || data.error) {
      return tossBridgeHtml({ ok: false, error: data.error ?? `오류 (${res.status})` }, res.status);
    }
    return tossBridgeHtml({ ok: true, content: data.content ?? '' });
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
