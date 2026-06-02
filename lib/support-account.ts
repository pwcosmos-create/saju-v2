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

/** 화면 표시용 — 12자리는 앞에서 4·4·4(예: 토스뱅크), 그 외는 오른쪽부터 3자리 묶음 */
export function formatAccountForDisplay(raw: string): string {
  const d = supportAccountDigits(raw);
  if (!d) return raw.trim();
  if (d.length === 12) {
    return `${d.slice(0, 4)} ${d.slice(4, 8)} ${d.slice(8, 12)}`;
  }
  const chunks: string[] = [];
  let rest = d;
  while (rest.length > 3) {
    chunks.unshift(rest.slice(-3));
    rest = rest.slice(0, -3);
  }
  if (rest) chunks.unshift(rest);
  return chunks.join(' ');
}

/** 복사 실패 시 alert — 읽기용(띄어쓴) + 이체용 숫자만 */
export function supportAccountManualCopyHint(rawOrDigits: string): string {
  const digits = supportAccountDigits(rawOrDigits);
  if (!digits) return '계좌번호를 불러오지 못했습니다.';
  const formatted = formatAccountForDisplay(digits);
  return `계좌번호를 길게 눌러 선택한 뒤 복사해 주세요.\n\n${formatted}\n\n이체 입력용(숫자만): ${digits}`;
}
