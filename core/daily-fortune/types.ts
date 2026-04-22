import type { Pillar } from '../pillar-calc/korean-calendar-engine';

export type ElemIdx = 0 | 1 | 2 | 3 | 4; // 0=목 1=화 2=토 3=금 4=수

export interface ElementClassification {
  yongsin: ElemIdx;
  huisin:  ElemIdx[];
  gisin:   ElemIdx[];
  gusin:   ElemIdx | null;
  hansin:  ElemIdx[];
}

export type FortuneLevel = '매우 좋음' | '좋음' | '보통' | '주의' | '매우 주의';

export type EventType = 'chung' | 'yughap' | 'samhap' | 'hyeong';

export interface FortuneEvent {
  type:          EventType;
  target?:       number;   // 상대 지지 인덱스
  trio?:         [number, number, number];
  weakened?:     boolean;  // 탐합망충으로 약화됨
  hwaElem?:      ElemIdx;  // 합화 전환 오행
  hwaCandidate?: boolean;  // 합화 조건 충족 후보 (v1 플래그)
  hwaConditions?: { seasonMatch: boolean; stemExposed: boolean };
}

export interface DailyFortuneResult {
  date:    string;         // YYYY-MM-DD
  dayGanji: Pillar;
  score:   number;
  level:   FortuneLevel;
  sipsin:  string;         // 일진 천간 기준 십신
  action:  string;         // 신강/신약 × 십신 행동 가이드
  events:  FortuneEvent[];
  background: {
    daewoonSipsin: string;
    yearSipsin:    string;
    monthSipsin:   string;
  };
  oneLiner:       string;
  classification: ElementClassification;
}
