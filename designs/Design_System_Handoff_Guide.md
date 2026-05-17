# 🎨 보배시즌 디자인 시스템 핸드오프 가이드 (v1.0)

**작성 목적:** 개발팀이 Mockup 이미지를 단순 참고하는 것이 아닌, 재사용 가능한 컴포넌트 기반으로 구현할 수 있도록 명확한 스펙을 제공합니다. [근거: Designer 개인 메모리]
**적용 범위:** Free Trial CTA 및 SSI 대시보드 전반의 UI/UX 요소.

## 1. 핵심 원칙 (The Golden Rules)
*   **통제력 강조 (Control Emphasis):** 모든 디자인은 '시스템적 통제권'이라는 가치를 시각적으로 증명해야 합니다. 단순한 수익률 그래프보다, **데이터 흐름(Clear Sky Blue)**과 **안정성 지표(KPI Metric Card)**를 전면에 배치합니다. [근거: Designer 검증된 지식]
*   **색상 사용 제한:** Primary Color (`#0A1931`)는 배경 및 권위적 섹션에, Secondary Color (`#B8860B`)는 **오직 CTA 버튼과 최종 결론 수치(Revenue)**에만 사용합니다. [근거: Designer 검증된 지식]
*   **폰트 일관성:** 모든 텍스트는 Pretendard를 사용하며, 제목은 Bold, 본문은 Regular를 기본으로 합니다.

## 2. 컴포넌트별 스펙 (Component Specs)
### A. Free Trial CTA Block
*   **레이아웃:** 중앙 정렬, 최대 너비 1000px 제한.
*   **헤드라인:** "무료 체험으로 시스템적 통제권을 경험하세요." (H2: 32px / SemiBold). Deep Copper를 사용하여 시선을 즉시 사로잡습니다. [근거: Designer 검증된 지식]
*   **CTA 버튼:** `[Deep Copper]` 배경, `[Midnight Blue]` 텍스트. 클릭 유도성이 가장 높은 요소입니다.

### B. SSI 대시보드 미리보기 (Dashboard Preview)
*   **구조:** 3열 그리드 레이아웃을 기본으로 합니다. 각 카드는 독립적인 '데이터 증명' 섹션 역할을 수행합니다. [근거: Designer 검증된 지식]
*   **KPI Metric Card:**
    *   **Value Display:** 가장 중요한 KPI 수치(예: DPSR 99.9%)는 **Deep Copper**로 강조하고, 그 옆에 작은 `[Clear Sky Blue]`의 상승 화살표를 배치하여 '성장하는 통제력'을 시각화합니다.
    *   **데이터 흐름:** 데이터가 어떻게 계산되는지(KPI 로직)는 배경이나 연결선(`Clear Sky Blue`)으로 간접적으로 보여주어 시스템적 신뢰도를 높입니다. [근거: Designer 검증된 지식]

## 3. 개발팀 참고 사항
*   모든 컴포넌트는 Figma 라이브러리 파일에서 가져와 사용해야 합니다. (직접 코딩 금지)
*   반응형 디자인은 모바일(375px 기준)과 데스크톱(1440px 기준) 두 가지를 모두 고려하여 구현합니다.