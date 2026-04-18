import { Pillar } from './korean-calendar-engine';

// 신살 상수
const DOHA    = [0, 6, 3, 9];
const YEOKMA  = [2, 8, 5, 11];
const HWAGAE  = [4, 10, 1, 7];
const CHEONEUL: number[][] = [
  [1,7],[0,8],[11,9],[11,9],[1,7],[0,8],[6,2],[6,2],[5,3],[5,3]
];
const MUNCHANG = [5, 6, 8, 9, 8, 9, 11, 0, 2, 3];

export interface Shinsal {
  name: string;
  icon: string;
  desc: string;
}

export function checkShinsal(pillars: (Pillar | null)[], dayStem: number): Shinsal[] {
  const dayBranch = pillars[2]?.b ?? 0;
  const allBranches = pillars.filter(Boolean).map(p => p!.b);
  const result: Shinsal[] = [];

  if (DOHA.includes(dayBranch))
    result.push({ name: '도화살 (桃花殺)', icon: '🌸',
      desc: '매력과 인기가 넘치는 기운입니다. 이성에게 자연스럽게 호감을 주는 타고난 매력이 있어 인간관계가 풍부합니다. 연예·방송·서비스업에서 강점을 보이며, 이성 관계에서의 복잡한 상황에 주의가 필요합니다.' });

  if (YEOKMA.includes(dayBranch))
    result.push({ name: '역마살 (驛馬殺)', icon: '🐎',
      desc: '이동과 변화를 즐기는 활동적 기질입니다. 해외 인연이나 타지 활동이 많을 수 있으며, 다양한 경험을 통해 성장합니다. 무역·외교·여행 분야에서 두각을 나타냅니다.' });

  if (HWAGAE.includes(dayBranch))
    result.push({ name: '화개살 (華蓋殺)', icon: '🎨',
      desc: '예술·종교·철학에 대한 깊은 관심과 탁월한 재능을 가지고 있습니다. 독창적인 개성으로 주목받으며, 고독한 시간 속에서 예술적 영감을 얻습니다.' });

  const ce = CHEONEUL[dayStem];
  if (allBranches.some(b => ce.includes(b)))
    result.push({ name: '천을귀인 (天乙貴人)', icon: '⭐',
      desc: '하늘이 내린 귀인의 기운을 가지고 있습니다. 위기의 순간마다 귀인이 나타나 도움을 주며, 평생 귀인복이 강하고 사람들에게 신뢰를 받는 타입입니다.' });

  const mc = MUNCHANG[dayStem];
  if (allBranches.includes(mc))
    result.push({ name: '문창귀인 (文昌貴人)', icon: '📚',
      desc: '학문과 문예에 뛰어난 재능을 가지고 있습니다. 총명하고 학습 능력이 뛰어나 자격증·시험 운이 강하고 글과 말로 두각을 나타냅니다.' });

  return result;
}
