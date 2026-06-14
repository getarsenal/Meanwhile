# Callback — project brief for Claude Code

Read this first. It's the hand-off for continuing work on this app from any device
(local machine, Claude Code on the web, or the mobile app connected to this repo).

## What this is
**Callback** is a personal job-interview-process tracker for the repo owner (Connor).
It's a **single, self-contained `index.html`** — vanilla JS, no framework, no build step,
no dependencies, no bundler. It runs by just opening the file. Hosted on GitHub Pages at
**https://getarsenal.github.io/CallBack/** and installable to a phone home screen (PWA).

Design goals, in priority order: **(1) extremely easy to use, (2) visually stunning,
(3) thorough.** Everything is editable/deletable; the hero feature is one-tap **AI briefs**
you paste into a new AI chat to prep for interviews.

## Files
- `index.html` — the entire app (UI + CSS + JS inline). This is 99% of the work.
- `privacy.html` — privacy policy for the App Store submission (hostable page).
- `supabase/functions/ai/index.ts` — optional Edge Function proxy for Smart add (holds the
  model key server-side). `supabase/README.md` has the deploy runbook. No keys in the repo.
- `package.json` — exists ONLY for the Capacitor iOS build (web app is still the single index.html).
- `capacitor.config.json` — config for wrapping as an iOS app (appId `com.scheidelholdings.callback`).
- `NATIVE.md` — iOS setup for the native power-ups (reminders, calendar, contacts, Share Extension).
- `APP_STORE.md` — runbook for shipping to the Apple App Store via Capacitor.
- `README.md` — user-facing readme.

## How `index.html` is organized (search for these section banners)
- `MODEL` — `DEFAULT_STAGES`, `CLOSED_STAGES`, `activeStages()/allStages()/stage()`, `SOURCES`, `ROUND_TYPES`, global `state`.
- `STORAGE` — `load()/migrate()/persist()/save()`. **`save()` bumps `state.rev` and triggers cloud push.** Use `persist()` (no push) only when writing data that came *from* the cloud.
- `CLOUD SYNC` — Supabase via `set_vault`/`get_vault` RPCs. Whole-document last-write-wins keyed by `state.rev`, scoped by a private `code`. Config in localStorage `callback_sync_cfg_v1` (NOT in `state`, never synced, never in the repo).
- `HELPERS`, `ICONS` (the `I` object), `NAV`, `RENDER ROUTER`.
- View renderers: `renderDashboard / renderPipeline / renderCards / renderCalendar / renderInsights`.
  The `cards` view (bottom-nav "Cards") is the glanceable all-roles browser: a responsive
  `.job-grid` of `jobCard()`s, each a summary card with a 2×2 stat grid — Stage, Next call,
  Salary, Contacts (avatar stack via `jcContacts()`) — plus `sortRoles()`/`compRange()` helpers
  and the `data-sort` chips. Works on desktop and mobile (1 col), no horizontal scroll.
  The Upcoming view has a `calMode` ("list" | "timeline") toggle (`calToggle()`); `renderTimeline()`
  draws per-job swimlanes — a unique HSL color per job, dots for each round/applied/offer/task placed
  by date %, solid line up to today + dashed into the future, a shared month axis and "today" line,
  with the current stage shown via its stage-colored pill. CSS-positioned (no SVG), clipped to width.
- `CHARTS` — hand-rolled SVG (funnel bars + donut). No chart library on purpose.
- `OFFER SCORECARD` — weighted decision matrix across competing offers (status `offer`).
  `openScorecard()` modal; `scorecardBody()`; `scResult()` (weighted 1–5 avg over rated criteria);
  `scorecardPrompt()` (AI decision brief); `scorecardTeaser()` surfaces it on Dashboard/Insights
  once ≥2 offers exist. State lives in `state.scorecard` (lazily created via `getScorecard()`).
- `DRAWER: DETAIL` — per-role drawer with tabs: `tabOverview / tabRounds / tabPeople / tabBrief`.
- AI prompts: `buildBrief / prepPrompt / introPrompt / researchPrompt`, plus `resumeText()`.
- `SMART PASTE (AI ingest)` — paste an invite/email/JD/profile → AI fills a reviewable suggested
  entry. Pluggable engine via `aiEngine()`: `proxy` (Supabase Edge Function, key server-side) →
  `anthropic`/`google` (direct browser call, user key) → `paste` (copy-paste fallback, any chatbot).
  `aiPrompt()` builds the extraction prompt against a fixed JSON schema; `aiParse()` is a defensive
  JSON extractor; `spReview()/spApply()` map the result to a new opportunity or merge into a matched
  one (adding round/people). Config in localStorage `callback_ai_cfg_v1` (device-local, never synced,
  never in repo). `openAISettings()` configures the engine. Entry: topbar "Smart add" + Settings.
- `EDITORS` — `openEditor()` modal; `opForm / roundForm / personForm`; `openSettings / openResume / openStageEditor`.
- `FILES` — JD/résumé attachments as base64 (`fileToData`, `downloadData`, `pickFileInto`).
- `CALENDAR` — `.ics` + Google Calendar links (`downloadICS`, `googleCalUrl`, `findRound`).
- `NATIVE (Capacitor iOS)` — device features, ALL guarded by `isNative()` so the web build is
  untouched; plugins reached via `window.Capacitor.Plugins.*`. Local-notification reminders
  (`syncReminders`/`enableReminders`, opt-in stored in `aiCfg.reminders`), on-device calendar scan
  → Smart add (`scanCalendar`), Contacts pull into the person form incl. photo (`pullContactInto`,
  `person.photo`), and share-into-app (`initShareIntake` reads `shared_intake` from an App Group via
  Preferences + the `callback://` scheme). On web every action toasts "available in the iOS app".
  Setup in `NATIVE.md`.
- `EVENT WIRING` — one delegated `document` click handler. **If you add a new `data-*` button, add its attribute to the `closest(...)` selector** in that handler or it won't fire.

## Data model
`state = { opportunities:[], stages?:[], resume?:{file,text}, rev, meta }`
Each opportunity: `{ id, company, role, status, source, referrer, workMode, location,
excitement(1-5), compMin/compMax/compNotes, appliedDate, jobUrl, jd, jdFile, nextActionLabel/Date,
nextMeetingLink, tags[], product, vibes, notes, offer{}, rounds[], people[], createdAt, updatedAt }`.
`rounds[]`: `{id,name,type,date,time,link,interviewers,prep,debrief,rating,status}`.
`people[]`: `{id,name,title,linkedin,email,notes}`.
`state.scorecard` (offer-comparison): `{ criteria:[{id,name,weight}], scores:{ [opId]:{ [critId]: 1-5 } } }`.
Criteria/weights are global; ratings are per-offer. Lazily created — don't hand-init it.
**Every record must have an `id`** — `migrate()` backfills missing ids on load; this is what makes
edit/delete work. Don't create rounds/people without ids.

## Conventions / rules
- **Escape all user content** with `esc()` in any HTML string.
- **Mobile = no horizontal scrolling, ever.** Pipeline stacks vertically on mobile; the table
  becomes `renderRoleCards()`. Test that `document.documentElement.scrollWidth <= innerWidth`.
- Respect iOS safe areas (`env(safe-area-inset-*)`) for top bar / bottom nav / drawer.
- Keep it dependency-free and single-file. No CDN scripts, no npm at runtime.
- Stages: the active pipeline stages are user-editable (`state.stages`); the closed buckets
  (rejected/withdrawn/ghosted) are fixed in `CLOSED_STAGES`. Never hard-code a status id without
  a fallback — a user may have renamed/removed it.

## How to verify changes (do this — don't ship untested)
There's no test suite; verify in a real browser via the preview tools:
1. Serve the folder and open it (a `.claude/launch.json` with a static server already exists in
   the local setup; on the web sandbox just open `index.html`).
2. Drive it with `preview_eval`: call render functions, simulate `.click()`, assert DOM/state.
3. Check `preview_console_logs` (level error) is clean.
4. **Gotcha:** `preview_screenshot` hangs offline because company-logo `<img>`s fetch from
   Google's favicon service and never resolve network-idle. Verify via `preview_eval` DOM
   assertions and `preview_inspect` instead of screenshots. Favicons fall back to colored initials.

## Deploy
`git add -A && git commit -m "..." && git push`. GitHub Pages (branch `main`, root) serves it;
live within ~1 minute. Phones cache hard — hard-refresh to see changes.
(Local note: `git push` may need the sandbox disabled — "Could not resolve host" otherwise.)

## Cloud sync (already set up by the user)
Backed by the user's own Supabase project. The app stores URL + anon key + sync code in
localStorage per device. **No Supabase keys or sync codes belong in this repo.** The setup SQL
lives in `index.html` as the `SYNC_SQL` constant (and in the in-app Settings panel).

## Backlog / ideas not yet built
- Thank-you-note tracker / reminders per round.
- "Questions they asked me" / "questions to ask" reusable libraries.
- Service worker for true offline of the web/PWA version (Capacitor build is already offline).
- Real PNG app icons + screenshots for App Store.

## Tone for the owner
Connor is sharp but not a developer — explain choices briefly, default to action, keep the UI
delightful and dead-simple. When in doubt, make it easier to use, not more featureful.
