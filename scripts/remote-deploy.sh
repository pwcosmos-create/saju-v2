#!/usr/bin/env bash
# Oracle VM safe deploy (SCP 후 실행)
set -euo pipefail
cd /home/ubuntu/saju-v2

ENV_FILE=".env.local"
[ -f "$ENV_FILE" ] || ENV_FILE=".env"

set_env() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

set_env GEMMA24_COUNSEL_GEMINI_ONLY 1
set_env GEMMA24_COUNSEL_LLM_FALLBACK 1

if [ -f deploy/saju-link/index.html ]; then
  sudo mkdir -p /var/www/saju.link
  sudo cp deploy/saju-link/index.html /var/www/saju.link/index.html
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
curl -sf -o /dev/null http://127.0.0.1:3001/appsaju
echo "OK: /saju /appsaju"
