import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

function buildReceiptHtml(p: {
  fullName: string;
  email: string;
  fiscalYear: string;
  amountCents: number;
  paidAt: string;
  categoryLabel: string;
  lateFee: boolean;
  buildingFund: boolean;
  stripeSessionId: string;
}): string {
  const dateStr = new Date(p.paidAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
  const ref = p.stripeSessionId.slice(-8).toUpperCase();

  const rows = [
    { label: p.categoryLabel || "Chapter Dues", amount: p.amountCents },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dues Receipt</title></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- Header -->
        <tr><td style="background:#111;border:1px solid #2a2a2a;border-radius:10px 10px 0 0;padding:28px 32px;text-align:center;border-bottom:none;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#c9a84c;margin-bottom:8px;">Xi Tau Lambda Chapter 607</div>
          <div style="font-size:22px;font-weight:800;color:#ffffff;">Dues Payment Received</div>
          <div style="font-size:13px;color:#888;margin-top:6px;">${esc(dateStr)}</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#111;border:1px solid #2a2a2a;border-top:none;border-bottom:none;padding:28px 32px;">

          <div style="font-size:14px;color:#d4d4d4;margin-bottom:24px;">
            Brother ${esc(p.fullName)}, your dues payment has been received. This email serves as your receipt.
          </div>

          <!-- Line items -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #2a2a2a;border-radius:8px;overflow:hidden;margin-bottom:20px;">
            <tr style="background:#1a1a1a;">
              <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#888;">Description</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#888;">Amount</th>
            </tr>
            ${rows.map((r) => `
            <tr>
              <td style="padding:12px;border-top:1px solid #2a2a2a;color:#d4d4d4;font-size:14px;">
                ${esc(r.label)} &mdash; FY ${esc(p.fiscalYear)}
              </td>
              <td style="padding:12px;border-top:1px solid #2a2a2a;text-align:right;color:#c9a84c;font-size:14px;font-weight:700;">${fmt(r.amount)}</td>
            </tr>`).join("")}
            <tr style="background:#1a1a1a;">
              <td style="padding:12px;border-top:1px solid #2a2a2a;font-weight:700;color:#ffffff;font-size:14px;">Total Paid</td>
              <td style="padding:12px;border-top:1px solid #2a2a2a;text-align:right;font-weight:800;color:#c9a84c;font-size:16px;">${fmt(p.amountCents)}</td>
            </tr>
          </table>

          <!-- Details -->
          <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:12px;color:#888;padding:4px 0;">Fiscal Year</td>
                <td style="font-size:13px;color:#d4d4d4;text-align:right;padding:4px 0;">${esc(p.fiscalYear)}</td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#888;padding:4px 0;">Payment Method</td>
                <td style="font-size:13px;color:#d4d4d4;text-align:right;padding:4px 0;">Credit / Debit Card (Stripe)</td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#888;padding:4px 0;">Reference</td>
                <td style="font-size:13px;color:#d4d4d4;text-align:right;padding:4px 0;">${esc(ref)}</td>
              </tr>
            </table>
          </div>

          <div style="font-size:13px;color:#666;line-height:1.6;">
            If you have questions about your dues record, contact the Financial Secretary. Keep this email for your records.
          </div>

        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#0d0d0d;border:1px solid #2a2a2a;border-top:none;border-radius:0 0 10px 10px;padding:20px 32px;text-align:center;">
          <div style="font-size:11px;color:#555;">Alpha Phi Alpha Fraternity, Inc. &bull; Xi Tau Lambda Chapter 607 &bull; North Dallas</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const resendKey  = Deno.env.get("RESEND_API_KEY");
  const fromEmail  = Deno.env.get("RESEND_FROM_EMAIL") ?? "northdallasalphas@gmail.com";
  const fromName   = Deno.env.get("RESEND_FROM_NAME")  ?? "North Dallas Alphas";

  if (!resendKey) {
    console.error("RESEND_API_KEY not set");
    return new Response("Resend not configured", { status: 500 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const email           = String(payload.email           ?? "").trim();
  const fullName        = String(payload.fullName        ?? "Brother").trim();
  const fiscalYear      = String(payload.fiscalYear      ?? "");
  const amountCents     = parseInt(String(payload.amountCents ?? "0"), 10) || 0;
  const paidAt          = String(payload.paidAt          ?? new Date().toISOString());
  const categoryLabel   = String(payload.categoryLabel   ?? "Chapter Dues");
  const lateFee         = payload.lateFee  === true;
  const buildingFund    = payload.buildingFund === true;
  const stripeSessionId = String(payload.stripeSessionId ?? "");

  if (!email || !email.includes("@")) {
    return new Response("Invalid email", { status: 400 });
  }

  const html = buildReceiptHtml({
    fullName, email, fiscalYear, amountCents, paidAt,
    categoryLabel, lateFee, buildingFund, stripeSessionId,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + resendKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to:   [email],
      subject: `Dues Payment Receipt — FY ${fiscalYear}`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", err);
    return new Response("Email send failed: " + err, { status: 502 });
  }

  return new Response(JSON.stringify({ sent: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
