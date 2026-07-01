import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type NotificationType = "announcement" | "member_request" | "visitor_request";

interface Payload {
  type: NotificationType;
  name?: string;
  email?: string;
  title?: string;
  category?: string;
  message?: string;
  chapter?: string;
}

function buildEmail(payload: Payload): { subject: string; html: string } {
  const dashboardUrl = "https://northdallasalphas.com/admin-dashboard.html";
  const gold = "#c9a84c";

  const configs: Record<NotificationType, { subject: string; icon: string; heading: string; body: string; action: string }> = {
    announcement: {
      subject: `New Announcement Submitted — ${esc(payload.title ?? "Untitled")}`,
      icon: "📣",
      heading: "New Announcement Submitted",
      body: `<strong style="color:#fff;">${esc(payload.name ?? "A brother")}</strong> submitted an announcement for review.
             <br><br>
             <strong style="color:${gold};">Title:</strong> ${esc(payload.title ?? "")}<br>
             <strong style="color:${gold};">Category:</strong> ${esc(payload.category ?? "General")}`,
      action: "Review Announcement",
    },
    member_request: {
      subject: `New Member Portal Request — ${esc(payload.name ?? payload.email ?? "Unknown")}`,
      icon: "🙋",
      heading: "New Member Portal Request",
      body: `<strong style="color:#fff;">${esc(payload.name ?? "Someone")}</strong> has requested access to the member portal.
             <br><br>
             <strong style="color:${gold};">Email:</strong> ${esc(payload.email ?? "—")}`,
      action: "Review Request",
    },
    visitor_request: {
      subject: `New Visiting Brother Request — ${esc(payload.name ?? payload.email ?? "Unknown")}`,
      icon: "🤝",
      heading: "New Visiting Brother Request",
      body: `<strong style="color:#fff;">${esc(payload.name ?? "A visiting brother")}</strong> has submitted a request for visiting brother access.
             <br><br>
             <strong style="color:${gold};">Email:</strong> ${esc(payload.email ?? "—")}
             ${payload.chapter ? `<br><strong style="color:${gold};">Chapter:</strong> ${esc(payload.chapter)}` : ""}`,
      action: "Review Request",
    },
  };

  const cfg = configs[payload.type] ?? configs.announcement;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="background:#111;border:1px solid #2a2a2a;border-radius:10px 10px 0 0;padding:24px 28px;border-bottom:none;text-align:center;">
          <div style="font-size:28px;margin-bottom:8px;">${cfg.icon}</div>
          <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${gold};margin-bottom:6px;">North Dallas Alphas — Admin Alert</div>
          <div style="font-size:18px;font-weight:800;color:#fff;">${cfg.heading}</div>
        </td></tr>
        <tr><td style="background:#161616;border:1px solid #2a2a2a;border-top:none;border-radius:0 0 10px 10px;padding:24px 28px;">
          <p style="margin:0 0 20px;font-size:14px;color:#d4d4d4;line-height:1.7;">${cfg.body}</p>
          <div style="text-align:center;margin-top:24px;">
            <a href="${dashboardUrl}" style="display:inline-block;background:${gold};color:#000;font-weight:800;font-size:14px;padding:12px 28px;border-radius:7px;text-decoration:none;">${cfg.action} →</a>
          </div>
          <p style="margin:24px 0 0;font-size:11px;color:#555;text-align:center;">
            Alpha Phi Alpha Fraternity, Inc. &mdash; Xi Tau Lambda Chapter
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject: cfg.subject, html };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const resendKey  = Deno.env.get("RESEND_API_KEY");
  const fromEmail  = Deno.env.get("RESEND_FROM_EMAIL") ?? "northdallasalphas@gmail.com";
  const fromName   = Deno.env.get("RESEND_FROM_NAME")  ?? "North Dallas Alphas";
  const adminEmail = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "northdallasalphas@gmail.com";

  if (!resendKey) return json({ error: "Email not configured." }, 503);

  let payload: Payload;
  try { payload = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!payload.type) return json({ error: "type is required" }, 400);

  const { subject, html } = buildEmail(payload);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + resendKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [adminEmail],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    console.error("Resend error:", err);
    return json({ error: "Email delivery failed." }, 502);
  }

  return json({ sent: true });
});
