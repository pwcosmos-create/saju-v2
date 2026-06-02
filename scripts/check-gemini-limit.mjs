#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const envPath = process.argv[2] || '/home/ubuntu/saju-v2/.env.local';
const raw = fs.readFileSync(envPath, 'utf8');
const key = raw.match(/^GOOGLE_AI_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) {
  console.log('NO_GOOGLE_AI_API_KEY');
  process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contents: [{ parts: [{ text: '한 줄로 안녕하세요' }] }] }),
});
const text = await res.text();
console.log('STATUS', res.status);
if (res.status === 200) {
  try {
    const j = JSON.parse(text);
    const out = j.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    console.log('OK', out.slice(0, 120));
  } catch {
    console.log('OK_RAW', text.slice(0, 200));
  }
} else {
  console.log('BODY', text.slice(0, 600));
}
