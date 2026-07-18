# 💎 보배시즌 마스터 비주얼 시스템 가이드라인 (V2.0)
## [최종 검증 및 통합 문서]

**작성 목적:** 대시보드(UI/UX)와 광고 소재(Marketing Visuals)에 사용될 모든 시각적 자산의 최종 규격화 및 일관성 확보. 핵심 메시지: '시스템적 통제권 (SSI)'과 '데이터 기반 권위' 강조.

---

### 🎨 1. 컬러 팔레트 시스템 (Color Palette System)
| 역할 | 이름 | Hex Code | 용도 범위 및 원칙 | 적용 예시 | [근거] |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary** | Midnight Blue | `#0A1931` | **[기본/배경/권위]** 전체 섹션의 기본 배경, 본문 텍스트 영역, 시스템의 '무게감'을 부여. 신뢰도를 최우선으로 확보할 때 사용. | 대시보드 메인 백그라운드, 섹션 제목 박스 배경. | Designer 검증된 지식 |
| **Secondary** | Deep Copper | `#B8860B` | **[핵심 강조/KPI/CTA]** 가장 중요한 수치(KPI), 최종 결론(Revenue), 사용자 행동 유도 버튼(CTA). '가장 높은 전환율'을 유도하는 제한적 사용. | `KPI_Card`의 핵심 숫자(`$12,345`), "지금 분석 시작하기" 버튼. | Designer 검증된 지식 |
| **Accent** | Clear Sky Blue | `#ADD8E6` | **[데이터 흐름/연결성]** 데이터가 이동하는 경로(Flow), 그래프의 상승 추세, 시스템 연결선, 통찰력 포인트를 시각화. '명확한 통제'를 상징. | 그래프의 선(Line Graph), '자동 분석 로직' 표시 영역. | Designer 검증된 지식 |
| **Neutral** | Light Gray | `#F5F5F5` | 배경 분리 및 콘텐츠 가독성 향상용 보조 색상. (Deep Copper/Midnight Blue와 높은 대비 유지) | 카드 컴포넌트의 경계, 섹션 구분선. | [추측] |

### ✒️ 2. 타이포그래피 시스템 (Typography System)
*   **폰트:** Pretendard (가장 높은 가독성과 현대적 느낌 제공).
    *   **Headline (H1/H2):** Bold, Size 32px ~ 48px. Midnight Blue에 대비되는 명확한 시각적 계층 구조 확립.
    *   **Key Metric (KPI 수치):** Semi-Bold 또는 Bold, Deep Copper 색상 사용. 크기 최우선.
    *   **Body Text:** Regular, Size 16px ~ 20px. 가독성을 위해 Midnight Blue 바탕에 White/Light Gray 사용 원칙 준수.

### 🧩 3. 컴포넌트 및 레이아웃 스펙 (Component & Layout Specs)

#### A. KPI Card Component (`KPI_Card.jsx` 표준화)
*   **기본 구조:** `Midnight Blue` 배경 위에 `Clear Sky Blue`의 흐름선이 지나가며, 핵심 수치(`Deep Copper`)가 강조된 형태.
*   **상태 변화 원칙 (Status):**
    *   **Normal:** Deep Copper로 KPI 숫자를 표시. 주변은 Clear Sky Blue로 안정적인 연결성을 표현.
    *   **Warning:** 경고 문구와 함께 `Orange/Yellow` 계열 (Hex #FFD700)을 보조적으로 사용, 추후 확장 가능성 고려.
    *   **Error:** Error 아이콘과 함께 `Red` 계열 (Hex #DC143C)을 사용하여 통제 실패를 명확히 알림.

#### B. 데이터 흐름 시각화 원칙 (Flow Visualization)
*   **원칙:** 모든 데이터의 출처(Source)와 최종 결과(Target/KPI) 사이에는 반드시 `Clear Sky Blue`의 연결선(Connector Line)을 사용한다.
*   **강조점:** 프로세스의 '단계적 진행'과 '시스템에 의한 자동 처리 과정'은 단순한 화살표가 아닌, 빛나는 연결 흐름 애니메이션으로 표현하여 기술적 우위를 강조한다.

### 🔄 4. 채널별 자산 적용 매트릭스 (Cross-Channel Asset Matrix)
| 요소 | 대시보드 UI/UX (Dashboard - 권위성 중점) | 광고 소재 (Marketing Visuals - 행동 유도 중점) | 디자인 변주 전략 |
| :--- | :--- | :--- | :--- |
| **Primary Color** | Midnight Blue (`#0A1931`)를 배경으로 사용하여 높은 신뢰감 구축. 복잡한 데이터 구조의 기반 제공. | 톤 다운된 `Midnight Blue`를 사용하되, 이미지/모델 사진에 깊이를 더하여 고급스러움을 강조. | *[Deep Copper]와 조합*하여 권위적이고 진중한 톤 유지. |
| **Secondary Color** | 핵심 KPI 수치 (`KPI_Card`) 및 주요 버튼(`CTA`). 데이터의 '결과'를 즉각적으로 인식시킴. | 광고 헤드라인 하이라이트, "지금 바로 경험하세요" 등 행동 유도 문구 강조. | **최소한의 Deep Copper 사용.** 시선이 가장 먼저 머물도록 제한적 활용. |
| **Accent Color** | 데이터 Flow(진행 과정)와 통계 그래프의 변화 추이를 직관적으로 연결함. 시스템의 '정교함' 증명. | 프로세스 다이어그램화, 기술 원리 설명 섹션 등 복잡한 개념을 시각적으로 풀어낼 때 활용. | *[Clear Sky Blue]는 설명을 위한 도구.* 메인 메시지보다 배경 정보에 집중 사용. |
| **콘텐츠 구조** | **데이터-증명(KPI)-분석(Flow)**의 논리적 흐름을 따라, 깊이 있는 정보를 제공하는 '보고서' 형태. | **문제 제기 $\rightarrow$ 해결책 제시 (상품) $\rightarrow$ 행동 유도 (CTA)**의 빠른 스토리텔링 구조를 채택한 '광고 포스터/숏폼'. | UI는 *정보의 깊이*에, 광고는 *감정적 당위성*에 집중하도록 분리한다. |

---
**[결론]** 이 가이드라인을 통해 보배시즌은 모든 접점에서 시각적인 통일성을 확보했으며, 대시보드는 '데이터 기반 권위'를, 광고 소재는 '명확한 행동 유도'라는 목적에 맞춰 색상과 구조를 분리하여 활용할 수 있게 되었습니다.