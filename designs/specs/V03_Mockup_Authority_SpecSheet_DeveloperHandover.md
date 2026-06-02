# ⚙️ Video 2: AUTHORITY - 개발팀 기술 명세서 (V03)
## 목표 및 개요

본 문서는 '데이터 기반 증명'을 핵심으로 하는 Authority 섹션의 시각적 Mockup(`V03_Mockup_Authority_SpecSheet.md` 기준)을 실제 인터랙티브 웹/앱 환경에서 구현하기 위한 기술 명세서입니다. 개발팀은 이 스펙을 기반으로 **실시간 데이터($R_{Actual}$)**를 바인딩하고, '통제력'을 극대화하는 애니메이션 로직을 적용해야 합니다.

**[근거: CEO 지시]**
**[근거: Designer 검증된 지식]** (Mockup 제작 및 개발팀 연동 과정)

## 1. 데이터 바인딩 규칙 (Data Binding Rules)

모든 그래프와 KPI는 **실시간으로 변하는 `$R_{Actual}$` 데이터를 최우선 근거**로 사용해야 하며, 단순한 예시 숫자가 아닌 실제 API 호출을 통해 받아온 값을 즉시 반영하도록 구현합니다.

| UI 컴포넌트 | 데이터 소스 (Source) | 바인딩 규칙 및 포맷 | 시각적 역할/강조색 |
| :--- | :--- | :--- | :--- |
| **핵심 KPI 수치 (예: $R_{Actual}$)** | `API /revenue/realtime` | 1. 데이터 타입: Float (소수점 첫째 자리) <br> 2. 포맷: '$[XXX].XXM' 형식으로 고정 표시. <br> 3. 바인딩 조건: 값이 변할 때마다 **Deep Copper (`#B8860B`)** 색상으로 깜빡이며 강조(Flashing Effect). | 가장 중요한 수치. 변화에 민감해야 함. |
| **KPI 추이 그래프 (Line Graph)** | `API /revenue/history` | 1. 데이터 타입: Time Series Array (시간순 배열) <br> 2. 바인딩 조건: 과거 $N$일간의 `$R_{Actual}$`를 시간 축에 따라 매끄럽게 연결. <br> 3. **핵심 로직:** 현재 시점($T_{Now}$)의 데이터 포인트는 다른 모든 지점과 대비되도록 Clear Sky Blue (`#ADD8E6`)로 강조 표시. | 추세와 '통제력'을 증명하는 주 축. |
| **비교 분석 그래프 (Bar/Area Chart)** | `API /benchmark/compare` | 1. 데이터 타입: Category Array (분기별, 모델별 등) <br> 2. 바인딩 조건: 비교 항목 A(Baseline)와 B($R_{Actual}$) 값을 병렬로 표시. <br> 3. **강조 로직:** `$R_{Actual}$`의 막대는 Always Deep Copper (`#B8860B`)를 사용하며, Baseline 대비 증가율을 색상 농도로 표현 (진한 코퍼 = 높은 효율). | '우리가 더 낫다'는 논리를 시각화. |
| **시스템 상태 지표** | `API /status/system` | 데이터 타입: Boolean 또는 Enum ('Normal', 'Warning', 'Critical'). <br> 바인딩 조건: 실시간 시스템 안정성 데이터를 받아, 색상과 아이콘으로 즉시 반영. (예: Normal = Green; Warning = Yellow) | 신뢰성을 높이는 보조 장치. |

**[근거: Designer 검증된 지식]**: Deep Copper는 핵심 수치와 CTA에만 제한적으로 사용해야 합니다.
**[근거: 통합 스케줄]**: 실시간 매출 데이터($R_{Actual}$)를 그래프의 핵심 요소로 활용합니다.

## 2. 애니메이션 로직 (Animation Logic)

애니메이션은 단순한 '예쁘게 움직이는 것'이 아니라, **정보적 위계를 구축**하고 **시스템적 통제력(Systemic Control)**을 사용자에게 체감시키는 것이 목표입니다.

### A. 초기 로드 애니메이션 (On Page Load / Initial Viewport Entry)
1.  **섹션 진입:** Authority 섹션 전체가 부드럽게 페이드 인(Fade-in)하며 시작합니다. (Duration: 0.8s, Ease: Ease-out Quad).
2.  **KPI 카운트업:** 핵심 KPI 수치(`$R_{Actual}$`)는 로드와 동시에 **'카운트업 애니메이션'**을 적용하여 초기 기준값부터 실시간 값까지 빠르게 도달하도록 합니다. (Duration: 1.5s, Ease: Linear).
3.  **데이터 흐름 시작:** 추이 그래프의 연결선(Clear Sky Blue)은 왼쪽에서 오른쪽으로 **점진적으로 그려지며(Drawing/Drawn)** 데이터가 채워지는 것처럼 보이게 만듭니다.

### B. 인터랙티브 애니메이션 (On Scroll / Hover Interaction)
1.  **스크롤 기반 강조:** 사용자가 그래프 섹션으로 스크롤을 내릴 때, 현재 뷰포트 범위에 해당하는 데이터 포인트만 **점진적으로 확대되거나(Zoom)** Clear Sky Blue의 연결선이 가장 선명하게 빛나도록 애니메이션을 적용합니다.
2.  **KPI 변화 감지:** `$R_{Actual}$` 값이 이전 값 대비 일정 임계치($\pm 5\%$) 이상으로 변동할 경우, 해당 수치는 **반사적(Reactive)**으로 깜빡임(`Deep Copper` 플래시)과 함께 위로/아래로 작은 트랜지션 효과를 줍니다. (개발팀 검토 필요).
3.  **비교 분석 시퀀스:** 사용자가 'Baseline'와 '$R_{Actual}$' 막대 그래프를 볼 때, 두 막대가 순차적으로 나타나면서 **$R_{Actual}$이 더 높아지는 지점**에서 Deep Copper가 배경처럼 은은하게 하이라이트 됩니다.

## 3. 개발팀 체크리스트 및 전달 사항 (Developer Handover Checklist)

*   **데이터 우선순위:** 모든 애니메이션과 시각적 증명은 **실시간 데이터의 안정성 확보($DPSR$)** 이후에 진행되어야 합니다. Mock Data를 사용하되, 실제 데이터 구조와 변동 패턴을 완벽히 모사해야 합니다.
*   **기술 스택 명세:** 그래프 라이브러리(예: D3.js 또는 Chart.js)는 애니메이션 커스터마이징이 용이한 것으로 선택하고, **CSS/JS 기반의 사용자 정의 트랜지션**을 최대한 활용할 것.
*   **디자인 원칙 준수:** Deep Copper (`#B8860B`)는 오직 '최종 결론', '가장 중요한 수치', 'CTA'에만 사용하여 시각적 피로도를 낮추고 주목도를 높입니다. Clear Sky Blue를 무분별하게 사용하지 않도록 주의할 것.

---
**[근거: Designer 검증된 지식]**: 핵심 가치와 색상 조합을 통해 메시지 전달력 극대화. (애니메이션은 메시지를 강화하는 수단임)
**[근거: Designer 개인 메모리, Final_Video_Visual_Spec_Sheet.md]**: 데이터 기반 증명 원칙 준수.