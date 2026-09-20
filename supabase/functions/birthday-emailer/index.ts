import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SITE_URL = "https://www.northdallasalphas.com";
const LOGO_URL = `${SITE_URL}/images/xtl-logo.png`;

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function emailHtml(
  type: "birthday" | "alphaversary",
  firstName: string,
  lastName: string,
  photoUrl: string | null,
  years?: number,
): string {
  const imageBlock = photoUrl
    ? `<img src="${esc(photoUrl)}" alt="${esc(firstName)} ${esc(lastName)}" width="88" height="88"
        style="width:88px;height:88px;border-radius:50%;border:3px solid #C9A84C;object-fit:cover;display:block;margin:0 auto 16px;" />`
    : `<img src="${LOGO_URL}" alt="Xi Tau Lambda" width="72" height="72"
        style="width:72px;height:72px;border-radius:50%;border:3px solid #C9A84C;object-fit:contain;display:block;margin:0 auto 16px;background:rgba(201,168,76,0.08);padding:8px;" />`;

  const footer = `
    <tr><td style="text-align:center;padding-top:20px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:rgba(255,255,255,0.22);line-height:1.6;">
      Xi Tau Lambda Chapter 607 · Alpha Phi Alpha Fraternity, Inc.<br>
      North Dallas, Texas · <a href="${SITE_URL}" style="color:rgba(255,255,255,0.35);">northdallasalphas.com</a>
    </td></tr>`;

  const shell = (topContent: string, bodyContent: string) => `
<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="background:#111;border:1px solid #2a2a2a;border-radius:10px 10px 0 0;padding:32px 28px 24px;text-align:center;border-bottom:none;">
          ${topContent}
        </td></tr>
        <tr><td style="background:#111;border:1px solid #2a2a2a;border-top:none;border-radius:0 0 10px 10px;padding:28px;">
          ${bodyContent}
          <div style="text-align:center;margin-top:24px;">
            <a href="${SITE_URL}/member-portal.html"
              style="display:inline-block;background:#C9A84C;color:#0a0a0a;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;text-decoration:none;padding:13px 28px;border-radius:6px;">
              Visit the Member Portal
            </a>
          </div>
        </td></tr>
        ${footer}
      </table>
    </td></tr>
  </table>
</body></html>`;

  if (type === "birthday") {
    return shell(
      `${imageBlock}
      <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#C9A84C;margin-bottom:12px;font-family:Arial,sans-serif;">Xi Tau Lambda · Chapter 607</div>
      <div style="font-family:Georgia,serif;font-size:1.55rem;font-weight:800;color:#ffffff;line-height:1.25;">Happy Birthday,<br>Brother ${esc(firstName)}!</div>`,
      `<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.72);margin:0 0 14px;">
        On behalf of the brothers of <strong style="color:#C9A84C;">Xi Tau Lambda Chapter</strong> of Alpha Phi Alpha Fraternity, Inc., we want to wish you a blessed and joyful birthday.
      </p>
      <div style="height:1px;background:#2a2a2a;margin:20px 0;"></div>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.72);margin:0 0 14px;">
        Your brotherhood, dedication, and service to this chapter and our community reflect the very best of Alpha. Today we celebrate you.
      </p>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:rgba(255,255,255,0.4);font-style:italic;margin:0;">
        "First of All, Servants of All, We Shall Transcend All."
      </p>`,
    );
  }

  // Alphaversary
  const yearsLabel = years ? `${ordinal(years)} Alphaversary` : "Alphaversary";
  const yearsBadge = years
    ? `<div style="display:inline-block;background:rgba(201,168,76,0.12);border:1px solid rgba(201,168,76,0.3);color:#C9A84C;font-family:Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.06em;padding:5px 14px;border-radius:20px;margin-top:10px;">${years} Years of Brotherhood</div>`
    : "";
  const yearsBody = years ? `${ordinal(years)} ` : "";

  return shell(
    `${imageBlock}
    <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#C9A84C;margin-bottom:12px;font-family:Arial,sans-serif;">Xi Tau Lambda · Chapter 607</div>
    <div style="font-family:Georgia,serif;font-size:1.55rem;font-weight:800;color:#ffffff;line-height:1.25;">Happy ${esc(yearsLabel)},<br>Brother ${esc(firstName)}!</div>
    ${yearsBadge}`,
    `<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.72);margin:0 0 14px;">
      On behalf of the brothers of <strong style="color:#C9A84C;">Xi Tau Lambda Chapter</strong> of Alpha Phi Alpha Fraternity, Inc., we honor the day you crossed the burning sands and joined our brotherhood.
    </p>
    <div style="height:1px;background:#2a2a2a;margin:20px 0;"></div>
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.72);margin:0 0 14px;">
      Your ${yearsBody}years of service, sacrifice, and brotherhood is a blessing to us all. We are proud to call you our brother.
    </p>
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:rgba(255,255,255,0.4);font-style:italic;margin:0;">
      "First of All, Servants of All, We Shall Transcend All."
    </p>`,
  );
}

function parseMonthDay(val: string | null): { month: number; day: number; year?: number } | null {
  if (!val) return null;
  const iso = String(val).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { year: parseInt(iso[1]), month: parseInt(iso[2]), day: parseInt(iso[3]) };
  const us = String(val).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return { month: parseInt(us[1]), day: parseInt(us[2]), year: parseInt(us[3]) };
  const short = String(val).match(/^(\d{1,2})-(\d{1,2})$/);
  if (short) return { month: parseInt(short[1]), day: parseInt(short[2]) };
  return null;
}

serve(async (_req) => {
  const supabaseUrl  = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendKey    = Deno.env.get("RESEND_API_KEY") ?? "";
  const fromEmail    = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@northdallasalphas.com";
  const fromName     = Deno.env.get("RESEND_FROM_NAME") ?? "Xi Tau Lambda Chapter";

  if (!supabaseUrl || !serviceKey || !resendKey) {
    return new Response("Server misconfiguration", { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // Today in Central Time (CDT = UTC-5)
  const now = new Date();
  const ctNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const todayMonth = ctNow.getUTCMonth() + 1;
  const todayDay   = ctNow.getUTCDate();
  const todayYear  = ctNow.getUTCFullYear();

  const { data: members, error } = await admin
    .from("members")
    .select("id,first_name,last_name,email,birthday,initiation_date,profile_photo")
    .not("email", "is", null);

  if (error || !members) {
    console.error("Members query:", error);
    return new Response("DB error", { status: 500 });
  }

  let sent = 0;
  const failures: string[] = [];

  async function send(to: string, subject: string, html: string) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [to], subject, html }),
    });
    if (r.ok) { sent++; console.log("Sent:", subject, "→", to); }
    else { const t = await r.text(); failures.push(`${to}: ${t}`); console.error("Send failed:", t); }
  }

  for (const m of members) {
    if (!m.email || !m.first_name) continue;
    const photo = m.profile_photo || null;

    const bday = parseMonthDay(m.birthday);
    if (bday && bday.month === todayMonth && bday.day === todayDay) {
      await send(
        m.email,
        `Happy Birthday, Brother ${m.first_name}! 🎂`,
        emailHtml("birthday", m.first_name, m.last_name || "", photo),
      );
    }

    const alpha = parseMonthDay(m.initiation_date);
    if (alpha && alpha.month === todayMonth && alpha.day === todayDay) {
      const years = alpha.year ? todayYear - alpha.year : undefined;
      await send(
        m.email,
        `Happy Alphaversary, Brother ${m.first_name}! ⚔️`,
        emailHtml("alphaversary", m.first_name, m.last_name || "", photo, years),
      );
    }
  }

  return new Response(JSON.stringify({ sent, failures }), {
    headers: { "Content-Type": "application/json" },
  });
});
