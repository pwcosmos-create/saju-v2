# 🎨 보배시즌 대시보드 비주얼 블루프린트 (KPI 영역)

## 🎯 I. 디자인 핵심 목표 및 원칙 재확인
*   **핵심 메시지:** '데이터 기반 증명'과 '시스템적 통제권(SSI)'의 가치 전달.
*   **컬러 팔레트 준수:** Primary: Midnight Blue (`#0A1931`) | Secondary: Deep Copper (`#B8860B`) | Accent: Clear Sky Blue (`#ADD8E6`). 3색 외 색상 사용 금지.
*   **레이아웃 철학:** 정보의 계층성(Hierarchy)을 명확히 하여, 시선이 자연스럽게 **[가장 중요한 KPI] → [KPI의 변화/흐름] → [다음 액션]** 순으로 이동하도록 설계합니다.

## 🖥️ II. 전반적인 레이아웃 구조 (Wireframe & Grid System)
*   **Grid:** 12-Column Grid 시스템을 기본으로 사용하며, 모바일 대응(Responsive Design) 시에는 4 Column 또는 1 Column으로 즉시 축소되도록 설계합니다.
*   **섹션 분할:**
    *   **헤더 (Authority Zone):** Midnight Blue 배경. 현재 조회 날짜/기간 명시 및 전체 시스템 상태 요약.
    *   **KPI 핵심 지표 (Focus Zone):** 1열~4열에 걸쳐 Deep Copper를 활용한 KPI 카드 컴포넌트 배치. 이 영역이 대시보드의 가장 중요한 시각적 무게 중심입니다.
    *   **데이터 흐름 분석 (Flow Zone):** 남아있는 공간에 Clear Sky Blue를 주조색으로 사용하여, '어떤 데이터가 어디서 와서 어떤 결과를 만들었는지'의 인과관계(Causality)를 다이어그램 형태로 표현합니다.

## ✨ III. 컴포넌트별 상세 디자인 지침 (Component Specifics)

### 1. KPI 카드 컴포넌트 (`KPI_Card`)
| 요소 | 역할/기능 | 색상 코드 / 사용 원칙 | 근거 및 비고 |
| :--- | :--- | :--- | :--- |
| **카드 배경** | 전체적인 섹션 안정감 부여 | Midnight Blue (`#0A1931`): 옅은 그라데이션 적용 가능. | 권위적이고 깊이 있는 느낌 유지. |
| **핵심 수치 (Value)** | 가장 중요한 측정값 (ROI, CR 등) | Deep Copper (`#B8860B`): Bold 처리 필수. | 시청자의 눈을 즉시 사로잡아 '가장 중요한 숫자'를 각인시킵니다. |
| **상태 표시 (Status Indicator)** | Normal/Warning/Error 상태 알림 | *Normal:* Clear Sky Blue (`#ADD8E6`) 점선 테두리. <br>*Warning:* Deep Copper 경고색(옅은 오렌지 계열 사용 가능하나, 톤앤매너 유지를 위해 #B8860B의 30% 명도로 대체).<br>*Error:* Midnight Blue와 대비되는 강한 회색 (흑백으로 통제력 상실 표현). | 상태 변화에 따라 색상이 즉시 반응함을 시각적으로 증명. |
| **변화 추이 (Change Flow)** | 전 기간 대비 증가/감소 흐름 | Clear Sky Blue (`#ADD8E6`): 상승은 진한 파란색 계열로 그라데이션, 하락은 회색 점선으로 표시. | 변화 자체를 '데이터의 움직임'으로 인식시켜 명확성을 높입니다. |

### 2. 데이터 흐름 시각화 (Flow Diagram Component)
*   **배경:** Flow Zone 전체는 Midnight Blue에 미묘한 그라데이션을 넣어 배경지 역할을 합니다.
*   **연결선 (Connection Line):** 오직 Clear Sky Blue (`#ADD8E6`)의 굵은 선(Stroke)으로만 표현합니다. 이 연결선이 곧 '시스템적 인과관계'를 의미합니다.
*   **데이터 노드 (Data Node):** 데이터가 들어오고 나가는 지점은 Midnight Blue 배경 위에 Clear Sky Blue로 테두리를 가진 작은 원형 컴포넌트로 정의합니다. 각 노드는 해당 데이터를 생성한 시스템 모듈 이름(예: `Ads_Funnel`, `API_Call`)을 라벨링 합니다.
*   **흐름 애니메이션 (Motion Principle):** 데이터가 흐르는 과정은 마치 '전기가 통하는' 것처럼, Clear Sky Blue의 빛이 연결선을 따라 순차적으로 이동하며 시각적 임팩트를 줍니다.

## ✅ IV. 최종 디자인 가이드라인 요약
1.  **Depth:** 깊고 권위적인 Midnight Blue 배경을 유지하여, 콘텐츠가 단순한 광고가 아닌 '전문 시스템 리포트'처럼 보이게 합니다.
2.  **Focus:** 모든 시선은 Deep Copper로 강조된 KPI 수치에 닿도록 유도합니다.
3.  **Clarity:** Clear Sky Blue를 활용하여 데이터의 출처와 이동 경로를 끊임없이 설명하고, 복잡성을 단순화합니다.