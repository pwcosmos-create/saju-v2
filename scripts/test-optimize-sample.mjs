import { optimizeCardBodyForDisplay, mergeOptimizedCardBodies } from '../core/gemma24/optimize-card-body.ts';

const noisy = {
  id: 99,
  title: '변수·격 정재격',
  summary: '',
  councilCertified: true,
  body: `「변수·격 정재격」
【개요】정재격은 월지 본기 정재로 잡는 격입니다. 안정·가정·현실 경영과 연결됩니다.
【핵심】재물은 꾸준한 관리와 성실한 수입 구조에서 강해집니다. 일간 강약은 별도로 봅니다.
키워드: 안정, 가정, 현실, 성실한 경영
본 내용은 명리 참고용이며 학파·환경에 따라 달라질 수 있습니다.`,
};

const opt = optimizeCardBodyForDisplay(noisy);
console.log('=== optimized ===\n', opt);
console.log('\n=== merged section ===\n', mergeOptimizedCardBodies([noisy]));
