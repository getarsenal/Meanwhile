# Shipping Callback to the Apple App Store

Callback is a single static web app, so the path to the App Store is to **wrap it in
[Capacitor](https://capacitorjs.com/)** (same approach as your DTMB game template) and submit
the resulting native iOS app. This doc is the runbook + the checklist Apple will hold you to.

> You're on Windows with no Xcode. The build/archive step needs macOS. Options below cover that.

---

## 1. One-time scaffolding (on any machine with Node)

From a copy of this repo:

```bash
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init Callback com.scheidelholdings.callback --web-dir .
# capacitor.config.json is already in this repo — keep its appId/appName/webDir
npx cap add ios
```

`webDir: "."` tells Capacitor the web app is `index.html` at the repo root. Because the app
bundles all assets inline, **it works fully offline once wrapped** (no service worker needed —
Capacitor serves the files locally from inside the app).

Whenever you change `index.html`, run `npx cap copy ios` to refresh the native shell.

## 2. App icons & splash

- Master icon is already in the repo: **`resources/icon.png`** (1024×1024, full-bleed, no alpha) —
  the CallBack squircle (speech-bubble "C" + rising bars). `icon.png` (transparent), `icon-512/192`,
  and `apple-touch-icon.png` are the web/PWA variants; `logo.png` is the wordmark for store listings.
- Generate the full iOS icon set with: `npm i -D @capacitor/assets` then
  `npx capacitor-assets generate --ios` (it reads `resources/icon.png`; add a `resources/splash.png`
  for the launch screen, e.g. the logo centered on `#0a0b0e`).

## 3. Building the iOS app (the macOS step)

You need Xcode to archive + upload. Pick one:

- **A borrowed/owned Mac:** open `ios/App/App.xcworkspace` in Xcode → set Team (your Apple
  Developer account) → Product ▸ Archive → Distribute to App Store Connect.
- **Cloud Mac CI (recommended for Windows):** [Codemagic](https://codemagic.io) or
  [Ionic Appflow](https://ionic.io/appflow) both build Capacitor iOS apps and upload to
  TestFlight without you owning a Mac. This is the route noted in your prior Capacitor/TestFlight
  workflow — reuse it.
- **MacInCloud / a rented Mac mini** as a fallback.

## 4. App Store Connect checklist

- [ ] **Apple Developer Program** membership ($99/yr).
- [ ] **Bundle ID** `com.scheidelholdings.callback` registered.
- [ ] **App icon** 1024×1024, no alpha.
- [ ] **Screenshots** for 6.7" and 6.5" iPhones (take them from the running app: dashboard,
      pipeline, a role's AI Brief, the calendar).
- [ ] **Privacy policy URL** — host `privacy.html` (e.g. https://getarsenal.github.io/CallBack/privacy.html)
      and paste that URL.
- [ ] **App Privacy questionnaire** — answer "Data Not Collected." (Cloud Sync goes to the
      user's own database; the app collects nothing for the developer. `privacy.html` says this.)
- [ ] **Sign in / demo:** Apple reviewers must be able to use the app with no account. Callback
      needs none — mention "tap Load demo data" in the Review Notes so they see it populated.
- [ ] **Encryption export compliance:** answer "No" to non-standard encryption (HTTPS only).
- [ ] **Age rating, category** (Productivity / Business), keywords, description.

## 5. Likely review pitfalls (and why Callback is fine)

- *"Spam / web-wrapper" (Guideline 4.2):* thin wrappers get rejected. Callback is a full native
  experience (offline data, native nav, no browser chrome) — present it as a productivity app,
  not "a website." Good icon + screenshots matter here.
- *"Minimum functionality":* it has real, persistent functionality — fine.
- *Account/paywall rules:* none, so most of Section 3 doesn't apply.

## 6. Versioning

Bump `CFBundleShortVersionString` / build number in Xcode (or the CI config) for each upload.
Keep `index.html` as the source of truth and re-`cap copy` before every build.
