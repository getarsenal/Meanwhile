# Meanwhile — project brief for Claude Code

Read this first. It's the hand-off for continuing work on this app from any device
(local machine, Claude Code on the web, or the mobile app connected to this repo).

## What this is
**Meanwhile** follows one person through the whole employment lifecycle: *find it → research it →
prepare for it → get hired →* **understand the company you just joined**. Before the job it's an
interview tracker; after the job it turns the same Company/People records into your map of how the
place actually works. The through-line: *Meanwhile was there before I got hired, and it's still
here helping me understand the company now that I'm here.*

It's a personal tool for the repo owner (Connor).
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
  `persist()` returns false and raises a **persistent alarm** (`renderStorageAlarm`/`openStorageHelp`) when
  localStorage is full — the previous good copy stays intact rather than the app pretending the write worked.
  `devPrefs` (localStorage `meanwhile_device_v1`, never synced) holds device facts: `lastExport`, `bytes`,
  `riskSnoozed`. `backupRisk()/riskBanner()` warn on Home and Work when there's no sync and no recent backup;
  `dataStatusBox()` is the Settings panel that says plainly where the data lives.
- `LOGIN SCREEN` — `renderAuthGate()` mounts `#authGate`, the first thing you see when signed out.
  Its own visual world (lit dusk, four drifting blooms + a **grain layer** — without grain those
  gradients band into stripes on a cheap panel) and deliberately single-theme, so every colour is
  painted rather than inherited. The backdrop is built **once**; only `#authBody` swaps between
  views (`signin/signup/mfa/sent/reset/setup`) via `paintAuthPanel()`, because replaying the
  entrance animation on every state change looks cheap. **`authGateNeeded(force)` is the rule that
  matters**: a device that knows its project opens here, a stranger who just found the app does
  **not** — walling them behind a form asking for a database URL is the worst possible first
  impression, and this app has always worked alone. `force` is how Settings opens it deliberately.
  `devPrefs.localOnly` remembers "continue without an account". `saveProjectCfg()` treats *no
  project fields on screen* as "use what's stored", not "the user left it blank" — the sign-in view
  has no such fields, and getting this wrong aborts every sign-in from the gate.
  `readInviteLink()`/`inviteLink()` carry the project URL+key in the URL **fragment** (never sent
  to a server) so a colleague opens one link and lands on sign-in; it is stripped from the address
  bar immediately.
- `ACCOUNTS` — **Supabase Auth (GoTrue) over plain fetch**, so a real login costs no dependency and
  no build step. Email+password signup/sign-in, password reset, password change, and **TOTP 2FA**
  (`mfaFactors/mfaPending/mfaVerify/mfaEnroll/mfaUnenroll`); the enroll response carries the QR image
  itself, so there is no QR library. `session` lives in localStorage `meanwhile_session_v1` — **never
  in `state`**, or the refresh token would be pushed to the vault and handed to every other device.
  `authToken()` refreshes on demand (memoized so a burst of calls makes one refresh) and, on a dead
  refresh token, ends the session once rather than looping. `authMessage()` turns GoTrue's errors into
  sentences; this screen is where people get stuck. `afterSignIn()` is the one dangerous moment —
  when **both** the device and the account have data it asks instead of letting last-write-wins pick,
  naming the counts on each side. `authSignOut(wipeLocal)` can take the local copy with it, which is
  what "sign out" has to mean on a shared computer.
- `LOCK` — **retired, but never deleted.** The passphrase encryption predates accounts and solved the
  same problem with a worse failure mode (forget it and the data is gone). It can no longer be turned
  on — `openLockSetup`/`enableLock` are gone — but everything that **opens** a sealed vault stays
  forever (`deriveLockKey`, `openDoc`, `sealDoc`, `persistSealed`, `renderLockGate`, `disableLock`,
  `isSealed`), because deleting them would strand anyone who switched it on. AES-256-GCM, PBKDF2-SHA256
  310k iterations, envelope `{__enc,v,kdf,iter,salt,iv,ct,rev}` with **`rev` outside the ciphertext** so
  `pullNow` can compare versions without the key. `lockKey`/`lockMeta`/`lockedBlob` are **declared above
  the first `load()` call on purpose** — reaching a `let` from above its declaration throws, and
  `load()`'s try/catch would swallow it, turning an encrypted vault into an empty app that the next save
  overwrites. `pullNow`/`afterSignIn` refuse to touch a sealed remote they cannot open rather than
  treating it as empty, and adopt it + show the gate (`remoteLocked`). `lockBox()` only appears if you
  still have one, and offers the way out.
- **`SCHEMA`** (declared **above `let state = load()`** — TDZ, the same trap as the lock keys and
  `DEFAULT_PROJECT`, which has now bitten three times; `migrate()` reads it, `load()`'s catch would
  swallow the ReferenceError and hand back an empty app that the next save overwrites) stamps
  `state.meta.schema`. `migrate()` never writes it *down*, and `pullNow` refuses to adopt or
  overwrite a document from a newer build (`remoteIsNewerBuild`) — an older cached build silently
  dropping fields it doesn't understand is invisible data loss.
- `CLOUD SYNC` — whole-document last-write-wins keyed by `state.rev`. **`syncMode()` picks the path**:
  `account` (the default now) writes `user_vaults` straight over PostgREST with the user's own token,
  where **row-level security** compares `auth.uid()` to the row owner — Postgres enforces the scoping,
  not the app, which is what makes one deployment safe for several colleagues. `code` is the legacy
  shared-code path through the `set_vault`/`get_vault` RPCs; it still works and is never offered to
  anyone new. The account table is deliberately named `user_vaults`, NOT `vaults` — reusing the name
  would collide with the old code-keyed table on any project that already ran the old SQL. `SYNC_SQL`
  in Settings creates it. **`DEFAULT_PROJECT`** (top of CLOUD SYNC) is the project the *build* ships
  with: fill in url+key and a brand-new device needs only an email and a password, because there is
  no server here to ask which project it belongs to. It is the one deliberate exception to
  "no keys in the repo" — the anon key is designed to ship in client code and the `revoke all …
  from anon` in `SYNC_SQL` means it can't read a vault row; the exposure is sign-up spam, closed by
  turning sign-ups off. It must be **declared above `let sync = loadSync()`** (TDZ, same trap as the
  lock keys) and `saveSync()` strips `builtIn` so a later build can move the project.
  **A pull can no longer eat local edits.** `devPrefs.pushedRev` records what the cloud is known to
  hold, so `unsyncedEdits()` is a fact rather than a guess; when the remote is newer *and* this
  device has unpushed work, `resolvePullConflict()` asks via `askChoice` instead of replacing
  `state` in silence on a background focus-pull. The status line says "Not uploaded yet" rather
  than "Synced ✓" whenever that's true. `docSig()` fingerprints the document with `rev` zeroed so a
  `save()` that changed nothing costs no upload — many handlers call `save()` unconditionally.
  A device-configured project always wins. Project URL + anon key live in localStorage `meanwhile_sync_cfg_v1` (NOT in
  `state`, never synced, never in the repo). The app was called **Callback** once: `readLS(new,old)`
  still reads `callback_sync_cfg_v1` / `callback_ai_cfg_v1` as a fallback and leaves them in place,
  so a device that has been syncing for months doesn't wake up unconfigured. The iOS `appId`,
  App Group and `callback://` scheme are **not** renamed — they are the app's identity to Apple.
- `HELPERS`, `ICONS` (the `I` object), `NAV`, `RENDER ROUTER`.
- **`listFilter` / `data-lfz` — every list in the app is searchable.** One component, not a search
  box per renderer: `listFilter(scope,{count,sorts,…})` draws the bar, and any container marked
  `data-lfz="<scope>"` is filtered. **Matching reads each row's own `textContent`**, so no renderer
  declares what is searchable and nothing can drift from what you can actually see; every word in
  the query must match (`"ada fin"` finds Ada Reed in Finance) and `norm()` folds case and accents.
  Sorting reads `data-s-name`/`data-s-at`/`data-s-n`, which **`entRow` writes for every row**, so
  each list built from it sorts for free. `lfState` survives a re-render and `lfRefresh()` re-applies
  after `render()` and `openEditor()`; typing mutates the DOM in place, so the caret never moves.
  Several zones can share one scope (Knowledge searches all seven kinds); wrap a heading+zone in
  `data-lfsec` and the whole section leaves when it has no hits, and `data-lfskip` exempts a row.
  Below `LF_MIN` (7) rows the bar doesn't render — a search box over five things is clutter.
  **`[hidden]{display:none!important}` is load-bearing**: rows are `display:flex`, which beats the
  UA's `[hidden]` rule, so without it the filter marks every row hidden and nothing moves. A test
  that asserts `el.hidden` rather than computed `display` will not catch that.
- `emptyState()` is the first screen: four **tappable** rows (`.wf` buttons, each with a `data-act`)
  rather than tiles that only describe features — paste a link, add by hand, connect AI, add résumé.
  The last two tick themselves off (`.wf.done`) once `aiEngine()` is live / a résumé exists.
  On mobile the topbar keeps to one row via `.vt-wrap{flex:1 1 0}` + `.vt-txt` ellipsis, the view
  icon is hidden and the greeting drops the name; `body.no-data` hides the search box until there's
  something to search.
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
- Groq reliability: **the model list comes from the account, not from us.** Groq retires model names
  on its own schedule, so a hard-coded list goes stale and the app dies with a 404 naming a model the
  user never picked (`llama-3.1-8b-instant` did exactly this). `groqDiscover()` reads
  `GET /openai/v1/models` with the key and caches it for a day; `groqUsable()` drops the speech,
  safety and embedding models (they 400 on a chat call) and ranks the rest by `GROQ_PREF`, which is
  only a tie-breaker. `aiCall` tries the remembered model → cache → `GROQ_PREF`, then **re-reads the
  catalogue once** if everything 404s, and remembers whichever model answered. AI settings shows the
  key's own models as tappable chips (`groqModelChips`/`data-groqmodel`).
- Gemini reliability: **same rule as Groq — the model list comes from the key, not from us.** A
  hard-coded chain (`gemini-2.0-flash`→`1.5-flash`→`2.0-flash-lite`) died exactly as Groq's did, with
  a 404 naming a model the user never picked. `gemDiscover()` reads `GET /v1beta/models` and keeps
  only those whose `supportedGenerationMethods` include `generateContent` — better evidence than
  Groq gives, so no name-guessing. `gemUsable()`/`gemRank()` order them newest generation → cheapest
  family (`GEM_PREF`) → stable over preview; `GEM_SKIP` drops embedding/imagen/veo/tts. `aiCall`
  tries remembered model → cache → catalogue, re-reads once if everything 404s, remembers the winner,
  and still falls through on **429** (each free-tier model has its own quota). `MODEL_PROV` drives the
  tappable chips (`modelChips`/`data-pickmodel`) for **both** free providers.
  **`gemDiscoverFailed`/`groqDiscoverFailed` are reset at the start of each call** — a stale flag from
  an earlier failure describes the wrong request — and "reached them and they listed nothing" is NOT
  "couldn't reach them": three different sentences, because blaming the key for a dropped connection
  sends the user to re-copy a key that was fine.
- **Busy is not broken** (`AI_BUSY`, `aiErr(msg,busy)`, `aiCallOne` + the `aiCall` wrapper). A
  Gemini 503 ("high demand") and a Groq 429 used to end the call outright, even though free-tier
  quotas and load are **per model** — so both providers now treat 429/5xx exactly like a dead model
  name: try the next one, then back off (honouring `retry-after` when it's ≤8s) and retry the best
  two. Only after all that does it throw, tagged `busy`.
  **Cross-provider failover**: a `busy` failure borrows the *other* free provider for that one call
  (`altFreeEngine`), toasts which one answered, files the model it learned under that provider, and
  restores `aiCfg` in a `finally`. Deliberately **only between Gemini and Groq** — falling over to a
  paid key would spend money the user never agreed to. `aiFailingOver` keeps two overlapping calls
  from trading engines; `noFailover` is passed by *Test connection*, which must report on the
  provider you actually picked. `keptKeysNote()` says out loud when both free keys are present,
  because otherwise nobody would know the safety net exists.
- **A picture is never refused on a guess.** Whether a Groq model is multimodal is inferred from its
  *name* (`GROQ_VISION`) because the catalogue doesn't say. So when nothing looks multimodal the
  photo goes to the best chat models anyway and the API gets to answer — a 400 from Groq is
  evidence, a regex isn't. Only then does it name Gemini as the fix.
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
  **`aiCall(prompt, doc, opts)` takes one attachment or an array of them** — one note can be three
  photos of the same whiteboard. Each provider wants a different envelope and getting it wrong is a
  400: Claude needs an `image` block for a photo and a `document` block for a PDF; OpenAI and Groq
  want `image_url` with a **full data URL**; Gemini and the proxy take `inline_data` parts.
  **Groq is the conditional one** — `groqUsable()` deliberately strips "vision" from the chat list,
  so `groqVision()` reads the **raw** cached catalogue instead, and its multimodal models reject
  `response_format:json_object` alongside an image (so it's dropped and `aiParse` does the digging).
  No vision model in the account → a message naming Gemini as the fix, not a 400.
  `engineReadsImages()` gates the camera buttons; it's wider than `engineReadsPDF()`.
  `aiPrompt()` builds the extraction prompt against a fixed JSON schema; `aiParse()` is a defensive
  JSON extractor; `spReview()/spApply()` map the result to a new opportunity or merge into a matched
  one (adding round/people). **Job URL → auto-fill**: `fetchJobUrl()` → `readUrlText()` walks the
  `URL_READERS` chain (Jina Reader → AllOrigins → CodeTabs → direct), each with a 15s abort, because
  any single public reader gets rate-limited, key-walled or blocked on any given day. HTML responses
  go through `htmlToText()`, which strips chrome and lifts schema.org **JobPosting** JSON-LD (title,
  company, location, pay) to the top — that structured block is why extraction from a URL is sharper
  than from a copy-paste. On total failure `readFailMessage()` names the actual cause (rate limit /
  site blocks readers / login-walled site via `WALLED` / JS-rendered / no connection) and
  `spShowReadFail()` hands over the paste box **keeping `spSourceUrl`**, so the link still lands on
  `o.jobUrl`. Only CORS-safelisted request headers — a custom header triggers a preflight these
  hosts don't answer, which breaks every fetch at once. Config in localStorage `callback_ai_cfg_v1`
  (device-local, never synced, never in repo). `openAISettings()` configures the engine. Entry:
  topbar "Smart add" + Settings.
- `POST-HIRE (90-day mode → My Company)` — everything that happens *after* you get the job. See the
  dedicated section below; it's the largest addition to the app.
- **A destructive choice never goes in `confirm()`** (`askChoice`, above the sign-in gate at z-index
  400). Two native buttons force one outcome onto the word "Cancel", and on the two-datasets prompt
  at sign-in "Cancel" meant *overwrite my account* — the instinct on a dialog you don't understand.
  Now every outcome has its own button saying what it replaces, the destructive one is marked as
  such, a backup is offered in the dialog, and **Cancel means nothing happens**: `afterSignIn`
  returns `"cancelled"` and `clearSession()`s, because staying signed in would let the very next
  `save()` push the copy they just declined to push.
- **A toast is a glance, not a document.** It's capped (`max-width:min(430px,100vw-28px)`, 4-line
  clamp) and the message trimmed to ~190 chars — a raw provider error used to stretch the phone and
  wrap into a wall of JSON. A leading `⚠` (how every error site here already marks itself) makes it
  red with a warning icon and holds it on screen longer. `apiErrText()` lifts the provider's own
  sentence out of its JSON envelope so the braces never reach the screen. The transition is
  `opacity,transform` — **never `all`**, which animates the width on a rotate or resize.
- **Undo** (`snapshotUndo`/`undoLast`/`withUndo`, `UNDO_MAX` 12) is a whole-document JSON snapshot —
  cheap at this size, impossible to get subtly wrong, and it covers deletes, merges, conversions,
  an import and a whole batch of AI-applied changes with one mechanism. **In memory only**:
  persisting it would double what localStorage holds, and undo is about the mistake you just made.
  `undoLast()` forces `rev` upward or the next pull hands back the very thing you undid. Offered in
  the toast itself (`toast(msg,kind,"Undo")`) plus ⌘Z — never while a field has focus, where the
  browser's own undo owns the caret. Attachment bytes are untouched by it (they're in IndexedDB and
  no undoable action deletes them), so restoring the document restores working references.
- **Modals never eat your typing**: `openEditor()` takes a `snapshotEditor()` of every field (and
  again on `spSetBody`); a backdrop tap or Escape goes through `tryCloseEditor()`, which only closes
  silently when `editorDirty()` is false and otherwise asks. The ✕/Cancel buttons still close outright.
- **AI keys**: **one key per provider**, in `aiCfg.keys[engine]` (`keyFor`/`setKeyFor`); `aiCfg.key`
  is kept as the active one for older code. Switching engines used to overwrite the single key
  field, and selecting a *paid* engine also deleted `state.ai`, which took the free key off every
  other device — both fixed. `aiKey()` reads the key for the **configured** engine (`aiCfg.engine`),
  never `aiEngine()`: that one calls back into `aiKey()` to decide whether a key exists, and asking
  each other the same question is an infinite loop. Free-tier keys (`FREE_ENGINES` — Gemini, Groq)
  mirror into `state.ai.keys` so they sync and a second device just works (`adoptSyncedAI` takes the
  whole map, not only the active one). Paid keys are never written to `state`; only `syncKey:false`
  clears the shared copy. `keptKeysNote()` names the other providers that still hold a key, because
  the fear this addresses is that switching threw the old one away.
- `EDITORS` — `openEditor()` modal; `opForm / roundForm / personForm`; `openSettings / openResume / openStageEditor`.
- `FILES` — attachment **bytes live in IndexedDB** (`meanwhile_files`), not in the synced document.
  A file record on `state` is `{name,type,size,ref}`; `fileBytes(f)` resolves `ref` → bytes (and still reads a
  legacy inline `data`). `migrateFilesToIDB()` moves old inline blobs out on boot, `sweepOrphanFiles()` bins
  unreferenced ones, and **`exportData()` re-inlines the bytes so a backup file is still a complete backup**.
  Contact photos stay inline but are downscaled by `shrinkImage()`. Never put base64 back on `state`.
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

## POST-HIRE: 90-day mode → My Company
The second half of the product. **Nothing is duplicated when you get hired** — the opportunity you
interviewed for *becomes* your employer, and the people you met *are* your colleagues.

**Lifecycle.** `HIRED_STAGE` (`status:"hired"`) is a fixed system stage alongside `CLOSED_STAGES`:
not an active pipeline stage (it drops out of the kanban, Next moves and follow-up nagging) but not
closed either (Cards keeps it visible, badged *Employee*; Insights counts it as an advance). The
transition is the **"I got the job"** button in the role drawer (`openHire`/`saveHire`) which asks
for exactly three things — start date, title, manager — writes `o.hired`, records milestones, and
drops you into the Work view. Picking "Hired" in the drawer's stage `<select>` routes to the same
modal rather than silently setting a status.

**Storage.** All of it lives on `state.work` — plain arrays listed in `WORK_LISTS`, so it syncs,
exports and migrates like everything else. Access via `W()` (lazily creates the arrays),
`wOf(list,opId)`, `wFind`, `wAdd`. **Never hand-init `state.work`.**

**The entity registry (`ENT`)** drives lists, detail modals, forms, search and graph nodes for all
eleven types: `person, project, problem, department, team, system, process, decision, question,
info, capture`. **`info` ("Company info")** is the catch-all for things you just have to know —
a product family, a recurring meeting, an acronym — categorised by `kind` (`INFO_KINDS`) so it
stays searchable; when the capture agent is torn between project and info it's told to pick info.
**`team`** nests inside a department (`deptId`) and both departments and teams carry a `headId`.
Add a type there and most of the UI comes free. `entFields(type)` is the form spec (one builder,
`openEntForm`/`saveEntForm`, handles every type). **People are the deliberate exception**: they stay
on `o.people` so a person is one record from interview to colleague — `entGet("person",id)` searches
across opportunities and `entOpId` finds their company.

**The relationship graph** is a flat array, `W().links`:
`{opId, st, sid, rel, tt, tid, conf, via:[captureIds], seen}` (source-type/id → rel → target-type/id).
No graph database — at personal scale a filtered array beats one, per the brief. `addLink()` dedups
and keeps the highest confidence; `relatedTo()/relatedOfType()` read it; `evidenceFor()` walks `via`
back to the notes that established each edge. Vocabulary is fixed in `REL_LABEL`.

**Quick capture is the whole game** (`openCapture`): one big textarea, optional voice via
`webkitSpeechRecognition` (`capVoice`, feature-detected), then `capExtract()` → `capturePrompt()` →
`buildPlan()` → **review screen** (`capReview`) → `capApply()`. With no AI configured it still saves
the raw note. The FAB (`renderFab`) appears app-wide once you have an employer.

**A photo is a note** (`capShots`, the "shots" plumbing in FILES). The fastest note is the one you
never type: point a camera at a whiteboard, a page of handwriting or a printed org chart, or ⌘V a
screenshot on a laptop. `capShotBar()` offers camera (`capture="environment"`, touch only) and
library; `capArmDrop()` adds paste + drag-drop on the modal `.card`. `imgToShot()` downscales to
`SHOT_MAX` 1500px / JPEG 0.82 (**on a white ground** — JPEG has no alpha and a PNG screenshot would
otherwise go black) and puts the bytes in **IndexedDB**, `SHOT_LIMIT` 4 per note. `shotDocs()`
turns them into aiCall attachments; `hydrateShots()` fills `<img data-shot>` from IDB after render,
because bytes never go on `state`.
`openCropper(shots,idx,after)` is a hand-rolled cropper — a rectangle over the picture with four
corner handles, pointer events so touch and mouse share one path, canvas to re-encode. Cropping a
whiteboard down to the board measurably sharpens extraction, because the rest of the room is noise
the model reads past. **Rotate re-encodes immediately** rather than carrying orientation as state:
one orientation to reason about is worth a re-encode nobody can see. `cropClamp()` keeps the box on
the picture and above `CROP_MIN`, so it can neither escape nor collapse. Cancel touches nothing.
**`capShotBar()` reports the count, so it must be redrawn with the strip** — it lived outside
`#capShotHost` and silently never updated, which is why "add another" was invisible.
`shotRules(n)` is appended to `capturePrompt` and the schema grows a **`transcript`** field: the
model writes out everything legible verbatim, and only then extracts records. It's told to read
*every* box of an org chart (lines → `REPORTS_TO`, bands → departments, inner boxes → teams), to
treat a business card as one person, and to say the picture is unreadable rather than invent.
`capReview` shows the transcription in an **editable box** — handwriting gets misread and the moment
to fix it is while the original is still on screen — and `capFinalText()` folds your typed text and
the (corrected) transcript into one `capture.text`, because search, citations, Ask Meanwhile and
re-reading all work on that one field. Smart add has the same intake (`spShots`) for the pre-hire
funnel: a posting on a screen, a business card, a flyer.
**`fileRecordsIn(doc)` must list every attachment.** `allFileRecords`, `exportData` (which zips a
deep copy against the live doc by position) and `sweepOrphanFiles` all read it — a file record
missing from there gets its bytes binned as an orphan.

**Capture is an agent, not an extractor.** `CAPTURE_SCHEMA` lets the model come back with more than
records: `ask_me` (up to 3 clarifying questions, with quick-answer `options`), `updates` (change a
record you already have), `answers` (close an open question), `tasks` (one next step → `o.nextAction*`),
`understood` (what it took from the note) and `advice`. `buildPlan` turns the first four into
`plan.ops` and `plan.asks`; `applyOps()` executes the ticked ones. Answering questions calls
`capRefine()`, which re-runs `capturePrompt(o,text,capAnswered)` — the answers go back in and the
plan is rebuilt, so the loop is ask → answer → re-read → act. **The guards are in `buildPlan`, not
the prompt**: an update to a record that doesn't resolve exactly is dropped, an invalid status is
dropped, only a whitelist of fields may be `set` (never ids or `opId`), an answer to a question that
isn't actually open is dropped, and a status change that wouldn't change anything is never offered.
Every op is individually tickable and shows its before → after plus the model's stated reason.

**Entity resolution** is the delicate part (`resolveEnt`). `personMatch()` scores name pairs through
a nickname table (`NICK`: mike→michael); surnames decide it when both have one, a bare first name is
0.7 ("probable"), and **two plausible matches means the item is left unticked until the user picks** —
never a silent merge. Non-people go through `canonThing()` + `SYS_ALIAS` (sfdc→salesforce).
`capApply` re-resolves before creating so entities made earlier in the same batch (a person's
department) aren't duplicated.

**Notes are editable** — `openCapture(opId, editId)` reopens a capture; `buildPlan` carries `captureId` so
re-reading merges into the same note instead of filing a second one, and `capApply` dedups `cap.entities`.
**You are in your own map.** The post-hire half is about understanding a company *from where you
sit*, which only works if you are actually in it — so "me" is an ordinary person record on
`o.people`, flagged by **`o.hired.meId`** (`meOf`/`isMe`/`ensureMe`/`setMe`). Created at hire from
`profile.name`, with your title and your manager already wired as a `REPORTS_TO` link. `myPlace(o)`
computes your position from the same graph everyone else uses — manager, chain above you, reports,
department, team, the projects you own — and `myPlaceText`/`mePrompt` turn it into the one sentence
every post-hire prompt opens with, so advice is given to someone with a position rather than to an
observer. `myCard()` leads the People tab (and offers to put you on the map when you aren't yet);
your row is badged **You**, your org-chart card is ringed and labelled. `whoToAsk` skips you —
never send someone to ask themselves.

**Merging people** (`openMergeReview`/`applyMergeReview`/`mergePeople`) is the repair tool for
duplicates resolution didn't catch. It used to keep whatever was on the surviving record and quietly
discard the other value — which is exactly where the useful correction lives ("Analyst" from a
January interview vs "Head of Finance" from June). Now **nothing is discarded**: `mergeConflicts()`
finds every field the two disagree about, the AI is given both records, their notes and the captures
mentioning them and must choose *between the two values* (never a third, "both" allowed) with a
one-sentence reason, and whatever you don't pick is written into the notes. `mergePeople` still
repoints every link/capture-reference/`ownerId`/`managerId`/`meId`, then `dedupeLinks()` collapses the
duplicates and drops self-links. With no AI you get the same review, unrecommended. **Meeting prep** (`openMeetingPrep`/`meetingBrief`) assembles what you know
about the people you're about to see — computed from the graph, no calendar integration anywhere near it.
**What changed** (`changesSince`/`changedCard`) diffs the map over 7/30/90 days from timestamps already on the
records; `saveEntForm` stamps `prevStatus`/`statusAt` so transitions are real rather than inferred.

**Today's objectives** (`objectivesCard`/`objectivesPrompt`/`buildObjectives`) is what the Work
overview opens with. It used to open with "what you might be missing", which on a young map is a
list of systems nobody owns — true, computed, and useless as the first thing you read on a Tuesday.
At most five things worth doing today, each tied to real evidence. **The job description (`o.jd`) is
the waypoint** — the only record of what you were actually hired to do — and the value is
correlating it against what the notes show. The AI writes the wording; it does not get to invent the
evidence: `buildObjectives()` drops any objective whose cited ids don't resolve and any `jd` quote
that isn't verbatim in the JD, and an objective left with neither is dropped entirely. Cached on
`state.work.objectives` (one record per employer, stamped with the day) so it costs one call, not
one per render; `objectivesFallback()` computes the same shape from open problems/questions/projects
when there's no AI. Items are tickable and the tick persists. Gaps moved down the page.
**Every objective is schedulable** — `when` (`OBJ_WHEN`: now/today/week), `mins` (10/20/30/60), and
a **＋ Add to my day** (`data-objday`) that writes `o.nextActionLabel`/`Date`, the same field
Upcoming and reminders already read, so a suggestion becomes a dated thing. `objMaterial` hands the
model how long everything has been sitting, because ageing is the only real clock this half has.
`normObjectives()` applies the "at most one Do first" cap and the urgency sort in the ONE funnel
both the written and the computed lists pass through (`saveObjectives`) — capping it in
`buildObjectives` alone let the fallback show two.
**They run themselves** (`maybeAutoObjectives`): a page that opens with a *button* asking you to
make a briefing is not a briefing. Once a day, per employer, only when there's something to read —
so it's one AI call a day, not one per render. The guard key is set **before** the call, or a
failure retry-loops on every render; `runObjectives(auto)` falls back to the computed list on an
auto failure rather than leaving a red error where the briefing goes, and stays silent (no toast).

**Every number on the dashboard opens the records behind it** (`digSpec`/`openDig`, `data-dig`).
A count you cannot open is trivia. `digSpec(o,key)` maps a gauge, tile or stat to the actual rows —
`people-cold`, `org-unplaced`, `depts-blank`, `owners-unowned`, `q-open`, `problems-open`,
`stale-people`, `week-added`, `all-known`, `quiet`, `recap` — rendered through `entRow` in a
`listFilter`ed modal, so every drill-down is searchable and every row opens the thing itself. A
**gauge digs into the GAP** (`dig`) while there is one and into what you have (`digHave`) when
there isn't, because the missing half is the point of a gauge. The `data-dash` handler also
understands `dig|<key>` — the action tiles encode it that way, and forgetting that made every tile
silently do nothing until a test caught it.

**The four week numbers** (`weekTiles`, straight under the briefing) are not a census of the map —
they are four questions with a right answer, each opening its own **report** (`reportSpec`/
`openWeekReport`, keys `met-week`/`bites-week`/`jd-gaps`/`connect`) rather than a list of rows. The
report is the point: **every row carries the evidence that put it there**, because a name with no
reason beside it is exactly the ambiguity these were built to remove. `openDig` delegates to
`openWeekReport` when `reportSpec` matches, and the function is **not** called `openReport` — that
name already belongs to the 30/60/90 review further down the file, and a second declaration hoists
straight over it.
- `engagedThisWeek` — *who you actually met*, not who a note talks about. "Cara owns the launch
  messaging" is **about** Cara; "call with Ben" is a conversation **with** him. The precise source is
  `capture.met`, which the capture agent now fills; `MET_RX` is the conservative phrase test standing
  in for notes taken before that (and for notes typed with no AI). Either way `metEvidence` returns
  the note's own sentence, so the judgement is auditable rather than magic.
- `bitesThisWeek` — knowledge bites filed in seven days. **These were never extracted from captures
  at all** until now, which is why the count sat at zero however much you wrote: `CAPTURE_SCHEMA` had
  no `bites` field. It does now (plus `met`), `CAPTURE_EXTRA` explains both to the model, `buildPlan`
  turns them into ordinary tickable items and `capApply` resolves `met` names to person ids.
- `jdCommitments`/`jdGaps` — *what you were hired to do, against what you've touched*. The JD is split
  into its separate responsibilities and each is matched by its own words (`jdTerms`, `JD_STOP`)
  against every record in the map; a line with nothing behind it is a real gap, and the report shows
  what each covered line matched on so you can disagree with it. Unticked objectives count too.
- `connectToday` — *who to talk to today, literally*. Three sources, never a vibe: a note that says
  you owe them (`OWE_RX`, and the sentence is the reason), an open question the graph points at them,
  or your manager/a report with something open and a real silence. Never you, never someone who left.

**The three questions a new starter opens this for**, below those:
- `recapCard`/`recapWindow` — *where you left off*. Since your last visit if that was more than six
  hours ago, otherwise yesterday. **`lastSeenAtBoot` is read ONCE at load**: `render()` stamps
  `devPrefs.lastSeen` while you sit there, so reading it live would collapse the window to nothing
  and the card would always say "yesterday".
- `circleCard`/`circleOpen` — *your manager and your reports*, each with what is open and touching
  them (problems, questions, blocked projects, via the graph) and how long since you last spoke.
  Sorted manager-first, then whoever has the most outstanding, then whoever you've left longest;
  capped at four, because four cards of "nothing on record" is furniture.
- `quietCard`/`quietThreads` — *what you started and stopped*. `lastTouched()` is the newest of the
  record's own timestamps and the newest note citing it; anything silent under six days isn't quiet
  yet. Ranked by silence × how much you'd already invested, so a thread you worked for a week and
  dropped beats a one-line note. Each row offers **Update**, which opens a capture pre-seeded with
  "Update on X: " so the agent files it back against the same record.

**The Work overview is a dashboard** (`workOverview`), in this order: `briefingCard` → `weekTiles` →
`recapCard` → objectives → `circleCard` → `quietCard` → `paceCard` →
`gaugesCard` → `actionTiles` → `growthCard` → count tiles → `worthKnowingCard` →
`reconnectCard` → `changedCard` → `coverageCard` → open questions → recent notes → gaps → timeline.
- **`readiness(o)` / `gaugesCard` — five speedometers, every one a real ratio with a real
  denominator taken from your own records**: people who appear in a note, people with a reporting
  line, departments you've actually been inside, systems+projects with a known owner, questions
  closed. There is no industry benchmark here and inventing one would be the same lie the post-hire
  prompts exist to avoid — so the denominator is *the org you have found so far*, which means
  discovering more people lowers the score rather than moving the bar. `gaugeSVG` is a hand-rolled
  240° arc; **the number lives inside the `<svg>` as `<text>`**, not pulled over it with a negative
  margin, or the containment suite correctly flags two overlapping siblings.
- **`actionTiles(o)` — the tiles are a to-do list, not a census.** Post-hire the map has exactly one
  real clock in it: how long things have been sitting. So every tile carries an age ("oldest is 34
  days old") and `ageDays` drives the `hot` state. Overdue `nextAction` leads. `data-dash="wtab|x"`
  routes to the tab that would fix it.
- **`pace(o)` / `paceCard`** — total, added this week vs your own 3-week average, and where your
  current rate lands by day 90. A projection of your own line, never a target someone made up.
- `briefLine()`/`briefingCard()` — one true line about today, assembled from the numbers (day N,
  notes this week, people talked to, open problems, unanswered questions), never generic
  encouragement, plus `quoteOfDay()`. The quote index comes from the **date**, not `random()`, so
  it's stable all day and identical on every device. Every entry in `QUOTES` is something a real
  person said or a stated proverb — **never invent a quotation and put a real name under it**;
  that is the same lie the post-hire prompts are built to avoid.
- `mapGrowth()`/`growthCard()` — cumulative weekly buckets of every timestamped record, drawn as a
  hand-rolled SVG area (no chart library, same as `funnelChart`/`donut`). `preserveAspectRatio="none"`
  stretches it to the card, so the stroke needs `vector-effect:non-scaling-stroke` and **shapes that
  must stay round can't be used** — the endpoint is a vertical tick, not a circle, which would
  stretch into an ellipse. `var()` goes in a `style=""` attribute, never a presentation attribute.
  Hidden below 3 records: a two-point line is decoration, not information.
- `reconnectPeople()`/`reconnectCard()` — people you're drifting from, ranked by gap × log(1+contacts)
  so five conversations that stopped outrank a name mentioned once. Skips you and anyone `personHere`
  says has left. Needs ≥2 or it doesn't render.
- `deptCoverage()`/`coverageCard()` — how much you actually know per department (people×2 + notes +
  records), bars in `deptColor()`. A department that's nearly blank is flagged, which is the thing a
  count can't tell you.
- `worthKnowing()`/`worthKnowingCard()` — one bite/decision/info rotated back up, also by date.
  Everything you write down sinks; this is the only way the pile pays you back.
The decorative blobs are `.wov-bloom` — the containment suite exempts things named as decoration,
so a new blur/glow layer needs a name that says so, not `.bl1`.

**Ask Meanwhile** (`workRefs`/`askWorkPrompt`/`runWorkAsk`) dumps the structured records with bracket
ids, requires inline citations, and renders `[p2]` back as clickable chips (`citeHTML`/`citeLabel`).
The last `ASK_KEEP` (10) questions and answers per employer are kept on `state.work.asks`
(`askLog`/`askHistory`/`askLoad`) so an earlier answer reopens without another call; re-asking the
same question replaces its entry rather than stacking a duplicate, text is trimmed before storage
(this is one localStorage key that gets pushed to the vault on every save), and `at` is forced
strictly upward because `Date.now()` ties inside a millisecond make "keep the newest ten" arbitrary.
**Who do I ask?** (`whoToAsk`) is ranked *in JS from the graph* so the evidence is always real — the
AI only phrases the recommendation over candidates it can't add to. **What am I missing?**
(`knowledgeGaps`) is likewise computed, so every gap is a fact about your notes. Same principle in
`reportData/reportText` for the 30/60/90 reviews: numbers computed, narrative generated.

**Nothing is filed forever.** `convertEnt` moves a record to **any** other type — including
person↔anything — keeping its links, the notes that mention it, its original `at` and a
`convertedFrom` breadcrumb. `CONVERT_LIKELY` only *orders* the options (`convertTargets()` appends
the rest from `CONVERT_ALL`); nothing is forbidden, because you rarely know what a thing is when you
first write it down. `ENT_NAMEF`/`ENT_BODYF` map each type's name and body field so the text
survives — **person included** (`name`/`notes`), or converting *to* a person silently drops it.
Converting a person away clears every pointer that assumed one: `managerId`, department/team
`headId`, project/system `ownerId`, bite `personId`. `openConvertPicker` is a tile grid plus **one
optional "connect it to" dropdown** — that is the "Joe Smith is actually someone's dog" case: the
fact stops being a contact but stays hung off the person it came from (`RELATES_TO`).
**Mislabelled records** (`convertEnt`/`openConvertPicker`, offered on every type)
move to another type keeping their links, the notes that mention them and their original `at`;
`ENT_NAMEF`/`ENT_BODYF` map each type's name and body field so the text survives.

**Work view** (`renderWork`): hero with the day-N-of-90 ring, then tabs
`overview | people | org | projects | problems | knowledge | timeline | ask`. The **people** tab is
the reporting tree, not a flat list: `peopleTree()` walks `personManager()` (so a `managerId` *or* a
`REPORTS_TO` link both count) and `pplRow()` indents each report under its manager, with a badge
showing how many report to them. Siblings stay ordered most-contact-first, so a flat org degrades to
the old list. The `anc` array carries, per level, whether that ancestor has a following sibling —
that is what decides where the vertical guide lines continue. Cycle guard and a depth cap, because a
reporting loop is a typo, not a crash; anyone stranded by one is still listed. People who have left
(`personHere`) come off the tree into a "No longer here" group, same rule as the chart. The **org** tab
(`workOrg`) is the map plus every department with its teams, heads and members; Knowledge is now
purely what-you-know (company info, systems, processes, decisions, questions, notes). `careerTimeline()` merges
pre-hire events (discovered/applied/rounds) with post-hire ones (milestones, captures, entities).
`workGraph()` is a real **org chart**: `orgLayout()` builds a tidy tree from `person.managerId`
(or a `REPORTS_TO` link, via `personManager()`), with a cycle guard, and drops anyone without a
reporting line into a band underneath rather than hiding them. Solid elbows are reporting;
dashed arcs are `collabPairs()` — people who keep appearing on the same project or problem, which
is the thing an org chart never tells you. Two layouts via `ogMode`: `orgLayout()` (reporting tree) and `deptLayout()` (department bands, with
**teams nested inside as their own dashed rounded regions** via `teamBoxes`, each labelled with its
lead; department and team heads get a gold ring and crown on their card). Departments get a stable colour from `deptColor()` — the card's accent bar, the
dot on its meta line, the legend chips and the bands all agree; tapping a legend chip sets
`ogFilter` and dims everyone else. Dashed lines are both inferred (`collabPairs`) and **manual**
(`WORKS_WITH` links, drawn heavier — `setWorksWith`/`openWorksWithPicker` from a person's record).
Pan/zoom/drag live in `armWorkGraph()` (pointer events, so touch and mouse share a path); dragged
positions persist in `W().layout` and `ogZoom("reset")` clears them.
**The bind flag lives on the element** (`wrap.dataset.bound`), never on the module: every `render()`
builds a new `#ogWrap`, and a module-level flag left that new one with no listeners — which is
exactly how editing someone from the map used to kill it until a reload. Managers and departments are set from the person detail (`openMgrPicker`,
`openDeptPicker`) — both write the field *and* the graph link.
**Day 91 changes nothing** — and the UI has to say so, because a countdown implies something
runs out. The ring (`.wh-ring`) is a **button** (`data-act="ring-help"` → `openRingHelp()`) that
spells out in plain words that nothing locks, expires, resets or is archived at day 90; past 90 it
simply reads complete, keeps counting ("128 days in") and the framing becomes *My Company*. The
Home hero counter is the same button. Never reintroduce copy like "90-day mode" that sounds like a
state you can fall out of.
The hero`s `.wh-top` is a **grid**, not a flex row (`"fav name ring" / "fav sub ring"`, and on
phones `"fav name ring" / "sub sub sub"`) so the subtitle drops to its own full-width line instead
of being crushed between the logo and the ring. The ring `<svg>` must size from CSS (`width:100%`),
never fixed attributes — a fixed 76px svg in a 62px slot put the number off-centre inside its own
circle, which is exactly the bug it shipped with.

**The header follows the job.** `tuneTopbar()` swaps the two topbar actions per view: on Work they
become **Add** (`openAddRecord()` — one grid for every record type) and **Capture**, and the search
placeholder changes, because "Smart add / Add role" is the wrong tool once you already have the job.
Everywhere else the job-search actions stay. Apply the same test anywhere pre-hire language leaks in.
**The map is a tool, not a picture.** `.og-tools` is a slim rail floating over `#ogWrap`'s right edge:
add person / department / team, draw a reporting line, link two people, and `?` (`openMapHelp()`).
`ogTool()` routes them (org / person / department / team / reporting line / works-with / help);
the connect tools go through `pickPersonThen()` then hand off to the pickers
that already exist. **The rail sits inside the pan surface, so `armWorkGraph`'s `pointerdown` must
ignore `.og-tools`** — capturing the pointer swallows every click on it — and `ogFit()` reserves
`ogRailGutter()` so the fitted view never parks a card underneath it.
**Not everyone you track still works there.** A person carries a `standing` (`PERSON_STANDING`,
default "Here"): left, *predecessor — had my role*, changed team, or not an employee. `personHere(p)`
gates it. They stay a full record — notes, links, citations, search — but come **off the reporting
chart**, because a chart that shows a predecessor reporting to your manager is a lie about how the
place works today. `orgLayout`/`deptLayout` partition them into `aside`, drawn under a gold
"NO LONGER HERE" shelf (its own band in department mode), dimmed and dashed but fully clickable and
draggable. `whoToAsk()` skips them — never send someone to ask a person who has left; their knowledge
is in the notes, not at their desk.
**Organizations sit above departments.** A large employer is a stack of legal entities and brands —
Mendix ⊂ Siemens Digital Industries Software ⊂ Siemens — and that is the thing a department list
cannot express. `ENT.org` (list `orgs`, kinds in `ORG_KINDS`) nests via `parentId`; a department
belongs to one via `orgId`, so different departments can hang off different levels of the stack.
`o.hired.orgId` marks the one that actually employs you (`employerOrg()`), and `orgPath()` walks the
lineage with a cycle guard. `orgLadder()` draws it as an indented ladder at the top of the Departments
tab, badging your employer; **its recursion needs its own `drawn` set** — the cycle guard on the path
walk does not protect a tree render, and two orgs pointing at each other overflowed the stack.
**Departments nest too** (`parentId`, an `ent:department` field), so division → department → team goes
as deep as needed; `deptPath()` walks up with the same guard.
**Every `ent:` picker creates what it picks** — `openEntForm` renders a `.pick-wrap` with a `＋ New …`
option; choosing it reveals an inline name field and `addEntInline()` creates the record (reusing an
existing one on a name match) without leaving the form.
**A synced AI key is only useful if the device adopts it.** `adoptSyncedAI()` runs at boot and after
every pull: a device with no key of its own takes the whole synced setup (engine, key, model) into
`aiCfg`. Without it a second device sat on the default engine and refused a perfectly good Groq key
for not matching — the key was there and the app still said "connect an AI".

**One switch decides what the app is for.** `APP_MODES` / `appMode()` / `setAppMode()`, stored on
`state.meta.mode`, at the very top of Settings: *Automatic* (show Work once a role is hired),
*Job hunting* (hide Work), *I'm employed* (Home + Work only). The app used to infer this, which
broke on any device that hadn't synced the hire — no Work tab and no way to ask for one. Note
`render()`'s guard: it only bounces you off Work when the mode is **not** "working", or an
explicit choice gets silently overridden.
**Knowledge bites** (`ENT.bite`, list `bites`, kinds in `BITE_KINDS`) are the atomic layer: one
small true thing — what a name used to mean, an unwritten rule, a number — with tags, a source and
an optional person. **They are deliberately kept out of the general AI context.** A pile of trivia
in every prompt drags the model toward whatever it contains, so `bitesFor(o,q)` matches them
against the question and `workRefs(o,q)` appends only those, cited like everything else. No
question means no bites. **They are also extracted from captures now** — the layer existed for a
year and only ever filled by hand, because `CAPTURE_SCHEMA` never asked for one. It does (see the
four week numbers above); a bite arrives as an ordinary tickable plan item like any other record.
**`BUILD`** is shown in Settings with a *Check for update* button (`forceUpdate()` unregisters the
service worker and clears caches). "I don't see the change" has twice been a stale cached file.

**Two FABs, always in the same place** (`renderFab`): Capture puts something in, **Ask** (green,
sitting above it, `data-act="ask-fab"`) gets something out. Ask was only a tab, which is the wrong
home for the question you have while looking at something else. Different colour on purpose — they
do opposite things. Both appear only once `employers().length > 0`.

**Nav** is progressive: `VIEWS` entries can carry `when()`, and Work only appears once
`employers().length > 0`, so a new user never sees an empty object.

## Data model
`state = { opportunities:[], stages?:[], resume?:{file,text,data}, stories?:[], questions?:[], profile?:{name,headline}, scorecard?:{}, work?:{}, rev, meta }`
- `state.work` (POST-HIRE, `W()`): `{ captures[], projects[], problems[], orgs[], departments[], systems[],
  processes[], decisions[], questions[], links[], milestones[], reports[], asks[], objectives[] }` —
  every record carries
  `{id, opId, at}`. **Note the name clash:** `state.questions` is the pre-hire Prep Bank question
  library; post-hire **open questions** are `state.work.questions`.
  `capture.shots[]`: `{name,type,size,ref,w,h}` — photos on a note; bytes in IndexedDB, never on `state`.
- `o.hired`: `{startDate, title, manager, managerId, meId, acceptedAt}` — present once `status==="hired"`.
  `meId` points at the person record on `o.people` that is **you**.
- `o.people[]` gains post-hire fields: `deptId`, `teamId`, `managerId`, `standing`, `expertise[]`, `at`, `fromCapture`.
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
- **Nothing large goes on `state`.** It's one localStorage key (~5MB) that gets pushed to the cloud on every
  save. Bytes belong in IndexedDB behind a `ref`; `state` holds ids, text and metadata.
- **Containment: user text must never break its box.** `body` sets `overflow-wrap:break-word` so a
  single long unbroken word (a system name, a handle, a pasted URL) cannot walk out of a card.
  Beyond that: a flex/grid child holding text needs `min-width:0` (the default `auto` refuses to
  shrink below its content — this is what put the company name under the day ring); a chip or pill
  carrying a name needs `max-width:100%` + ellipsis; a fixed-size box in a flex row needs
  `flex:0 0 <size>` or it gets squeezed and crops its contents (the sidebar mark did); and anything
  positioned at `0–100%` and centred on its point overhangs both ends, so inset its plotting area
  (the Upcoming timeline) rather than letting the card shave it. Where insetting would break
  alignment — a month label must stay over the dates it labels — make the positioned element a
  zero-width anchor and shift only the text inside it (`.tl-tick` / `.tl-tick.at-start|.at-end`).
- **Mobile = no horizontal scrolling, ever.** Pipeline stacks vertically on mobile; the table
  becomes `renderRoleCards()`. Test that `document.documentElement.scrollWidth <= innerWidth`.
- Respect iOS safe areas (`env(safe-area-inset-*)`) for top bar / bottom nav / drawer.
- Keep it dependency-free and single-file. No CDN scripts, no npm at runtime.
- Stages: the active pipeline stages are user-editable (`state.stages`); the closed buckets
  (rejected/withdrawn/ghosted) are fixed in `CLOSED_STAGES`, and `HIRED_STAGE` sits between the two.
  Never hard-code a status id without a fallback — a user may have renamed/removed it.
- **The AI must never invent organizational knowledge.** Post-hire prompts say "based on your
  notes", cite their sources, and are told to answer "you haven't recorded anything about that"
  rather than fill a gap. Anything ranked or counted (who to ask, gaps, report numbers) is computed
  in JS from the records so the evidence is real; the model only does wording.
- **The AI writes; the code decides what may be written.** `buildPlan` coerces every list the model
  returns (`L()` — a string, an object or a null where an array belongs must not throw, or the whole
  note is refused), whitelists the fields an `update` may `set` (never ids, `opId`, names, `meId`,
  `managerId`, `standing`), validates a status against that type's own list, drops an update that
  doesn't resolve to exactly one record, only closes questions that are actually open, and passes
  dates through `validYMD()` — the shape test alone let `2026-13-45` become a calendar entry.
  `agent.mjs` in the scratchpad attacks all of this deliberately.
- **`esc()` is for text; markup is not the only escaping context.** Two more helpers exist because
  `esc()` alone doesn't cover them: `cssCol(c)` for anything landing inside `style="…"` (a colour is
  the one a user can set, and `;`/`)` break out of a declaration, which `esc()` doesn't touch), and
  `safeUrl(u)` / `safeImg(u)` for `href`/`src` (`esc()` happily preserves `javascript:`). Every
  user-typed or AI-extracted URL goes through `safeUrl`; contact photos and logos through `safeImg`.
- **`save()` keeps `rev` strictly climbing** (`Math.max(Date.now(), rev+1)`). `rev` is the entire
  conflict story for cloud sync — a bare `Date.now()` ties inside one millisecond and runs backwards
  on a lagging clock, either of which silently drops an edit.
- **Drawer buttons outlive their record.** The drawer is hidden with a class, not removed, so the
  delegated click handler bails early (`t.closest("#drawer") && !getOp()`) rather than letting a
  dozen handlers each dereference an undefined opportunity.

## How to verify changes (do this — don't ship untested)
The app has been through a full audit — static (AST) plus runtime — and there are **~1,600 browser
assertions** across forty-one Playwright suites. They live in the scratchpad, not the repo (the app
stays dependency-free), so recreate what you need rather than hunting for them. What they cover,
and what a future change should not regress:
- **XSS**: a payload in *every* user-writable field, then render every view, work tab, drawer tab,
  modal and entity form and assert nothing was parsed as markup. The whole surface once traced back
  to stage `name`/`color` — see `cssCol`/`safeUrl` above.
- **Resilience**: links and `deptId`/`managerId`/`ownerId` pointing at deleted records, a reporting
  line that loops, records with no ids, `null` where arrays belong, a status no stage defines,
  nonsense dates, corrupt localStorage. Nothing may throw; nothing may blank the screen.
- **Clicks**: every `data-*` control in every view is clicked and the console must stay silent.
- **Layout**: no horizontal scroll at 320–1024px, on every view and every work tab.
- **Weight**: 60 people / 120 notes / 300 links / 30 roles still renders each view in ~20ms.
- **Durability**: a refused write keeps the last good copy and raises the alarm; a backup round-trips
  including IndexedDB attachment bytes; free AI keys sync and paid ones never enter the document;
  a half-typed form survives a backdrop tap or Escape.

Day to day, verify in a real browser via the preview tools:
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

## Known limits, stated on purpose
- **Photos are device-local.** Bytes live in IndexedDB behind a `ref`; only `{name,type,size,ref}`
  syncs. `hydrateShots()` renders `SHOT_MISSING` (an inline SVG saying so) rather than an empty
  frame — the note's *transcription* travels, the picture doesn't, and a backup file re-inlines it.
  Real attachment sync would mean Supabase Storage; not built.
- **2FA is app-level until the SQL is run.** `SYNC_SQL`'s policies check `auth.uid()` only, so a
  password alone yields an `aal1` token that satisfies them over the REST API. `MFA_SQL` (Settings →
  Your account, once 2FA is on) adds `mw_mfa_ok()` to all four policies. Deliberately opt-in and
  additive — accounts without a verified factor take the `else true` branch — and the way back is
  the last line of the block, because it's the one change here that could lock someone out.
- **`askPersistentStorage()`** asks the browser not to evict this origin. It is a request, not a
  guarantee; the answer is recorded in `devPrefs.persisted` and shown, never assumed.
- **A failed refresh is not always the end of a session.** `authToken()` tells a rejected refresh
  token (400/401/403, `invalid_grant`) from a dropped connection and only clears the session for the
  first. `refreshing` is cleared **synchronously** — on a timer, the next call in the same tick was
  handed back the previous rejection.

## Accounts & cloud sync (the user's own Supabase project)
Sign-in is email + password with optional TOTP 2FA, and the vault row is owned by the account.
The app stores project URL + anon key + the session in localStorage per device. **No Supabase keys,
sync codes, passwords or tokens belong in this repo.** Setup SQL is the `SYNC_SQL` constant in
`index.html` (also shown in Settings). Two things the owner must do in the dashboard and no code can
do for them: run that SQL, and set **custom SMTP** under Authentication → Emails — the built-in
sender allows only a few messages an hour, which is not enough for confirmations and resets.

## PWA / offline
`sw.js` (registered at boot, http(s) only) caches the app shell — network-first for
navigations (updates show online), cache fallback offline. Cross-origin (logos/AI/readers/
Supabase) is never intercepted, so it fails gracefully offline. Inline web manifest already
present. Bump `CACHE` in `sw.js` to force-invalidate.

## Server-side (optional, needs Supabase deploy)
- `supabase/functions/ai` — Gemini proxy for Smart add / briefs / résumé / digest-free AI.
- `supabase/functions/digest` — daily reminder digest (quiet processes + 7-day upcoming) to
  Slack and/or email (Resend); reads the vault via `get_vault` with `DIGEST_CODE`. Scheduled
  via Supabase cron. Runbook in `supabase/README.md`.

## Deliberately NOT doing
- **MCP / connecting Meanwhile to an outside AI host.** Considered and rejected by the owner:
  everything lives in Meanwhile. MCP runs the other way — it would make the app a data source for
  ChatGPT or Claude and move the asking into someone else's chat window, which hollows out the
  point of `Ask Meanwhile` and sends the whole company map to a third party rather than the
  minimum a specific prompt needs. The AI stays *inside* the app, called per-feature with a
  scoped prompt. Don't propose this again.

## Backlog / ideas not yet built
- Real PNG app icons + screenshots for App Store (icons currently inline SVG).
- "Questions they asked me" reusable library (questions-to-ask is now generated on demand).
- Per-user digest config (currently one vault via env; fine for personal use).
- Post-hire, deliberately not built yet (the brief's Tier 4 — don't start these until the capture →
  extract → ask loop has been lived in for a while): calendar/email/Slack/Teams ingestion feeding
  the same graph and meeting transcript import. ("What changed?" is built — see `changesSince`.)
- Native iOS build for durability: in a Capacitor wrapper the same storage sits in the app sandbox, so it
  survives "clear browsing data" and Safari's 7-day eviction and rides along in iCloud device backups.
- Semantic/vector search for Ask Meanwhile. Today retrieval is the full structured record set plus
  the 40 most recent notes, which is plenty at personal scale and needs no new infrastructure.

## Tone for the owner
Connor is sharp but not a developer — explain choices briefly, default to action, keep the UI
delightful and dead-simple. When in doubt, make it easier to use, not more featureful.
