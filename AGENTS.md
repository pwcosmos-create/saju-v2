<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Deployment Context (Important)

### Homepage (Oracle)

- Production server: Oracle Cloud VM.
- SSH target: `ubuntu@168.107.31.153` (identity file typically `~/.ssh/shinserver.key`).
- App directory on server: `/home/ubuntu/saju-v2`.
- Runtime/process manager: PM2, app name `saju-v2`.
- Active runtime port is `3001` (current PM2 start command: `npm start -- -p 3001`).
- **Safe deploy** (avoids 502 / broken `.next` chunks): stop PM2 → delete `.next` → build → start. On the server: `bash scripts/deploy-oracle.sh`. Do not `rm -rf .next` while `saju-v2` is still running.

### Toss Apps in Toss (WebView mini app)

- **This repo (`saju-v2`) manages both the Homepage and the Toss Mini App.**
- Toss build: `npm run build:toss` → `npm run ait:build` → `npx ait deploy` (appName `saju-coupax`).
- `TOSS_BUILD=1` sets `NEXT_PUBLIC_APPS_IN_TOSS=1` and uses `distDir: '.next-toss'` + static `output: 'export'`.
- Banner ads use `TossAds.attachBanner` (`lib/toss-banner-ad.ts`), not GoogleAdMob load/show (those are interstitial/rewarded only).
- Rewarded ads use `loadFullScreenAd` / `showFullScreenAd` (`lib/toss-rewarded-ad.ts`).
- **Mobile sticky banner**: full-bleed via `left/right:0` + `width:100%` (never `100vw`). Height `96px + env(safe-area-inset-bottom)`. Requires `viewportFit: 'cover'` in `app/layout.tsx`. Sets `--saju-sticky-banner-h` so `.results-section` / footer clear the bar on all phone widths.

### UI/UX Visual Consistency (비주얼 일관성 규칙)

- **Proof Stage 디자인 스펙 준수**:
  - 신규 대시보드나 데이터 시각화 화면을 구현할 때 반드시 [ProofStage_Master_Layout_Spec_V1.md](file:///c:/커셔/saju-v2/DesignSpecs/ProofStage_Master_Layout_Spec_V1.md)를 참조하여 구현합니다.
  - 배경은 Midnight Blue (`#0A1931`), 핵심 가치와 결과 강조는 Deep Copper (`#B8860B`), 데이터 연결선과 흐름 애니메이션은 Clear Sky Blue (`#ADD8E6`)를 엄격하게 구분하여 사용합니다.
  - 텍스트 위주가 아닌 **시각적인 데이터 흐름(Data Visualization First)**을 최우선으로 적용합니다.
