import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const resendKey   = Deno.env.get("RESEND_API_KEY");
  const fromEmail   = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@northdallasalphas.com";
  const fromName    = Deno.env.get("RESEND_FROM_NAME")  ?? "North Dallas Alphas";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")      ?? "";
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!resendKey)   return json({ error: "RESEND_API_KEY not configured." }, 503);
  if (!serviceKey)  return json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured." }, 503);

  let payload: { subject: string; html: string };
  try { payload = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!payload.subject || !payload.html) return json({ error: "subject and html are required." }, 400);

  // Fetch all active members with emails
  const membersRes = await fetch(
    `${supabaseUrl}/rest/v1/members?status=eq.active&portal_access=eq.granted&select=email,first_name&email=not.is.null`,
    { headers: { "apikey": serviceKey, "Authorization": "Bearer " + serviceKey } }
  );
  if (!membersRes.ok) return json({ error: "Failed to fetch members." }, 502);
  const members: Array<{ email: string; first_name?: string }> = await membersRes.json();

  const emails = members.filter((m) => m.email && m.email.includes("@"));
  if (!emails.length) return json({ error: "No active members with email addresses found." }, 404);

  const from = `${fromName} <${fromEmail}>`;
  let sent = 0;

  // Send in batches of 50 (Resend batch limit)
  for (let i = 0; i < emails.length; i += 50) {
    const batch = emails.slice(i, i + 50);
    await Promise.allSettled(batch.map((m) =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + resendKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [m.email],
          subject: payload.subject,
          html: payload.html,
        }),
      }).then((r) => { if (r.ok) sent++; else r.text().then((t) => console.error("Resend error:", t)); })
    ));
  }

  return json({ sent, total: emails.length });
});
