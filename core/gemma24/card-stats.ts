/**
 * live cards.json 실시간 집계 (mtime 캐시 없음 — Agent Office add 직후 반영)
 */
import fs from 'fs';
import { resolveExistingLiveCardsPath } from './cards-path';

export type Gemma24CardKind =
  | 'stem-day'
  | 'stem-chen'
  | 'gyeok'
  | 'branch'
  | 'yongsin'
  | 'gisin'
  | 'other';

export type Gemma24CardSummary = {
  id: number;
  title: string;
  kind: Gemma24CardKind;
  councilCertified: boolean;
  councilStatus: 'pass' | 'fail' | 'none';
};

export type Gemma24CardStats = {
  collectedAt: string;
  source: string;
  fileMtime: string;
  updatedAt: string | null;
  total: number;
  confirmed: number;
  usable: number;
  certified: number;
  reviewed: number;
  excludedFail: number;
  excludedTest: number;
  byKind: Record<Gemma24CardKind, { total: number; certified: number }>;
  usableCards: Gemma24CardSummary[];
  certifiedCards: Gemma24CardSummary[];
};

type RawCard = {
  id: number;
  title?: string;
  body?: string;
  status?: string;
  council_pass?: boolean;
  council_status?: string;
};

function liveCardsPath(): string {
  return resolveExistingLiveCardsPath();
}

function isPass(c: RawCard): boolean {
  return c.council_pass === true || c.council_status === 'pass';
}

function isFail(c: RawCard): boolean {
  return c.council_pass === false || c.council_status === 'fail';
}

function isConfirmed(c: RawCard): boolean {
  return !c.status || c.status === 'confirmed';
}

function hasBody(c: RawCard): boolean {
  return typeof c.body === 'string' && c.body.trim().length > 0;
}

function isTest(c: RawCard): boolean {
  const t = (c.title || '').trim().toLowerCase();
  return t === 'test' || t.startsWith('test ');
}

export function getGemma24CardKind(title: string): Gemma24CardKind {
  const t = title.trim();
  if (t.startsWith('변수·격 ')) return 'gyeok';
  if (t.startsWith('변수·지지관계 ')) return 'branch';
  if (t.includes('변수·운 용신')) return 'yongsin';
  if (t.includes('변수·운 기신')) return 'gisin';
  if (t.includes('일주')) return 'stem-day';
  if (t.startsWith('변수·천간 ')) return 'stem-chen';
  return 'other';
}

function councilStatus(c: RawCard): 'pass' | 'fail' | 'none' {
  if (isPass(c)) return 'pass';
  if (isFail(c)) return 'fail';
  return 'none';
}

function toSummary(c: RawCard): Gemma24CardSummary {
  const title = (c.title || '').trim() || `(id ${c.id})`;
  return {
    id: c.id,
    title,
    kind: getGemma24CardKind(title),
    councilCertified: isPass(c),
    councilStatus: councilStatus(c),
  };
}

const EMPTY_BY_KIND: Gemma24CardStats['byKind'] = {
  'stem-day': { total: 0, certified: 0 },
  'stem-chen': { total: 0, certified: 0 },
  gyeok: { total: 0, certified: 0 },
  branch: { total: 0, certified: 0 },
  yongsin: { total: 0, certified: 0 },
  gisin: { total: 0, certified: 0 },
  other: { total: 0, certified: 0 },
};

/** cards.json을 매번 디스크에서 읽어 집계 */
export function collectGemma24CardStats(options?: { includeLists?: boolean }): Gemma24CardStats {
  const source = liveCardsPath();
  const includeLists = options?.includeLists !== false;

  if (!fs.existsSync(source)) {
    return {
      collectedAt: new Date().toISOString(),
      source,
      fileMtime: '',
      updatedAt: null,
      total: 0,
      confirmed: 0,
      usable: 0,
      certified: 0,
      reviewed: 0,
      excludedFail: 0,
      excludedTest: 0,
      byKind: { ...EMPTY_BY_KIND },
      usableCards: [],
      certifiedCards: [],
    };
  }

  const stat = fs.statSync(source);
  const raw = JSON.parse(fs.readFileSync(source, 'utf-8')) as {
    cards?: RawCard[];
    updated_at?: string;
    exported_at?: string;
  };
  const cards = raw.cards ?? [];

  const usableRaw = cards.filter((c) => isConfirmed(c) && hasBody(c) && !isFail(c) && !isTest(c));
  const certifiedRaw = usableRaw.filter(isPass);
  const reviewedRaw = usableRaw.filter((c) => !isPass(c));

  const byKind: Gemma24CardStats['byKind'] = {
    'stem-day': { total: 0, certified: 0 },
    'stem-chen': { total: 0, certified: 0 },
    gyeok: { total: 0, certified: 0 },
    branch: { total: 0, certified: 0 },
    yongsin: { total: 0, certified: 0 },
    gisin: { total: 0, certified: 0 },
    other: { total: 0, certified: 0 },
  };
  for (const c of usableRaw) {
    const k = getGemma24CardKind((c.title || '').trim());
    byKind[k].total += 1;
    if (isPass(c)) byKind[k].certified += 1;
  }

  const usableCards = includeLists ? usableRaw.map(toSummary).sort((a, b) => a.id - b.id) : [];
  const certifiedCards = includeLists
    ? certifiedRaw.map(toSummary).sort((a, b) => a.id - b.id)
    : [];

  return {
    collectedAt: new Date().toISOString(),
    source,
    fileMtime: stat.mtime.toISOString(),
    updatedAt: raw.updated_at ?? raw.exported_at ?? null,
    total: cards.length,
    confirmed: cards.filter(isConfirmed).length,
    usable: usableRaw.length,
    certified: certifiedRaw.length,
    reviewed: reviewedRaw.length,
    excludedFail: cards.filter(isFail).length,
    excludedTest: cards.filter(isTest).length,
    byKind,
    usableCards,
    certifiedCards,
  };
}
