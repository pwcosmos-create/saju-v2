#!/usr/bin/env node
/**
 * dev/build 전 — 로컬 개발용 cards.json 동기화 (선택)
 * 런타임은 Oracle live cards.json 만 읽음 (core/data/cards.live.json 자동 사용 안 함)
 * Oracle VM: coupax live 경로가 있으면 sync 생략
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const serverLive = '/home/ubuntu/coupax-homepage/board/data/saju_learning/cards.json';
const quiet = process.env.SYNC_CARDS_QUIET === '1';

function log(...a) {
  if (!quiet) console.log(...a);
}

if (process.env.SYNC_CARDS_SKIP === '1') {
  log('[cards] SYNC_CARDS_SKIP=1');
  process.exit(0);
}

if (fs.existsSync(serverLive)) {
  log('[cards] Using Oracle live cards:', serverLive);
  process.exit(0);
}

const syncScript = path.join(__dirname, 'sync-cards-from-server.mjs');
const r = spawnSync(process.execPath, [syncScript, '--if-stale', '--fail-soft'], {
  cwd: root,
  stdio: 'inherit',
});

process.exit(r.status ?? 0);
