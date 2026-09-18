import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://northdallasalphas.com",
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
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const siteUrl     = "https://northdallasalphas.com";

  if (!resendKey)  return json({ error: "RESEND_API_KEY not configured." }, 503);
  if (!serviceKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured." }, 503);

  // Verify caller is an authenticated chapter admin
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Invalid or expired session." }, 401);

  const userEmail = (userData.user.email ?? "").toLowerCase().trim();
  const adminCheck = await fetch(
    `${supabaseUrl}/rest/v1/chapter_admins?select=email&email=ilike.${encodeURIComponent(userEmail)}&limit=1`,
    { headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, Accept: "application/json" } }
  );
  const adminRows: Array<{ email: string }> = adminCheck.ok ? await adminCheck.json() : [];
  if (!Array.isArray(adminRows) || adminRows.length === 0) return json({ error: "Admin access required." }, 403);

  let payload: { subject: string; html: string; recipients?: string[]; newsletter_id?: string };
  try { payload = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!payload.subject || !payload.html) return json({ error: "subject and html are required." }, 400);

  // Build recipient list — filter opted-out members
  let emailList: string[] = [];
  if (Array.isArray(payload.recipients) && payload.recipients.length > 0) {
    emailList = payload.recipients.filter((e) => typeof e === "string" && e.includes("@"));
  } else {
    const membersRes = await fetch(
      `${supabaseUrl}/rest/v1/members?status=eq.active&select=email&email=not.is.null`,
      { headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey } }
    );
    if (!membersRes.ok) return json({ error: "Failed to fetch members." }, 502);
    const members: Array<{ email: string }> = await membersRes.json();
    emailList = members.map((m) => m.email).filter((e) => e && e.includes("@"));
  }

  // Remove opted-out emails
  if (emailList.length > 0) {
    const optedOutRes = await fetch(
      `${supabaseUrl}/rest/v1/members?email_opt_out=eq.true&select=email`,
      { headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey } }
    );
    if (optedOutRes.ok) {
      const optedOut: Array<{ email: string }> = await optedOutRes.json();
      const optedOutSet = new Set(optedOut.map((m) => m.email?.toLowerCase()));
      emailList = emailList.filter((e) => !optedOutSet.has(e.toLowerCase()));
    }
  }

  if (!emailList.length) return json({ error: "No recipients found." }, 404);

  // Create a send batch record
  const batchId = crypto.randomUUID();
  const now = new Date().toISOString();
  await fetch(`${supabaseUrl}/rest/v1/newsletter_send_log`, {
    method: "POST",
    headers: {
      apikey: serviceKey, Authorization: "Bearer " + serviceKey,
      "Content-Type": "application/json", Prefer: "return=minimal",
    },
    body: JSON.stringify(emailList.map((email) => ({
      batch_id: batchId,
      newsletter_id: payload.newsletter_id ?? null,
      subject: payload.subject,
      sent_by: userEmail,
      recipient_email: email,
      status: "pending",
      sent_at: now,
    }))),
  });

  const from = `${fromName} <${fromEmail}>`;
  let sent = 0; let failed = 0;

  // Inject unsubscribe footer into HTML
  function addUnsub(html: string, email: string): string {
    const token = btoa(email);
    const unsubUrl = `${siteUrl}/unsubscribe.html?t=${encodeURIComponent(token)}`;
    const footer = `<div style="text-align:center;padding:16px;font-size:11px;color:#999;">
      You're receiving this because you're a member of Xi Tau Lambda Chapter.<br>
      <a href="${unsubUrl}" style="color:#999;">Unsubscribe</a>
    </div>`;
    return html.replace(/<\/body>/i, footer + "</body>");
  }

  // Send one at a time to capture individual Resend IDs
  for (const email of emailList) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [email],
          subject: payload.subject,
          html: addUnsub(payload.html, email),
        }),
      });
      const data: { id?: string } = await res.json().catch(() => ({}));
      const resendId = data.id ?? null;
      const status = res.ok ? "sent" : "failed";
      if (res.ok) sent++; else failed++;

      // Update log with Resend ID and status
      await fetch(
        `${supabaseUrl}/rest/v1/newsletter_send_log?batch_id=eq.${batchId}&recipient_email=eq.${encodeURIComponent(email)}`,
        {
          method: "PATCH",
          headers: {
            apikey: serviceKey, Authorization: "Bearer " + serviceKey,
            "Content-Type": "application/json", Prefer: "return=minimal",
          },
          body: JSON.stringify({ resend_id: resendId, status, status_updated_at: new Date().toISOString() }),
        }
      );
    } catch (err) {
      console.error("Send error for", email, err);
      failed++;
    }
  }

  return json({ sent, failed, total: emailList.length, batch_id: batchId });
});
