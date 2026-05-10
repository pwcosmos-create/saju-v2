import { NextRequest } from 'next/server';

/** Gemini TTS 기본값: 24kHz mono LE PCM — 브라우저 `Audio()`는 raw PCM data URL 재생을 지원하지 않아 WAV로 감싼다. */
function pcm16leMonoToWavBuffer(pcm: Buffer, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length;
  const out = Buffer.alloc(44 + dataSize);
  let o = 0;
  out.write('RIFF', o);
  o += 4;
  out.writeUInt32LE(36 + dataSize, o);
  o += 4;
  out.write('WAVE', o);
  o += 4;
  out.write('fmt ', o);
  o += 4;
  out.writeUInt32LE(16, o);
  o += 4;
  out.writeUInt16LE(1, o);
  o += 2;
  out.writeUInt16LE(numChannels, o);
  o += 2;
  out.writeUInt32LE(sampleRate, o);
  o += 4;
  out.writeUInt32LE(byteRate, o);
  o += 4;
  out.writeUInt16LE(blockAlign, o);
  o += 2;
  out.writeUInt16LE(bitsPerSample, o);
  o += 2;
  out.write('data', o);
  o += 4;
  out.writeUInt32LE(dataSize, o);
  o += 4;
  pcm.copy(out, o);
  return out;
}

function parsePcmSampleRate(mimeType: string): number | null {
  const m = /rate=(\d+)/i.exec(mimeType);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

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

    let outMime = mimeType;
    let outB64 = audioBase64;
    const isRawPcm =
      /audio\/L\d+/i.test(mimeType) ||
      (mimeType.toLowerCase().includes('pcm') && !mimeType.toLowerCase().includes('wav'));
    if (isRawPcm) {
      const rate = parsePcmSampleRate(mimeType) ?? 24000;
      try {
        const pcmBuf = Buffer.from(audioBase64, 'base64');
        const wavBuf = pcm16leMonoToWavBuffer(pcmBuf, rate);
        outB64 = wavBuf.toString('base64');
        outMime = 'audio/wav';
      } catch {
        return new Response(JSON.stringify({ error: 'TTS PCM → WAV 변환 실패' }), { status: 500 });
      }
    }

    return new Response(JSON.stringify({ audioBase64: outB64, mimeType: outMime }), {
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
