// Callback — "Smart add" AI proxy (Supabase Edge Function), Gemini-based
//
// Holds the model API key SERVER-SIDE so the browser never sees it. The app POSTs
// { prompt, doc?, maxTokens? } and this calls Gemini, returning { text } (raw JSON the
// app parses). Gemini's free tier keeps this at zero cost for a broad set of users —
// the right default for App Store distribution.
//
// One-time setup (from the repo root, Supabase CLI installed & logged in):
//   supabase link --project-ref <your-project-ref>
//   supabase secrets set GEMINI_API_KEY=AIza...     # free key from aistudio.google.com/apikey
//   supabase functions deploy ai                     # anon JWT required (default)
//
// Then in the app: AI engine → "Cloud proxy". The proxy URL defaults to
// <your-supabase-url>/functions/v1/ai. The anon key is public, so the function is
// best-effort — Gemini's free tier is the backstop; add rate limiting if you scale.
//
// To swap models, edit MODEL and redeploy.

const MODEL = "gemini-2.0-flash";

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
    const { prompt, doc, maxTokens, json } = await req.json().catch(() => ({}));
    if (!prompt || typeof prompt !== "string") return json({ error: "missing prompt" }, 400);

    const key = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
    if (!key) return json({ error: "GEMINI_API_KEY secret is not set" }, 500);

    // optional document (e.g. a PDF résumé) Gemini reads natively via inline_data
    const parts = doc && doc.data
      ? [{ inline_data: { mime_type: doc.mime || "application/pdf", data: doc.data } }, { text: prompt }]
      : [{ text: prompt }];

    // JSON for extraction (default); plain prose when json === false (e.g. thank-you notes)
    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: typeof maxTokens === "number" ? maxTokens : 1024,
    };
    if (json !== false) generationConfig.responseMimeType = "application/json";

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }], generationConfig }),
      },
    );

    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300);
      return json({ error: `gemini ${r.status}: ${detail}` }, 502);
    }

    const j = await r.json();
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return json({ text });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
