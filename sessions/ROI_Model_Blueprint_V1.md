# 💰 [최종 산출물] 보배시즌 수익성 검증 모델 (ROI Model Blueprint) V1.0

## 🎯 목표
현빈이 제시한 가격 옵션(A/B/C)과 핵심 KPI(SSI-DS, FDR 등) 간의 인과관계를 수치적으로 검증하고, 궁극적으로 '월천만원' 달성 가능성을 예측하는 **ROI (Return On Investment) 모델** 구축을 위한 데이터 요구사항 및 분석 프레임워크를 정의합니다.

## 💡 핵심 전제 조건
1. **가치 측정의 전환:** 수익률(%) 중심 $\rightarrow$ **통제권 확보 경험(Predictability)** 중심 [근거: Researcher 개인 메모리 (3번)]
2. **KPI 연쇄 구조:** SSI-DS 상승 $\rightarrow$ LPI 상승 $\rightarrow$ FDR 개선으로 이어지는 선순환 구조를 측정합니다. [근거: 현빈 산출물 / Researcher 개인 메모리 (3번)]
3. **ROI의 정의:** $ROI = \frac{(총 수익 - 총 비용)}{총 비용}$

---

## 📊 파트 1: 데이터 요구사항 및 변수 정의 (Data Requirements)

| 구분 | 측정 항목 (KPI/Metric) | 정의 및 계산 방식 | 필요 데이터 소스 | 비고 / 중요성 |
| :--- | :--- | :--- | :--- | :--- |
| **A. 비용 측면 (Cost)** | **CAC (Customer Acquisition Cost)** | 마케팅 채널별 총비용 $\div$ 신규 고객 수. (채널별로 분리 측정 필수) | 광고 플랫폼 데이터, 운영 인건비 기록 | 가장 중요한 변수. A/B/C 각 경로의 CAC를 비교해야 함. |
| **B. 수익 측면 (Revenue)** | **LTV (Life Time Value)** | 평균 고객 생애 가치. $\text{평균 구독료} \times \text{예상 유지 기간}$. | 결제 시스템 데이터, 이탈률(Churn Rate) 예측 모델 | B와 C 옵션의 LTV를 극대화하는 것이 목표. |
| **C. 전환 및 행동 (KPI)** | **SSI-DS (System Stability Index Depth Score)** | 사용자가 대시보드 내 '시스템적 통제권' 관련 지표에 깊이 관여한 정도 (클릭/호버링 횟수 가중치 합). | 웹 로그 데이터 (Event Tracking), 히트맵 분석 결과 | **가장 중요한 선행 지표.** 이 점수가 높을수록 LPI 상승 확률 증가. [근거: Researcher 개인 메모리 (A)] |
| | **LPI (Lead Purchase Intent)** | SSI-DS를 통해 '구매 의도'로 전환된 비율. (예: 특정 상품 페이지 진입률) | 웹 로그 데이터 (Funnel Drop-off Modeling), 이벤트 추적 | Funnel의 2단계(Interest $\rightarrow$ Desire) 측정. |
| | **FDR (Final Decision Rate)** | 최종 결제 단계에 도달하여 실제로 구독/구매를 완료한 비율. | 결제 시스템 데이터, 퍼널 이탈 지점 모델링 결과 | 월천만원 달성의 직접적인 근거가 되는 핵심 전환율. [근거: Researcher 개인 메모리 (C)] |

---

## 📐 파트 2: ROI 분석 프레임워크 및 가설 검증 로직 (Analysis Framework)

### 1. 가격 옵션별 수익성 시뮬레이션 구조
| 가격 옵션 | 핵심 판매 메시지 | 예상 CAC 대비 LTV 비율 목표 | 주요 측정 변수 | 기대 효과 |
| :--- | :--- | :--- | :--- | :--- |
| **A (진단형)** | "일단 불안함을 해소하세요." | $LTV/CAC > 1.5$ (낮은 진입 장벽으로 대량 유입) | Funnel 상단 전환율, CAC 효율성 | 트래픽 확보 및 잠재 고객 풀(Pool) 확대. |
| **B (통제권 확보형)** | "시스템적 통제권을 직접 관리하세요." | $LTV/CAC > 3$ (지속적인 관계 구축) | SSI-DS $\rightarrow$ LPI 전환율, 구독 유지 기간 | 가장 이상적인 모델. 높은 LTV와 안정적인 수익 구조 확립. |
| **C (프리미엄)** | "완벽한 자동화 시스템을 소유하세요." | $LTV/CAC > 4$ (고가치 단일 계약) | 초기 고액 결제 전환율, 컨설팅 연계 성공률 | 최고 수익 극대화. 제한된 고객에게 집중하여 높은 가치를 제공. |

### 2. 인과관계 검증 모델 (Causal Linkage Model)
ROI는 단순히 $LTV - CAC$가 아닙니다. KPI를 통해 **'왜 이 가격 옵션이 효과적인지'**에 대한 논리적 근거를 제시해야 합니다.

$$ \text{Predicted ROI} = \frac{(\text{A/B/C 선택 시 예상 LTV}) - (\text{CAC})}{\text{CAC}} $$

*   **가설 검증 로직:**
    1.  **SSI-DS $\uparrow$ (불안감 자극) $\rightarrow$ LPI $\uparrow$ (관심 증대):** A 옵션 사용자가 SSI-DS를 높일수록, B 옵션으로의 전환율이 얼마나 증가하는가? (A $\to$ B Conversion Rate 측정)
    2.  **LPI $\uparrow$ (구매 의도) $\rightarrow$ FDR $\uparrow$ (결제 완료):** LPI가 특정 임계점(Threshold)을 넘었을 때, C 옵션으로의 최종 결제율이 얼마나 높아지는가? (B $\to$ C Conversion Rate 측정)

---
## 🛠️ 파트 3: 다음 단계 실행 계획 (Action Plan for Next Cycle)

1.  **데이터 확보:** 코다리 에이전트를 통해 정의된 모든 변수(CAC, SSI-DS 이벤트 로그 등)를 수집할 수 있는 기술적 인프라 구축을 최우선으로 진행합니다.
2.  **모델링:** 현빈과 함께 이 청사진을 기반으로 초기 시뮬레이션 가정을 설정하고, 대시보드에 반영할 KPI 계산 로직(Formula Sheet)을 확정합니다.

---