// 음력 로컬 테이블 집계 (1900-2200) — date-fns-tz 불필요
import { LUNAR_TABLE_1900_2019 } from './lunar_table_1900_2019';
import { LUNAR_TABLE_EXTENDED }  from './lunar_table_extended';
import { LUNAR_TABLE_2031_2100 } from './lunar_table_2031_2100';
import { LUNAR_TABLE_2101_2200 } from './lunar_table_2101_2200';

export interface LunarYearData {
  year:         number;
  leapMonth:    number;   // 0=윤달없음, 1-12=해당월
  monthDays:    number[]; // 각 월 일수 (평년12, 윤년13)
  totalDays:    number;
  solarNewYear: string;   // 음력1월1일의 양력 날짜 ISO
}

export function getLunarYearData(year: number): LunarYearData | null {
  let table: LunarYearData[];
  if      (year >= 1900 && year <= 2019) table = LUNAR_TABLE_1900_2019 as LunarYearData[];
  else if (year >= 2020 && year <= 2030) table = LUNAR_TABLE_EXTENDED  as LunarYearData[];
  else if (year >= 2031 && year <= 2100) table = LUNAR_TABLE_2031_2100 as LunarYearData[];
  else if (year >= 2101 && year <= 2200) table = LUNAR_TABLE_2101_2200 as LunarYearData[];
  else return null;
  return table.find(d => d.year === year) ?? null;
}

// 날짜를 UTC 정오 기준 ms로 변환 (일수 비교용)
function dateMs(y: number, m: number, d: number): number {
  return Date.UTC(y, m - 1, d);
}

/** 양력 → 음력 변환 */
export function solarToLunarLocal(
  year: number, month: number, day: number
): { year: number; month: number; day: number; isLeapMonth: boolean } | null {
  let yd = getLunarYearData(year);

  // 음력 1월 1일 이전이면 전년도 데이터 사용
  if (yd) {
    const [ny, nm, nd] = yd.solarNewYear.split('-').map(Number) as [number,number,number];
    if (dateMs(year, month, day) < dateMs(ny, nm, nd)) {
      yd = getLunarYearData(year - 1);
      if (!yd) return null;
      // 전년 기준으로 재계산
      const [py, pm, pd] = yd.solarNewYear.split('-').map(Number) as [number,number,number];
      const diffDays = Math.round((dateMs(year, month, day) - dateMs(py, pm, pd)) / 86_400_000);
      return resolveFromYearData(yd, diffDays, year - 1);
    }
    const [ny2, nm2, nd2] = [ny, nm, nd];
    const diffDays = Math.round((dateMs(year, month, day) - dateMs(ny2, nm2, nd2)) / 86_400_000);
    return resolveFromYearData(yd, diffDays, year);
  }
  return null;
}

function resolveFromYearData(
  yd: LunarYearData, diffDays: number, lunarYear: number
): { year: number; month: number; day: number; isLeapMonth: boolean } | null {
  let remaining = diffDays;
  for (let i = 0; i < yd.monthDays.length; i++) {
    const days = yd.monthDays[i]!;
    if (remaining < days) {
      const lunarDay = remaining + 1;
      let lunarMonth: number;
      let isLeapMonth = false;
      if (yd.leapMonth > 0) {
        if (i < yd.leapMonth)       { lunarMonth = i + 1; }
        else if (i === yd.leapMonth) { lunarMonth = yd.leapMonth; isLeapMonth = true; }
        else                         { lunarMonth = i; }
      } else {
        lunarMonth = i + 1;
      }
      return { year: lunarYear, month: lunarMonth, day: lunarDay, isLeapMonth };
    }
    remaining -= days;
  }
  return null;
}

/** 음력 → 양력 변환 */
export function lunarToSolarLocal(
  year: number, month: number, day: number, isLeapMonth = false
): { year: number; month: number; day: number } | null {
  const yd = getLunarYearData(year);
  if (!yd) return null;

  const [ny, nm, nd] = yd.solarNewYear.split('-').map(Number) as [number,number,number];
  let elapsed = 0;

  for (let m = 1; m < month; m++) {
    let idx = m - 1;
    if (yd.leapMonth > 0 && m > yd.leapMonth) idx = m;
    elapsed += yd.monthDays[idx]!;
    if (yd.leapMonth === m) elapsed += yd.monthDays[yd.leapMonth]!;
  }
  if (isLeapMonth && yd.leapMonth === month) {
    let idx = month - 1;
    if (yd.leapMonth > 0 && month > yd.leapMonth) idx = month;
    elapsed += yd.monthDays[idx]!;
  }
  elapsed += day - 1;

  const solarMs = dateMs(ny, nm, nd) + elapsed * 86_400_000;
  const d = new Date(solarMs);
  return {
    year:  d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day:   d.getUTCDate(),
  };
}
