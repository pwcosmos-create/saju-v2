#!/usr/bin/env bash
set -euo pipefail
cd /home/ubuntu/saju-v2

if grep -q '^GEMMA24_COUNSEL_GEMINI_ONLY=' .env 2>/dev/null; then
  sed -i 's/^GEMMA24_COUNSEL_GEMINI_ONLY=.*/GEMMA24_COUNSEL_GEMINI_ONLY=1/' .env
else
  echo 'GEMMA24_COUNSEL_GEMINI_ONLY=1' >> .env
fi
if grep -q '^GEMMA24_COUNSEL_LLM_FALLBACK=' .env 2>/dev/null; then
  sed -i 's/^GEMMA24_COUNSEL_LLM_FALLBACK=.*/GEMMA24_COUNSEL_LLM_FALLBACK=1/' .env
else
  echo 'GEMMA24_COUNSEL_LLM_FALLBACK=1' >> .env
fi

PM2_NAME="${PM2_NAME:-saju-v2}"
echo "Stopping $PM2_NAME before rebuild..."
pm2 stop "$PM2_NAME" || true
rm -rf .next
npm install
npm run build
pm2 start "$PM2_NAME" 2>/dev/null || pm2 restart "$PM2_NAME"
pm2 status "$PM2_NAME"
sleep 8
curl -sf -o /dev/null http://127.0.0.1:3001/saju
echo "OK: deployed /saju"
