# Board Compose API ?곕룞 怨꾪쉷 (saju-v2)

## ??븷 ??以?(?ъ＜??vs board)

| | **saju-v2 (?ъ＜??** | **board (?덊럹?댁?)** |
|--|----------------------|----------------------|
| ?섎뒗 ??| ?붿옄쨌?쇱슫 **怨꾩궛** 쨌 吏덈Ц??reading_kind` 쨌 **移대뱶瑜????곌쾶 ??context/tags** 쨌 compose **1??* ?몄텧 쨌 ?붾㈃??**臾댁뾿???대뵒??* 肉뚮┫吏 | 移대뱶 **?쒖옉쨌PASS** 쨌 `context`濡?移대뱶 **留ㅼ묶쨌議고빀** 쨌 `text_chat` / `text_full` **?앹꽦** |
| ?섏? ?딅뒗 ??| `cards.json` ?섏젙 쨌 PASS 쨌 移대뱶 蹂몃Ц 濡쒖뺄 ?댁뼱 遺숈씠湲?쨌 吏덈Ц??compose ?ㅽ쉶 | ?붿옄 怨꾩궛 쨌 UX쨌踰꾩쟾蹂?kind ?뺤콉 |

**?듭떖:** saju-v2???쒖뭅???띿뒪??怨듭옣?앹씠 ?꾨땲??**移대뱶 ?ъ슜 ?꾨왂??寃곗젙?섎뒗 ??*?대떎. 湲곗〈 [`saju-knowledge.ts`](core/gemma24/saju-knowledge.ts)??`extractPromptFacts`, `cardKind`, [`council-card-request.ts`](core/gemma24/council-card-request.ts)???좏뵿쨌deep ?뱀뀡 異붾줎? **??젣?섏? ?딄퀬** ??compose ?붿껌??`reading_kind` + `context`/`tags`濡?**?댁쟾**?쒕떎. 濡쒖뺄 [`council-fortune-compose`](core/gemma24/council-fortune-compose.ts) / [`council-counsel-reply`](core/gemma24/council-counsel-reply.ts)???쒖뭅??body 遺숈씠湲겸앸쭔 compose ?묐떟 ?쒖떆濡??泥댄븳??

```mermaid
flowchart TB
  subgraph app [saju-v2 ?ъ＜??
    Calc[calculate + dailyFortune]
    Orch[card orchestration]
    Orch --> Kind[reading_kind]
    Orch --> Ctx[context tags summary]
    UI[?쒖떆 洹쒖튃]
  end
  subgraph board [board]
    Match[移대뱶 留ㅼ묶쨌議고빀]
    Text[text_chat text_full]
  end
  Calc --> Orch
  Kind --> Compose
  Ctx --> Compose
  Compose["POST .../reading/compose 횞1"] --> Match
  Match --> Text
  Text --> UI
```

---

## ?꾩옱 ?곹깭 vs 紐⑺몴

```mermaid
flowchart LR
  subgraph today [?꾩옱]
    A1[SajuResult] --> B1[buildChatContext 臾몄옄??
    B1 --> C1["POST /api/saju-chat"]
    C1 --> D1[council-counsel-reply cards.json]
    A2[buildPrompt] --> C2["POST /api/fortune-stream SSE"]
    C2 --> D2[council-fortune-compose + Groq]
  end

  subgraph target [紐⑺몴]
    A3[SajuResult + dailyFortune] --> O3[card orchestration]
    O3 --> B3[context JSON + tags]
    O3 --> E3["reading_kind + user_query"]
    B3 --> F3["POST coupax .../reading/compose 횞1"]
    E3 --> F3
    F3 --> G3[text_chat / text_full ?쒖떆]
    F3 -->|llm_required| H3[Gemini 蹂댁“留?
  end
```

| ??ぉ | ?꾩옱 ([`app/counsel/use-counsel-chat.ts`](app/counsel/use-counsel-chat.ts), [`app/api/fortune-stream/route.ts`](app/api/fortune-stream/route.ts)) | 紐⑺몴 |
|------|------|------|
| 移대뱶 ?ъ슜 寃곗젙 | ?깆씠 濡쒖뺄?먯꽌 移대뱶 寃?됀룹꽑?씲톌ody 議고빀 | ?깆씠 **kind + context**濡?board???꾩엫, 蹂몃Ц? ?묐떟留??쒖떆 |
| `reading_kind` / `text_chat` / `text_full` | ?놁쓬 | ?ㅽ럺 ?꾨뱶 ?ъ슜 |
| 梨꾪똿 蹂몃Ц | `tryCouncilCounselReply` + 濡쒖뺄 `cards.json` | board `display.body` (?깆? 留ㅼ묶??context 梨낆엫) |
| ?ъ링 10??| SSE + `AiRenderer` ?뚯떛 | `text_full` + (?좏깮) `sections[]` |
| 吏덈Ц??API | 移대뱶 寃?됀룹“???대? ?ㅽ쉶 | compose **1??* |

**?꾩젣:** board 履?[`board/docs/SAJU-V2-COMPOSE-INTEGRATION.md`](https://coupax.co.kr)媛 諛고룷?섏뼱 `SAJU_READING_API_ENABLED=1`?댁뼱???⑸땲?? 濡쒖뺄 workspace?먮뒗 ?대떦 臾몄꽌쨌compose ?쇱슦?멸? ?놁쑝誘濡? 援ы쁽 ??board repo?먯꽌 臾몄꽌瑜?[`docs/SAJU-V2-COMPOSE-INTEGRATION.md`](docs/SAJU-V2-COMPOSE-INTEGRATION.md)濡?蹂듭궗???먮뒗 寃껋쓣 0?④퀎濡?沅뚯옣?⑸땲??

---

## 1. ?좉퇋 core 紐⑤뱢 ??移대뱶 ?ㅼ??ㅽ듃?덉씠??(???듭떖)

[`core/reading/card-orchestration.ts`](core/reading/card-orchestration.ts) (?좉퇋) ??**吏덈Ц 1嫄대떦 compose ?붿껌 1嫄?*??留뚮뱶???⑥씪 吏꾩엯??

```ts
planComposeRequest({ result, userQuery, surface }): ComposeRequestBody
// ??{ reading_kind, topic?, user_query, context, surface }
```

?대??먯꽌 `resolveReadingKind` + `buildComposeContext` ?몄텧. UI쨌API ?쇱슦?몃뒗 ???⑥닔留??곕㈃ ?쒖뭅?쒕? ???곌쾶 ?좎??앷? ?쒓납??紐⑥씤??

### 1-1. `reading_kind` 寃곗젙 ??[`core/reading/resolve-reading-kind.ts`](core/reading/resolve-reading-kind.ts) (?좉퇋)

**?깆씠 1李⑤줈 `reading_kind`瑜?紐낆떆** (board `user_query` 異붾줎? 蹂댁“留?. 湲곗〈 [`isTodayFortuneQuestion`](core/gemma24/is-today-fortune-question.ts) 諛?[`council-card-request.ts`](core/gemma24/council-card-request.ts)??`INTERPRET_BY_TOPIC` / deep ?뱀뀡 ?뺢퇋?앹쓣 **洹몃?濡??댁떇**:

| ?ъ슜???⑦꽩 (?? | `reading_kind` | 異붽? ?꾨뱶 |
|------------------|----------------|-----------|
| ?ㅻ뒛???댁꽭, ?쇱슫 | `daily` | ??|
| ?ㅼ쓬?? ?대쾲 ?? ?붿슫 | `monthly` | ??|
| ?щЪ/?곗븷/吏곸뾽/嫄닿컯留?| `topic` | `topic: "?щЪ"` ??|
| ?ъ링 10?? ?꾩껜 ???| `full` | `surface: "fortune"` |
| ?섏쓽 ?댁꽭, ?ъ＜ ???(湲곕낯 梨꾪똿) | `summary` | `surface: "chat"` |

- ?곗꽑?쒖쐞: `full` > `daily` > `monthly` > `topic` > `summary` (寃뱀튂硫???援ъ껜?곸씤 kind)
- export: `resolveReadingKind(userQuery: string): { reading_kind; topic?; surface }`

### 1-2. `context` JSON ??[`core/reading/build-compose-context.ts`](core/reading/build-compose-context.ts) (?좉퇋)

**board 移대뱶 留ㅼ묶 ?덉쭏 = ?깆씠 ?ｋ뒗 context**. [`buildChatContext`](app/counsel/build-saju-context.ts) + [`extractPromptFacts`](core/gemma24/saju-knowledge.ts) + [`dailyFortune`](core/daily-fortune/index.ts) + (monthly ?? [`buildMonthlyBriefs`](core/daily-fortune/monthly-brief.ts)瑜??⑹퀜 ?ㅽ럺 ?꾨뱶 ?앹꽦.

`reading_kind`蹂꾨줈 board媛 湲곕??섎뒗 ?좏샇瑜?**?깆씠 梨꾩?** (?ㅽ럺 짠3):

| kind | ?깆씠 context??諛섎뱶???ㅼ뼱 蹂대궪 寃?|
|------|-----------------------------------|
| `daily` | `day_fortune`, `ilun`, `today_ten_god`, tags???쇱슫쨌?ㅻ뒛 ?좎쭨 |
| `monthly` | `wolun`, `month_fortune`, tags??`?붿슫` |
| `topic` | body `topic` + tags???щЪ/?곗븷/吏곸뾽/嫄닿컯 |
| `summary` | `summary`, `day_master`, `geok`, `pillars`, ?⑹떊쨌?ㅽ뻾 tags |
| `full` | ??+ ??떊쨌?ㅼ썙??(?ъ링 10?덉슜, ?붿옄 ?λЦ? ?묐떟 `text_full`留? |

湲곗〈 濡쒖뺄 留ㅼ묶怨??숈씪??facts ?뚯뒪 ?좎?:

```ts
// ?덉떆 異쒕젰 ?뺥깭 (??낆? board 臾몄꽌? 留욎땄)
{
  summary: "蹂묓솕 ?쇱＜, ?뺢?寃???,  // ??以?紐낆떇
  tags: ["蹂묓솕", "?뺢?寃?, "?⑹떊", "??, "?붿슫"],
  day_master: "蹂?,
  geok: "?뺢?寃?,
  pillars: ["媛묒쭊", "蹂묒닠", ??,
  elements: number[],           // ?ㅽ뻾 counts
  ten_gods: string[],           // sipsin 諛곗뿴
  keywords: string[],
  // daily
  day_fortune, ilun, today_ten_god,
  // monthly
  wolun, month_fortune,
  // topic ???붿껌 body??topic 蹂꾨룄
}
```

- `summary`/`geok`: `extractPromptFacts(sajuContextString)` ?ъ궗??- `tags`: facts + kind蹂??ㅼ썙??(`cardKind` taxonomy? 留욌뒗 ?쇰꺼 ??`deep-7` ????ъ슜??facing `?щЪ` ??
- (?좏깮) board ?ㅽ럺??`hints` ?꾨뱶媛 ?덉쑝硫?`inferCouncilCardNeeds` / `pickConsultDeepIds` 寃곌낵瑜?**移대뱶 ID媛 ?꾨땶 ?쒕ぉ쨌kind ?뚰듃**濡쒕쭔 ?꾨떖 ???깆? ?ъ쟾??body 議고빀 ????- `daily` / `monthly`: 媛곴컖 `dailyFortune`, `buildMonthlyBriefs`?먯꽌 梨꾩?

### 1-3. Compose ?대씪?댁뼵????[`core/reading/compose-client.ts`](core/reading/compose-client.ts) (?좉퇋)

- ?붿껌 ??? `{ surface, user_query, reading_kind, context, topic? }`
- ?묐떟 ???(?ㅽ럺 湲곗?, board 臾몄꽌濡??뺤젙):
  - `text` / `text_chat`, `text_full`, `display: { headline, body }`, `sections[]`, `mode`, `llm_required`
- ?먮윭: HTTP 404 ???ъ슜??硫붿떆吏 `"????쒕쾭 ?먭? 以?` ([`core/user-messages.ts`](core/user-messages.ts)???곸닔 異붽?)

### 1-4. LLM 蹂댁“ ??[`core/reading/compose-llm-supplement.ts`](core/reading/compose-llm-supplement.ts) (?좉퇋)

`llm_required: true`???뚮쭔 ?숈옉:

- ?낅젰: board媛 以 `text_chat`(?덈궡 臾멸뎄) + 鍮?吏㏃? `sections` ?먮뒗 蹂몃Ц &lt; 220??- **Gemini 2.5留?* ([`fetchLlmCompletionText`](core/config/llm.ts), Groq 寃쎈줈 ?ъ슜 ???????ㅽ럺 1-5)
- 湲곗〈 [`council-fortune-hybrid.ts`](core/gemma24/council-fortune-hybrid.ts)???쒕퉰 ?뱀뀡留?蹂댁땐??濡쒖쭅??李멸퀬?섎릺, 移대뱶 議고빀쨌Groq 遺꾧린???쒓굅

---

## 2. API ?꾨줉??(CORS쨌鍮꾨???

saju-v2??[`saju.coupax.co.kr`](docs/FULL-ARCHITECTURE.md) ??蹂꾨룄 ?ㅻ━吏꾩뿉???숈옉?????덉쑝誘濡? 釉뚮씪?곗??먯꽌 `https://coupax.co.kr` 吏곸젒 ?몄텧 ???**?쒕쾭 ?꾨줉??* 沅뚯옣:

| ?뚯씪 | ??븷 |
|------|------|
| [`app/api/saju/reading/compose/route.ts`](app/api/saju/reading/compose/route.ts) | body 寃利???`SAJU_READING_API_BASE`濡?fetch ??JSON 洹몃?濡?諛섑솚 |
| [`.env.local.example`](.env.local.example) | `SAJU_READING_API_BASE=https://coupax.co.kr`, `SAJU_READING_COMPOSE_ENABLED=1` |

- Rate limit: 湲곗〈 [`makeRateLimiter`](core/http-client/rate-limit.ts) ?⑦꽩 (counsel 20/min ?섏?)
- `SAJU_READING_COMPOSE_ENABLED=0` ?먮뒗 upstream 404 ??`{ error: '????쒕쾭 ?먭? 以? }` + 503

?대씪?댁뼵?몃뒗 湲곗〈怨?媛숈씠 `NEXT_PUBLIC_API_BASE` + `/api/saju/reading/compose` ?몄텧 ([`use-counsel-chat.ts`](app/counsel/use-counsel-chat.ts) ?⑦꽩 ?ъ궗??.

---

## 3. UI ?곕룞 (援ы쁽 ?쒖꽌 = ?ъ슜???ㅽ럺 짠7)

### Phase 1 ??梨꾪똿: compose 1??+ `text_chat`

**[`app/counsel/use-counsel-chat.ts`](app/counsel/use-counsel-chat.ts)**

- `send()`?먯꽌 `/api/saju-chat` ???`/api/saju/reading/compose` ?몄텧
- body: `user_query`, `resolveReadingKind()`, `buildComposeContext()`, `surface: 'chat'`
- ?묐떟 ??assistant 踰꾨툝 **1媛?*: `display.body ?? text_chat ?? text`
- **??吏덈Ц = ??踰꾨툝** ?좎? (移대뱶 ?쒕ぉ蹂??ㅼ쨷 硫붿떆吏 湲덉?)
- `daily` 吏덈Ц ?? 蹂몃Ц ?꾩뿉 ?쇱슫 硫뷀? 移?1以?([`DailyFortuneCounselPayload`](core/daily-fortune/counsel-format.ts) ???좎쭨쨌媛꾩?쨌??떊쨌level留? ?ㅼ썙?쒕쭔 ?⑤룆 ?쒖떆 湲덉?)

**[`app/counsel/CounselPanel.tsx`](app/counsel/CounselPanel.tsx)**

- assistant 硫붿떆吏??`metaChips?: string[]`, `deepLink?: { text_full }` ?뺤옣 (?먮뒗 compose ?묐떟??ref??蹂닿?)
- `text_full`???덉쑝硫??뚯떖痢????蹂닿린?띯넂 紐⑤떖/?섏쐞 ?붾㈃

濡쒖뺄 [`tryCouncilCounselReply`](core/gemma24/council-counsel-reply.ts) / [`buildTodayFortuneCounselReply`](core/daily-fortune/counsel-format.ts)??compose 寃쎈줈?먯꽌 **?몄텧?섏? ?딆쓬** (?꾪솚湲곗뿉??env濡?湲곗〈 寃쎈줈 ?좎? 媛?????꾨옒 짠6).

### Phase 2 ??`reading_kind` 留ㅽ븨 QA

- [`scripts/verify-reading-kind.mjs`](scripts/verify-reading-kind.mjs): ?ㅽ럺 ???섑뵆 臾몄옣 ??kind assertion
- counsel send ?꾩뿉 kind 濡쒓퉭 (dev only)

### Phase 3 ???ъ링 ?붾㈃ `text_full`

**[`app/saju/page.tsx`](app/saju/page.tsx) `askAI()`**

- ?꾩옱: `buildPrompt` ??[`fetchStream`](core/http-client/stream-fetcher.ts) ??SSE ??`AiRenderer` ?뚯떛
- 蹂寃? `reading_kind: 'full'`, `surface: 'fortune'`濡?compose 1????`text_full`??`aiText`???ㅼ젙
- 濡쒕뵫 UX??湲곗〈 4?④퀎 ?곗텧 ?좎? 媛??(?ㅽ듃?뚰겕 1?뚮줈 ?⑥닚??
- `AiRenderer`: `text_full`??`[1]`??[10]` ?뺤떇?대㈃ 湲곗〈 ?꾩퐫?붿뼵 ?좎?; ?꾨땲硫?plain markdown 釉붾줉

**?좉툑 ?댁젣:** `aiFortuneComplete`??compose ?깃났 + `text_full` 湲몄씠 ?꾧퀎(?? &gt; 500?? ??true ???곷떞 ?⑤꼸 ?닿린 議곌굔 ?좎?.

### Phase 4 ??`llm_required` ??Gemini

- compose ?묐떟 ???쒕쾭 ?꾨줉???먮뒗 ?대씪?댁뼵???꾩쿂由ъ뿉??`compose-llm-supplement` ?ㅽ뻾
- **鍮?梨꾪똿쨌?ㅼ썙?쒕쭔 ?몄텧 湲덉?** (?ㅽ럺 QA): 理쒖쥌 `text_chat` 湲몄씠 &gt; 80, ?쒓뎅??2臾몄옣 ?댁긽 寃利???踰꾨툝 媛깆떊
- `mode: 'card_compose'` ??supplement ?앸왂

### Phase 5 ??`sections[]` ?꾩퐫?붿뼵 (?좏깮)

- compose媛 `sections[{ card_title, excerpt }]` ?쒓났 ?? ?ъ링 ?붾㈃?먯꽌 excerpt + ?쇱튂湲? **?덈쭏??API ?ы샇異??놁쓬**
- 梨꾪똿?먯꽌??sections 誘몄궗??(?붿빟留?`text_chat`)

### Phase 6 ??QA 泥댄겕由ъ뒪??(?먮룞 + ?섎룞)

| 泥댄겕 | 諛⑸쾿 |
|------|------|
| ?뚮굹???댁꽭?띯넂 summary, text_chat &gt; 80 | e2e ?먮뒗 verify ?ㅽ겕由쏀듃 |
| ?뚯삤?섏쓽 ?댁꽭?띯넂 daily, ?ъ링 [1] ?놁쓬 | kind + `text_full` empty assert |
| ?뚮떎?뚮떖?띯넂 monthly | kind + context tags???붿슫 |
| 吏덈Ц 1媛쒕떦 compose 1??| ?꾨줉??濡쒓렇 / dev counter |
| 蹂몃Ц ??硫뷀?留?| ?묐떟 湲몄씠쨌湲덉? ?⑦꽩 ?뚯뒪??|
| ?ъ링 = text_full 10??遺꾨웾 | 湲몄씠 &gt; N, `[10]` ?ы븿 |

---

## 4. 嫄대뱶由ъ? ?딆쓣 寃?/ ?깆뿉 ?④린??寃?(?ㅽ럺 짠2)

**?깆씠 ?섏? ?딆쓬**

- [`cards.json`](core/data/) 蹂몃Ц ?묒꽦쨌?섏젙, PASS, dedupe cron
- 濡쒖뺄 [`council-fortune-compose`](core/gemma24/council-fortune-compose.ts) / [`council-counsel-reply`](core/gemma24/council-counsel-reply.ts)濡?**移대뱶 body ?댁뼱 遺숈씠湲?* (compose ON ??誘명샇異?
- 媛숈? 吏덈Ц??compose ?ㅽ쉶 ?몄텧
- compose ?놁씠 移대뱶 ?띿뒪?몃쭔?쇰줈 梨꾪똿 梨꾩슦湲?
**?깆씠 怨꾩냽 ??(移대뱶 ???곌린 = ?ш린)**

- [`saju-knowledge.ts`](core/gemma24/saju-knowledge.ts) ??`extractPromptFacts`, `cardKind` (context/tags ?앹꽦?? 濡쒖뺄 RAG 議고빀? compose 寃쎈줈?먯꽌留?以묐떒)
- [`council-card-request.ts`](core/gemma24/council-card-request.ts) ???좏뵿쨌deep ?뺢퇋????`resolveReadingKind` / tags
- [`is-today-fortune-question.ts`](core/gemma24/is-today-fortune-question.ts)
- ?붿옄쨌?쇱슫 ?붿쭊, ?쒖떆 洹쒖튃(踰꾨툝 1媛? ?쇱슫 移? ?ъ링 留곹겕)
- `llm_required` ??Gemini 蹂댁땐 (鍮??ㅼ썙?쒕쭔 ?몄텧 諛⑹?)

**?좎?:** [`core/pillar-calc`](core/pillar-calc/main-calculator.ts), [`daily-fortune`](core/daily-fortune/index.ts), TTS/STT, ??UI [`DailyFortuneCard`](app/saju/page.tsx).

**?꾪솚湲?** `SAJU_READING_LEGACY_FALLBACK=1`?대㈃ compose ?ㅽ뙣 ?쒖뿉留?湲곗〈 濡쒖뺄 議고빀 ???됱긽?쒕뒗 ?ㅼ??ㅽ듃?덉씠??寃쎈줈媛 湲곕낯.

---

## 5. ?섍꼍 蹂??
```env
# ?쒕쾭 (?꾨줉??
SAJU_READING_API_BASE=https://coupax.co.kr
SAJU_READING_COMPOSE_ENABLED=1

# ?꾪솚湲?(?좏깮)
SAJU_READING_LEGACY_FALLBACK=0   # 1?대㈃ compose ?ㅽ뙣 ??湲곗〈 saju-chat/fortune-stream

# ?대씪?댁뼵??(蹂寃??놁쓬)
NEXT_PUBLIC_API_BASE=
```

board ?쒕쾭: `SAJU_READING_API_ENABLED=1` (?댁쁺 coupax).

---

## 6. 留덉씠洹몃젅?댁뀡쨌由ъ뒪??
| 由ъ뒪??| ???|
|--------|------|
| compose API 誘몃같??| ?꾨줉??503 + ?먭? 臾멸뎄; `LEGACY_FALLBACK` env (?꾪솚湲곕쭔) |
| `context` ?덉쭏 | `extractPromptFacts` + pillars/tags ?띾??? board 留ㅼ묶 ?ㅽ뙣 ??`llm_required` 利앷? ??Phase 4 |
| ?ъ링 UX ?뚭? | `text_full` ?놁쑝硫?askAI 踰꾪듉 鍮꾪솢??+ ?덈궡 |
| Oracle 諛고룷 | 湲곗〈 [`scripts/deploy-oracle.sh`](scripts/deploy-oracle.sh); env??`SAJU_READING_API_BASE` 異붽? |

**沅뚯옣 濡ㅼ븘??** counsel(Phase 1??) ??QA ??fortune `full`(Phase 3) ??llm supplement(Phase 4) ??sections(Phase 5).

---

## 7. ?뚯씪 蹂寃??붿빟

| ?좉퇋 | ?섏젙 |
|------|------|
| `docs/SAJU-V2-COMPOSE-INTEGRATION.md` | `use-counsel-chat.ts`, `CounselPanel.tsx` |
| `core/reading/*` (5 files: **card-orchestration** ?ы븿) | `app/saju/page.tsx` (`askAI`, deep link) |
| `app/api/saju/reading/compose/route.ts` | `.env.local.example`, `user-messages.ts` |
| `scripts/verify-reading-kind.mjs` | (?좏깮) `fortune-stream/route.ts` ??compose ON ??議곌린 return |

湲곗〈 council/gemma24 紐⑤뱢? ??젣?섏? ?딄퀬, compose ?뚮옒洹멸? 爰쇱쭊 媛쒕컻 ?섍꼍쨌濡ㅻ갚?⑹쑝濡??붿〈.
