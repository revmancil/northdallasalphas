import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Map Resend event types to our status values
const EVENT_STATUS: Record<string, string> = {
  "email.sent":      "sent",
  "email.delivered": "delivered",
  "email.bounced":   "bounced",
  "email.complained":"complained",
  "email.failed":    "failed",
};

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")             ?? "";
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET")  ?? "";

  // Verify Resend webhook signature if secret is configured
  if (webhookSecret) {
    const svixId        = req.headers.get("svix-id")        ?? "";
    const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
    const svixSignature = req.headers.get("svix-signature") ?? "";
    if (!svixId || !svixTimestamp || !svixSignature) {
      return json({ error: "Missing webhook signature headers." }, 400);
    }
    // Signature verification: svix-id.svix-timestamp.body signed with HMAC-SHA256
    const body = await req.text();
    const toSign = `${svixId}.${svixTimestamp}.${body}`;
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(webhookSecret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    // svix-signature may be "v1,<base64>" — strip prefix
    const sigB64 = svixSignature.replace(/^v1,/, "");
    const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(toSign));
    if (!valid) return json({ error: "Invalid webhook signature." }, 401);

    // Parse already-read body
    let event: { type: string; data: { email_id: string; to?: string[] } };
    try { event = JSON.parse(body); } catch { return json({ error: "Invalid JSON" }, 400); }
    return handleEvent(event, supabaseUrl, serviceKey);
  }

  // No secret configured — parse body directly
  let event: { type: string; data: { email_id: string; to?: string[] } };
  try { event = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  return handleEvent(event, supabaseUrl, serviceKey);
});

async function handleEvent(
  event: { type: string; data: { email_id: string; to?: string[] } },
  supabaseUrl: string,
  serviceKey: string
): Promise<Response> {
  const status = EVENT_STATUS[event.type];
  if (!status) return json({ ok: true, ignored: true }); // unrecognised event

  const resendId = event.data?.email_id;
  if (!resendId) return json({ error: "No email_id in payload." }, 400);

  const patch = await fetch(
    `${supabaseUrl}/rest/v1/newsletter_send_log?resend_id=eq.${encodeURIComponent(resendId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceKey, Authorization: "Bearer " + serviceKey,
        "Content-Type": "application/json", Prefer: "return=minimal",
      },
      body: JSON.stringify({ status, status_updated_at: new Date().toISOString() }),
    }
  );

  if (!patch.ok) {
    const msg = await patch.text();
    console.error("Failed to update send log:", msg);
    return json({ error: "DB update failed." }, 502);
  }

  // If bounced or complained, flag the member
  if (status === "bounced" || status === "complained") {
    const email = event.data?.to?.[0];
    if (email) {
      await fetch(
        `${supabaseUrl}/rest/v1/members?email=eq.${encodeURIComponent(email)}`,
        {
          method: "PATCH",
          headers: {
            apikey: serviceKey, Authorization: "Bearer " + serviceKey,
            "Content-Type": "application/json", Prefer: "return=minimal",
          },
          body: JSON.stringify({ email_opt_out: true }),
        }
      );
    }
  }

  return json({ ok: true, status });
}
