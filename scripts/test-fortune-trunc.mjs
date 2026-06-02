import { tryCouncilHybridBase, buildCouncilHybridFortuneOfflineOnly } from '../core/gemma24/council-fortune-hybrid.ts';

const samplePrompt = `
생년월일: 1990년 5월 15일 (양력)
성별: 남
시간: 14시 30분 (미토시)
연주: 경오(庚午)
월주: 신사(辛巳)
일주: 임신(壬申)
시주: 정미(丁未)
지배 오행: 금 3개, 토 2개
부족 오행: 수 1개, 목 0개
최종 판정: ★ 신강(身强) (+2점) ★
용신(用神) = 금(金)
희신(喜神) = 수(水)
기신(忌神) = 화(火)
격국: 편인격(偏印格)
`;

const base = tryCouncilHybridBase(samplePrompt);
if (!base) {
  console.log('tryCouncilHybridBase returned null');
} else {
  console.log('composed NeedsSupplementIds:', base.composed.needsSupplementIds);
  const result = buildCouncilHybridFortuneOfflineOnly(samplePrompt, base);
  console.log('=== RESULT TEXT ===');
  console.log(result.text);
}
