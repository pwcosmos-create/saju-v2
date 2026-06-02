# 🛡️ Trust Bar Module (TBM) 최종 통합 핸드오프 스펙 v1.1

**작성 목적:** TBM의 모든 시각적 요소(Visual Component)와 기능적 요구사항(Functionality/Data Binding)을 완벽하게 통합하여, 개발팀이 단 하나의 진실 출처(Single Source of Truth)로 활용하도록 함.
**최종 목표:** 시스템적 통제권 확보 메시지를 데이터 기반으로 증명하고, 구독 전환(Subscription Funnel)을 극대화한다.

## 1. 핵심 원칙 및 구조 (Principle & Structure)

| 영역 | 정의된 규칙 | 근거/담당 에이전트 |
| :--- | :--- | :--- |
| **핵심 메시지** | 시스템적 통제권 확보를 데이터로 증명한다. (Feeling $\rightarrow$ Fact) | 💼 현빈 / Designer |
| **컬러 팔레트** | Primary: `#0A1931` (배경/신뢰), Secondary: `#B8860B` (CTA/KPI), Accent: `#ADD8E6` (데이터 흐름/변화) | 🎨 Designer (Self-RAG) |
| **폰트** | Pretendard (가독성 최우선) | 🎨 Designer (Self-RAG) |
| **구조 원칙** | 모든 변화는 'Before $\rightarrow$ After'의 대비를 통해 시각화되어야 한다. (Dichotomy Flow) | 💼 현빈 / 🎨 Designer |

## 2. 컴포넌트별 통합 스펙 (Component-wise Integration Spec)

### 🔴 [KPI A] DPSR Status Indicator
*   **기능 설명:** 현재 시장 리스크 대비 시스템의 안정성/우위를 나타내는 가장 중요한 시각적 지표. 이 값에 따라 TBM 전체의 분위기가 좌우됨.
*   **데이터 바인딩 요구사항 (Input):** `API: /api/v1/system_risk_score` -> 원시 데이터 필요.
*   **로직 플로우:**
    *   **조건 1 (Deep Copper, `#B8860B`):** $\text{Risk Score} > \text{Threshold}_{\text{High}}$ 일 때 (위험 신호 감지).
        *   **시각 변화:** 배경이 경고성으로 미세하게 어두워지고, 이 컴포넌트의 테두리에 Deep Copper가 강조되어야 한다.
        *   **메시지 바인딩:** "경고 상태: 데이터 안정성 확보 필요 (즉시 구독 전환 유도)"를 Display.
    *   **조건 2 (Clear Sky Blue, `#ADD8E6`):** $\text{Risk Score} < \text{Threshold}_{\text{Low}}$ 일 때 (안정적).
        *   **시각 변화:** Clear Sky Blue가 데이터 흐름과 함께 부드럽게 연결되어야 한다.
        *   **메시지 바인딩:** "시스템 통제권 확보: 안정적인 자산 배분 상태 유지"를 Display.

### 🟢 [KPI B] 핵심 수익 지표 (Revenue/Value)
*   **기능 설명:** 실제 시장 대비 우리의 포트폴리오 가치 증명. 가장 높은 신뢰도를 요구하는 KPI.
*   **데이터 바인딩 요구사항 (Input):** `API: /api/v1/portfolio_value` -> 실시간 데이터 스트림.
*   **시각 요소 및 동작:**
    1.  **숫자 표시:** 현재 가치(Value)는 항상 **Deep Copper (`#B8860B`)**로 강조되어야 한다. (최종 결론으로서의 무게감 부여).
    2.  **변화 추이:** 직전 값 대비 상승/하락 여부는 Clear Sky Blue를 사용하여 그래프 형태로 표시하며, 상승 시에는 애니메이션 효과(Flow)가 필수적이다.
    3.  **Critical Point:** 이 수치가 **최근 7일 평균치 대비 -10% 이하로 하락할 경우**, DPSR Status Indicator에 즉시 경고 신호를 발생시키도록 로직을 추가한다.

### 🔵 [CTA] 구독 유도 버튼 (Subscription Call-to-Action)
*   **기능 설명:** 사용자가 시스템적 통제권을 얻기 위해 취해야 할 최종 행동 유도 장치.
*   **시각 요소 및 동작:**
    1.  **색상/위치:** TBM의 가장 하단, Deep Copper(`#B8860B`)를 사용하여 최우선으로 눈에 띄게 배치한다.
    2.  **활성화 조건 (Critical):** DPSR Status Indicator가 'Deep Copper' 상태일 때, 이 CTA 버튼은 **'긴급성(Urgency)'**을 내포하는 카피라이팅과 함께 가장 강하게 강조되어야 한다. (예: "지금 시스템적 통제권을 확보하세요.")

---
*이 스펙 문서는 개발팀의 코드를 위한 완벽한 레퍼런스이며, 모든 팀은 이 v1.1을 기준으로 진행한다.*