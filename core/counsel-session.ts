/** AI 심층 상담 세션 — 기본 10분 (환경변수로 분 단위 조정 가능) */

export const COUNSEL_SESSION_EXPIRED_MESSAGE =
  '상담 제한 시간(10분)이 종료되었습니다. 패널을 닫았다가 다시 열면 새 세션으로 상담할 수 있습니다.';

export function counselSessionLimitMs(): number {
  const raw = (process.env.GEMMA24_COUNSEL_SESSION_MINUTES ?? '10').trim();
  const mins = Number.parseInt(raw, 10);
  if (!Number.isFinite(mins) || mins <= 0) return 10 * 60_000;
  return Math.min(mins, 120) * 60_000;
}

export function counselSessionLimitSecs(): number {
  return Math.floor(counselSessionLimitMs() / 1000);
}

export function isCounselSessionExpired(sessionStartedAt: number, now = Date.now()): boolean {
  if (!Number.isFinite(sessionStartedAt) || sessionStartedAt <= 0) return false;
  return now - sessionStartedAt >= counselSessionLimitMs();
}

export function formatCounselTimeLeft(totalSecs: number): string {
  const s = Math.max(0, totalSecs);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}
