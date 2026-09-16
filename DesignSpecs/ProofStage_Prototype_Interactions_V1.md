# 🧩 Proof Stage Prototype Interaction Map (KPI Driven)
**[기반 스펙]**: ProofStage_Mockup_Spec_V2.0 <br> **[목표 KPI 조건]**: Conversion Time $\ge 3$분 / CTR $\ge 0.7\%$

## 1. 시스템 흐름 정의 및 인터랙션 규칙 (Interaction Logic)
| 단계 | 사용자 행동/상태 변화 | Trigger Condition | 디자인 반응 (Visual Change) | 에셋 준비 필요 항목 |
| :--- | :--- | :--- | :--- | :--- |
| **[A] 초기 진입** | 콘텐츠 소비 시작 | N/A | Midnight Blue 배경, 기본 정보 표시. Focus: 신뢰성 구축. | Default UI Kit |
| **[B] 핵심 데이터 노출** | 사용자가 첫 번째 KPI 차트(예: Revenue Growth)를 스크롤하여 인식함. | Scroll Depth $ > 20\%$ | **Clear Sky Blue (Accent)**의 연결선이 활성화되며, 해당 수치에만 포커싱 효과 부여. <br> *(시각적 통제감 증명)* | Flow Line Animation (ADD8E6) |
| **[C] 전환점 도달 (Critical Point)** | 사용자가 특정 기능을 클릭하거나 '다음 단계'로 이동할 준비를 함. | User Interaction ($>$ Click) | Deep Copper 색상(Secondary)이 CTA 버튼과 핵심 가치에 극대화되어 발광하는 듯한 효과 부여. <br> *(행동 유도 및 희소성 강조)* | Hover/Active State (B8860B) |
| **[D] 성공 검증 (Success Path)** | **KPI 조건 만족 시**: 사용자가 충분히 시간을 보내고(Time $\ge 3$), 높은 상호작용을 보일 때. | `Conversion Time >= 3` & `CTR >= 0.7%` | 1. 화면 전체에 미묘한 '시스템 안정화' 애니메이션 효과 (Micro-Interaction). <br> 2. 최종 결과 대시보드에서 **Deep Copper**를 사용해 명확한 '성과 달성 수치(Achieved KPI)'가 플래시되도록 구현. | Success Animation Set, Achievement Badge Component |
| **[E] 실패/탈락 (Failure Path)** | KPI 조건에 미달하거나 이탈할 때. | `Time < 3` OR `CTR < 0.7%` | Deep Copper 사용 최소화. Instead, Clear Sky Blue를 사용하여 '추가 학습이 필요함'을 안내하는 Flow Line 유도. | Guidance/Fallback UI Kit |

## 2. 시각 에셋 및 컴포넌트 스펙 (Visual Assets Specification)
**[폰트]**: Pretendard (Standard)
**[색상 토큰 적용]**:
*   `--color-primary`: #0A1931 (Midnight Blue) - 배경, 섹션 구분선. [근거: Designer 검증된 지식]
*   `--color-secondary`: #B8860B (Deep Copper) - CTA, 최종 KPI 수치. [근거: Designer 검증된 지식]
*   `--color-accent`: #ADD8E6 (Clear Sky Blue) - 데이터 흐름, 연결선, 상호작용 강조. [근거: Designer 검증된 지식]

**[핵심 컴포넌트 스펙]**:
1.  **KPI 차트 모듈:** 단순 그래프가 아닌, '데이터 파이프라인'을 통해 수치가 유입되는 듯한 애니메이션 효과를 적용합니다. (Clear Sky Blue 사용) [근거: Designer 검증된 지식]
2.  **CTA 버튼 (Success State):** Deep Copper 배경에 마우스 오버 시 빛이 번지는(Glow) 효과를 추가하여, 행동의 중요성을 극대화합니다. (Interaction Rule 반영)

## 3. Figma/Prototype 구현 방향 (Implementation Guide for Dev Team)
1.  **Artboard 구성:** ProofStage_Mockup_Spec_V2.0에 정의된 모든 레이아웃을 따라 Artboard를 생성하되, 최소 **[A] -> [B] -> [C] -> [D]**의 시퀀스를 반드시 포함합니다.
2.  **Prototype Linkage:** Prototype 툴 내에서 각 단계별 조건부 전환(Conditional Transition) 기능을 활용하여 KPI 로직을 구현합니다. (예: `If Time > 2.5 min, Show Success Flow`)