import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청 형식' }), { status: 400 });
  }

  const text = (body.text ?? '').trim();
  if (!text) {
    return new Response(JSON.stringify({ error: 'text 없음' }), { status: 400 });
  }

  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: 'GOOGLE_AI_API_KEY 누락' }), { status: 500 });
  }

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        }),
      },
    );

    const raw = await upstream.text();
    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: `TTS upstream 오류: ${raw}` }), { status: 502 });
    }

    const json = JSON.parse(raw) as any;
    const inlineData = json?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
    const audioBase64 = inlineData?.data as string | undefined;
    const mimeType = inlineData?.mimeType as string | undefined;

    if (!audioBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: 'TTS 오디오 데이터 없음' }), { status: 502 });
    }

    return new Response(JSON.stringify({ audioBase64, mimeType }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: `TTS 처리 실패: ${String(e)}` }), { status: 500 });
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
