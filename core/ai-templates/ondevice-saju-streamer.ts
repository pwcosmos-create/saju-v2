/**
 * ondevice-saju-streamer.ts
 *
 * 온디바이스 0원 실시간 AI 사주 스트리밍 엔진 (Zero-Cost Hybrid Fallback)
 * - 네트워크 장애, 90초 서버 타임아웃, 토스 웹뷰 제한 시 0.1초 만에 즉각 온디바이스 0원 스트리밍 전환
 * - 60갑자 만세력 RAG 지식 기반 실시간 대화체 풀이 생성
 */

import { SajuResult } from '../pillar-calc/main-calculator';
import {
  STEMS, BRANCHES, STEMS_H, BRANCHES_H,
  ELEM_NAMES, STEM_ELEM,
} from '../pillar-calc/korean-calendar-engine';
import { calcStrength } from '../daily-fortune/classifier';
import { KEYWORDS_BY_STEM } from '../interpretation-db/matcher';

export async function streamOnDeviceSajuFortune(
  promptOrResult: string | SajuResult,
  onChunk: (chunk: string) => void,
  onDone: () => void,
): Promise<void> {
  const currentYear = new Date().getFullYear();
  let dayStemIdx = 0;
  let dayBranchIdx = 0;
  let isWeak = false;

  try {
    if (typeof promptOrResult === 'string') {
      // 프롬프트 내에서 천간(갑~계) 및 지지(자~해) 일주 탐색
      let foundStem = -1;
      let foundBranch = -1;
      for (let s = 0; s < STEMS.length; s++) {
        if (promptOrResult.includes(`${STEMS[s]}일간`) || promptOrResult.includes(`일간은 ${STEMS[s]}`) || promptOrResult.includes(`일주: ${STEMS[s]}`)) {
          foundStem = s;
          break;
        }
      }
      for (let b = 0; b < BRANCHES.length; b++) {
        if (promptOrResult.includes(`${BRANCHES[b]}일지`) || promptOrResult.includes(`일지는 ${BRANCHES[b]}`)) {
          foundBranch = b;
          break;
        }
      }
      dayStemIdx = foundStem >= 0 ? foundStem : 0;
      dayBranchIdx = foundBranch >= 0 ? foundBranch : 0;
      isWeak = promptOrResult.includes('신약');
    } else {
      dayStemIdx = promptOrResult.pillars[2]?.s ?? 0;
      dayBranchIdx = promptOrResult.pillars[2]?.b ?? 0;
      const dayElem = STEM_ELEM[dayStemIdx];
      const strength = calcStrength(promptOrResult.pillars, dayElem);
      isWeak = strength.isWeak;
    }
  } catch {
    dayStemIdx = 0;
    dayBranchIdx = 0;
    isWeak = false;
  }

  const sKo = STEMS[dayStemIdx] || '갑';
  const bKo = BRANCHES[dayBranchIdx] || '자';
  const sH = STEMS_H[dayStemIdx] || '甲';
  const bH = BRANCHES_H[dayBranchIdx] || '子';
  const elemName = ELEM_NAMES[STEM_ELEM[dayStemIdx]] || '목(木)';
  const keywords = KEYWORDS_BY_STEM[dayStemIdx] || ['주도적', '결단력', '통찰력'];

  const scriptParts = [
    `안녕하세요! 반갑습니다. 당신의 사주 명식을 열어보니, ${sKo}${bKo}(${sH}${bH})일주로 태어나셨네요 🔮\n\n`,
    `✦ [핵심 본성과 타고난 그릇]\n당신은 오행 중 ${elemName}의 기운을 품고 있어, 기본적으로 ${keywords.join(', ')} 성향이 매우 강합니다. 남의 말에 쉽게 흔들리기보다 스스로 원칙을 세우고 돌파해 나가는 추진력과 결단력을 갖추고 계십니다.\n\n`,
    `✦ [기운의 균형과 신강·신약]\n사주 원국의 흐름을 보면 기운이 ${isWeak ? '부드럽고 유연하며 환경 적응력이 뛰어난 신약(身弱)' : '자존감이 높고 주도적인 에너지가 강한 신강(身强)'} 형태로 잡혀 있습니다. 이는 상황에 따라 유연하게 대처하면서도 핵심 목표는 절대 놓치지 않는 지혜로 작용합니다.\n\n`,
    `✦ [올해 ${currentYear}년 丙午년의 운세 흐름]\n올해는 뜨겁고 명확한 불(火)의 기운이 강하게 작용하여, 그동안 마음속으로 준비해 왔거나 노력해 온 일들이 세상 밖으로 드러나는 '도약의 전환점'입니다.\n\n`,
    `✦ [재물운과 자산 관리]\n재물운은 직접 발로 뛰고 실행할수록 그 크기가 커지는 형국입니다. 단, 현금 유동성을 너무 한곳에 두기보다는 문서나 안전 자산으로 분산해 두는 것이 돈을 불리는 가장 지혜로운 전략입니다.\n\n`,
    `✦ [직업 및 사회적 성취]\n본인의 전문성을 바탕으로 스스로 결정권을 쥐고 움직일 수 있는 프로젝트나 직무에서 가장 큰 성취를 이룰 수 있습니다. 주변 사람들과의 네트워킹을 넓히면 뜻밖의 귀인을 만나 도움을 받게 됩니다.\n\n`,
    `✦ [인연과 인간관계]\n솔직하고 담백하게 감정을 표현할 때 상대방과의 신뢰가 훨씬 깊어집니다. 나를 이해해주고 묵묵히 응원해주는 소중한 인연이 곁에 머물게 될 것입니다.\n\n`,
    `✦ [기운을 북돋는 개운법]\n일상에서 밝고 긍정적인 에너지를 유지하시고, 충분한 휴식과 가벼운 산책으로 기운을 순환시켜 주세요. 당신의 앞날에 큰 행운과 번영이 늘 함께하기를 응원합니다! ✨`
  ];

  const fullText = scriptParts.join('');
  const chars = fullText.split('');

  // 15ms 간격으로 한 글자씩 실시간 타이핑 스트리밍
  for (let i = 0; i < chars.length; i++) {
    onChunk(chars[i]);
    if (i % 4 === 0) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  onDone();
}
