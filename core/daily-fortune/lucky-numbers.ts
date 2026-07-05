/** 일간 한글 라벨 (갑목~계수) */
export const STEM_KO_LABELS = [
  '갑목', '을목', '병화', '정화', '무토', '기토', '경금', '신금', '임수', '계수',
] as const;

export const YONGSIN_ELEM_CHARS = ['목', '화', '토', '금', '수'] as const;

const ELEM_IDX: Record<string, number> = { 목: 0, 화: 1, 토: 2, 금: 3, 수: 4 };

const STEM_MICRO_SHIFT: Record<string, number> = {
  갑목: 0, 을목: 1, 병화: 2, 정화: 1, 무토: 3,
  기토: 2, 경금: 4, 신금: 1, 임수: 3, 계수: 5,
};

/** YYYY-MM-DD → KST 달력 날짜 (kst-date와 동일한 UTC noon 기준) */
export function parseKstDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((v) => Number.parseInt(v, 10));
  if (!y || !m || !d) return new Date();
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function formatKstDateLabel(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return `${y}년 ${m}월 ${d}일`;
}

/** 운세를 보는 당일(KST) + 용신·일간 기반 행운 숫자 6개 (1~45) */
export function computeDailyLuckyNumbers(
  yongsinElem: string,
  stemKo: string | null,
  viewDate: Date,
): number[] {
  const y = viewDate.getUTCFullYear();
  const m = viewDate.getUTCMonth() + 1;
  const d = viewDate.getUTCDate();
  const elemIdx = ELEM_IDX[yongsinElem] ?? 0;
  const shift = stemKo ? (STEM_MICRO_SHIFT[stemKo] ?? 0) : 0;
  let seed = y * 10000 + m * 100 + d + elemIdx * 997 + shift * 37;

  const out = new Set<number>();
  let guard = 0;
  while (out.size < 6 && guard < 120) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    out.add((seed % 45) + 1);
    guard += 1;
  }
  return [...out].sort((a, b) => a - b);
}
