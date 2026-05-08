# 사주팔자 — AI 심층 풀이

생년월일·시간으로 60갑자 사주팔자를 계산하고, AI(Gemini 2.5 Flash)가 실시간 스트리밍으로 풀이해주는 웹 서비스입니다.

## 기능

- 사주팔자 (년·월·일·시주) 정밀 계산 — 진짜만세력(고영창) 기반
- 양력/음력 입력 지원
- 오행 분석, 신살, 대운
- 십신·12운성·지장간
- AI 심층 풀이 (Gemini 스트리밍 SSE)
- 건강·직업·운세·월별 탭

## 로컬 실행

```bash
npm install
cp .env.local.example .env.local  # API 키 설정
npm run dev
```

## 환경변수

`.env.local` 파일을 생성하고 아래 값을 입력하세요. (`.env.local`은 gitignore 처리되어 있습니다)

```bash
GOOGLE_AI_API_KEY=...
ANTHROPIC_API_KEY=...          # 선택(프리미엄 경로용)
KASI_SERVICE_KEY=...
NEXT_PUBLIC_GA_ID=...          # 선택
NEXT_PUBLIC_PAYPAL_CLIENT_ID=...
NEXT_PUBLIC_API_BASE=...       # 선택(기본은 현재 오리진)
NEXT_PUBLIC_FEEDBACK_URL=...   # 선택(외부 수집 엔드포인트)
```

## 기술 스택

- Next.js 16 (App Router) · TypeScript · Tailwind CSS
- Gemini 2.5 Flash API — 스트리밍 SSE
- KASI 공공데이터 API — 음양력 변환

## 버전 릴리즈

Conventional Commit 메시지를 기준으로 버전/체인지로그를 자동 갱신합니다.

```bash
# 기본(커밋 내역 기준으로 자동 판단)
npm run release

# 강제 버전 타입 지정
npm run release:patch
npm run release:minor
npm run release:major
```

실행 시 `package.json`, `CHANGELOG.md`가 업데이트되고 릴리즈 커밋 및 태그가 생성됩니다.

### 커밋 메시지 규칙

Husky + commitlint가 `commit-msg` 훅에서 Conventional Commit 형식을 검사합니다.

- 예시: `feat: add AI analysis retry flow`
- 예시: `fix: handle empty birth time input`

### pre-commit 품질 게이트

커밋 전에 Husky가 아래 검사를 자동 실행합니다.

- `npm run lint:staged`

`lint-staged` 설정으로 스테이징된 TypeScript(`.ts/.tsx/.mts/.cts`) 파일이 있을 때만 `npm run lint`를 실행하여 커밋 속도를 최적화합니다.

## 라이선스

이 프로젝트는 MIT 라이선스로 공개합니다.

단, 사주 계산 엔진으로 **[@orrery/core](https://github.com/rath/orrery) (AGPL-3.0)** 를 사용합니다.
AGPL-3.0 조건에 따라 이 저장소의 소스코드를 공개합니다.
