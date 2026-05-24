#!/usr/bin/env node
/**
 * Oracle VM cards.json → core/data/cards.live.json
 *
 * Usage:
 *   node scripts/sync-cards-from-server.mjs           # 항상 받기
 *   node scripts/sync-cards-from-server.mjs --if-stale  # 서버가 더 최신일 때만
 *   node scripts/sync-cards-from-server.mjs --fail-soft # 실패해도 exit 0
 *
 * Env: SAJU_SSH_HOST, SAJU_SSH_KEY, SAJU_REMOTE_CARDS, SYNC_CARDS_SKIP=1
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const localPath = path.join(root, 'core/data/cards.live.json');

const args = new Set(process.argv.slice(2));
const ifStale = args.has('--if-stale');
const failSoft = args.has('--fail-soft');
const quiet = args.has('--quiet') || process.env.SYNC_CARDS_QUIET === '1';

const host = process.env.SAJU_SSH_HOST || 'ubuntu@168.107.31.153';
const keyRaw = process.env.SAJU_SSH_KEY || path.join(os.homedir(), '.ssh', 'shinserver.key');
const key = keyRaw.startsWith('~') ? path.join(os.homedir(), keyRaw.slice(1)) : keyRaw;
const remote =
  process.env.SAJU_REMOTE_CARDS
  || '/home/ubuntu/coupax-homepage/board/data/saju_learning/cards.json';

function log(...a) {
  if (!quiet) console.log(...a);
}

function bail(code, msg) {
  if (msg) (failSoft ? console.warn : console.error)(msg);
  process.exit(failSoft ? 0 : code);
}

if (process.env.SYNC_CARDS_SKIP === '1') {
  log('[cards] SYNC_CARDS_SKIP=1 — sync skipped');
  process.exit(0);
}

if (!fs.existsSync(key)) {
  bail(1, `[cards] SSH key not found: ${key} (set SAJU_SSH_KEY or run on Oracle VM)`);
}

function sshRemoteMtimeSec() {
  const cmd = `stat -c %Y '${remote.replace(/'/g, "'\\''")}'`;
  const r = spawnSync(
    'ssh',
    ['-i', key, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=no', host, cmd],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) return null;
  const n = parseInt(String(r.stdout).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

if (ifStale && fs.existsSync(localPath)) {
  const localSec = Math.floor(fs.statSync(localPath).mtimeMs / 1000);
  const remoteSec = sshRemoteMtimeSec();
  if (remoteSec != null && localSec >= remoteSec) {
    log('[cards] Already up to date (local mtime >= server)');
    process.exit(0);
  }
}

fs.mkdirSync(path.dirname(localPath), { recursive: true });

const scpArgs = ['-i', key, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'StrictHostKeyChecking=no', `${host}:${remote}`, localPath];
log('[cards] Syncing from server…');
const r = spawnSync('scp', scpArgs, { stdio: quiet ? 'pipe' : 'inherit', shell: process.platform === 'win32' });

if (r.status !== 0) {
  bail(r.status ?? 1, '[cards] scp failed — using existing cards.live.json if present');
}

const data = JSON.parse(fs.readFileSync(localPath, 'utf8'));
const cards = data.cards ?? [];
const pass = cards.filter((c) => c.council_pass === true || c.council_status === 'pass').length;
log('');
log('[cards] Synced →', localPath);
log('[cards] updated_at:', data.updated_at || data.exported_at || '(none)');
log('[cards] total:', cards.length, '| PASS (명리위원회 인증):', pass);

if (pass < cards.length) {
  console.warn(`[cards] Warning: ${cards.length - pass} cards are not PASS — council compose may skip some.`);
}
