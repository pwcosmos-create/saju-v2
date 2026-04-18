// 만세력 기반 사주 기둥 계산 엔진 — 절기는 로컬 테이블(1900-2200) 기반
import { getTermsFromTable } from '../data/solar-terms-local';

export const STEMS   = ['갑','을','병','정','무','기','경','신','임','계'] as const;
export const STEMS_H = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'] as const;
export const BRANCHES   = ['자','축','인','묘','진','사','오','미','신','유','술','해'] as const;
export const BRANCHES_H = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'] as const;
export const ZODIAC = ['쥐','소','호랑이','토끼','용','뱀','말','양','원숭이','닭','개','돼지'] as const;

// 오행 인덱스 (0=목,1=화,2=토,3=금,4=수)
export const STEM_ELEM:   number[] = [0,0,1,1,2,2,3,3,4,4];
export const BRANCH_ELEM: number[] = [4,2,0,0,2,1,1,2,3,3,2,4];
export const ELEM_NAMES   = ['목','화','토','금','수'] as const;
export const ELEM_NAMES_H = ['木','火','土','金','水'] as const;
export const ELEM_COLORS  = ['#4cbe82','#e05555','#e8a030','#9090c0','#4a9eff'] as const;

export interface Pillar { s: number; b: number; }

// 12절기 로컬 테이블 기반 조회 (1900-2200 지원)
export function getTerms(year: number): Record<number, { day: number; hour: number; min: number }> {
  return getTermsFromTable(year);
}

function getSajuMonth(year: number, m: number, d: number): number {
  const jg = getTerms(year);
  const fallback = [6, 4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7];
  const cut = jg[m] ? jg[m].day : fallback[m - 1];
  const after:  Record<number, number> = {1:12,2:1,3:2,4:3,5:4,6:5,7:6,8:7,9:8,10:9,11:10,12:11};
  const before: Record<number, number> = {1:11,2:12,3:1,4:2,5:3,6:4,7:5,8:6,9:7,10:8,11:9,12:10};
  return d >= cut ? after[m] : before[m];
}

// ─── 사주 기둥 계산 ───

export function calcYear(y: number, m: number, d: number): Pillar {
  const jg = getTerms(y);
  const ipchun = jg[2]?.day ?? 4;
  let sy = y;
  if (m < 2 || (m === 2 && d < ipchun)) sy--;
  const idx = (((sy - 4) % 60) + 60) % 60;
  return { s: idx % 10, b: idx % 12 };
}

export function calcMonth(y: number, m: number, d: number): Pillar {
  const jg = getTerms(y);
  const ipchun = jg[2]?.day ?? 4;
  let sy = y;
  if (m < 2 || (m === 2 && d < ipchun)) sy--;
  const ys = (((sy - 4) % 60) + 60) % 60 % 10;
  const sm = getSajuMonth(y, m, d);
  const starts = [2, 4, 6, 8, 0];
  const stem   = (starts[ys % 5] + (sm - 1)) % 10;
  const branch = (sm + 1) % 12;
  return { s: stem, b: branch };
}

export function calcDay(y: number, m: number, d: number): Pillar {
  const ref  = new Date(2000, 0, 1).getTime();
  const dt   = new Date(y, m - 1, d).getTime();
  const diff = Math.round((dt - ref) / 86400000);
  // 기준: 2000.1.1=무자(idx24) → 1984.1.1=갑자(idx0) ✓
  const idx = (((24 + diff) % 60) + 60) % 60;
  return { s: idx % 10, b: idx % 12 };
}

export function calcHour(totalMin: number, dayStem: number): Pillar | null {
  if (totalMin < 0) return null;
  // 자시: 00:30~02:30 / 해시: 22:30~00:30
  let bi: number;
  if (totalMin >= 1350 || totalMin < 30) bi = 11;
  else bi = Math.floor((totalMin - 30) / 120);
  const starts = [0, 2, 4, 6, 8];
  const stem = (starts[dayStem % 5] + bi) % 10;
  return { s: stem, b: bi };
}

export function getPillarIdx(s: number, b: number): number {
  for (let i = 0; i < 60; i++) if (i % 10 === s && i % 12 === b) return i;
  return 0;
}
