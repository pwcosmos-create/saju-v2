#!/usr/bin/env bash
# Oracle VM safe deploy — never delete .next while PM2 is serving traffic.
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/saju-v2}"
PM2_NAME="${PM2_NAME:-saju-v2}"

cd "$APP_DIR"
git pull
npm ci

echo "Stopping $PM2_NAME before rebuild..."
pm2 stop "$PM2_NAME" || true
rm -rf .next
npm run build
pm2 start "$PM2_NAME" 2>/dev/null || pm2 restart "$PM2_NAME"
pm2 status "$PM2_NAME"

echo "Smoke test..."
sleep 3
curl -sf -o /dev/null http://127.0.0.1:3001/saju
echo "OK: /saju"
