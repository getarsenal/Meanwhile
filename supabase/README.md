# Supabase setup

Two separate things live here: **accounts + sync** (required, dashboard only, no CLI) and the
optional **Edge Functions** (Smart add proxy, daily digest — CLI needed). Do accounts first.

---

## Accounts & sync — one-time dashboard setup

Sign-in is email + password with optional TOTP two-factor. The vault row is owned by the account
and scoped by row-level security, so one project can serve several colleagues without any of them
seeing another's notes.

**Export a backup from the app first** (Settings → Pipeline & data → Export backup).

1. **Run the SQL.** Dashboard → **SQL Editor → New query** → paste the `SYNC_SQL` block (copy it
   from the app: Settings → *Copy setup SQL*) → **Run**. Expect “Success. No rows returned.”
   It is safe to run more than once.
   The table is `user_vaults`, deliberately **not** `vaults` — reusing the name would collide with
   the old code-keyed table on a project that already ran the legacy SQL.

2. **Set the Site URL.** Authentication → **URL Configuration → Site URL** →
   `https://getarsenal.github.io/Meanwhile/`.
   Every confirmation and reset link points here. It defaults to `localhost:3000`, which silently
   makes every emailed link dead — this is the single most common way the setup "doesn't work".

3. **Choose whether sign-ups must confirm by email.** Authentication → Sign In / Providers →
   Email → **Confirm email**. Off = instant sign-up, no email infrastructure needed. On = requires
   step 4 to be working first, or nobody can get in.

4. **Custom SMTP.** Authentication → **Emails → SMTP Settings**. The built-in sender allows only a
   few messages an hour and is not for real use; password resets need email regardless of step 3.
   Reuse the Resend key from the digest function:
   host `smtp.resend.com`, port `465`, user `resend`, password = the Resend API key, sender = an
   address on a domain verified in Resend. **Until a domain is verified Resend only delivers to
   your own address** — fine for testing, not fine when a colleague signs up.

5. **Project URL + anon key** (Project Settings → API) into the app under Settings → Project
   settings. Already filled in if the device was syncing before.

6. **Create the account on the device that already holds the data.** That device's copy is
   uploaded to the new account. Signing up on a blank device first creates an empty account.

7. Sign in on a second device to confirm. If that device also has data, the app stops and asks
   which side to keep, naming the counts — it never silently picks.

8. Optional: turn on two-factor in the app; then close the door with Authentication → Sign In /
   Providers → Email → **Enable sign ups** off, once everyone is in.

Users are listed under Authentication → **Users**; that is also where to remove someone's MFA
factor if they lose their authenticator.

### Migrating off the sync code
The legacy `vaults` table and the `set_vault`/`get_vault` RPCs are left untouched and keep working,
so the old path stays available as a safety net. Delete them only after accounts have been in use
for a while.

---

## Smart add — optional cloud proxy

Meanwhile's **Smart add** (paste an invite / email / job post / profile → suggested entry)
works three ways. You pick the engine in **Settings → Smart add engine**:

1. **Gemini (default, free)** — paste a free **Gemini** key into the app's AI engine
   settings. One-tap, $0 on Google's free tier, the broadest/most reliable option for
   wide distribution. Get a key at https://aistudio.google.com/apikey (30s, no card).
   The key lives in your browser's local storage (fine on your own device).
2. **Cloud proxy (this folder)** — your Gemini key lives **server-side** on your own
   Supabase project; the browser never sees it and users need no setup of their own.
3. **Claude** — paste an Anthropic key instead, if you prefer Claude's quality.
4. **Copy-paste (no key)** — always-works fallback: the app builds a prompt you paste
   into any chatbot, then paste the JSON reply back. No setup.

## Deploy the proxy (option 3)

Prereqs: a Supabase project (the same one you use for sync is perfect) and the
[Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
# from the repo root
supabase login
supabase link --project-ref <your-project-ref>     # ref is in your Supabase project URL
supabase secrets set GEMINI_API_KEY=AIza...         # free key — never committed
supabase functions deploy ai
```

Then in the app: **AI engine → Cloud proxy → Save**. The proxy URL auto-fills to
`https://<your-project>.supabase.co/functions/v1/ai` (derived from your sync settings);
override it only if you deployed elsewhere.

## Daily reminder digest (optional, `functions/digest`)

Your push-notification stand-in for the web/PWA. Once a day it reads your synced data and
sends a summary of what's gone quiet and what's coming up — to Slack and/or email.

```bash
supabase secrets set SUPABASE_URL=https://<ref>.supabase.co
supabase secrets set SUPABASE_ANON_KEY=<your-anon-key>
supabase secrets set DIGEST_CODE=<your in-app Sync code>     # which vault to read
# pick one or both destinations:
supabase secrets set SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
supabase secrets set RESEND_API_KEY=re_...  DIGEST_EMAIL=you@example.com
supabase functions deploy digest
```

Then schedule it: Supabase Dashboard → Edge Functions → **digest** → **Schedules**, e.g. CRON
`0 13 * * *` (~8am ET). Trigger it manually any time by opening the function URL. It returns a
JSON preview so you can see exactly what it would send.

## Notes

- **No keys belong in this repo.** The key is set via `supabase secrets`, which stores
  it on Supabase, not in git.
- The function requires the project's anon JWT (sent automatically by the app). The anon
  key is public, so Gemini's free tier is the backstop; add rate limiting if you scale.
- The function accepts an optional `doc` (base64 PDF) so the app can have Gemini read a
  PDF résumé/JD directly.
- Swap the model by editing `MODEL` in `functions/ai/index.ts` and re-running
  `supabase functions deploy ai`.
