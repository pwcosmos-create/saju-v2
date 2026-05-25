/** Asia/Seoul 기준 달력 날짜 + N일 */
export function kstCalendarDatePlusDays(days: number): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = Number.parseInt(parts.find((p) => p.type === 'year')?.value ?? '1970', 10);
  const m = Number.parseInt(parts.find((p) => p.type === 'month')?.value ?? '1', 10);
  const d = Number.parseInt(parts.find((p) => p.type === 'day')?.value ?? '1', 10);
  return new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
}
