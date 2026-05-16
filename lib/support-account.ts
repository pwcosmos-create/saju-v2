/** 선택 후원 계좌 — `NEXT_PUBLIC_SUPPORT_*` 로 덮어쓸 수 있음 */
export const SUPPORT_BANK =
  process.env.NEXT_PUBLIC_SUPPORT_BANK_NAME ?? '토스뱅크';
export const SUPPORT_ACCOUNT_NO =
  process.env.NEXT_PUBLIC_SUPPORT_ACCOUNT_NO ?? '100091449133';
export const SUPPORT_ACCOUNT_HOLDER =
  process.env.NEXT_PUBLIC_SUPPORT_ACCOUNT_HOLDER ?? '심*인';

/** 이체 앱 붙여넣기용 — 숫자만 */
export function supportAccountDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** 화면 표시용 — 오른쪽부터 3자리씩 띄어 읽기 쉽게 */
export function formatAccountForDisplay(raw: string): string {
  const d = supportAccountDigits(raw);
  if (!d) return raw.trim();
  const chunks: string[] = [];
  let rest = d;
  while (rest.length > 3) {
    chunks.unshift(rest.slice(-3));
    rest = rest.slice(0, -3);
  }
  if (rest) chunks.unshift(rest);
  return chunks.join(' ');
}
