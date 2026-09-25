import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

// ── Which sections qualify an admin for each notification group ──────────────
const ROLE_SECTIONS: Record<string, string[]> = {
  communications: ["member-announcements", "chapter-news", "newsletters", "meetings"],
  finance:        ["requisitions", "reimbursements", "finance", "dues"],
  membership:     ["members"],
};

// Returns deduplicated list of admin emails matching a role group.
// Full admins always qualify.
async function getAdminEmails(supabaseUrl: string, serviceKey: string, group: string): Promise<string[]> {
  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin
    .from("chapter_admins")
    .select("email, is_full_admin, sections");

  if (error || !data) {
    console.error("chapter_admins query error:", error);
    return [];
  }

  const qualifying = ROLE_SECTIONS[group] ?? [];
  const emails: string[] = [];
  for (const row of data) {
    if (!row.email) continue;
    if (row.is_full_admin) { emails.push(row.email); continue; }
    const sections: string[] = Array.isArray(row.sections) ? row.sections : [];
    if (qualifying.some((s) => sections.includes(s))) {
      emails.push(row.email);
    }
  }
  return [...new Set(emails)];
}

async function sendEmail(resendKey: string, from: string, to: string[], subject: string, html: string): Promise<boolean> {
  if (!to.length) return true;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + resendKey, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    console.error("Resend error:", await res.text().catch(() => "unknown"));
    return false;
  }
  return true;
}

// ── Email builders ────────────────────────────────────────────────────────────

const gold = "#c9a84c";
const dashboardUrl = "https://northdallasalphas.com/admin-dashboard.html";

function emailShell(icon: string, heading: string, eyebrow: string, body: string, actionLabel: string, actionUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="background:#111;border:1px solid #2a2a2a;border-radius:10px 10px 0 0;padding:24px 28px;border-bottom:none;text-align:center;">
          <div style="font-size:28px;margin-bottom:8px;">${icon}</div>
          <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${gold};margin-bottom:6px;">${esc(eyebrow)}</div>
          <div style="font-size:18px;font-weight:800;color:#fff;">${esc(heading)}</div>
        </td></tr>
        <tr><td style="background:#161616;border:1px solid #2a2a2a;border-top:none;border-radius:0 0 10px 10px;padding:24px 28px;">
          <p style="margin:0 0 20px;font-size:14px;color:#d4d4d4;line-height:1.7;">${body}</p>
          <div style="text-align:center;margin-top:24px;">
            <a href="${esc(actionUrl)}" style="display:inline-block;background:${gold};color:#000;font-weight:800;font-size:14px;padding:12px 28px;border-radius:7px;text-decoration:none;">${esc(actionLabel)} →</a>
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
}

// Admin alert: new announcement submitted
function buildAnnouncementAlert(name: string, title: string, category: string) {
  return {
    subject: `New Announcement Submitted — ${title}`,
    html: emailShell(
      "📣",
      "New Announcement Submitted",
      "North Dallas Alphas — Communications Alert",
      `<strong style="color:#fff;">${esc(name)}</strong> submitted an announcement for review.<br><br>
       <strong style="color:${gold};">Title:</strong> ${esc(title)}<br>
       <strong style="color:${gold};">Category:</strong> ${esc(category)}`,
      "Review Announcement",
      dashboardUrl + "#member-announcements",
    ),
  };
}

// Admin alert: new requisition
function buildRequisitionAlert(name: string, amount: string, description: string) {
  return {
    subject: `New Requisition Request — ${name}`,
    html: emailShell(
      "📄",
      "New Requisition Request",
      "North Dallas Alphas — Finance Alert",
      `<strong style="color:#fff;">${esc(name)}</strong> submitted a requisition request.<br><br>
       <strong style="color:${gold};">Amount:</strong> ${esc(amount)}<br>
       <strong style="color:${gold};">Description:</strong> ${esc(description)}`,
      "Review Requisition",
      dashboardUrl + "#requisitions",
    ),
  };
}

// Admin alert: new reimbursement
function buildReimbursementAlert(name: string, amount: string, description: string) {
  return {
    subject: `New Reimbursement Request — ${name}`,
    html: emailShell(
      "🧾",
      "New Reimbursement Request",
      "North Dallas Alphas — Finance Alert",
      `<strong style="color:#fff;">${esc(name)}</strong> submitted a reimbursement request.<br><br>
       <strong style="color:${gold};">Amount:</strong> ${esc(amount)}<br>
       <strong style="color:${gold};">Description:</strong> ${esc(description)}`,
      "Review Reimbursement",
      dashboardUrl + "#reimbursements",
    ),
  };
}

// Member alert: announcement status changed
function buildAnnouncementStatus(name: string, title: string, status: string, note: string) {
  const approved = status === "approved";
  const icon = approved ? "✅" : "❌";
  const heading = approved ? "Announcement Approved" : "Announcement Not Approved";
  const bodyText = approved
    ? `Your announcement <strong style="color:#fff;">${esc(title)}</strong> has been <strong style="color:#4ade80;">approved</strong> by chapter leadership and will be shared with the brotherhood.`
    : `Your announcement <strong style="color:#fff;">${esc(title)}</strong> was <strong style="color:#f87171;">not approved</strong> at this time.`;
  const noteHtml = note ? `<br><br><strong style="color:${gold};">Note from leadership:</strong> ${esc(note)}` : "";
  return {
    subject: approved ? `Your Announcement Was Approved — ${title}` : `Announcement Update — ${title}`,
    html: emailShell(
      icon,
      heading,
      "North Dallas Alphas — Member Portal",
      bodyText + noteHtml,
      "View Member Portal",
      "https://northdallasalphas.com/member-portal.html",
    ),
  };
}

// Admin alert: new committee report submitted
function buildCommitteeReportAlert(name: string, committee: string, title: string) {
  return {
    subject: `New Committee Report — ${committee}`,
    html: emailShell(
      "📋",
      "Committee Report Submitted",
      "North Dallas Alphas — Communications Alert",
      `<strong style="color:#fff;">${esc(name)}</strong> submitted a committee report for review.<br><br>
       <strong style="color:${gold};">Committee:</strong> ${esc(committee)}<br>
       <strong style="color:${gold};">Document:</strong> ${esc(title)}`,
      "Review in Dashboard",
      dashboardUrl + "#meetings",
    ),
  };
}

// Admin alert: new news article submitted
function buildNewsArticleAlert(name: string, title: string, tag: string) {
  return {
    subject: `New News Article Submitted — ${title}`,
    html: emailShell(
      "📰",
      "News Article Submitted for Review",
      "North Dallas Alphas — Communications Alert",
      `<strong style="color:#fff;">${esc(name)}</strong> submitted a news article for review.<br><br>
       <strong style="color:${gold};">Headline:</strong> ${esc(title)}<br>
       <strong style="color:${gold};">Tag:</strong> ${esc(tag)}`,
      "Review Article",
      dashboardUrl + "#news-submissions",
    ),
  };
}

// Finance alert: chapter store order paid
function buildStorePurchaseAlert(name: string, email: string, amount: string, orderId: string) {
  return {
    subject: `Chapter Store Purchase — ${name}`,
    html: emailShell(
      "🛍",
      "Chapter Store Purchase Received",
      "North Dallas Alphas — Finance Alert",
      `<strong style="color:#fff;">${esc(name)}</strong> completed a chapter store purchase.<br><br>
       <strong style="color:${gold};">Amount Paid:</strong> ${esc(amount)}<br>
       <strong style="color:${gold};">Email:</strong> ${esc(email)}<br>
       <strong style="color:${gold};">Order ID:</strong> ${esc(orderId)}`,
      "View Orders",
      dashboardUrl + "#store",
    ),
  };
}

// Finance alert: dues payment received
function buildDuesPaymentAlert(name: string, email: string, amount: string, category: string, fiscalYear: string, lateFee: boolean) {
  return {
    subject: `Dues Payment Received — ${name}`,
    html: emailShell(
      "💳",
      "Chapter Dues Payment Received",
      "North Dallas Alphas — Finance Alert",
      `<strong style="color:#fff;">${esc(name)}</strong> paid chapter dues.<br><br>
       <strong style="color:${gold};">Category:</strong> ${esc(category)}<br>
       <strong style="color:${gold};">Fiscal Year:</strong> ${esc(fiscalYear)}<br>
       <strong style="color:${gold};">Amount Paid:</strong> ${esc(amount)}<br>
       <strong style="color:${gold};">Email:</strong> ${esc(email)}` +
      (lateFee ? `<br><strong style="color:${gold};">Late Fee:</strong> Included` : ""),
      "View Finance Records",
      dashboardUrl + "#finance-payments",
    ),
  };
}

// Fallback for visitor / member request types (existing behaviour)
function buildGenericAlert(type: string, name: string, email: string, chapter: string) {
  const isVisitor = type === "visitor_request";
  return {
    subject: isVisitor ? `New Visiting Brother Request — ${name || email}` : `New Member Portal Request — ${name || email}`,
    html: emailShell(
      isVisitor ? "🤝" : '<img src="https://northdallasalphas.com/images/xtl-logo.png" alt="Xi Tau Lambda" style="width:48px;height:48px;object-fit:contain;" />',
      isVisitor ? "New Visiting Brother Request" : "New Member Portal Request",
      "North Dallas Alphas — Admin Alert",
      `<strong style="color:#fff;">${esc(name || "Someone")}</strong> submitted a ${isVisitor ? "visiting brother" : "member portal"} request.<br><br>
       <strong style="color:${gold};">Email:</strong> ${esc(email)}` +
      (isVisitor && chapter ? `<br><strong style="color:${gold};">Chapter:</strong> ${esc(chapter)}` : ""),
      "Review Request",
      dashboardUrl,
    ),
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const resendKey    = Deno.env.get("RESEND_API_KEY");
  const fromEmail    = Deno.env.get("RESEND_FROM_EMAIL") ?? "northdallasalphas@gmail.com";
  const fromName     = Deno.env.get("RESEND_FROM_NAME")  ?? "North Dallas Alphas";
  const fallbackEmail = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "northdallasalphas@gmail.com";
  const supabaseUrl  = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!resendKey) return json({ error: "Email not configured." }, 503);

  const from = `${fromName} <${fromEmail}>`;

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const type = String(payload.type ?? "");

  // ── Announcement status → email member ────────────────────────────────────
  if (type === "announcement_status") {
    const memberEmail = String(payload.memberEmail ?? "").trim();
    const memberName  = String(payload.memberName  ?? "A brother").trim();
    const title       = String(payload.title       ?? "Your announcement").trim();
    const status      = String(payload.status      ?? "").trim();
    const note        = String(payload.note        ?? "").trim();
    if (!memberEmail || !status) return json({ error: "memberEmail and status required" }, 400);
    const { subject, html } = buildAnnouncementStatus(memberName, title, status, note);
    const ok = await sendEmail(resendKey, from, [memberEmail], subject, html);
    return json({ sent: ok });
  }

  // ── New announcement → Communications admins ──────────────────────────────
  if (type === "announcement") {
    const name     = String(payload.name     ?? payload.memberName ?? "A brother").trim();
    const title    = String(payload.title    ?? "Untitled").trim();
    const category = String(payload.category ?? "General").trim();
    const { subject, html } = buildAnnouncementAlert(name, title, category);
    const to = supabaseUrl && serviceKey
      ? await getAdminEmails(supabaseUrl, serviceKey, "communications")
      : [fallbackEmail];
    const recipients = to.length ? to : [fallbackEmail];
    const ok = await sendEmail(resendKey, from, recipients, subject, html);
    return json({ sent: ok, recipients: recipients.length });
  }

  // ── New requisition → Finance admins ──────────────────────────────────────
  if (type === "requisition") {
    const name        = String(payload.memberName ?? payload.name ?? "A brother").trim();
    const amountRaw   = Number(payload.amount ?? 0);
    const amount      = "$" + amountRaw.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const description = String(payload.description ?? "").trim();
    const { subject, html } = buildRequisitionAlert(name, amount, description);
    const to = supabaseUrl && serviceKey
      ? await getAdminEmails(supabaseUrl, serviceKey, "finance")
      : [fallbackEmail];
    const recipients = to.length ? to : [fallbackEmail];
    const ok = await sendEmail(resendKey, from, recipients, subject, html);
    return json({ sent: ok, recipients: recipients.length });
  }

  // ── New reimbursement → Finance admins ────────────────────────────────────
  if (type === "reimbursement") {
    const name        = String(payload.memberName ?? payload.name ?? "A brother").trim();
    const amountRaw   = Number(payload.amount ?? 0);
    const amount      = "$" + amountRaw.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const description = String(payload.description ?? "").trim();
    const { subject, html } = buildReimbursementAlert(name, amount, description);
    const to = supabaseUrl && serviceKey
      ? await getAdminEmails(supabaseUrl, serviceKey, "finance")
      : [fallbackEmail];
    const recipients = to.length ? to : [fallbackEmail];
    const ok = await sendEmail(resendKey, from, recipients, subject, html);
    return json({ sent: ok, recipients: recipients.length });
  }

  // ── Committee report → Communications admins ─────────────────────────────
  if (type === "committee_report") {
    const name      = String(payload.name      ?? payload.memberName ?? "A brother").trim();
    const committee = String(payload.committee ?? "Committee").trim();
    const title     = String(payload.title     ?? "Report").trim();
    const { subject, html } = buildCommitteeReportAlert(name, committee, title);
    const to = supabaseUrl && serviceKey
      ? await getAdminEmails(supabaseUrl, serviceKey, "communications")
      : [fallbackEmail];
    const recipients = to.length ? to : [fallbackEmail];
    const ok = await sendEmail(resendKey, from, recipients, subject, html);
    return json({ sent: ok, recipients: recipients.length });
  }

  // ── News article → Communications admins ──────────────────────────────────
  if (type === "news_article") {
    const name  = String(payload.name     ?? payload.memberName ?? "A brother").trim();
    const title = String(payload.title    ?? "Untitled").trim();
    const tag   = String(payload.category ?? payload.tag ?? "General").trim();
    const { subject, html } = buildNewsArticleAlert(name, title, tag);
    const to = supabaseUrl && serviceKey
      ? await getAdminEmails(supabaseUrl, serviceKey, "communications")
      : [fallbackEmail];
    const recipients = to.length ? to : [fallbackEmail];
    const ok = await sendEmail(resendKey, from, recipients, subject, html);
    return json({ sent: ok, recipients: recipients.length });
  }

  // ── Store purchase → Finance admins ───────────────────────────────────────
  if (type === "store_purchase") {
    const name      = String(payload.memberName ?? payload.name ?? "A member").trim();
    const email     = String(payload.email      ?? "").trim();
    const amountRaw = Number(payload.amount ?? 0);
    const amount    = "$" + amountRaw.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const orderId   = String(payload.orderId    ?? "").trim();
    const { subject, html } = buildStorePurchaseAlert(name, email, amount, orderId);
    const to = supabaseUrl && serviceKey
      ? await getAdminEmails(supabaseUrl, serviceKey, "finance")
      : [fallbackEmail];
    const recipients = to.length ? to : [fallbackEmail];
    const ok = await sendEmail(resendKey, from, recipients, subject, html);
    return json({ sent: ok, recipients: recipients.length });
  }

  // ── Dues payment → Finance admins ─────────────────────────────────────────
  if (type === "dues_payment") {
    const name       = String(payload.memberName ?? payload.name ?? "A member").trim();
    const email      = String(payload.email      ?? "").trim();
    const amountRaw  = Number(payload.amount ?? 0);
    const amount     = "$" + amountRaw.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const category   = String(payload.category   ?? "Chapter Dues").trim();
    const fiscalYear = String(payload.fiscalYear  ?? "").trim();
    const lateFee    = payload.lateFee === true || payload.lateFee === "true";
    const { subject, html } = buildDuesPaymentAlert(name, email, amount, category, fiscalYear, lateFee);
    const to = supabaseUrl && serviceKey
      ? await getAdminEmails(supabaseUrl, serviceKey, "finance")
      : [fallbackEmail];
    const recipients = to.length ? to : [fallbackEmail];
    const ok = await sendEmail(resendKey, from, recipients, subject, html);
    return json({ sent: ok, recipients: recipients.length });
  }

  // ── Zelle payment notification → Finance admins ──────────────────────────
  if (type === "zelle_payment") {
    const name         = String(payload.memberName ?? payload.name ?? "A member").trim();
    const email        = String(payload.email      ?? "").trim();
    const fiscalYear   = String(payload.fiscalYear ?? "").trim();
    const confirmation = String(payload.confirmation ?? "(none provided)").trim();
    const { subject, html } = {
      subject: `Zelle Payment Submitted — ${name}`,
      html: emailShell(
        "💸",
        "Zelle Payment Submitted",
        "North Dallas Alphas — Finance Alert",
        `<strong style="color:#fff;">${esc(name)}</strong> submitted a Zelle payment notification and is awaiting confirmation.<br><br>
         <strong style="color:${gold};">Email:</strong> ${esc(email)}<br>
         <strong style="color:${gold};">Fiscal Year:</strong> ${esc(fiscalYear)}<br>
         <strong style="color:${gold};">Memo / Confirmation:</strong> ${esc(confirmation)}<br><br>
         Please verify the Zelle payment was received at <strong style="color:${gold};">treasurer@northdallasalphas.org</strong> and confirm in the admin dashboard.`,
        "Confirm Payment in Dashboard",
        dashboardUrl + "#finance-payments",
      ),
    };
    const to = supabaseUrl && serviceKey
      ? await getAdminEmails(supabaseUrl, serviceKey, "finance")
      : [fallbackEmail];
    const recipients = to.length ? to : [fallbackEmail];
    const ok = await sendEmail(resendKey, from, recipients, subject, html);
    return json({ sent: ok, recipients: recipients.length });
  }

  // ── Meeting request → Communications admins ──────────────────────────────
  if (type === "meeting_request") {
    const name      = String(payload.memberName ?? payload.name ?? "A brother").trim();
    const email     = String(payload.email      ?? "").trim();
    const title     = String(payload.title      ?? "Untitled").trim();
    const committee = String(payload.committee  ?? "").trim();
    const date      = String(payload.date       ?? "TBD").trim();
    const location  = String(payload.location   ?? "TBD").trim();
    const purpose   = String(payload.purpose    ?? "").trim();
    const { subject, html } = {
      subject: `Meeting Request — ${title}`,
      html: emailShell(
        "📅",
        "New Meeting Request",
        "North Dallas Alphas — Communications Alert",
        `<strong style="color:#fff;">${esc(name)}</strong> has submitted a meeting request for leadership review.<br><br>
         <strong style="color:${gold};">Title:</strong> ${esc(title)}<br>
         <strong style="color:${gold};">Committee:</strong> ${esc(committee)}<br>
         <strong style="color:${gold};">Proposed Date:</strong> ${esc(date)}<br>
         <strong style="color:${gold};">Location:</strong> ${esc(location)}<br>
         <strong style="color:${gold};">Email:</strong> ${esc(email)}` +
        (purpose ? `<br><br><strong style="color:${gold};">Purpose / Notes:</strong><br>${esc(purpose)}` : ""),
        "Review in Dashboard",
        dashboardUrl + "#meetings",
      ),
    };
    const to = supabaseUrl && serviceKey
      ? await getAdminEmails(supabaseUrl, serviceKey, "communications")
      : [fallbackEmail];
    const recipients = to.length ? to : [fallbackEmail];
    const ok = await sendEmail(resendKey, from, recipients, subject, html);
    return json({ sent: ok, recipients: recipients.length });
  }

  // ── Member / visitor request → Membership admins ─────────────────────────
  if (type === "member_request" || type === "visitor_request") {
    const name    = String(payload.name    ?? "").trim();
    const email   = String(payload.email   ?? "").trim();
    const chapter = String(payload.chapter ?? "").trim();
    const { subject, html } = buildGenericAlert(type, name, email, chapter);
    const to = supabaseUrl && serviceKey ? await getAdminEmails(supabaseUrl, serviceKey, "membership") : [fallbackEmail];
    const recipients = to.length ? to : [fallbackEmail];
    return json({ sent: await sendEmail(resendKey, from, recipients, subject, html), recipients: recipients.length });
  }

  return json({ error: "Unknown notification type: " + type }, 400);
});
