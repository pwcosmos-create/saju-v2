/** AI 심층 상담 세션 — 동적 구매 시간 지원 (기본 10분) */

export const COUNSEL_SESSION_EXPIRED_MESSAGE =
  '구매하신 상담 시간이 모두 소진되었습니다. 대화를 계속하시려면 시간을 연장해 주세요.';

export function counselSessionLimitMs(purchasedMinutes = 10): number {
  return Math.max(1, purchasedMinutes) * 60_000;
}

export function counselSessionLimitSecs(purchasedMinutes = 10): number {
  return Math.floor(counselSessionLimitMs(purchasedMinutes) / 1000);
}

export function isCounselSessionExpired(sessionStartedAt: number, purchasedMinutes = 10, now = Date.now()): boolean {
  if (!Number.isFinite(sessionStartedAt) || sessionStartedAt <= 0) return false;
  return now - sessionStartedAt >= counselSessionLimitMs(purchasedMinutes);
}

export function formatCounselTimeLeft(totalSecs: number): string {
  const s = Math.max(0, totalSecs);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}
