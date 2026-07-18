# 🎨 Proof Stage 마스터 디자인 및 UX/UI 스펙 (V1.0)
## 💡 개요: 시스템적 통제권 증명 레이아웃 확정
*   **목표:** '데이터 기반의 신뢰'를 시각적으로 증명하여, 사용자가 막연한 희망이 아닌 구체적인 시스템에 의존해야 한다는 인식을 갖게 한다. [근거: CEO 지시 / 자율 사이클 로그]
*   **핵심 원칙:** **Data Visualization First.** 모든 텍스트는 데이터 흐름과 증명 과정을 보조하는 역할에 머물러야 한다.
*   **톤앤매너:** 권위적, 명료함 (Midnight Blue 배경 유지).

## 🖼️ 1. 섹션별 레이아웃 및 와이어프레임 구조 정의

| 요소 | 규격/크기 | 배치 원칙 | 기능 설명 |
| :--- | :--- | :--- | :--- |
| **메인 헤드라인** | H1 (Pretendard Bold, 48pt) | 좌측 정렬. Midnight Blue 배경 위 Deep Copper로 강조. | 문제 제기 및 핵심 가치 정의. ("불안한 시장에 시스템적 통제권을 확보하는 법") |
| **데이터 플로우 섹션** | 전체 폭 사용 (Full Width). Accent Color(`ADD8E6`)의 연결선 필수. | 상단에서 하단으로 흐르는 시각적 계층 구조. | 가상의 데이터 파이프라인(A $\to$ B $\to$ C)을 애니메이션화하여 보여줌. **가장 중요한 섹션.** |
| **KPI 증명 모듈** | 3열 그리드 (Grid System). 각 KPI에 Deep Copper 사용. | 명확한 카운트다운 또는 상승 그래프 형태. | 예: "평균 체류 시간 $\geq 3$분", "상호작용률 $\geq 70\%$". **수치만 강조.** |
| **CTA 영역** | Bottom Sticky Footer (Full Width). Deep Copper 배경 사용. | 시선이 자연스럽게 머무는 위치에 배치. | 최종 행동 유도: '자세한 데이터 리포트 다운로드' 버튼. |

## 🎨 2. 비주얼 에셋 및 디자인 시스템 상세 스펙
### A. 컬러 팔레트 적용 (Color Tokens)
*   **Primary:** Midnight Blue (`#0A1931`) — 기본 배경, 신뢰 구축 영역.
*   **Secondary:** Deep Copper (`#B8860B`) — KPI 수치, CTA 버튼, 핵심 가치 강조. **(제한적 사용 원칙 준수)**
    *   *⚠️ 웹 접근성 주의 (WCAG 2.1):* Midnight Blue 배경과 Deep Copper 색상의 대비율은 약 **3.9:1**로, 본문(Body)용 일반 텍스트에 쓰기에는 시인성이 낮습니다. 반드시 **18pt(24px) 이상의 대형 텍스트, 14pt 이상의 굵은 제목, 혹은 배경 박스나 장식 요소**에만 제한적으로 사용해야 합니다.
*   **Accent:** Clear Sky Blue (`#ADD8E6`) — 데이터 연결선(Flow), 그래프의 상승 추세, 시스템 아크.
*   **Neutral Text:** Light Gray (`#F3F4F6` ~ `#E5E7EB`) — 일반 가독성을 보장하기 위해 모든 본문 및 서브 텍스트에 적용.

### B. 타이포그래피 스펙 (Typography Tokens)
*   **폰트:** Pretendard (모든 텍스트에 적용).
*   **Title/H1:** Bold, 대비 색상 활용.
*   **Body:** Regular, 충분한 줄 간격 확보로 가독성 극대화.

### C. 인터랙션 및 모션 스펙 (Motion Guide)
1.  **데이터 흐름(Flow):** Clear Sky Blue 연결선이 좌측 상단에서 우측 하단으로 점진적으로 '연결'되며 데이터가 *처리되는* 느낌을 준다. (애니메이션 필수) [근거: Self-RAG]
    *   *모션 규격:* `stroke-dasharray` 및 `stroke-dashoffset`을 이용한 SVG 패스 드로잉 효과. 지속 시간 `1200ms`, 가속도 곡선 `cubic-bezier(0.25, 1, 0.5, 1)` (Ease Out Quad).
2.  **KPI 등장:** 수치(`3분`, `70%`)는 슬라이드인(Slide-in) 애니메이션과 함께 Deep Copper로 강조되면서, 마치 **시스템이 계산을 완료하고 결과를 제시하는 듯한 효과**를 준다.
    *   *모션 규격:* `translateY(15px) ➜ 0` 페이드인. 지연 시간(Delay) `300ms`를 주어 흐름선 작동 완료 후 등장. 지속 시간 `500ms`, 가속도 곡선 `cubic-bezier(0.16, 1, 0.3, 1)` (Out Expo).
3.  **CTA 전환:** 사용자가 페이지 하단에 도달하면 배경색이 미묘하게 어두워지며 집중도를 높이고, CTA 버튼만 Deep Copper로 빛나도록 처리한다.

### D. 반응형 레이아웃 가이드 (Responsive Breakpoints)
*   **Desktop:** 1200px 이상 — 기본 3열 그리드 및 양방향 스플릿 뷰 배치.
*   **Tablet:** 768px ~ 1199px — 2열 그리드로 가변 처리 혹은 가로 스와이프 레이아웃 적용. H1 크기는 `36pt`로 축소.
*   **Mobile:** 767px 이하 — 1열 수직 카드 레이아웃. 헤더 폰트는 `clamp(1.8rem, 5vw, 2.4rem)` 스케일링 적용, 터치 대상 크기 최소 44px 확보.

## 🛠️ 3. 개발/구현 가이드 (Developer Handover)
*   **Mockup 데이터 파이프라인 통합:** 모든 시각 자료는 '데이터를 읽고(Input) $\to$ 시스템으로 처리하고(Process, Accent Color) $\to$ 결과를 도출한다(Output, Deep Copper)'의 3단계 흐름을 반드시 따라야 한다.
*   **최종 아웃풋 형식:** Web/App 기반의 반응형 레이아웃 (Desktop First).