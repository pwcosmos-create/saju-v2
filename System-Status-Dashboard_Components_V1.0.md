# System Status Dashboard Component Library Definition V1.0
## 🎯 목표: KPI 임계값 초과 시, 사용자 행동을 유도하는 위계적인 시각적 시스템 구축 [근거: CEO 지시/디자인 원칙]

### 🎨 A. 핵심 컴포넌트 정의 및 재사용성 원칙
모든 컴포넌트는 Pretendard를 기반으로 하며, 다음의 색상 변수를 사용합니다. (Midnight Blue / Deep Copper / Clear Sky Blue) [근거: Designer 검증된 지식]

1.  **KPI Gauge Card (`kpi-gauge`):** 주요 KPI 수치와 추세를 보여주는 카드.
    *   **필수 요소:** `value` (숫자), `trend-arrow` (상승/하강 화살표), `status-indicator` (색상 점).
2.  **Alert Signal Block (`alert-signal`):** KPI가 임계값을 벗어났을 때 발생하는 경고 영역. **(Deep Copper 사용 원칙 준수)** [근거: Designer 검증된 지식]
    *   **필수 요소:** `severity` (심각도: Low/Medium/High), `message` (경고 메시지).
3.  **Action CTA Button (`cta-button`):** 사용자에게 다음 행동을 유도하는 버튼. **(Deep Copper 사용 원칙 준수)** [근거: Designer 검증된 지식]

### 🖥️ B. 컴포넌트별 상태 변화 및 CSS Variable 정의 (가장 중요)
상태 전이를 위한 변수를 명확히 정의하여, 코다리가 프로토타입에서 이 변수만 바꿔도 모든 시각 요소가 업데이트되도록 합니다. [근거: Designer 개인 메모리]

| 컴포넌트 | 상태(State) | `var(--bg-color)` | `var(--text-color)` | `var(--kpi-value-color)` | 트리거 동작 (코다리 요청) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **KPI Gauge Card** | **Normal (정상)** | `#0A1931` | `#FFFFFF` | `var(--kpi-value-color)`: Clear Sky Blue (`#ADD8E6`) | - |
| | **Warning (주의)** | `#2C3E50` *(약간 밝게)* | `#FFFFFF` | `var(--kpi-value-color)`: Deep Copper (`#B8860B`) | KPI > 임계값 X ~ Y 범위 진입 시, 배경색과 숫자 색상이 변하고 경고 아이콘(⚠️) 노출. |
| | **Critical (위험)** | `#472A3D` *(심각한 어둠)* | `#FFFFFF` | `var(--kpi-value-color)`: Deep Copper (`#B8860B`) | KPI < 임계값 X 미만 진입 시, 배경색이 가장 어두워지고 (Midnight Blue보다 톤 다운), 경고 메시지(`alert-signal`)가 즉시 활성화됨. |
| **Alert Signal Block** | **Inactive (비활성)** | `transparent` | `transparent` | `N/A` | - |
| | **Active (활성)** | 배경색: Deep Copper의 옅은 그림자 효과 (`#B8860B22`) | 글자색: Deep Copper (`#B8860B`) | 해당 없음 | Critical 상태가 감지되면, 이 블록이 애니메이션과 함께 화면 상단/좌측에서 '팝업'되어야 함. (애니메이션 스펙 참조) |

### ✨ C. 레이아웃 및 시각적 연결 원칙
1.  **정보 흐름:** 가장 중요한 KPI Gauge Card가 좌상단에 위치해야 하며, 임계값 경고가 발생하는 순간에는 사용자의 시선이 자연스럽게 해당 카드에서 Alert Signal Block으로 이동하도록 **Depth of Field(깊이감)**를 활용합니다. [근거: Designer 검증된 지식]
2.  **애니메이션:** KPI 값이 Critical 상태로 진입할 때, 배경 전체가 미세하게 깜빡이는 (Pulse) 효과와 함께 데이터 연결선(`Clear Sky Blue`)이 해당 영역으로 빠르게 수렴하는 애니메이션을 적용합니다. [근거: Designer 검증된 지식]