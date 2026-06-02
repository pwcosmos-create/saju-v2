# 🎨 보배시즌 랜딩 페이지 디자인 시스템 컴포넌트 스펙 시트 (Final)

## 📄 1. 프로젝트 개요 및 원칙 [근거: Designer 검증된 지식]
*   **핵심 가치:** '시스템적 통제권 확보'를 통해 은퇴자에게 권위적 신뢰감과 명확한 경로 제시.
*   **톤앤매너:** 전문성, 체계성, 압도적인 데이터 증명력 (Authority & Proof).
*   **컬러 시스템:** Deep Copper (`#B8860B` - 행동 유도), Clear Sky Blue (`#ADD8E6` - 흐름/데이터), Midnight Blue (`#0A1931` - 배경/신뢰) 3색 제한.

## 🎨 2. 타이포그래피 시스템 (Typography System) [근거: Designer 검증된 지식]
*   **폰트:** Pretendard (모든 플랫폼에서 최적의 가독성 확보).
*   **H1 - 메인 헤드라인:** Size: 48px / Weight: Bold / Color: Midnight Blue (`#0A1931`).
    *   *사용 원칙:* 페이지 상단에 배치되어 핵심 메시지를 즉시 각인.
*   **H2 - 섹션 제목:** Size: 32px / Weight: SemiBold / Color: Midnight Blue (`#0A1931`).
    *   *사용 원칙:* 새로운 논리적 섹션을 구분하며, 항상 Deep Copper 밑줄 또는 배경을 사용하여 강조.
*   **Body Text - 본문:** Size: 16px / Weight: Regular / Color: #444444 (Midnight Blue의 가독성 강화).
    *   *사용 원칙:* 충분한 행간(Line Height: 1.6)을 확보하여 장문의 신뢰 정보를 편안하게 읽히도록 설계.
*   **KPI Value - 핵심 수치:** Size: 40px / Weight: Bold / Color: Deep Copper (`#B8860B`).
    *   *사용 원칙:* *오직 가장 중요한 성과 지표(예: LTV, % 증가)*에만 사용.

## 💡 3. 색상 시스템 (Color System Palette) [근거: Designer 검증된 지식]
| 역할 | 이름 | Hex Code | 용도 및 규칙 |
| :--- | :--- | :--- | :--- |
| **Primary** | Midnight Blue | `#0A1931` | 기본 배경, 섹션 구분선, 권위 부여. (배경색) |
| **Secondary** | Deep Copper | `#B8860B` | **CTA 버튼**, 핵심 수치(KPI), 최종 결론 강조. (행동 유도) |
| **Accent** | Clear Sky Blue | `#ADD8E6` | 데이터 흐름, 연결선(Flow), 그래프의 상승 추세 시각화. (명확한 통제) |
| **Surface** | White / Light Gray | `#FFFFFF` / `#F5F5F5` | 콘텐츠 배경, 정보 구분을 위한 미묘한 밝기 차이. |

## 🧩 4. 핵심 컴포넌트 라이브러리 (Atomic Components)

### A. CTA Button Component
*   **State:** 반드시 모든 상태(Hover/Active/Disabled)를 정의해야 합니다.
*   **Primary CTA (가장 중요한 버튼):**
    *   **Default:** Background: Deep Copper (`#B8860B`), Text: White, Border Radius: 4px.
    *   **Hover:** Background: `#DDAA3C` (약간 밝은 코퍼), Shadow: Subtle Depth Effect.
    *   **Active/Click:** Slight scale down effect (애니메이션 필수).
    *   **Disabled:** Background: `#8d6c0a`, Opacity: 70%.
*   **Secondary CTA:**
    *   **Default:** Background: Transparent, Border: Deep Copper (`#B8860B`), Text: Deep Copper. (주요 액션의 보조 역할)

### B. Data Visualization Component (KPI Card & Graph)
*   **KPI Box (Key Performance Indicator):**
    *   **레이아웃:** Midnight Blue 배경 위에 White Surface로 배치.
    *   **구조:** `[제목(H3)]` / `[수치(Deep Copper, 40px)]` / `[설명/전환율 변화(Clear Sky Blue Arrow/Text)]`.
    *   **핵심:** 수치가 들어가는 영역은 Deep Copper 색상으로 시선을 강하게 유도해야 합니다.
*   **Flow Chart / Connection Line (시스템 흐름):**
    *   **색상:** Clear Sky Blue (`#ADD8E6`)을 주력으로 사용하며, 시작점과 끝점에만 Deep Copper를 연결하여 '통제된 경로'임을 강조합니다.
    *   **애니메이션 원칙:** 데이터가 출발지에서 도착지로 흐르는 듯한 점진적(Progressive) 애니메이션이 필수입니다.

### C. 섹션 분리 컴포넌트 (Section Divider & Trust Bar)
*   **Trust/Authority Strip:** Midnight Blue 배경 위에 가로 전체를 차지하며, "시스템 검증 완료", "Deep Copper 기반의 성과 증명" 등의 문구를 Clear Sky Blue 텍스트로 배치하여 신뢰도를 시각적으로 확보합니다.

## 🚀 5. 구현 지침 (Implementation Directive)
1.  **컴포넌트 우선:** 모든 요소는 위 정의된 컴포넌트를 조합하여 만드세요. 임의의 색상이나 크기 변경은 금지됩니다.
2.  **애니메이션:** 모든 전환(Transition)에는 부드러운 `ease-out` 곡선과 짧은 지연 시간(Delay)을 적용하여 기술적 정교함을 암시합니다.
3.  **가독성 체크:** 은퇴자 타겟의 특성을 고려하여, 텍스트 대비는 항상 최소 4:1 이상 확보해야 합니다.