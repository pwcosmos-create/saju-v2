import type { ElemIdx } from './types';

// ── 오행 관계
export const GENERATES: ElemIdx[] = [1, 2, 3, 4, 0]; // 목→화→토→금→수→목
export const CONTROLS:  ElemIdx[] = [2, 3, 4, 0, 1]; // 목극토…
// 극을 받는 쪽: CONTROLLED_BY[i] = i를 극하는 오행
export const CONTROLLED_BY: ElemIdx[] = [3, 4, 0, 1, 2];
// 생을 받는 쪽의 역: GEN_INV[i] = i를 생하는 오행
export const GEN_INV: ElemIdx[] = [4, 0, 1, 2, 3];

// ── 지장간 (본기 항상 존재, 중기·여기 선택)
// 인덱스 = 지지 인덱스 (0=자…11=해)
export const JIJANG_DETAIL: { bongi: number; junggi?: number; yeogi?: number }[] = [
  { bongi: 9 },                       // 0: 자  (癸)
  { bongi: 5, junggi: 7, yeogi: 9 }, // 1: 축  (己辛癸)
  { bongi: 0, junggi: 2, yeogi: 4 }, // 2: 인  (甲丙戊)
  { bongi: 1 },                       // 3: 묘  (乙)
  { bongi: 4, junggi: 9, yeogi: 1 }, // 4: 진  (戊癸乙)
  { bongi: 2, junggi: 6, yeogi: 4 }, // 5: 사  (丙庚戊)
  { bongi: 3, junggi: 5, yeogi: 2 }, // 6: 오  (丁己丙)
  { bongi: 5, junggi: 1, yeogi: 3 }, // 7: 미  (己乙丁)
  { bongi: 6, junggi: 8, yeogi: 4 }, // 8: 신  (庚壬戊)
  { bongi: 7 },                       // 9: 유  (辛)
  { bongi: 4, junggi: 3, yeogi: 7 }, // 10: 술 (戊丁辛)
  { bongi: 8, junggi: 0, yeogi: 4 }, // 11: 해 (壬甲戊)
];

// ── 용신 룩업 (10간 × 신약/신강)
interface YEntry { primary: ElemIdx[]; secondary: ElemIdx[]; adjust?: ElemIdx; }
export const YONGSIN_TABLE: Record<number, Record<'신약'|'신강', YEntry>> = {
  0: { 신약: { primary:[4],   secondary:[0],   adjust:1 }, 신강: { primary:[1,2], secondary:[3] } }, // 갑
  1: { 신약: { primary:[4],   secondary:[0],   adjust:1 }, 신강: { primary:[1,2], secondary:[3] } }, // 을
  2: { 신약: { primary:[0],   secondary:[1],   adjust:2 }, 신강: { primary:[2,3], secondary:[4] } }, // 병
  3: { 신약: { primary:[0],   secondary:[1],   adjust:2 }, 신강: { primary:[2,3], secondary:[4] } }, // 정
  4: { 신약: { primary:[1],   secondary:[2]            }, 신강: { primary:[3,4], secondary:[0] } }, // 무
  5: { 신약: { primary:[1],   secondary:[2]            }, 신강: { primary:[3,4], secondary:[0] } }, // 기
  6: { 신약: { primary:[2],   secondary:[3],   adjust:4 }, 신강: { primary:[4,0], secondary:[1] } }, // 경
  7: { 신약: { primary:[2],   secondary:[3],   adjust:4 }, 신강: { primary:[4,0], secondary:[1] } }, // 신
  8: { 신약: { primary:[3],   secondary:[4]            }, 신강: { primary:[0,1], secondary:[2] } }, // 임
  9: { 신약: { primary:[3],   secondary:[4]            }, 신강: { primary:[0,1], secondary:[2] } }, // 계
};

// ── 형충회합

function pairKey(a: number, b: number): string {
  return `${Math.min(a, b)}_${Math.max(a, b)}`;
}

const CHUNG_SET = new Set([
  pairKey(0, 6), pairKey(1, 7), pairKey(2, 8),
  pairKey(3, 9), pairKey(4, 10), pairKey(5, 11),
]);
export function isChung(a: number, b: number): boolean {
  return CHUNG_SET.has(pairKey(a, b));
}

const HAP6_MAP = new Map<string, ElemIdx>([
  [pairKey(0,  1), 2], // 자축 → 토
  [pairKey(2, 11), 0], // 인해 → 목
  [pairKey(3, 10), 1], // 묘술 → 화
  [pairKey(4,  9), 3], // 진유 → 금
  [pairKey(5,  8), 4], // 사신 → 수
  [pairKey(6,  7), 1], // 오미 → 화
]);
export function getYughap(a: number, b: number): ElemIdx | null {
  return HAP6_MAP.get(pairKey(a, b)) ?? null;
}

export const HAP3: [number[], ElemIdx][] = [
  [[2, 6, 10], 1],  // 인오술 → 화
  [[11, 3, 7], 0],  // 해묘미 → 목
  [[8, 0, 4],  4],  // 신자진 → 수
  [[5, 9, 1],  3],  // 사유축 → 금
];

// 형: 무은지형·지세지형·무례지형 (자형은 Phase 2)
const HYEONG_TRIPLES = [[2, 5, 8], [1, 10, 7]];
const HYEONG_PAIRS   = [[0, 3]];

export function isHyeong(a: number, b: number): boolean {
  if (HYEONG_PAIRS.some(p => p.includes(a) && p.includes(b) && a !== b)) return true;
  return false; // triple form requires 3-way check, done in detect_events
}
export function getHyeongTriples(): number[][] { return HYEONG_TRIPLES; }

// ── 계절(월지) ↔ 오행 (합화 후보용)
export const SEASON_BRANCHES: Record<ElemIdx, Set<number>> = {
  0: new Set([2, 3, 4]),    // 목: 인묘진
  1: new Set([5, 6, 7]),    // 화: 사오미
  2: new Set([4, 7, 10, 1]),// 토: 진미술축
  3: new Set([8, 9, 10]),   // 금: 신유술
  4: new Set([11, 0, 1]),   // 수: 해자축
};

// ── 십신 행동 가이드 (10십신 × 신강·신약)
export const SIPSIN_ACTION: Record<string, Record<'신강'|'신약', string>> = {
  '비견': { 신강: '독자 행보 가능, 경쟁 격화',          신약: '동료·지원 활용, 단독 행동 자제' },
  '겁재': { 신강: '경쟁·도전 환경, 재물 변동',          신약: '지출·손재 주의, 수비 전환' },
  '식신': { 신강: '창작·기획 활동 증가',                신약: '에너지 누수 주의, 선택적 집중' },
  '상관': { 신강: '표현·발언 기회, 협상 유리',          신약: '갈등·구설 주의, 말 아끼기' },
  '편재': { 신강: '큰 기회 포착, 외부 활동 확장',       신약: '과욕 주의, 건강 관리 병행' },
  '정재': { 신강: '적극적 재물 관리, 투자·계약 유리',   신약: '지출 억제, 기존 자산 점검 중심' },
  '편관': { 신강: '경쟁 돌파, 결단 유리',               신약: '번아웃 경계, 방어적 자세' },
  '정관': { 신강: '공적 업무 처리, 규칙 준수 성과',     신약: '압박 경감 전략, 위임·분산' },
  '편인': { 신강: '고립·의심 주의',                    신약: '직관 활용, 깊이 있는 작업' },
  '정인': { 신강: '정체·지연, 외부 활동 감소',          신약: '휴식·학습·회복 유리' },
};
