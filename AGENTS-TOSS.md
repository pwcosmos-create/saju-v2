# Toss WebView Mini App Development Guidelines (`AGENTS-TOSS.md`)

This document defines the technical constraints, build pipelines, and SDK integration rules that AI development agents must strictly follow when working on the **Toss WebView Mini App** context of the Saju service.

---

## 🚨 Critical Architectural Constraints

### 1. Static HTML Export Mode (`output: "export"`)
- The Toss WebView runs client-side as a packaged static bundle (`.ait`).
- Next.js **App Router API Routes** (`app/api/*`) are **NOT supported** within the client bundle and will cause build failures if left in the active path during a static export build.
- **Rule**: Never add or rely on server-side logic, headers, or runtime middleware for the Toss WebView bundle.

### 2. Build Pipeline (`npm run build:toss`)
- Always build the Toss WebView package using the designated script:
  ```bash
  npm run build:toss
  ```
- This command executes [scripts/build-toss.mjs](file:///c:/커셔/토스%20앱/3----완료-----/사주팔자v2/scripts/build-toss.mjs), which performs the following operations:
  1. Temporarily stashes the `app/api` directory to `app/_api_stashed_for_toss_export`.
  2. Bundles the standalone client-side calculation file [lib/toss-standalone-analyze.ts](file:///c:/커셔/토스%20앱/3----완료-----/사주팔자v2/lib/toss-standalone-analyze.ts) into `public/toss-analyze.js` using `esbuild`.
  3. Triggers `next build` under static export conditions (`TOSS_BUILD=1`).
  4. Restores the stashed `app/api` directory immediately after the build completes.
- **Rule**: If the build fails or is interrupted, check if `app/api` has been stashed, and manually rename `app/_api_stashed_for_toss_export` back to `app/api` if necessary.

---

## 🛠️ Toss Native SDK Integrations (`@apps-in-toss/web-framework`)

All native APIs must be accessed safely via the `@apps-in-toss/web-framework` library.

### 1. In-App Purchases (IAP)
- Consumable product grants (counseling session minutes) are processed via [lib/toss-counsel-iap.ts](file:///c:/커셔/토스%20앱/3----완료-----/사주팔자v2/lib/toss-counsel-iap.ts).
- Always use `IAP.createOneTimePurchaseOrder` and `IAP.completeProductGrant` to manage the purchase state securely.
- Track verified purchases using the native secure storage wrapper `Storage.getItem` and `Storage.setItem`.

### 2. Rewarded Fullscreen Ads
- Preloading and displaying fullscreen ads must utilize the group ID `ait.v2.live.6e873e2eea174a0d`.
- Implementations reside in [lib/toss-rewarded-ad.ts](file:///c:/커셔/토스%20앱/3----완료-----/사주팔자v2/lib/toss-rewarded-ad.ts).
- Preload ads early (`preloadSajuRewardedAd`) to reduce loading latency when the user triggers an action.

### 3. Out-Of-App Redirection (Deep Links)
- Redirect user flow from external browsers (Instagram, KakaoTalk, TikTok) into the Toss Mini App using `intoss-private://saju-coupax`.
- Helper function `redirectToTossMiniApp` is located in [lib/toss-mini-app-link.ts](file:///c:/커셔/토스%20앱/3----완료-----/사주팔자v2/lib/toss-mini-app-link.ts).

### 4. Notification & Campaign Messaging
- Sending automated notification channels (Push, Inbox, SMS, Alimtalk) must call the companion backend integration in [lib/toss-messenger.ts](file:///c:/커셔/토스%20앱/3----완료-----/사주팔자v2/lib/toss-messenger.ts) via `https://apps-in-toss-api.toss.im`.

---

## 🌐 WebView Communication & Navigation Helpers

### 1. Iframe postMessage Bridge for POST Requests (`lib/toss-http.ts`)
- In some Android/iOS WebView environments, direct cross-origin POST fetches are blocked due to security restrictions.
- **Rule**: Never call standard `fetch` or custom Axios instances directly for POST communications.
- **Solution**: Always use the iframe-based postMessage bridge wrappers:
  - Chat: `tossChat(body)`
  - Counseling: `tossSajuCounsel(body)`
  - Fortune Stream: `tossFortune(prompt)`
  - TTS Audio: `tossTts(text, counselorName)`
- These bridge calls are serialized via `bridgeQueue` in [lib/toss-http.ts](file:///c:/커셔/토스%20앱/3----완료-----/사주팔자v2/lib/toss-http.ts) to prevent postMessage collisions.

### 2. Custom Navigation Anchors (`lib/toss-nav-anchor.tsx`)
- Standard Next.js `<Link>` or relative `<a href="...">` anchors can fail in static file WebViews because routes must resolve as physical files (e.g. `saju.html` or `saju/index.html`).
- **Rule**: Always wrap internal page navigations in the custom [TossNavAnchor](file:///c:/커셔/토스%20앱/3----완료-----/사주팔자v2/lib/toss-nav-anchor.tsx) component. This sets `data-saju-go` and `data-saju-href` attributes that hook into native layouts for seamless file-based transitions.

### 3. DOM-Based Form Parsing (`lib/toss-form-read.ts`)
- Since the offline calculation script (`toss-analyze.js`) executes in the browser layout independently of React hydration, it reads birth details directly from DOM node selectors.
- **Helper**: Use `readSajuFormFromDom()` from [lib/toss-form-read.ts](file:///c:/커셔/토스%20앱/3----완료-----/사주팔자v2/lib/toss-form-read.ts) to parse birth date, gender, and calendar type values directly from the DOM `.form-card`.

---

## 🔊 TTS Voice Chat & Speech Processing

### 1. TTS Text Normalization
- **Rule**: Saju/Fortune interpretations contain Chinese characters (Hanja) and markdown markers that sound unnatural when spoken. Always normalize text before sending to Speech Synthesis:
  - Strip Hanja and markdown syntax using `stripHanjaForSpeech(text)` in [lib/korean-tts.ts](file:///c:/커셔/토스%20앱/3----완료-----/사주팔자v2/lib/korean-tts.ts).
  - Extract only the core counsel card paragraphs (exclude intro, disclaimer, PM2/coupon footnotes) using `extractCounselVoiceAnswer(content)` in [lib/counsel-voice-answer.ts](file:///c:/커셔/토스%20앱/3----완료-----/사주팔자v2/lib/counsel-voice-answer.ts).

### 2. Dual-Path Playback (Client SpeechSynthesis vs. Server Audio)
- **Local SpeechSynthesis**: Fallback to browser Web Speech API for low-cost offline playback. Mapped to counselor genders (e.g. Dohwa = Female, Yujin = Male) via [core/counselor-config.ts](file:///c:/커셔/토스%20앱/3----완료-----/사주팔자v2/core/counselor-config.ts) and chosen using `pickCounselorKoVoice` in `lib/korean-tts.ts`.
- **Server Audio**: For high-quality voice synthesis, query `/api/tts` (via `tossTts` bridge) to get base64 audio, convert it to a Blob Object URL, and play using the `<audio playsinline>` controller in [lib/server-tts-playback.ts](file:///c:/커셔/토스%20anonymous/3----완료-----/사주팔자v2/lib/server-tts-playback.ts).

### 3. iOS/WebView Sound Priming Bypass
- **Rule**: Mobile WebViews block programmatic audio play unless triggered directly by a user click gesture.
- **Solution**: Execute the sound priming helper `primeSpeechAudio()` in [lib/korean-tts.ts](file:///c:/커셔/토스%20앱/3----완료-----/사주팔자v2/lib/korean-tts.ts#L125) on the very first user interaction (e.g., clicking "Analyze") to unlock the audio channel context before playing speech.

---



## 🌐 External API & Environment Configuration

### `NEXT_PUBLIC_API_BASE`
- Since the static WebView bundle cannot process backend requests locally, it must delegate all server API calls (such as real-time AI counseling chat, payment confirmation) to the remote Oracle VM host.
- Always configure the `NEXT_PUBLIC_API_BASE` environment variable to point to the production server API endpoint (`https://saju.shin.app` or similar) during the Toss build process.

---

## 🔒 Privacy-First Data Storage Policy

### 1. Zero Server-Side PII Storage
- **Rule**: Never store any Personally Identifiable Information (PII) such as names, exact birthdates, birth times, or gender on the server-side database.
- The backend must process this data strictly in-memory (Stateless) and discard it immediately after generating the response.

### 2. Client-Side Local Storage Priority
- Keep user inputs cached locally on the device to maintain context without cloud dependency.
- **Rule**: For normal browser environments, use `sessionStorage`. For the Toss WebView mini-app environment, prioritize the Toss SDK's secure local Storage API (`Storage.setItem` / `Storage.getItem` in `@apps-in-toss/web-framework`) to prevent loss of user data due to OS cache clearance.

---

## 💸 Monetization & API Cost Guardrails

### 1. Hard Paywall (In-App Purchases) for Chat & Server TTS
- **Rule**: Real-time AI chat counseling and server-side TTS audio generation are high-cost functions (calling LLM and TTS APIs). They must be gated behind a hard paywall.
- Verify payment state via `grantedOrder` in [lib/toss-counsel-iap.ts](file:///c:/커셔/토스%20앱/3----완료-----/사주팔자v2/lib/toss-counsel-iap.ts) before invoking the chat endpoint `/api/saju-chat`.
- Block unauthenticated or non-paid chat/TTS requests on both client and server levels to prevent token/API leakage.

### 2. Soft Paywall (Rewarded Ad Gates) for Previews
- **Rule**: Access to brief AI summary paragraphs or initial previews must be gated by a rewarded ad wall.
- Require successful completion of a fullscreen ad (Group ID: `ait.v2.live.6e873e2eea174a0d`) via [lib/toss-rewarded-ad.ts](file:///c:/커셔/토스%20앱/3----완료-----/사주팔자v2/lib/toss-rewarded-ad.ts) before unlocking the text blocks.
- Preload the ad group beforehand to ensure instantaneous transition upon user consent.


