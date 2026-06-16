# Meanwhile — project brief for Claude Code

Read this first. It's the hand-off for continuing work on this app from any device
(local machine, Claude Code on the web, or the mobile app connected to this repo).

## What this is
**Meanwhile** is a personal job-interview-process tracker for the repo owner (Connor).
It's a **single, self-contained `index.html`** — vanilla JS, no framework, no build step,
no dependencies, no bundler. It runs by just opening the file. Hosted on GitHub Pages at
**https://getarsenal.github.io/Meanwhile/** and installable to a phone home screen (PWA).

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
- `renderDashboard` leads with `dashHero()` (hero), 4 KPI tiles, then `renderMovesHub()` — the
  **Next moves** action hub: `nextMoves()` aggregates every actionable thing across roles (upcoming
  interviews, thank-yous for just-finished rounds, due `nextAction` tasks, offer deadlines, quiet
  follow-ups) into one priority-sorted list with per-row quick actions (`data-gen-hero` Prep,
  `data-gen-ty` thank-you + `data-thanked` dismiss, `data-task-done`, `data-followup`, Compare).
- AI **Application kit** in `tabBrief`: `coverLetterPrompt / resumeMatchPrompt / appAnswersPrompt`
  (+ `followupPrompt` for the hub) draft the application itself from the JD + résumé via `data-gen`.
- View renderers: `renderDashboard / renderPipeline / renderCards / renderCalendar / renderInsights`.
  The `cards` view (bottom-nav "Cards") is the glanceable all-roles browser: a responsive
  `.job-grid` of `jobCard()`s, each a summary card with a 2×2 stat grid — Stage, Next call,
  Salary, Contacts (avatar stack via `jcContacts()`) — plus `sortRoles()`/`compRange()` helpers
  and the `data-sort` chips. Works on desktop and mobile (1 col), no horizontal scroll.
  The Upcoming view has a `calMode` ("list" | "timeline") toggle (`calToggle()`); `renderTimeline()`
  draws per-job swimlanes — a unique HSL color per job, dots for each round/applied/offer/task placed
  by date %, solid line up to today + dashed into the future, a shared month axis and "today" line,
  with the current stage shown via its stage-colored pill. CSS-positioned (no SVG), clipped to width.
  Calendar items are interactive: each row has **edit** (`data-cal-edit`) / **delete** (`data-cal-del`)
  keyed by `eventFromKey` (round id, or `opId|task`/`opId|offer`) → `calEditEvent`/`calDeleteEvent`.
  Closing without data loss: a CLOSED stage (rejected/withdrawn/ghosted) or a round `status:cancelled`
  drops out of active views but stays for Insights; the Cards view hides closed roles behind a
  `cards-closed` toggle (`cardsShowClosed`), rendering them dimmed.
- `CHARTS` — hand-rolled SVG (funnel bars + donut). No chart library on purpose.
- `OFFER SCORECARD` — weighted decision matrix across competing offers (status `offer`).
  `openScorecard()` modal; `scorecardBody()`; `scResult()` (weighted 1–5 avg over rated criteria);
  `scorecardPrompt()` (AI decision brief); `scorecardTeaser()` surfaces it on Dashboard/Insights
  once ≥2 offers exist. State lives in `state.scorecard` (lazily created via `getScorecard()`).
- `DRAWER: DETAIL` — per-role drawer with tabs: `tabOverview / tabRounds / tabPeople / tabBrief`.
- `RÉSUMÉ STUDIO` — `openResume()` opens a structured editor (header/summary/experience/education/
  skills) over `state.resume.data`; `rsSync()` reads the DOM into `resumeDraft`, `rsSave()` persists
  + sets `state.resume.text` (so AI briefs use it). Import: `rsUpload()` reads text files directly
  and sends **PDFs straight to the AI** (`aiCall(prompt, doc)` — Claude/Gemini/proxy read PDFs
  natively; the edge function forwards a document block); `rsAIParse()`/`resumeParsePrompt()` →
  structured JSON, with `rsParseManual()` copy-paste fallback. Export: `rsHTML()`/`rsCSS()` render a
  clean printable doc (Modern/Classic/Compact templates) and `rsPrint()` uses the browser print
  pipeline → Save as PDF (no libraries). `resumeText()` derives from the structured data when present.
- AI prompts: `buildBrief / prepPrompt / introPrompt / researchPrompt / questionsPrompt / thankyouPrompt`,
  plus `resumeText()`. `aiGen(prompt,title)` runs any prompt through the engine and shows the result
  inline (paste-mode falls back to copy); `aiCall(prompt,doc,opts)` takes `opts.json=false` for prose.
  Brief tab = one-tap **Prep me / Questions to ask / Write my intro** (`data-gen`); each round has a
  **Thank-you note** (`data-gen-ty`). `aigen-copy` copies the generated text.
- `ASK AI` — pipeline-aware assistant surfaced at the top of Insights (`askAICard()`). `pipelineContext()`
  builds a compact all-roles+offers summary; `askPrompt(q)` wraps it + résumé; `runAsk()` answers inline
  (`data-act="ask-ai"`, suggestion chips via `data-ask`), copy-prompt fallback in paste mode.
- Gemini reliability: `aiCall` tries `gemini-2.0-flash`→`1.5-flash`→`2.0-flash-lite`, falling through on
  **404/400/429** (each free-tier model has its own quota), with friendly messages for quota/bad-key.
- `COMPANY ENRICH (logo + pre-call brief)` — instant visual ID for juggling many processes.
  `resolveCompany()` hits Clearbit autocomplete (free, no key, CORS-ok) for a real logo + canonical
  domain; `enrichLogo()/enrichLater()` cache `o.domain`/`o.logo` and fire after create/edit.
  `favHTML()` now prefers the Clearbit logo → favicon → colored initials. `runResearch()` builds an
  AI pre-call brief (`briefPrompt()` → `{tagline, brief}` JSON) via `aiEngine()` (one-tap with a
  key/proxy; `openResearchManual()` copy-paste fallback otherwise), cached on `o.tagline`/`o.research`/
  `o.researchAt`. Surfaced as a `.brief-box` in `tabOverview` (logo, tagline, brief, Research/Refresh
  via `data-research-co`) and a `.jc-tagline` line on each job card.
- `SMART PASTE (AI ingest)` — paste an invite/email/JD/profile → AI fills a reviewable suggested
  entry. Pluggable engine via `aiEngine()` — **default `google` (Gemini, free tier; the standard for
  broad/zero-cost reach)**, plus `groq` (free, Llama, OpenAI-compatible), `openai` (ChatGPT, paid),
  `anthropic` (Claude, paid), `proxy` (Supabase Edge Function, Gemini-based), and `paste`
  (copy-paste fallback). Bring-your-own-LLM; the two genuinely free APIs are Gemini and Groq. `engineReadsPDF()` gates PDF upload to proxy/anthropic/google. The Gemini path has a model fallback
  (`gemini-2.0-flash`→`gemini-1.5-flash`) so a rename never breaks it; `aiCall(prompt, doc)` can send
  a base64 PDF the model reads natively.
  `aiPrompt()` builds the extraction prompt against a fixed JSON schema; `aiParse()` is a defensive
  JSON extractor; `spReview()/spApply()` map the result to a new opportunity or merge into a matched
  one (adding round/people). **Job URL → auto-fill**: `fetchJobUrl()` pulls a posting via Jina Reader
  (`r.jina.ai`, free/CORS/no-key) → clean text → the same extraction; the source URL is saved to
  `o.jobUrl` (which also yields the logo domain). Config in localStorage `callback_ai_cfg_v1`
  (device-local, never synced, never in repo). `openAISettings()` configures the engine. Entry:
  topbar "Smart add" + Settings.
- `EDITORS` — `openEditor()` modal; `opForm / roundForm / personForm`; `openSettings / openResume / openStageEditor`.
- `FILES` — JD/résumé attachments as base64 (`fileToData`, `downloadData`, `pickFileInto`).
- `CALENDAR` — `.ics` + Google Calendar links for ANY event (rounds, next-step tasks, offer
  deadlines) via `eventFromKey()` (round id, or `opId|task` / `opId|offer`) → `buildICS`/
  `downloadEventICS`/`googleCalEventUrl`; `icsEsc()` escapes per RFC 5545.
- `NATIVE (Capacitor iOS)` — device features, ALL guarded by `isNative()` so the web build is
  untouched; plugins reached via `window.Capacitor.Plugins.*`. Local-notification reminders
  (`syncReminders`/`enableReminders`, opt-in stored in `aiCfg.reminders`), on-device calendar scan
  → Smart add (`scanCalendar`), Contacts pull into the person form incl. photo (`pullContactInto`,
  `person.photo`), and share-into-app (`initShareIntake` reads `shared_intake` from an App Group via
  Preferences + the `callback://` scheme). On web every action toasts "available in the iOS app".
  Setup in `NATIVE.md`.
- `EVENT WIRING` — one delegated `document` click handler. **If you add a new `data-*` button, add its attribute to the `closest(...)` selector** in that handler or it won't fire.

## Data model
`state = { opportunities:[], stages?:[], resume?:{file,text,data}, stories?:[], questions?:[], profile?:{name,headline}, scorecard?:{}, rev, meta }`
- `profile` (PERSONALIZATION, `getProfile()`): `name`/`headline` set in Settings → Profile. The name
  drives the Home greeting (`render()`: "Good afternoon, {first}"), the welcome state, and AI briefs
  (`buildBrief` adds a "Candidate (me)" line). Synced like the rest of state.
- `stories[]` (PREP BANK): `{id,title,tags[],s,t,a,r}` STAR stories; `questions[]`: `{id,q,a,tags[]}`.
  `getStories()/getQuestions()` lazily create the arrays; `storyBankText()` feeds them into the AI
  prep prompts (`prepPrompt`, `appAnswersPrompt`). UI: `openPrepBank()` (Settings + AI Brief tab).
Each opportunity: `{ id, company, role, status, source, referrer, workMode, location,
excitement(1-5), compMin/compMax/compNotes, appliedDate, jobUrl, jd, jdFile, nextActionLabel/Date,
nextMeetingLink, tags[], product, vibes, notes, offer{}, rounds[], people[], createdAt, updatedAt,
domain, logo, tagline, research, researchAt }` — the last five are auto-filled by COMPANY ENRICH.
`rounds[]`: `{id,name,type,date,time,link,interviewers,prep,debrief,rating,status,thanked}`.
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

## Branding
The Meanwhile mark (a person kicking back in an office chair, periwinkle on a dark indigo squircle)
is the app identity. Assets at repo root:
`icon.png` (256, transparent — favicon + sidebar/topbar/empty-state img), `apple-touch-icon.png`,
`icon-192/512.png` (full-bleed maskable, used by the inline PWA manifest), `icon-1024.png` +
`resources/icon.png` (App Store master), `resources/splash.png`/`splash-dark.png` (native launch),
`logo.png` (wordmark). In-app it shows in the sidebar brand, the **mobile topbar** (`.topbar-brand`,
desktop sidebar is hidden there), the **empty state**, and a **launch splash** (`#splash`, shown only
in `display-mode:standalone` so browser tabs skip it; faded out at boot). Regenerate icons from the
source art with Pillow if it changes; bump `CACHE` in `sw.js` after asset changes.

## Deploy
`git add -A && git commit -m "..." && git push`. GitHub Pages (branch `main`, root) serves it;
live within ~1 minute. Phones cache hard — hard-refresh to see changes.
(Local note: `git push` may need the sandbox disabled — "Could not resolve host" otherwise.)

## Cloud sync (already set up by the user)
Backed by the user's own Supabase project. The app stores URL + anon key + sync code in
localStorage per device. **No Supabase keys or sync codes belong in this repo.** The setup SQL
lives in `index.html` as the `SYNC_SQL` constant (and in the in-app Settings panel).

## PWA / offline
`sw.js` (registered at boot, http(s) only) caches the app shell — network-first for
navigations (updates show online), cache fallback offline. Cross-origin (logos/AI/Jina/
Supabase) is never intercepted, so it fails gracefully offline. Inline web manifest already
present. Bump `CACHE` in `sw.js` to force-invalidate.

## Server-side (optional, needs Supabase deploy)
- `supabase/functions/ai` — Gemini proxy for Smart add / briefs / résumé / digest-free AI.
- `supabase/functions/digest` — daily reminder digest (quiet processes + 7-day upcoming) to
  Slack and/or email (Resend); reads the vault via `get_vault` with `DIGEST_CODE`. Scheduled
  via Supabase cron. Runbook in `supabase/README.md`.

## Backlog / ideas not yet built
- Real PNG app icons + screenshots for App Store (icons currently inline SVG).
- "Questions they asked me" reusable library (questions-to-ask is now generated on demand).
- Per-user digest config (currently one vault via env; fine for personal use).

## Tone for the owner
Connor is sharp but not a developer — explain choices briefly, default to action, keep the UI
delightful and dead-simple. When in doubt, make it easier to use, not more featureful.
