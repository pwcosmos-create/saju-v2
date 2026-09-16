# 🚀 [개발 착수 지침] KPI 성공 상태 애니메이션 구현 사양 (V1.0)

**작성자:** Designer (Lead Designer)
**참조 파일:** `Final_KPI_Success_State_Spec_V1.0.md`, `Animation_Spec_Finalized_V1.0.md`
**목표:** 프론트엔드 개발팀이 지체 없이, 지정된 시스템적 톤앤매너를 유지하며 애니메이션을 구현할 수 있도록 모든 변수 및 로직을 명시합니다.

---

## 💡 1. 핵심 원칙 (Core Principles)

*   **시스템 제어감:** 모든 움직임은 유기적이거나 무작위적이지 않으며, 데이터가 **명확한 시스템 로직(Systemic Flow)**에 따라 이동하고 증폭되는 느낌을 주어야 합니다.
*   **지연 시간 준수 (Timing):** 애니메이션의 시작과 끝 간의 공백이 느껴져서는 안 됩니다. 모든 변화는 부드럽게 연결되어야 합니다.
*   **컬러 우선순위:** 색상 코드는 반드시 아래 정의된 CSS 변수를 사용하며, **Deep Copper (`--color-accent-cta`)** 는 오직 '성공' 및 '최종 CTA'에만 제한적으로 사용하여 시선을 유도합니다.

## 🎨 2. 글로벌 CSS 변수 (Global CSS Variables)

개발팀은 아래의 변수들을 `:root` 또는 해당 컴포넌트 범위에 정의하고, 하드코딩된 값 사용을 엄격히 금지해야 합니다.

| 변수명 | 색상 코드 (Hex) | 설명 | 용도 |
| :--- | :--- | :--- | :--- |
| `--color-primary` | `#0A1931` | 배경, 기본 요소의 무게감을 담당하는 Midnight Blue. | 섹션 배경, 텍스트 기본색. |
| `--color-secondary` | `#B8860B` | CTA 버튼 및 핵심 KPI 수치를 강조하는 Deep Copper. | 최종 액션 유도, 증명된 가치. |
| `--color-accent` | `#ADD8E6` | 데이터 흐름(Flow), 연결성, 시스템의 통찰을 나타내는 Clear Sky Blue. | 그래프 라인, 연결선(Line Animation). |
| `--animation-duration` | `0.8s` | 애니메이션의 표준 지속 시간 (Transition/Duration). | 모든 변화 요소에 적용되는 기본 트랜지션 속도. |
| `--easing-flow` | `cubic-bezier(0.25, 1, 0.5, 1)` | 데이터가 흐르거나 연결될 때 사용하는 부드럽고 가속적인 Easing Curve (EaseOut). | Flow Line Animation, 그래프 변화. |
| `--easing-pop` | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` | KPI 수치가 최종적으로 '도약'하며 자리 잡을 때 사용하는 탄성 애니메이션 (Spring/Pop). | 카운터 증가, 최종 값 등장. |

## ✨ 3. 주요 인터랙션 및 컴포넌트 스펙

### A. [Flow Line Animation]
*   **목표:** 데이터 소스에서 KPI를 거쳐 결과물로 이동하는 경로의 시각화 (Clear Sky Blue 사용).
*   **구현 로직:**
    1.  Start Point: `opacity: 0` / `transform: scaleX(0)` 상태에서 시작합니다.
    2.  Transition: 데이터 흐름이 감지되는 순간, 해당 라인이 **좌우로 그려지는 듯한(Drawing)** 효과를 주어야 합니다. (`stroke-dasharray`와 CSS 애니메이션의 조합 필수).
    3.  Animation Curve: `--easing-flow`를 사용하여 부드럽게 가속하며 진입합니다.

### B. [KPI 카운터 증폭 (The Pop)]
*   **목표:** 단순 숫자가 아니라 '증명된 수치'가 폭발적으로 증가하는 느낌을 구현합니다.
*   **구현 로직:**
    1.  초기 상태: 0으로 표시됩니다.
    2.  Transition: 데이터 로드 완료 시, 애니메이션이 트리거 됩니다.
    3.  Animation Curve: `--easing-pop`를 사용하여 카운트가 최종 값에 도달할 때 **약간의 탄성(Overshoot)**을 주어 역동성을 부여합니다. (e.g., `transform: scale(1.05)` -> `scale(1)`)
    4.  색상 사용: 수치 자체는 일반 텍스트 색상을 유지하되, 애니메이션 트랜지션 시에만 미세하게 `--color-secondary`의 그림자/하이라이트를 활용하여 중요성을 부각합니다.

### C. [Success Glow Effect (Final State)]
*   **목표:** 최종 KPI 달성 상태에서 시스템이 '정상 작동'하고 있음을 시각적으로 선언합니다.
*   **구현 로직:**
    1.  Trigger: 모든 데이터 처리가 완료되고 목표치에 도달했을 때 발동됩니다.
    2.  Visual Effect: 성공 메시지 영역 및 관련 KPI 수치 주변에 **미세하고 부드러운 광원 효과(Subtle Glow)**를 적용합니다. (CSS `box-shadow`와 `radial-gradient` 활용)
    3.  Animation Curve: `--easing-flow`를 기반으로, 빛이 가장자리부터 중앙으로 퍼져나가며 안정감을 주는 루프 애니메이션을 구현합니다.

---
**개발팀 참고 사항:**
모든 컴포넌트는 반응형 웹 디자인(RWD)을 준수해야 하며, 특히 모바일 환경에서 `--easing-pop` 효과가 과도하게 느껴지지 않도록 타이밍 조정이 필요할 수 있습니다. (Mobile Optimization Check 필수)