# Smart add — optional cloud proxy

Callback's **Smart add** (paste an invite / email / job post / profile → suggested entry)
works three ways. You pick the engine in **Settings → Smart add engine**:

1. **Copy-paste (no key)** — default, $0, works with any chatbot. The app builds a
   prompt; you paste it into your AI and paste the JSON reply back. No setup.
2. **Direct key** — paste a **Claude** or free **Gemini** key into Settings. One-tap,
   but the key lives in your browser's local storage (fine on your own device).
3. **Cloud proxy (this folder)** — your key lives **server-side** on your own Supabase
   project; the browser never sees it. One-tap and nothing exposed.

## Deploy the proxy (option 3)

Prereqs: a Supabase project (the same one you use for sync is perfect) and the
[Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
# from the repo root
supabase login
supabase link --project-ref <your-project-ref>     # ref is in your Supabase project URL
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # your key — never committed
supabase functions deploy ai
```

Then in the app: **Settings → Smart add engine → Cloud proxy → Save**. The proxy URL
auto-fills to `https://<your-project>.supabase.co/functions/v1/ai` (derived from your
sync settings); override it only if you deployed elsewhere.

## Notes

- **No keys belong in this repo.** The key is set via `supabase secrets`, which stores
  it on Supabase, not in git.
- The function requires the project's anon JWT (sent automatically by the app). The anon
  key is public, so also **set a spend cap** on your Anthropic account as a backstop.
- Swap the model/provider by editing `functions/ai/index.ts` (`MODEL`, or the `fetch`)
  and re-running `supabase functions deploy ai`.
