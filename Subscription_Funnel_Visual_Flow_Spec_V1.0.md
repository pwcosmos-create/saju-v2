# 💸 구독 퍼널 비주얼 플로우 스펙 (State Transition & Visual Hierarchy) V1.0
## 🎯 목표 및 원칙

*   **최종 목표:** 사용자가 Free Plan $\rightarrow$ Basic/Pro Plan $\rightarrow$ Stability Pro 순서로 자연스럽게 상위 단계로 이동하도록 유도한다.
*   **핵심 전략 (Visual Gatekeeping):** 낮은 레벨의 기능을 사용할 때마다, 다음 상위 레벨에만 가능한 '통제권'의 부재를 시각적 장벽(Visual Obstacle)으로 경험하게 한다.
*   **톤앤매너:** 권위적이고 시스템적인 '진실 폭로' 톤 유지. 모든 UI 요소는 데이터 기반 증명('Proof')을 목표로 한다.

## I. 전반적인 레이아웃 및 위계 구조 (Hierarchy)

1.  **메인 컴포넌트 배치:** 구독 플랜 비교 페이지를 중심으로, 세 가지 카드를 나란히 배치한다.
2.  **시각적 강조 원칙:** 가장 높은 가치(Stability Pro)가 항상 시선의 초점이 되도록 디자인하고, 이를 위해 Deep Copper 색상을 전면적으로 사용하며 주변 요소 대비 명암 대비를 극대화한다.
3.  **구조적 흐름:** Free $\rightarrow$ Basic (좌측에서 우측으로의 점진적 확장)의 구조로 배치하되, **가장 오른쪽(Stability Pro)**에 가장 강력한 시각적 무게감(Midnight Blue 배경 위에 Deep Copper 하이라이트)을 부여한다.

## II. 구독 레벨별 State Transition 스펙 (핵심 변경 사항)

| 상태 (State) | 조건 및 사용자가 느끼는 감정 | UI/UX 변화 (Designer Action) | 비주얼 사양 (Color / Component) |
| :--- | :--- | :--- | :--- |
| **1. Free State** (정보 탐색 초기) | "이 정도면 어느 정도 알겠다." $\rightarrow$ **미성숙함, 불안감 유발.** | 기본 시스템 대시보드 컴포넌트(System-Status-Dashboard\_Components\_V1.0.md 참조)를 사용하되, 핵심 KPI는 제한된 정보만 표시한다. | 배경: Primary (Midnight Blue). 강조색: Clear Sky Blue만 제한적으로 사용. **Deep Copper 없음.** |
| **2. Basic/Pro State** (중간 단계) | "이 정도면 좀 나아졌지만, 아직 뭔가 빠진 느낌." $\rightarrow$ **불완전함, 부족한 통제력 인지.** | 1차 KPI는 정상적으로 표시되나, 가장 중요한 '리스크 예측' 섹션에 **레이어링 된 가림막(Overlay Filter)**이 적용된다. | 배경: Primary (Midnight Blue). 강조색: Clear Sky Blue + Limited Deep Copper. <br>**[필수 컴포넌트]** `Feature_Locked_Widget`: "Advanced Control Feature Locked." 텍스트와 함께 Deep Copper로 표시되는 **'업그레이드 필요' 버튼**을 배치한다. |
| **3. Stability Pro State** (최종/목표) | "이걸 알아야만 안전하다. 통제권을 확보했다." $\rightarrow$ **안정감, 절대적 신뢰.** | 모든 KPI가 실시간으로 완전하게 활성화되며, 데이터 흐름(Clear Sky Blue)이 가장 풍부하고 역동적으로 보인다. '리스크 경고 알림' 컴포넌트가 Active 상태로 표시된다. | 배경: Primary (Midnight Blue). 강조색: **Deep Copper를 최대치**로 사용하여 CTA와 핵심 수치를 배치한다. <br>**[핵심 비주얼]** `Risk_Control_Gauge`: 게이지가 최대로 차오르며, 시스템의 통제권을 상징하는 시각적 효과(Animation)를 부여한다. |

## III. 인터랙션 및 모션 가이드라인 (Motion Guide)

*   **Free $\rightarrow$ Basic Transition:** 사용자가 Free 기능을 사용하다가, `Feature_Locked_Widget` 영역으로 스크롤할 때 **'Deep Copper 색상의 경고음(Visual Tone)'**이 발생하며 시선이 강제적으로 오른쪽 상위 플랜 쪽으로 이동하도록 유도한다.
*   **Basic $\rightarrow$ Stability Pro Transition:** CTA 버튼을 누르거나, 해당 플랜의 가치를 인지하는 순간, 배경 전체에 Clear Sky Blue와 Deep Copper가 교차하는 **'시스템 연결 성공(Connection Success)' 애니메이션**이 1초 동안 발생하여 성취감을 극대화한다.

## IV. 구현 시 유의사항 (Developer Note)

*   모든 '잠긴(Locked)' 기능은 단순히 비활성화된 것이 아니라, 해당 기능을 사용하지 않았을 때 **사용자가 놓치고 있는 가치를 명시적으로 알려주는 방식**으로 디자인되어야 한다.
*   Deep Copper 색상은 오직 *가장 중요한 행동 유도 지점(CTA)*과 *최상위 플랜의 핵심 수치*에만 핀포인트로 사용한다.