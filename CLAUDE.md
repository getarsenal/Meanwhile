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
- `CLOUD SYNC` — Supabase via `set_vault`/`get_vault` RPCs. Whole-document last-write-wins keyed by `state.rev`, scoped by a private `code`. Config in localStorage `callback_sync_cfg_v1` (NOT in `state`, never synced, never in the repo).
- `HELPERS`, `ICONS` (the `I` object), `NAV`, `RENDER ROUTER`.
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
- **Modals never eat your typing**: `openEditor()` takes a `snapshotEditor()` of every field (and
  again on `spSetBody`); a backdrop tap or Escape goes through `tryCloseEditor()`, which only closes
  silently when `editorDirty()` is false and otherwise asks. The ✕/Cancel buttons still close outright.
- **AI keys**: free-tier engines (`FREE_ENGINES` — Gemini, Groq) mirror the key into `state.ai` so it
  syncs with the vault and a second device just works (`aiKey()` prefers the local key, falls back to
  the synced one). Paid keys are never written to `state`. `aiCfg.syncKey:false` opts out.
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
**Merging people** (`mergePeople`) is the repair tool for duplicates that resolution didn't catch: it unions
the fields, repoints every link/capture-reference/`ownerId`/`managerId`, then `dedupeLinks()` collapses the
duplicates and drops self-links. **Meeting prep** (`openMeetingPrep`/`meetingBrief`) assembles what you know
about the people you're about to see — computed from the graph, no calendar integration anywhere near it.
**What changed** (`changesSince`/`changedCard`) diffs the map over 7/30/90 days from timestamps already on the
records; `saveEntForm` stamps `prevStatus`/`statusAt` so transitions are real rather than inferred.

**Ask Meanwhile** (`workRefs`/`askWorkPrompt`/`runWorkAsk`) dumps the structured records with bracket
ids, requires inline citations, and renders `[p2]` back as clickable chips (`citeHTML`/`citeLabel`).
**Who do I ask?** (`whoToAsk`) is ranked *in JS from the graph* so the evidence is always real — the
AI only phrases the recommendation over candidates it can't add to. **What am I missing?**
(`knowledgeGaps`) is likewise computed, so every gap is a fact about your notes. Same principle in
`reportData/reportText` for the 30/60/90 reviews: numbers computed, narrative generated.

**Mislabelled records** (`convertEnt`/`openConvertPicker`, offered on any type in `CONVERT_TO`)
move to another type keeping their links, the notes that mention them and their original `at`;
`ENT_NAMEF`/`ENT_BODYF` map each type's name and body field so the text survives.

**Work view** (`renderWork`): hero with the day-N-of-90 ring, then tabs
`overview | people | org | projects | problems | knowledge | timeline | ask`. The **org** tab
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
Day 91 changes nothing: the ring keeps counting and the framing becomes *My Company*.

**Nav** is progressive: `VIEWS` entries can carry `when()`, and Work only appears once
`employers().length > 0`, so a new user never sees an empty object.

## Data model
`state = { opportunities:[], stages?:[], resume?:{file,text,data}, stories?:[], questions?:[], profile?:{name,headline}, scorecard?:{}, work?:{}, rev, meta }`
- `state.work` (POST-HIRE, `W()`): `{ captures[], projects[], problems[], departments[], systems[],
  processes[], decisions[], questions[], links[], milestones[], reports[] }` — every record carries
  `{id, opId, at}`. **Note the name clash:** `state.questions` is the pre-hire Prep Bank question
  library; post-hire **open questions** are `state.work.questions`.
- `o.hired`: `{startDate, title, manager, managerId, acceptedAt}` — present once `status==="hired"`.
- `o.people[]` gains post-hire fields: `deptId`, `expertise[]`, `at`, `fromCapture`.
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
navigations (updates show online), cache fallback offline. Cross-origin (logos/AI/readers/
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
