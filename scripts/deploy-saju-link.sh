#!/usr/bin/env bash
# saju.link — 토스 미니앱 우회 진입 (틱톡·인스타·카톡용)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_ROOT="${WEB_ROOT:-/var/www/saju.link}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/saju.link}"

sudo mkdir -p "$WEB_ROOT"
sudo cp "$ROOT/deploy/saju-link/index.html" "$WEB_ROOT/index.html"
sudo chown -R www-data:www-data "$WEB_ROOT" 2>/dev/null || sudo chown -R nginx:nginx "$WEB_ROOT" 2>/dev/null || true

sudo cp "$ROOT/deploy/saju-link/nginx-saju.link.conf" "$NGINX_SITE"
sudo ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/saju.link
sudo nginx -t
sudo systemctl reload nginx

echo "OK: http://saju.link (DNS A → $(curl -s ifconfig.me))"
