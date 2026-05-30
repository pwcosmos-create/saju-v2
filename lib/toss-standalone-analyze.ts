import { calculate, type SajuResult } from '../core/pillar-calc/main-calculator';
import { STEMS, BRANCHES } from '../core/pillar-calc/korean-calendar-engine';
import { readSajuFormFromDom, type SajuFormDom } from './toss-form-read';
import { ELEM_NAMES } from '../core/pillar-calc/korean-calendar-engine';

const THIS_YEAR = new Date().getFullYear();
const PENDING_KEY = 'saju_pending_result';
const PENDING_FORM_KEY = 'saju_pending_form';

export type StandaloneAnalyzeResult =
  | { ok: true; result: SajuResult }
  | { ok: false; error: string };

function pillarLabel(p: { s: number; b: number } | null): string {
  if (!p) return '—';
  return `${STEMS[p.s]}${BRANCHES[p.b]}`;
}

function showFormErrorDom(msg: string) {
  const wait = document.getElementById('saju-js-wait');
  if (wait) {
    wait.textContent = msg;
    wait.style.display = 'block';
    return;
  }
  let err = document.getElementById('saju-form-error-fallback');
  if (!err) {
    err = document.createElement('p');
    err.id = 'saju-form-error-fallback';
    err.style.cssText =
      'margin-top:12px;padding:10px 12px;border-radius:10px;background:rgba(224,85,85,.15);border:1px solid rgba(224,85,85,.4);color:#ff8a8a;font-size:.88rem;font-weight:600';
    document.querySelector('[data-saju-analyze]')?.parentElement?.appendChild(err);
  }
  err.textContent = msg;
}

function showFallbackPanel(result: SajuResult, error?: string) {
  let el = document.getElementById('saju-fallback-results');
  if (!el) {
    el = document.createElement('section');
    el.id = 'saju-fallback-results';
    el.style.cssText =
      'margin:24px 16px;padding:20px;border-radius:16px;background:var(--card);border:1px solid var(--border)';
    const btn = document.querySelector('[data-saju-analyze]');
    btn?.closest('.form-card')?.parentElement?.appendChild(el);
  }
  if (error) {
    el.innerHTML = `<p style="color:#ff8a8a;font-weight:600">${error}</p>`;
    return;
  }
  const [y, m, d, h] = result.pillars;
  const ohaeng = result.ohaeng.counts
    .map((c, i) => `${ELEM_NAMES[i]} ${c}`)
    .join(' · ');
  el.innerHTML = `
    <p style="font-size:.9rem;font-weight:700;color:var(--gold);margin-bottom:8px">✦ 사주팔자 정밀 분석 완료</p>
    <p style="color:var(--muted);font-size:.85rem;margin-bottom:16px">
      ${result.input.year}년 ${result.input.month}월 ${result.input.day}일 · 아래로 스크롤하면 상세 탭·AI 풀이를 볼 수 있어요.
    </p>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center;margin-bottom:14px">
      ${['년주', '월주', '일주', '시주']
        .map((label, i) => {
          const p = [y, m, d, h][i];
          return `<div style="padding:10px;border-radius:10px;background:rgba(255,255,255,.05)">
            <div style="font-size:.7rem;color:var(--muted)">${label}</div>
            <div style="font-size:1.1rem;font-weight:800;margin-top:4px">${pillarLabel(p)}</div>
          </div>`;
        })
        .join('')}
    </div>
    <p style="font-size:.82rem;color:rgba(248,246,255,.9);line-height:1.6">오행: ${ohaeng}</p>`;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function consumePendingForm(): SajuFormDom | null {
  try {
    const raw = sessionStorage.getItem(PENDING_FORM_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SajuFormDom;
  } catch {
    return null;
  }
}

export function runStandaloneAnalyze(): StandaloneAnalyzeResult {
  const form = readSajuFormFromDom();
  if (!form) {
    const err = '입력 폼을 찾을 수 없습니다.';
    showFormErrorDom(err);
    return { ok: false, error: err };
  }

  const y = parseInt(form.year, 10);
  const m = parseInt(form.month, 10);
  const d = parseInt(form.day, 10);
  if (!y || !m || !d) {
    const err = '생년월일을 모두 입력해주세요.';
    showFormErrorDom(err);
    return { ok: false, error: err };
  }
  if (y < 1900 || y > THIS_YEAR) {
    const err = `년도는 1900~${THIS_YEAR} 사이로 입력해주세요.`;
    showFormErrorDom(err);
    return { ok: false, error: err };
  }

  try {
    const result = calculate({
      year: y,
      month: m,
      day: d,
      hourTotalMin: parseInt(form.hour, 10),
      gender: form.gender,
    });
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(result));
      sessionStorage.setItem(PENDING_FORM_KEY, JSON.stringify(form));
    } catch {
      /* WebView 저장소 제한 */
    }
    showFallbackPanel(result);
    window.dispatchEvent(new CustomEvent('saju:pending-result'));
    return { ok: true, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '사주 계산 중 오류가 발생했습니다.';
    showFormErrorDom(msg);
    showFallbackPanel(null as unknown as SajuResult, msg);
    return { ok: false, error: msg };
  }
}

export function consumePendingResult(): SajuResult | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_KEY);
    return JSON.parse(raw) as SajuResult;
  } catch {
    return null;
  }
}

if (typeof window !== 'undefined') {
  (window as Window & { __SAJU_STANDALONE_ANALYZE__?: () => StandaloneAnalyzeResult }).__SAJU_STANDALONE_ANALYZE__ =
    runStandaloneAnalyze;
}
