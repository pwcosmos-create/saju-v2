# 🎨 애니메이션 및 상호작용 최종 스펙 (Designer V1.0)
## 🎯 목표: 시스템적 성공 경험(Success State)의 완벽한 시각화
이 문서는 KPI 달성 후 사용자에게 제공되는 '시스템 통제력'을 극대화하기 위한 모든 인터랙션, 애니메이션, 비주얼 이펙트의 최종 구현 사양을 정의합니다. (Figma Prototype/개발 핸드오프용)

---

### 1️⃣ 핵심 컬러 토큰 및 스타일 재확인 [근거: Designer 검증된 지식]
*   **Primary:** Midnight Blue (`#0A1931`) - 기본 배경, 안정성 유지.
*   **Secondary (Success Focus):** Deep Copper (`#B8860B`) - KPI 수치, 최종 CTA 강조.
*   **Accent (Flow/System):** Clear Sky Blue (`#ADD8E6`) - 데이터 흐름 경로 및 활성화된 연결선.

### 2️⃣ Flow Line Animation 스펙 (데이터 흐름 증명) [근거: 통합 스케줄]
사용자가 핵심 데이터를 조작하거나, KPI를 달성하는 과정에서 '시스템이 작동하고 있음'을 시각적으로 보여줍니다.
*   **트리거:** 사용자의 액션 발생 (Hover, 클릭) 또는 데이터 로드 완료 시점.
*   **요소:** 섹션 A(입력) $\rightarrow$ Flow Line $\rightarrow$ 섹션 B(결과).
*   **구현 방식:** `SVG Stroke-Dasharray`를 활용한 '드로잉' 효과가 최적입니다.
    1.  **시작 상태:** 선은 완전히 비활성화되어 보이지 않음 (opacity: 0%).
    2.  **진행 과정:** 데이터 로드 시작과 동시에, 연결선이 왼쪽에서 오른쪽으로 부드럽게 그려지며(Draw-in), 마치 전기가 흐르는 것처럼 점멸 효과가 가미됩니다.
    3.  **애니메이션 설정:**
        *   **Duration:** 600ms (최소한의 지연을 주어 '시스템적 처리' 시간을 부여).
        *   **Easing Curve:** `cubic-bezier(0.25, 1, 0.5, 1)` (EaseOutQuad) - 빠르고 부드럽게 가속하며 도착합니다.

### 3️⃣ Success Glow Effect 스펙 (성공 경험 극대화) [근거: CEO 지시]
KPI 달성(예: `conversionTime >= 3` 또는 `ctr >= 0.7`) 시, 가장 중요한 요소에 시각적인 '축복'을 부여합니다.
*   **트리거:** KPI 조건 충족 직후 (State Change).
*   **영향 범위:** 성공한 KPI 수치(Deep Copper 사용 영역) 및 최종 CTA 버튼 주변.
*   **구현 방식:** **`box-shadow`와 `radial-gradient`의 조합**을 사용합니다.
    1.  **애니메이션 단계 1 (Onset):** 조건 충족 직후, 대상 요소 주변에 미세한 빛이 번지기 시작합니다. (Duration: 100ms).
    2.  **애니메이션 단계 2 (Peak Glow):** 가장 밝은 지점(Core)에서 Clear Sky Blue (`#ADD8E6`)와 Deep Copper (`#B8860B`)가 혼합된 은은한 빛이 퍼집니다.
        *   `box-shadow`: `0 0 15px rgba(184, 134, 11, 0.7), 0 0 30px rgba(173, 216, 230, 0.6)`
        *   **Duration:** 150ms (가장 중요한 순간에 시선을 붙잡습니다).
    3.  **애니메이션 단계 3 (Decay):** 빛이 서서히 줄어들며(Fade-out), 요소의 기본 상태로 돌아갑니다. (Duration: 400ms, Easing: EaseInOutSine).

### 4️⃣ 전체 플로우 및 시퀀싱 가이드 (The Grand Sequence)
최종 사용자 경험은 이 세 가지 애니메이션이 순차적으로 작동할 때 완성됩니다.

| Step | 이벤트/트리거 | 동작 요소 | 효과 | 타이밍 (누적 시간) | 담당 에이전트 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | KPI 조건 충족 감지 | 전체 화면 (Success Area) | Success Glow Effect 발동. Deep Copper 수치에 1차 강조. | T + 0ms | Designer/Frontend |
| **2** | 시스템 결과 계산 완료 | Flow Line | 데이터 경로 연결선이 '드로잉' 되며, 데이터 흐름을 증명합니다. | T + 300ms (반전) | Frontend/Codari |
| **3** | 최종 결론 도출 및 제시 | CTA 영역 | Success Glow Effect가 2차 발동하며, 최종 행동(CTA 버튼)에 집중됩니다. | T + 900ms (완료) | Designer/Frontend |

---
*본 스펙은 Figma Prototype의 Component State와 개발팀의 CSS Transition 코드를 기반으로 즉시 구현 가능하도록 최적화되었습니다.*