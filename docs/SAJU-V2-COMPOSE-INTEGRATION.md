# saju-v2 ↔ board Compose 연동 스펙

> **원칙:** 카드 제작·PASS·본문 수정은 **board(홈페이지)**. 앱(saju-v2)은 **사주 계산 + 카드 사용 전략(reading_kind, context) + compose API 1회 + 화면 표시**만.

동일 스펙 원본: `board/docs/SAJU-V2-COMPOSE-INTEGRATION.md` (coupax homepage repo)

구현 계획: [BOARD-COMPOSE-PLAN.md](./BOARD-COMPOSE-PLAN.md)

---

## 역할 나눔

| board | saju-v2 (사주앱) |
|-------|------------------|
| 카드 제작·PASS·조합 API | 팔자·일운 계산 |
| `text_chat` / `text_full` 생성 | **어떤 kind로 부를지** + **context/tags** + **어디에 무엇을 뿌릴지** |

saju-v2는 **카드 본문을 로컬에서 이어 붙이지 않는다.** 기존 `saju-knowledge` / `council-card-request`의 매칭·토픽 추론은 **compose 요청 품질**로 이전한다.

---

## 1. 앱이 하는 일

### 1-1. 사주 계산 (앱 내부)

- 생년월일시 → 사주팔자·일간·격·용신/기신 등
- **일운** (오늘 간지, 십신, 등급·키워드) — 보조 메타용
- board에는 **계산 결과만** `context` JSON으로 전달 (board는 팔자 계산 안 함)

### 1-2. 질문 → `reading_kind` (앱 1차 담당)

| 사용자 말 | `reading_kind` |
|-----------|----------------|
| 오늘의 운세, 일운 | `daily` |
| 다음달, 이번 달, 월운 | `monthly` |
| 나의 운세, 사주 풀이 (채팅) | `summary` |
| 재물/연애/직업만 | `topic` + `topic: "재물"` 등 |
| 심층 10절, 전체 풀이 | `full` |

서버도 `user_query`로 추론 가능하지만, **앱에서 명시하는 것**이 우선 (버전·UX 통제).

### 1-3. compose API (질문당 1회)

```
POST https://coupax.co.kr/api/saju/reading/compose
Content-Type: application/json
```

앱에서는 CORS 회피를 위해 `POST /api/saju/reading/compose` 프록시 권장.

**요청 예시 (채팅):**

```json
{
  "surface": "chat",
  "user_query": "나의 운세",
  "reading_kind": "summary",
  "context": {
    "summary": "병화 일주, 정관격 …",
    "tags": ["병화", "일주", "용신", "토"],
    "day_master": "병",
    "geok": "정관격",
    "pillars": ["갑진", "병술", "…"],
    "day_fortune": "戊戌",
    "today_ten_god": "편인"
  }
}
```

- `daily`: `day_fortune`, `ilun`, `today_ten_god`
- `monthly`: `wolun`, `month_fortune`, tags에 `월운`
- `topic`: `topic: "재물"` (또는 연애/직업/건강)

### 1-4. 응답 필드 (표시 규칙)

| 화면 | 쓸 필드 | 쓰지 말 것 |
|------|---------|------------|
| 채팅 버블 | `display.body` 또는 `text_chat` | 일운 키워드·「보통」만 단독 표시 |
| 심층 10절 | `text_full` | `text_chat` 잘라 쓰기 |
| 절별 펼치기 | `sections[].excerpt` + `card_title` | 카드마다 API 재호출 |
| 헤드라인 | `display.headline` 또는 `context.summary` | — |

- `mode: "card_compose"` → 텍스트 그대로 표시
- `mode: "llm"` + `llm_required: true` → Gemini 보조 (1-5)
- `text` = `text_chat` (하위 호환)

### 1-5. LLM 보조 (앱)

- `llm_required: true` 이면 빈 채팅·키워드만 노출 금지
- board `text_chat`(안내) + Gemini로 빈 섹션·220자 미만 보충
- Groq 미사용, Gemini 2.5

### 1-6. UI/UX

- 한 질문 = 한 버블
- 채팅: 요약 → 「심층 풀이 보기」→ `text_full`
- 일운 메타는 상단 칩/한 줄만, 본문은 board `text_chat`
- API 404 → 「풀이 서버 점검 중」 (`SAJU_READING_API_ENABLED` 꺼짐)

---

## 2. 앱이 하지 않는 일

- `cards.json` 본문 작성·수정
- PASS / dedupe / cron 제작
- 카드 여러 장 로컬 이어 붙이기
- 같은 질문에 compose 여러 번
- board 없이 카드 텍스트만으로 채팅 채우기

---

## 3. `context` 필드 (매칭 품질)

| 필드 | 설명 |
|------|------|
| `summary` | 명식 한 줄 요약 |
| `tags` | 일간, 격, 용신, 오행, 일운 등 |
| `day_master`, `geok` | 일간·격국 |
| `elements`, `ten_gods` | 오행·십신 배열 |
| `pillars`, `keywords` | 팔자·키워드 |
| `day_fortune`, `today_ten_god` | daily용 |
| `wolun`, `month_fortune` | monthly용 |

---

## 4. QA 체크리스트

- [ ] 「나의 운세」→ `summary`, `text_chat` 길이 > 80, 2문장 이상
- [ ] 「오늘의 운세」→ `daily`, 심층 [1]·팔자 장문 없음
- [ ] 「다음달」→ `monthly`
- [ ] 질문 1개당 `reading/compose` 1회
- [ ] 본문 ≠ 키워드만
- [ ] 심층 화면 = `text_full` (10절 분량)

---

## 5. 환경

| 항목 | 값 |
|------|-----|
| API Base | `https://coupax.co.kr` (스테이징 가능) |
| Endpoint | `/api/saju/reading/compose` |
| 앱 env | `SAJU_READING_API_BASE`, `SAJU_READING_COMPOSE_ENABLED` |
| board 전제 | `SAJU_READING_API_ENABLED=1` |

---

## 6. 구현 순서 (앱)

1. compose 1회 + `text_chat` 채팅
2. `reading_kind` 매핑
3. 심층 `text_full`
4. `llm_required` → Gemini
5. `sections[]` 아코디언 (선택)
6. QA 통과
