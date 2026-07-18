/** 일간 한글 라벨 (갑목~계수) */
export const STEM_KO_LABELS = [
  '갑목', '을목', '병화', '정화', '무토', '기토', '경금', '신금', '임수', '계수',
] as const;

export const YONGSIN_ELEM_CHARS = ['목', '화', '토', '금', '수'] as const;

export const ELEM_HANJA_LABELS: Record<string, string> = {
  목: '木·나무', 화: '火·불', 토: '土·흙', 금: '金·쇠', 수: '水·물',
};

export const LUCKY_NUMBERS_BY_ELEM: Record<string, {
  direction: string;
  directionDetail: string;
  bestTime: string;
  timeDetail: string;
}> = {
  목: {
    direction: '동쪽(東)',
    directionDetail: '동쪽 방향이나 동쪽 출입구가 있는 곳에서 구입하면 목 기운이 활성화됩니다',
    bestTime: '06시~09시',
    timeDetail: '하루 중 기운이 솟아오르는 새벽·아침 시간대에 목(木) 에너지가 가장 잘 살아납니다',
  },
  화: {
    direction: '남쪽(南)',
    directionDetail: '남향 매장이나 남쪽 방향으로 이동하며 구입하면 화 기운이 활성화됩니다',
    bestTime: '11시~14시',
    timeDetail: '태양이 높이 뜨는 한낮 시간대에 화(火) 기운이 가장 선명하게 작동합니다',
  },
  토: {
    direction: '중앙 또는 남서쪽(中·西南)',
    directionDetail: '중심부 위치나 남서쪽 방향의 매장에서 구입하면 토 기운이 안정적으로 받쳐줍니다',
    bestTime: '17시~20시',
    timeDetail: '하루의 흐름이 정리되는 저녁 시간대에 토(土) 기운이 균형을 잡아줍니다',
  },
  금: {
    direction: '서쪽(西)',
    directionDetail: '서쪽 방향 매장이나 서쪽을 바라보며 구입하면 금 기운이 집중력을 높여줍니다',
    bestTime: '15시~18시',
    timeDetail: '결실을 정리하는 오후 시간대에 금(金) 기운이 판단력을 또렷하게 합니다',
  },
  수: {
    direction: '북쪽(北)',
    directionDetail: '북쪽 방향 매장이나 북향 출입구로 들어가 구입하면 수 기운의 지혜가 작동합니다',
    bestTime: '21시~24시',
    timeDetail: '고요해지는 밤 시간대에 수(水) 기운이 직관과 판단을 깊게 만듭니다',
  },
};

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

export function buildDailyLuckyNumbersLines(
  yongsinElem: string | null,
  stemKo: string | null,
  viewDate: Date,
): string[] {
  const base = yongsinElem ? LUCKY_NUMBERS_BY_ELEM[yongsinElem] : null;
  if (!base) return [];

  const dateLabel = formatKstDateLabel(viewDate);
  const nums = computeDailyLuckyNumbers(yongsinElem!, stemKo, viewDate);
  const elemHanja = ELEM_HANJA_LABELS[yongsinElem ?? ''] ?? '';

  return [
    `### 🎱 ${dateLabel} 행운의 숫자`,
    `**${dateLabel}** 운세를 보는 오늘 날짜에 맞춰, 용신 **${yongsinElem}(${elemHanja})** 기운과${stemKo ? ` **${stemKo}** 일간` : ''} 에너지를 반영해 행운의 숫자를 산출했습니다.`,
    '',
    `* 🔢 **오늘의 행운 숫자 6개:** ✨ **${nums.join(' · ')}** ✨`,
    `* 🧭 **행운의 방향:** **${base.direction}** — ${base.directionDetail}`,
    `* 🕒 **구입 적기(시간):** **${base.bestTime}** — ${base.timeDetail}`,
    '',
    `> 💡 **활용 팁:** 6개를 모두 쓰기 어렵다면 앞의 3개(${nums.slice(0, 3).join('·')})를 중심으로 고르세요. **${base.bestTime}** 사이에 잠깐 눈을 감고 바라는 것을 떠올리며 선택하면 더 좋습니다.`,
  ];
}

/** AI 심층 풀이 10번 섹션용 마크다운 블록 */
export function buildDailyLuckyNumbersMarkdown(
  yongsinElem: string | null,
  stemKo: string | null,
  viewDate: Date,
): string {
  const lines = buildDailyLuckyNumbersLines(yongsinElem, stemKo, viewDate);
  if (!lines.length) return '';
  return ['', '---', '', ...lines].join('\n');
}
