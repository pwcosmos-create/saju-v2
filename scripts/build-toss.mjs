/**
 * 앱인토스(WebView) 정적 export용 빌드.
 * `output: "export"` 는 Route Handler(app/api)와 호환되지 않아, 빌드 직전에 app/api 를
 * 비라우트 폴더로 잠시 옮긴 뒤 복구합니다.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const apiDir = path.join(root, 'app', 'api');
const stashDir = path.join(root, 'app', '_api_stashed_for_toss_export');

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Windows에서 out/ rename EPERM 시 cp+rm 폴백 */
async function moveDir(src, dest) {
  await fs.rm(dest, { recursive: true, force: true });
  await fs.mkdir(path.dirname(dest), { recursive: true });
  try {
    await fs.rename(src, dest);
  } catch (e) {
    if (e?.code !== 'EPERM' && e?.code !== 'EXDEV') throw e;
    await fs.cp(src, dest, { recursive: true });
    await fs.rm(src, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  }
}

/** Next export 를 out/web/ 아래로 옮겨 ait 가 기대하는 out/web/index.html 구조와 맞춘다. */
async function nestExportUnderOutWeb() {
  const outRoot = path.join(root, 'out');
  const outWeb = path.join(outRoot, 'web');
  const staging = path.join(root, '.toss-out-staging');

  if (!(await exists(outRoot))) {
    throw new Error('[build-toss] out/ 폴더가 없습니다. next export 가 실패했을 수 있습니다.');
  }
  if (await exists(path.join(outWeb, 'index.html'))) {
    return;
  }
  if (await exists(outWeb)) {
    throw new Error('[build-toss] out/web 이 있지만 index.html 이 없습니다. out/ 을 정리한 뒤 다시 빌드하세요.');
  }

  await fs.rm(staging, { recursive: true, force: true });
  await moveDir(outRoot, staging);
  await fs.mkdir(outRoot, { recursive: true });
  await moveDir(staging, outWeb);
}

const SAJU_ANALYZE_BOOT = `<script>(function(){var lastRun=0;function showErr(m){var w=document.getElementById("saju-js-wait");if(w){w.textContent=m;w.style.display="block";}}function hideWait(){var w=document.getElementById("saju-js-wait");if(w)w.style.display="none";}function runAnalyze(e){var t=e.target&&e.target.closest("[data-saju-analyze]");if(!t)return;var now=Date.now();if(now-lastRun<900)return;lastRun=now;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(typeof window.__SAJU_ANALYZE__==="function"){hideWait();window.__SAJU_ANALYZE__();return;}if(typeof window.__SAJU_STANDALONE_ANALYZE__==="function"){var r=window.__SAJU_STANDALONE_ANALYZE__();if(!r.ok)showErr(r.error);else hideWait();return;}showErr("앱을 불러오는 중이에요. 잠시 후 다시 눌러주세요.");}document.addEventListener("click",runAnalyze,true);document.addEventListener("touchend",runAnalyze,true);var n=0;var iv=setInterval(function(){if(typeof window.__SAJU_ANALYZE__==="function"){hideWait();clearInterval(iv);}else if(++n>60)clearInterval(iv);},500);})();</script>`;

const TOSS_ANALYZE_SCRIPT = `<script src="toss-analyze.js"></script>`;

async function bundleTossAnalyze() {
  const r = spawnSync(
    'npx',
    [
      'esbuild',
      'lib/toss-standalone-analyze.ts',
      '--bundle',
      '--format=iife',
      '--platform=browser',
      '--outfile=public/toss-analyze.js',
      '--log-level=warning',
    ],
    { cwd: root, shell: true, stdio: 'inherit' },
  );
  if (r.status !== 0) {
    throw new Error('[build-toss] toss-analyze.js 번들 실패 (esbuild)');
  }
}

/** WebView: base 태그 + _next 경로 통일 → React 하이드레이션(정밀 분석 버튼) */
async function fixTossExportAssetPaths(outWeb) {
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const ent of entries) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) files.push(...(await walk(p)));
      else if (ent.name.endsWith('.html')) files.push(p);
    }
    return files;
  }

  const htmlFiles = await walk(outWeb);
  for (const file of htmlFiles) {
    const relDir = path.relative(outWeb, path.dirname(file));
    const depth = !relDir || relDir === '.' ? 0 : relDir.split(path.sep).length;
    const baseHref = depth === 0 ? './' : '../'.repeat(depth);

    let html = await fs.readFile(file, 'utf8');
    html = html.replace(/<base\s+[^>]*>/i, '');
    html = html.replace(/<head>/i, `<head><base href="${baseHref}">`);
    html = html.replace(/\.\.\/_next\//g, '_next/');
    html = html.replace(/\.\/_next\//g, '_next/');
    html = html.replace(/href="\.\.\/index\.html"/g, 'href="index.html"');
    html = html.replace(/data-saju-href="\.\.\/index\.html"/g, 'data-saju-href="index.html"');
    html = html.replace(/href="\/(favicon|icon|apple-icon)/g, 'href="data:,');
    html = html.replace(/href="https:\/\/cdn\.jsdelivr\.net\/[^"]+"/g, 'href="data:," disabled="disabled"');

    const isSajuPage = file.includes(`${path.sep}saju${path.sep}index.html`) || file.endsWith(`${path.sep}saju.html`) || file.endsWith('/saju.html');
    if (isSajuPage) {
      if (!html.includes('toss-analyze.js')) {
        html = html.replace(/<head>/i, `<head>${TOSS_ANALYZE_SCRIPT}`);
      }
      if (!html.includes('closest("[data-saju-analyze]")')) {
        html = html.replace(/<\/body>/i, `${SAJU_ANALYZE_BOOT}</body>`);
      }
    }

    await fs.writeFile(file, html, 'utf8');
  }

  const tossRoot = path.join(outWeb, 'toss-analyze.js');
  const tossSaju = path.join(outWeb, 'saju', 'toss-analyze.js');
  if (await exists(tossRoot)) {
    await fs.mkdir(path.join(outWeb, 'saju'), { recursive: true });
    await fs.copyFile(tossRoot, tossSaju);
  }

  console.log(`[build-toss] HTML ${htmlFiles.length}개 — base/_next/분석 버튼 부트스트랩 적용`);
}

async function main() {
  if (await exists(stashDir)) {
    if (await exists(apiDir)) {
      console.error('[build-toss] app/api 와 스태시 폴더가 동시에 있습니다. 수동으로 정리해 주세요.', stashDir);
      process.exit(1);
    }
    console.warn('[build-toss] 이전 스태시 폴더를 app/api 로 복구합니다.');
    await fs.rename(stashDir, apiDir);
  }
  if (!(await exists(apiDir))) {
    console.error('[build-toss] app/api 가 없습니다:', apiDir);
    process.exit(1);
  }

  let stashed = false;
  let exitCode = 0;
  try {
    const nextDir = path.join(root, '.next');
    await fs.rm(nextDir, { recursive: true, force: true });

    await fs.rename(apiDir, stashDir);
    stashed = true;

    await bundleTossAnalyze();

    const env = { ...process.env, TOSS_BUILD: '1' };
    const r = spawnSync('npx', ['next', 'build', '--webpack'], {
      stdio: 'inherit',
      cwd: root,
      env,
      shell: true,
    });
    exitCode = r.status ?? 1;
    if (exitCode === 0) {
      await nestExportUnderOutWeb();
      const outWeb = path.join(root, 'out', 'web');
      await fs.copyFile(
        path.join(root, 'public', 'toss-analyze.js'),
        path.join(outWeb, 'toss-analyze.js'),
      );
      await fixTossExportAssetPaths(outWeb);
    }
  } finally {
    if (stashed) {
      await fs.rename(stashDir, apiDir).catch((e) => {
        console.error('[build-toss] app/api 복구 실패 — 수동으로 폴더명을 되돌려 주세요.', e);
        exitCode = 1;
      });
    }
  }
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
