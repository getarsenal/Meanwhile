# Smart add — optional cloud proxy

Callback's **Smart add** (paste an invite / email / job post / profile → suggested entry)
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

## Notes

- **No keys belong in this repo.** The key is set via `supabase secrets`, which stores
  it on Supabase, not in git.
- The function requires the project's anon JWT (sent automatically by the app). The anon
  key is public, so Gemini's free tier is the backstop; add rate limiting if you scale.
- The function accepts an optional `doc` (base64 PDF) so the app can have Gemini read a
  PDF résumé/JD directly.
- Swap the model by editing `MODEL` in `functions/ai/index.ts` and re-running
  `supabase functions deploy ai`.
