// Callback — "Smart add" AI proxy (Supabase Edge Function)
//
// Holds the model API key SERVER-SIDE so the browser never sees it. The app POSTs
// { prompt }, this calls Claude and returns { text } (raw JSON the app parses).
//
// One-time setup (from the repo root, with the Supabase CLI installed & logged in):
//   supabase link --project-ref <your-project-ref>
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...        # your key, never in git
//   supabase functions deploy ai                              # anon JWT required (default)
//
// Then in the app: Settings → Smart add engine → "Cloud proxy". The proxy URL
// defaults to <your-supabase-url>/functions/v1/ai. Set a spend cap on your
// Anthropic account — the anon key is public, so treat this as best-effort.
//
// To swap models or providers, edit MODEL / the fetch below and redeploy.

const MODEL = "claude-haiku-4-5";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const { prompt } = await req.json().catch(() => ({}));
    if (!prompt || typeof prompt !== "string") return json({ error: "missing prompt" }, 400);

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "ANTHROPIC_API_KEY secret is not set" }, 500);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300);
      return json({ error: `claude ${r.status}: ${detail}` }, 502);
    }

    const j = await r.json();
    const text = (j.content || []).map((b: { text?: string }) => b.text || "").join("");
    return json({ text });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
