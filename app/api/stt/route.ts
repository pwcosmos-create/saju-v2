import { NextRequest } from 'next/server';
import { makeRateLimiter } from '../../../core/http-client/rate-limit';

/** IP당 분당 횟수 — TTS보다 낮게(비용·남용 완화) */
const checkRateLimit = makeRateLimiter(24, 60_000);
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg',
  'audio/wav',
  'audio/x-m4a',
  'audio/aac',
]);

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return Response.json({ error: '음성 인식 요청 한도 초과. 잠시 후 다시 시도해 주세요.' }, { status: 429 });
  }

  let body: { audioBase64?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: '잘못된 요청 형식' }, { status: 400 });
  }

  const audioBase64 = (body.audioBase64 ?? '').trim();
  let mimeType = (body.mimeType ?? 'audio/mp4').trim().toLowerCase();
  if (!audioBase64) {
    return Response.json({ error: 'audioBase64 없음' }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(mimeType)) {
    mimeType = mimeType.startsWith('audio/webm') ? 'audio/webm' : 'audio/mp4';
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(audioBase64, 'base64');
  } catch {
    return Response.json({ error: '오디오 데이터 형식 오류' }, { status: 400 });
  }

  if (!buf.length) {
    return Response.json({ error: '오디오 데이터 없음' }, { status: 400 });
  }
  if (buf.length > MAX_AUDIO_BYTES) {
    return Response.json({ error: '녹음이 너무 깁니다. 1분 이내로 말씀해 주세요.' }, { status: 400 });
  }

  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) {
    return Response.json({ error: 'GOOGLE_AI_API_KEY 누락' }, { status: 500 });
  }

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: audioBase64 } },
              {
                text: [
                  '이 오디오는 한국어 음성입니다.',
                  '말한 내용만 정확히 받아 적어 주세요.',
                  '설명·따옴표·접두어 없이 한국어 텍스트만 한 줄로 출력하세요.',
                  '들리지 않거나 무음이면 빈 문자열만 출력하세요.',
                ].join(' '),
              },
            ],
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
        }),
      },
    );

    const raw = await upstream.text();
    if (!upstream.ok) {
      return Response.json({ error: `STT upstream 오류: ${raw}` }, { status: 502 });
    }

    const json = JSON.parse(raw) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const transcript = (json.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();

    return Response.json({ transcript });
  } catch (e) {
    return Response.json({ error: `STT 처리 실패: ${String(e)}` }, { status: 500 });
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
