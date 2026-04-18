import { Pillar, getPillarIdx } from './korean-calendar-engine';

export interface DaeunResult {
  pillars: Pillar[];
  startAge: number;
  forward: boolean;
}

export function calcDaeun(monthPillar: Pillar, yearStem: number, gender: string, birthYear: number): DaeunResult {
  const yang    = yearStem % 2 === 0;
  const male    = gender === '남';
  const forward = (yang && male) || (!yang && !male);

  const base = getPillarIdx(monthPillar.s, monthPillar.b);
  const pillars: Pillar[] = [];
  for (let i = 1; i <= 8; i++) {
    const off = forward ? i : -i;
    const idx = (((base + off) % 60) + 60) % 60;
    pillars.push({ s: idx % 10, b: idx % 12 });
  }
  const startAge = 3 + (birthYear % 10) % 8;
  return { pillars, startAge, forward };
}
