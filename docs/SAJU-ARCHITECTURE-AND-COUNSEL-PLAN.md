# 사주 서비스 구조 정리 & AI 상담 재구축 계획

> 저장일: 2026-05-17  
> repo: `saju-v2` (홈페이지 Oracle 배포 전용)  
> 토스 미니앱: `C:\커셔\토스 앱\사주팔자v1` (별도 코드베이스)

---

## 1. 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│ App UI                                                       │
│  /              → home-page-client.tsx                       │
│  /saju          → saju/page.tsx (~1600줄)                    │
│  chat-widget    → chat-widget.tsx (~2640줄) ← 재구축 대상    │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ core/pillar-calc                                             │
│  main-calculator.ts  → @orrery/core calculateSaju            │
│  five-phase-breakdown, grand-fortune, celestial-relations    │
│  korean-calendar-engine.ts                                   │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 해석·운세                                                     │
│  interpretation-db/matcher  (일주·직업·키워드 등)              │
│  daily-fortune              (오늘 운세·용신/기신)             │
│  ai-templates/blueprints    (AI 심층 풀이 프롬프트)          │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ AI                                                           │
│  fortune-stream (SSE)  ← 심층 풀이, 유지                      │
│  consult-post + saju-chat (JSON) ← 상담, 재구축              │
│  config/llm.ts (Gemini 2.5 Flash)                            │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 데이터                                                        │
│  core/data/* (음력·절기 표), manseryeok(클라), kasi-api       │
└─────────────────────────────────────────────────────────────┘
```

### API 라우트 (app/api)

| 경로 | 역할 | 재구축 시 |
|------|------|-----------|
| `fortune-stream` | AI 심층 풀이 (prompt → SSE) | **유지**, counsel 분기 제거 |
| `saju-chat` | AI 상담 JSON | **유일 상담 API로 유지** |
| `fortune-reply`, `saju-counsel`, `chat`, `consult` | 상담 중복 | **제거 또는 비활성** |
| `tts`, `stt` | 음성 | 파일 유지, 2단계에서 UI 연결 |
| `kasi`, `gemma`, `feedback`, `og` | 기타 | 유지 |

---

## 2. 사용자 여정 (한 번의 플로우)

1. `/saju` — 이름·성별·생년월일·시간(48슬롯 / 모름=-1) 입력
2. `calculate(SajuInput)` — orrery → 연·월·일·시주, 오행, 대운, 신살
3. 결과 UI — 7탭: 성격·운세·신살·대운·월별·직업·건강 + 오행·일주·오늘 운세
4. 「AI 심층 풀이」— `buildPrompt(result)` → `fetchStream` → `POST /api/fortune-stream` → `aiFortuneComplete=true`
5. 「AI 심층 상담」— `ChatWidget` (풀이 완료 후만) — **현재 불안정**

### SajuResult 핵심 필드

- `pillars`: [년, 월, 일, 시] (`Pillar | null`, 시 미입력 시 null)
- `ohaeng`, `daeun`, `shinsal`, `input`
- orrery 확장: `sipsin`, `unseong`, `jigang`

---

## 3. 레이어별 이해 수준 (2026-05-17 기준)

| 영역 | 이해 | 비고 |
|------|------|------|
| 사주 계산 (`main-calculator`, orrery) | **잘 파악** | `hourTotalMin: -1` = 시주 미입력 |
| 만세력/음력 (`core/data`, manseryeok, KASI) | **중간** | 메인은 orrery |
| 일진/오늘 운세 (`daily-fortune`) | **잘 파악** | |
| 정적 해석 DB (`interpretation-db`) | **중간** | 탭 연동 위주 |
| AI 심층 풀이 (`blueprints`, `fortune-stream`) | **잘 파악** | Draft 후 일괄 표시 |
| AI 상담 (`chat-widget`, 복수 API) | **깊음(문제 포함)** | 서버 200인데 UI 실패 사례 |
| 음성 (tts/stt, counselor-config) | **중간** | 위젯에 혼재 |
| 랜딩/SEO | **얕음** | |
| 배포 (Oracle PM2 :3001) | **파악** | `scripts/deploy-oracle.sh` |

### 아직 100% 정독하지 않은 부분

- `app/saju/page.tsx` 전체 (~1600줄+)
- `core/ai-templates/blueprints.ts` 프롬프트 전문 (~470줄)
- `core/data/` 음력·절기 대용량 표
- `@orrery/core` 내부 구현
- `/api/gemma`, `/api/feedback`, `home-page-client` 세부
- 토스 미니앱 repo 전체

---

## 4. AI 상담 — 현재 문제 요약

- `chat-widget.tsx` ~2640줄: 상담·음성·TTS·STT·궁합·후원·타이핑·API 폴백이 한 파일에 누적
- 상담 API 6경로 혼용 → 차단·캐시·`fortune-stream` 풀이와 URL 충돌
- 증상: 「답변을 불러오지 못했습니다」, Network에 `saju-chat` 없음, 배포 중 `?_rsc` 502
- 서버 `POST /api/saju-chat` 단독 테스트는 200 응답 확인됨 → **클라이언트·상태 꼬임** 쪽이 유력

### 배포 시 주의

- PM2 실행 중 `.next` 삭제 금지 → `scripts/deploy-oracle.sh` (stop → rm .next → build → start)
- 배포 직후 1~2분 502 가능 (nginx connect refused)

---

## 5. AI 상담 재구축 계획

**원칙:** `postConsult` / `counselor-config` / 심층 풀이는 **유지**. 상담 **UI + API 경로만** 새로 작성.

### Phase 0 — 준비 (0.5일)

- `chat-widget.tsx` → `app/_legacy/chat-widget.tsx` 이동
- `saju/page.tsx`에서 상담 임시 숨김 또는 「준비 중」
- 사주 분석 + AI 심층 풀이는 그대로

### Phase 1 — 백엔드 정리 (0.5일)

- **유지:** `core/api/consult-post.ts`, `app/api/saju-chat/route.ts`
- **제거:** `fortune-stream`의 `mode: counsel`, `fortune-reply`, `saju-counsel`, `chat`, `consult` 상담용
- `fortune-stream` = `{ prompt }` → SSE 만

**API 계약 (고정):**

```http
POST /api/saju-chat
{
  "messages": [{ "role": "user"|"assistant", "content": "..." }],
  "sajuContext": "...",
  "chatMode": "single",
  "counselorName": "도화"
}
→ 200 { "content": "..." }
```

### Phase 2 — 프론트 MVP (1~1.5일)

```
app/counsel/
  CounselPanel.tsx
  use-counsel-chat.ts
  build-saju-context.ts
  types.ts
```

- `POST /api/saju-chat` **한 경로만**, JSON만, 타이핑 효과 없음
- `turnGen` / 다중 API 폴백 / verifyPause **없음**
- 로딩 중 빈 말풍선에 에러 문구 표시하지 않음
- `aiSummaryReady` false 시 패널 닫기·메시지 초기화

**완료 기준:**

- [ ] 풀이 완료 → 「안녕」→ 3~8초 내 답변
- [ ] Network: `saju-chat` 200
- [ ] 연속 3턴 대화
- [ ] 풀이 중 상담 비활성

### Phase 3 — UI 폴리시 (0.5~1일)

- 플로팅 버튼·safe-area, 상담사 localStorage, 후원 안내

### Phase 4 — 음성 (1~2일, 별도)

- TTS 답변 듣기 → STT → iOS MediaRecorder

### Phase 5 — 궁합 모드 (선택, 1일)

### Phase 6 — 정리·배포

- `_legacy` 삭제, README/AGENTS 보강

**MVP 일정:** 약 2~3일 (텍스트 상담만)

**롤백:** `git revert` + `_legacy/chat-widget` import 복구

**권장 브랜치:** `feat/counsel-rewrite`

---

## 6. 삭제·유지 체크리스트

### 반드시 유지

- `app/saju/page.tsx`, `core/pillar-calc/*`, `core/daily-fortune/*`
- `core/ai-templates/blueprints.ts`, `core/http-client/stream-fetcher.ts`
- `app/api/fortune-stream` (prompt SSE)
- `core/api/consult-post.ts`, `core/counselor-config.ts`
- `app/api/tts`, `app/api/stt` (파일)

### 교체 후 제거

- `app/chat-widget.tsx` (→ `_legacy` → 삭제)
- 상담 중복 API 4개

---

## 7. 테스트 시나리오 (배포마다)

| # | 시나리오 | 기대 |
|---|----------|------|
| T1 | 사주 입력 → 분석 | 결과 표시 |
| T2 | AI 심층 풀이 | fortune-stream 200 |
| T3 | 풀이 전 상담 | 비활성/안내 |
| T4 | 풀이 후 「안녕」 | saju-chat 200, 답변 표시 |
| T5 | 배포 직후 | 1분 후 ?_rsc 502 없음 |
| T6 | 모바일 400px | 입력·전송 보임 |

---

## 8. 배포 (Oracle)

- SSH: `ubuntu@168.107.31.153`, dir: `/home/ubuntu/saju-v2`
- PM2: `saju-v2`, port `3001`
- 배포: `bash scripts/deploy-oracle.sh`
- 확인: `https://saju.coupax.co.kr/saju`

---

## 9. 관련 커밋 (상담 디버깅 이력)

- `00b37f8` — fortune-stream counsel mode
- `4b988ad` — deploy-oracle.sh, logo prefetch off
- `7336a6a` — saju-chat API, consult client hardening

---

*이 문서는 Cursor 대화에서 정리한 내용입니다. 구현 진행 시 이 파일을 기준으로 Phase를 체크하세요.*
