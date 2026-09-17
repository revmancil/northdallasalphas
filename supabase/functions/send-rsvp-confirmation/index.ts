import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://northdallasalphas.com",
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

interface Payload {
  member_name: string;
  member_email: string;
  meeting_title: string;
  meeting_date?: string;
  meeting_time?: string;
  meeting_location?: string;
  meeting_date_raw?: string;       // YYYY-MM-DD
  meeting_start_time_raw?: string; // HH:MM or HH:MM:SS
  meeting_end_time_raw?: string;   // HH:MM or HH:MM:SS (optional)
  response: "yes" | "maybe" | "no";
}

function addHours(timeStr: string, hours: number): string {
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || "0", 10);
  const newH = (h + hours) % 24;
  return `${String(newH).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function toCalDt(dateRaw: string, timeRaw: string): string {
  const d = dateRaw.replace(/-/g, "");
  const t = timeRaw.replace(/:/g, "").substring(0, 6).padEnd(6, "0");
  return `${d}T${t}`;
}

interface CalLinks {
  google: string;
  outlook: string;
  icsData: string; // base64 ICS content for data URI
}

function buildCalendarLinks(p: Payload): CalLinks | null {
  if (!p.meeting_date_raw) return null;

  const startTime = p.meeting_start_time_raw || "12:00:00";
  const endTime   = p.meeting_end_time_raw   || addHours(startTime, 2);

  const startDt = toCalDt(p.meeting_date_raw, startTime);
  const endDt   = toCalDt(p.meeting_date_raw, endTime);

  const startIso = `${p.meeting_date_raw}T${startTime.substring(0, 8).padEnd(8, ":00")}`;
  const endIso   = `${p.meeting_date_raw}T${endTime.substring(0, 8).padEnd(8, ":00")}`;

  const title    = encodeURIComponent(p.meeting_title);
  const location = encodeURIComponent(p.meeting_location || "");
  const details  = encodeURIComponent(
    `North Dallas Alphas — Xi Tau Lambda Chapter\nYour RSVP: ${
      p.response === "yes" ? "Attending" : p.response === "maybe" ? "Maybe" : "Not Attending"
    }`
  );

  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDt}/${endDt}&details=${details}&location=${location}`;

  const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${encodeURIComponent(startIso)}&enddt=${encodeURIComponent(endIso)}&body=${details}&location=${location}`;

  const uid = `${p.meeting_date_raw}-${Math.random().toString(36).slice(2)}@northdallasalphas.com`;
  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//North Dallas Alphas//RSVP//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `DTSTART:${startDt}`,
    `DTEND:${endDt}`,
    `SUMMARY:${p.meeting_title}`,
    `LOCATION:${p.meeting_location || ""}`,
    `DESCRIPTION:North Dallas Alphas - Xi Tau Lambda Chapter`,
    `UID:${uid}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const icsData = btoa(unescape(encodeURIComponent(icsLines)));

  return { google, outlook, icsData };
}

function buildMemberEmail(p: Payload): { subject: string; html: string } {
  const gold = "#c9a84c";
  const responseLabels: Record<string, { label: string; icon: string; color: string }> = {
    yes:   { label: "Attending",     icon: "✅", color: "#27ae60" },
    maybe: { label: "Maybe",         icon: "🤔", color: "#f39c12" },
    no:    { label: "Not Attending", icon: "❌", color: "#e74c3c" },
  };
  const res = responseLabels[p.response] ?? responseLabels.yes;
  const firstName = p.member_name.split(" ")[0] || "Brother";

  const detailRows = [
    p.meeting_date     ? `<tr><td style="padding:6px 0 6px 0;color:#aaa;font-size:13px;white-space:nowrap;padding-right:20px;">Date</td><td style="padding:6px 0;color:#fff;font-size:13px;">${esc(p.meeting_date)}</td></tr>` : "",
    p.meeting_time     ? `<tr><td style="padding:6px 0 6px 0;color:#aaa;font-size:13px;white-space:nowrap;padding-right:20px;">Time</td><td style="padding:6px 0;color:#fff;font-size:13px;">${esc(p.meeting_time)}</td></tr>` : "",
    p.meeting_location ? `<tr><td style="padding:6px 0 6px 0;color:#aaa;font-size:13px;white-space:nowrap;padding-right:20px;">Location</td><td style="padding:6px 0;color:#fff;font-size:13px;">${esc(p.meeting_location)}</td></tr>` : "",
  ].join("");

  // Calendar links
  const cal = buildCalendarLinks(p);
  const calSection = cal ? `
    <div style="margin-top:24px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#888;margin-bottom:10px;">Add to Your Calendar</div>
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:8px;">
          <a href="${cal.google}" target="_blank" style="display:inline-block;background:#1e1e1e;border:1px solid #333;border-radius:6px;padding:8px 14px;font-size:12px;font-weight:700;color:#fff;text-decoration:none;">📅 Google Calendar</a>
        </td>
        <td style="padding-right:8px;">
          <a href="${cal.outlook}" target="_blank" style="display:inline-block;background:#1e1e1e;border:1px solid #333;border-radius:6px;padding:8px 14px;font-size:12px;font-weight:700;color:#fff;text-decoration:none;">📅 Outlook</a>
        </td>
        <td>
          <a href="data:text/calendar;charset=utf8;base64,${cal.icsData}" download="${esc(p.meeting_title).replace(/\s+/g, "_")}.ics" style="display:inline-block;background:#1e1e1e;border:1px solid #333;border-radius:6px;padding:8px 14px;font-size:12px;font-weight:700;color:#fff;text-decoration:none;">📅 iCalendar (.ics)</a>
        </td>
      </tr></table>
    </div>` : "";

  const subject = `RSVP Confirmed — ${p.meeting_title}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="background:#111;border:1px solid #2a2a2a;border-radius:10px 10px 0 0;padding:24px 28px;border-bottom:none;text-align:center;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${gold};margin-bottom:6px;">North Dallas Alphas — Xi Tau Lambda Chapter</div>
          <div style="font-size:18px;font-weight:800;color:#fff;">Meeting RSVP Confirmed</div>
        </td></tr>
        <tr><td style="background:#161616;border:1px solid #2a2a2a;border-top:none;border-radius:0 0 10px 10px;padding:24px 28px;">
          <p style="margin:0 0 16px;font-size:14px;color:#d4d4d4;line-height:1.7;">
            Brother ${esc(firstName)}, your RSVP for <strong style="color:#fff;">${esc(p.meeting_title)}</strong> has been recorded.
          </p>

          <div style="background:#1e1e1e;border:1px solid #2a2a2a;border-radius:8px;padding:16px 20px;margin-bottom:0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              ${detailRows}
              <tr>
                <td style="padding:6px 0 6px 0;color:#aaa;font-size:13px;white-space:nowrap;padding-right:20px;">Response</td>
                <td style="padding:6px 0;font-size:13px;">
                  <span style="color:${res.color};font-weight:700;">${res.icon} ${res.label}</span>
                </td>
              </tr>
            </table>
          </div>

          ${calSection}

          <p style="margin:20px 0 20px;font-size:13px;color:#888;line-height:1.6;">
            If your plans change, you can update your RSVP anytime from the member portal.
          </p>
          <div style="text-align:center;">
            <a href="https://northdallasalphas.com/member-portal.html" style="display:inline-block;background:${gold};color:#000;font-weight:800;font-size:14px;padding:12px 28px;border-radius:7px;text-decoration:none;">Go to Member Portal →</a>
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

  return { subject, html };
}

function buildAdminEmail(p: Payload): { subject: string; html: string } {
  const gold = "#c9a84c";
  const responseLabels: Record<string, { label: string; color: string }> = {
    yes:   { label: "Attending",     color: "#27ae60" },
    maybe: { label: "Maybe",         color: "#f39c12" },
    no:    { label: "Not Attending", color: "#e74c3c" },
  };
  const res = responseLabels[p.response] ?? responseLabels.yes;

  const subject = `Meeting RSVP — ${esc(p.member_name)} — ${esc(p.meeting_title)}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="background:#111;border:1px solid #2a2a2a;border-radius:10px 10px 0 0;padding:24px 28px;border-bottom:none;text-align:center;">
          <div style="font-size:28px;margin-bottom:8px;">📋</div>
          <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${gold};margin-bottom:6px;">North Dallas Alphas — Admin Alert</div>
          <div style="font-size:18px;font-weight:800;color:#fff;">New Meeting RSVP</div>
        </td></tr>
        <tr><td style="background:#161616;border:1px solid #2a2a2a;border-top:none;border-radius:0 0 10px 10px;padding:24px 28px;">
          <p style="margin:0 0 20px;font-size:14px;color:#d4d4d4;line-height:1.7;">
            <strong style="color:#fff;">${esc(p.member_name)}</strong> has submitted an RSVP for <strong style="color:#fff;">${esc(p.meeting_title)}</strong>.<br><br>
            <strong style="color:${gold};">Response:</strong> <span style="color:${res.color};font-weight:700;">${res.label}</span>
            ${p.member_email ? `<br><strong style="color:${gold};">Email:</strong> ${esc(p.member_email)}` : ""}
          </p>
          <div style="text-align:center;margin-top:24px;">
            <a href="https://northdallasalphas.com/admin-dashboard.html" style="display:inline-block;background:${gold};color:#000;font-weight:800;font-size:14px;padding:12px 28px;border-radius:7px;text-decoration:none;">View in Dashboard →</a>
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

  return { subject, html };
}

async function sendEmail(resendKey: string, from: string, to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + resendKey, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    console.error("Resend error:", err);
  }
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

  if (!payload.member_email || !payload.member_name || !payload.meeting_title || !payload.response) {
    return json({ error: "Missing required fields." }, 400);
  }

  const from = `${fromName} <${fromEmail}>`;

  const { subject: memberSubject, html: memberHtml } = buildMemberEmail(payload);
  const { subject: adminSubject,  html: adminHtml  } = buildAdminEmail(payload);

  await Promise.allSettled([
    sendEmail(resendKey, from, payload.member_email, memberSubject, memberHtml),
    sendEmail(resendKey, from, adminEmail, adminSubject, adminHtml),
  ]);

  return json({ sent: true });
});
