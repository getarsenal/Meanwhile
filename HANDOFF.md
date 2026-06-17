# Meanwhile — Handoff

> Status snapshot for continuing this project. Deep architecture lives in **`CLAUDE.md`** — read that
> first. This file is *current state + what's next*.

## What it is
**Meanwhile** — a single-file (`index.html`) job-interview tracker. Vanilla JS, no build step, no deps,
PWA + offline, optional Capacitor iOS wrapper and optional Supabase backend. Hosted on GitHub Pages at
`https://getarsenal.github.io/Meanwhile/`.

---

## ⚠️ Read this first: pushing
The repo was renamed `CallBack → Meanwhile`. The session that built most of this was bound to the OLD
repo name, so its git push broke after the rename (proxy authorized the old path → 503 on redirect;
new path → "not authorized"). **Work from a session connected to `getarsenal/Meanwhile`** and pushes
work normally. If you're reading this in a fresh clone, you're already fine.

---

## ✅ Done & live (on GitHub / Pages)
Full rebrand (name + chair logo everywhere) and the complete feature set, all tested:
- **Dashboard** — adaptive hero (live countdown to next interview / offers / momentum) + 4 KPI tiles
  + **Next moves** action hub (one prioritized to-do across all roles, with one-tap actions).
- **Cards** — glanceable all-roles grid; closed roles hidden behind a toggle (kept for Insights).
- **Pipeline** (kanban), **Upcoming** (list/month/timeline; calendar items are edit/delete-able),
  **Insights** + **Ask AI** (pipeline-aware assistant).
- **Smart add** — paste a job URL / email / invite / profile → AI fills a reviewable entry. PDF too.
- **Company enrich** (auto logo + pre-call brief), **Résumé Studio** (upload→edit→export PDF),
  **Prep bank** (STAR stories + question library, feeds AI prep), **Application kit** (cover letter /
  résumé↔JD match / application answers), **Offer scorecard**, per-round **thank-you notes**.
- **Profile** personalization (name → greeting + AI voice), **Cloud sync** (Supabase, your own DB),
  **offline** service worker, native iOS hooks (parked on Apple).
- A full functional audit was completed — all bugs/gaps fixed.

## ⏳ Pending (committed locally here, not yet on GitHub)
One commit renaming the **invisible technical IDs** to `meanwhile` (atomic — done together):
`capacitor.config.json` appId + iosScheme, `index.html` `APP_GROUP`, `package.json` name,
`callback://`→`meanwhile://` + bundle-id/app-group in `NATIVE.md`/`APP_STORE.md`/`CLAUDE.md`,
`privacy.html` date, `sw.js` cache bump.
**Deliberately KEPT** the device-local localStorage keys (`callback_sync_cfg_v1`, `callback_ai_cfg_v1`,
`pipeline_interview_tracker_v1`) — renaming them would wipe existing users' AI key / sync config / data.

## AI engine (BYO-LLM)
Settings → **AI Integration**. Free, no-billing options that "just work": **Groq** (`gsk_…`, current
setup) and **Gemini** (`AIza…`). ChatGPT/Claude need **paid API credits** (separate from a chat
subscription — that's why a GPT key 429s instantly). Copy-paste works with no key. There's a **Test
connection** button. PDF résumé parsing needs Gemini/Claude/proxy (not Groq/OpenAI).

## Your open setup tasks (need your accounts — not code)
1. **Native iOS** — `APP_STORE.md` + `NATIVE.md` runbooks (Capacitor build, Share Extension, App
   Group, icons in `resources/`). Parked on the Apple Dev account transfer.
2. **Optional Supabase** — `supabase/functions/ai` (key-server proxy) + `supabase/functions/digest`
   (daily reminder email/Slack). Deploy/schedule per `supabase/README.md`. Not needed for BYO-key.
3. **App Store** — remaining prep is **screenshots** (icon ✅, privacy ✅).

## Backlog (features, not fixes)
- Outreach drafting (referral / recruiter cold messages)
- Goals & velocity (weekly apply target + response-rate trend)
- True accent-color theming (move hardcoded indigo to CSS vars)
- "Questions they asked me" reusable library

## Dev conventions / gotchas
- Single file; escape user content with `esc()`; mobile = never horizontal-scroll.
- **New `data-*` button → add it to the `closest(...)` selector** in the one delegated click handler,
  and make sure the `data-act` name isn't a duplicate (a collision caused a real bug).
- `save()` = persist + bump rev + cloud push; `persist()` = local only (for cloud-sourced writes).
- **Verify before shipping** (no test suite): node-syntax-check the inline `<script>`, then a
  stubbed-DOM VM harness for render/logic assertions; bump `sw.js` `CACHE` after asset changes.
- Free third-party niceties (Clearbit logos, Jina URL reader) degrade gracefully if they ever change.
