// 24절기 로컬 테이블 집계 (1900-2200) — date-fns-tz 불필요
import { SOLAR_TERMS_1900_2019 } from './solar_terms_1900_2019';
import { SOLAR_TERMS_COMPLETE }   from './solar_terms_complete';
import { SOLAR_TERMS_2031_2100 }  from './solar_terms_2031_2100';
import { SOLAR_TERMS_2101_2200 }  from './solar_terms_2101_2200';

export interface SolarTermEntry {
  year: number;
  term: string;
  datetime: string;
  timestamp: number;
  solarLongitude: number;
}

// timestamp 보정: datetime 문자열에서 올바른 UTC 재계산
function correct(t: SolarTermEntry): SolarTermEntry {
  const ts = new Date(t.datetime).getTime();
  return ts !== t.timestamp ? { ...t, timestamp: ts } : t;
}

const cache = new Map<number, SolarTermEntry[]>();

export function getSolarTermsForYear(year: number): SolarTermEntry[] {
  if (cache.has(year)) return cache.get(year)!;
  let raw: SolarTermEntry[];
  if      (year >= 1900 && year <= 2019) raw = (SOLAR_TERMS_1900_2019 as SolarTermEntry[]).filter(t => t.year === year);
  else if (year >= 2020 && year <= 2030) raw = (SOLAR_TERMS_COMPLETE  as SolarTermEntry[]).filter(t => t.year === year);
  else if (year >= 2031 && year <= 2100) raw = (SOLAR_TERMS_2031_2100 as SolarTermEntry[]).filter(t => t.year === year);
  else if (year >= 2101 && year <= 2200) raw = (SOLAR_TERMS_2101_2200 as SolarTermEntry[]).filter(t => t.year === year);
  else return [];
  const result = raw.map(correct);
  cache.set(year, result);
  return result;
}

// 황경 → 월 인덱스 (korean-calendar-engine getTerms() 포맷)
// r[1]=소한, r[2]=입춘, r[3]=경칩, ..., r[12]=대설
const LON_TO_MONTH: Record<number, number> = {
  285: 1, 315: 2, 345: 3, 15: 4, 45: 5, 75: 6,
  105: 7, 135: 8, 165: 9, 195: 10, 225: 11, 255: 12,
};

export interface TermTime { day: number; hour: number; min: number; }

export function getTermsFromTable(year: number): Record<number, TermTime> {
  const terms = getSolarTermsForYear(year);
  const result: Record<number, TermTime> = {};
  for (const t of terms) {
    const month = LON_TO_MONTH[t.solarLongitude];
    if (!month) continue;
    // KST = UTC+9: timestamp + 9h → KST date components
    const kstMs = t.timestamp + 9 * 3600_000;
    const d = new Date(kstMs);
    result[month] = {
      day:  d.getUTCDate(),
      hour: d.getUTCHours(),
      min:  d.getUTCMinutes(),
    };
  }
  return result;
}
