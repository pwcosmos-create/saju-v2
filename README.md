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
NEXT_PUBLIC_API_BASE=...       # 선택(기본은 현재 오리진). 클라이언트가 다른 호스트의 `/api/*` 를 쓸 때
NEXT_PUBLIC_FEEDBACK_URL=...   # 선택(외부 수집 엔드포인트)
```

## 기술 스택

- Next.js 16 (App Router) · TypeScript · Tailwind CSS
- Gemini 2.5 Flash API — 스트리밍 SSE
- KASI 공공데이터 API — 음양력 변환

## 홈페이지와 토스 미니앱 (저장소 분리)

**홈페이지**(이 저장소 `saju-v2`)와 **앱인토스 WebView 미니앱**은 **서로 다른 폴더**에서 관리합니다. 한쪽만 수정하면 **다른 쪽 소스에는 반영되지 않습니다**(자동 동기화 없음).

| 구분 | 위치 / 배포 |
|------|----------------|
| **홈페이지** | 이 저장소 → Oracle VM, PM2, `npm run build` + `next start` |
| **미니앱** | `C:\커셔\토스 앱\사주팔자v1` → `npm run build:toss`, `npm run ait:build`, 앱인토스 콘솔 `.ait` 등록(해당 폴더의 `README.md` 참고) |

미니앱은 정적 번들이라 API는 별도 호스트의 `/api/*` 를 쓰는 경우가 많습니다. 운영·트래픽을 더 분리하려면 홈과 **다른 도메인**에 API를 두고, 미니앱 빌드 환경에만 그 URL을 `NEXT_PUBLIC_API_BASE` 로 넣는 방식을 권장합니다.

## 운영 배포 (Oracle 서버)

이 프로젝트의 홈페이지 운영 서버는 Oracle Cloud VM입니다.

- 서버: `ubuntu@168.107.31.153`
- 운영 경로: `/home/ubuntu/saju-v2`
- 프로세스 매니저: PM2
- 앱 프로세스명: `saju-v2`
- 현재 서비스 포트: `3001` (`npm start -- -p 3001`으로 운영 중)
- 주의: **홈페이지**만 이 경로에서 Oracle·PM2로 배포합니다. **미니앱**은 `C:\커셔\토스 앱\사주팔자v1`에서 빌드한 `.ait` 를 **앱인토스 콘솔**에 등록하는 흐름이며, 홈 `git pull` 과 **동시에 돌릴 필요 없음**.

배포 기본 절차:

```bash
ssh -i ~/.ssh/shinserver.key ubuntu@168.107.31.153
cd /home/ubuntu/saju-v2
git pull origin main
npm install
npm run build
pm2 restart saju-v2 --update-env
pm2 save
```

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
