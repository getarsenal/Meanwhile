// Callback — daily reminder digest (Supabase Edge Function, scheduled).
//
// Your push-notification stand-in for the web/PWA: once a day this reads your synced
// data and sends a summary of (a) processes that have gone quiet and need a nudge and
// (b) interviews / tasks coming up in the next 7 days — to Slack and/or email.
//
// Setup (from the repo root, Supabase CLI installed & logged in):
//   supabase link --project-ref <your-project-ref>
//   supabase secrets set SUPABASE_URL=https://<ref>.supabase.co
//   supabase secrets set SUPABASE_ANON_KEY=<your-anon-key>
//   supabase secrets set DIGEST_CODE=<your in-app Sync code>          # which vault to read
//   # pick one or both destinations:
//   supabase secrets set SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
//   supabase secrets set RESEND_API_KEY=re_...  DIGEST_EMAIL=you@example.com  DIGEST_FROM="Callback <onboarding@resend.dev>"
//   supabase functions deploy digest
//
// Schedule it daily (Supabase Dashboard → Edge Functions → digest → Schedules, e.g. CRON
// "0 13 * * *" for ~8am ET), or via pg_cron calling the function URL. Trigger manually any
// time by opening the function URL in a browser.

const CLOSED = new Set(["rejected", "withdrawn", "ghosted"]);
const NON_ACTIVE = new Set(["offer", "wishlist"]);

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function daysUntil(date: string, today: Date): number | null {
  if (!date) return null;
  const a = new Date(date + "T00:00:00"); const b = new Date(ymd(today) + "T00:00:00");
  if (isNaN(a.getTime())) return null;
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}
function daysSince(ms: number, today: Date): number {
  if (!ms) return 999;
  return Math.floor((today.getTime() - ms) / 86400000);
}

type Op = Record<string, any>;

function nextEvent(o: Op, today: Date) {
  let best: { du: number; label: string; date: string } | null = null;
  for (const r of (o.rounds || [])) {
    if (r.date && r.status !== "done" && r.status !== "cancelled") {
      const du = daysUntil(r.date, today);
      if (du != null && du >= -1 && (!best || du < best.du)) best = { du, label: r.name || r.type || "Interview", date: r.date };
    }
  }
  if (o.nextActionDate) {
    const du = daysUntil(o.nextActionDate, today);
    if (du != null && (!best || du < best.du)) best = { du, label: o.nextActionLabel || "Next step", date: o.nextActionDate };
  }
  return best;
}

function buildDigest(state: any, today: Date) {
  const ops: Op[] = (state && state.opportunities) || [];
  const nudges: string[] = [];
  const upcoming: { du: number; line: string }[] = [];

  for (const o of ops) {
    const status = o.status || "";
    const active = !CLOSED.has(status) && !NON_ACTIVE.has(status) && status !== "";
    const ne = nextEvent(o, today);

    // needs a nudge: active, nothing scheduled ahead, quiet 7+ days
    if (active && (!ne || ne.du < 0) && daysSince(o.updatedAt, today) >= 7) {
      nudges.push(`• ${o.company}${o.role ? ` — ${o.role}` : ""} (quiet ${daysSince(o.updatedAt, today)}d)`);
    }
    // upcoming within 7 days
    for (const r of (o.rounds || [])) {
      if (r.date && r.status !== "cancelled") {
        const du = daysUntil(r.date, today);
        if (du != null && du >= 0 && du <= 7) upcoming.push({ du, line: `• ${du === 0 ? "Today" : du === 1 ? "Tomorrow" : "in " + du + "d"} — ${o.company}: ${r.name || r.type || "interview"}${r.time ? " @ " + r.time : ""}` });
      }
    }
    if (o.nextActionDate) {
      const du = daysUntil(o.nextActionDate, today);
      if (du != null && du >= 0 && du <= 7) upcoming.push({ du, line: `• ${du === 0 ? "Today" : du === 1 ? "Tomorrow" : "in " + du + "d"} — ${o.company}: ${o.nextActionLabel || "Next step"}` });
    }
    if (o.offer && o.offer.deadline) {
      const du = daysUntil(o.offer.deadline, today);
      if (du != null && du >= 0 && du <= 7) upcoming.push({ du, line: `• ${du === 0 ? "Today" : "in " + du + "d"} — ${o.company}: offer decision deadline` });
    }
  }
  upcoming.sort((a, b) => a.du - b.du);

  const parts: string[] = [];
  parts.push(`*Callback — your daily digest* (${ymd(today)})`);
  parts.push("");
  parts.push(upcoming.length ? `📅 *Coming up (7 days)*\n${upcoming.map((u) => u.line).join("\n")}` : "📅 Nothing scheduled in the next 7 days.");
  parts.push("");
  parts.push(nudges.length ? `🔔 *Needs a nudge*\n${nudges.join("\n")}` : "🔔 No processes have gone quiet — nice.");
  return { text: parts.join("\n"), upcoming: upcoming.length, nudges: nudges.length };
}

async function getVault(url: string, anon: string, code: string) {
  const res = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/rpc/get_vault`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anon, Authorization: `Bearer ${anon}` },
    body: JSON.stringify({ p_code: code }),
  });
  if (!res.ok) throw new Error(`get_vault ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const rows = await res.json();
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row && (row.data || row.p_data || row);
}

Deno.serve(async () => {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const code = Deno.env.get("DIGEST_CODE");
    if (!url || !anon || !code) return new Response(JSON.stringify({ error: "set SUPABASE_URL, SUPABASE_ANON_KEY, DIGEST_CODE" }), { status: 500 });

    const state = await getVault(url, anon, code);
    if (!state) return new Response(JSON.stringify({ error: "no vault for that code" }), { status: 404 });

    const today = new Date();
    const d = buildDigest(state, today);
    const sent: string[] = [];

    const slack = Deno.env.get("SLACK_WEBHOOK_URL");
    if (slack) {
      const r = await fetch(slack, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: d.text }) });
      sent.push("slack:" + r.status);
    }

    const resend = Deno.env.get("RESEND_API_KEY");
    const email = Deno.env.get("DIGEST_EMAIL");
    if (resend && email) {
      const html = `<div style="font:14px/1.6 -apple-system,Segoe UI,Roboto,sans-serif">${d.text.replace(/\*(.+?)\*/g, "<b>$1</b>").replace(/\n/g, "<br>")}</div>`;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resend}` },
        body: JSON.stringify({ from: Deno.env.get("DIGEST_FROM") || "Callback <onboarding@resend.dev>", to: [email], subject: `Callback digest — ${ymd(today)}`, html }),
      });
      sent.push("email:" + r.status);
    }

    return new Response(JSON.stringify({ ok: true, upcoming: d.upcoming, nudges: d.nudges, sent, preview: d.text }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
