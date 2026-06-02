#!/usr/bin/env node
/**
 * Flash TTS 스모크 테스트 — Oracle/로컬 공통
 * 사용: node scripts/test-flash-tts.mjs
 * (.env.local 의 GOOGLE_AI_API_KEY 읽음)
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env.local');

function loadKey() {
  if (process.env.GOOGLE_AI_API_KEY?.trim()) return process.env.GOOGLE_AI_API_KEY.trim();
  if (!existsSync(envPath)) return '';
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = /^GOOGLE_AI_API_KEY=(.*)$/.exec(line.trim());
    if (m) return m[1].replace(/^["']|["']$/g, '').trim();
  }
  return '';
}

const MODEL = process.env.GEMINI_TTS_MODEL?.trim() || 'gemini-2.5-flash-preview-tts';
const key = loadKey();
if (!key) {
  console.error('GOOGLE_AI_API_KEY 없음 (.env.local 또는 환경변수)');
  process.exit(1);
}

const text = '안녕하세요. 사주 심층 상담 음성 테스트입니다.';
const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

console.log('model:', MODEL);
console.log('text:', text);

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
      },
    },
  }),
});

const raw = await res.text();
if (!res.ok) {
  console.error('FAIL', res.status, raw.slice(0, 800));
  process.exit(1);
}

let json;
try {
  json = JSON.parse(raw);
} catch {
  console.error('FAIL invalid JSON');
  process.exit(1);
}

const parts = json?.candidates?.[0]?.content?.parts ?? [];
const audio = parts.find((p) => p?.inlineData?.data || p?.inline_data?.data);
const b64 = audio?.inlineData?.data ?? audio?.inline_data?.data;
const mime = audio?.inlineData?.mimeType ?? audio?.inline_data?.mime_type;

if (!b64) {
  console.error('FAIL no audio in response', raw.slice(0, 400));
  process.exit(1);
}

console.log('OK audio bytes (base64 length):', b64.length);
console.log('mime:', mime ?? '(unknown)');
