import { optimizeCardBodyForDisplay, mergeOptimizedCardBodies } from '../core/gemma24/optimize-card-body.ts';

const noisy = {
  id: 99,
  title: '정재격(正財格) · 격국 지식 카드',
  summary: '',
  councilCertified: true,
  body: `【격국】
정재격은 월지 본기 정재로 잡는 격입니다.

키워드: 안정, 가정, 현실, 성실한 경영

월지 본기로 격을 정합니다. 일간 강약·종격 여부는 별도 검토가 필요합니다.

본 내용은 명리 참고용이며 확정 예언이 아닙니다. 학파·환경에 따라 해석이 달라질 수 있습니다.`,
};

const opt = optimizeCardBodyForDisplay(noisy);
console.log('=== optimized ===\n', opt);
console.log('\n=== merged section ===\n', mergeOptimizedCardBodies([noisy]));
