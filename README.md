# 사주팔자 — AI 심층 풀이

생년월일·시간으로 60갑자 사주팔자를 계산하고, AI(Groq llama-3.3-70b)가 실시간 스트리밍으로 풀이해주는 웹 서비스입니다.

## 기능

- 사주팔자 (년·월·일·시주) 정밀 계산 — 진짜만세력(고영창) 기반
- 양력/음력 입력 지원
- 오행 분석, 신살, 대운
- 십신·12운성·지장간
- AI 심층 풀이 (Groq 스트리밍 SSE)
- 건강·직업·운세·월별 탭

## 로컬 실행

```bash
npm install
cp .env.local.example .env.local  # API 키 설정
npm run dev
```

## 환경변수

`.env.local` 파일을 생성하고 아래 값을 입력하세요. (`.env.local`은 gitignore 처리되어 있습니다)

```
GROQ_API_KEY=...
KASI_SERVICE_KEY=...
NEXT_PUBLIC_FEEDBACK_URL=...   # 피드백 수집 엔드포인트 (선택)
```

## 기술 스택

- Next.js 16 (App Router) · TypeScript · Tailwind CSS
- Groq API (llama-3.3-70b-versatile) — 스트리밍 SSE
- KASI 공공데이터 API — 음양력 변환

## 라이선스

이 프로젝트는 MIT 라이선스로 공개합니다.

단, 사주 계산 엔진으로 **[@orrery/core](https://github.com/rath/orrery) (AGPL-3.0)** 를 사용합니다.
AGPL-3.0 조건에 따라 이 저장소의 소스코드를 공개합니다.
