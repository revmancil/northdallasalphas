import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Constant-time string comparison to prevent timing attacks
function safeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still iterate to avoid length-based timing
    let result = 0;
    for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ 0;
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const PORTAL_URL = 'https://northdallasalphas.com/member-portal.html';

function emailTemplate(firstName: string, subject: string, bodyContent: string): { subject: string; html: string } {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#000;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111;border:2px solid #C9A84C;border-radius:8px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:#000;padding:28px 32px;text-align:center;border-bottom:2px solid #C9A84C;">
            <div style="font-size:11px;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;margin-bottom:6px;">Alpha Phi Alpha Fraternity, Inc.</div>
            <div style="font-size:22px;font-weight:bold;color:#C9A84C;">Xi Tau Lambda Chapter</div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 32px;color:#e5e5e5;font-size:15px;line-height:1.7;">
            <p style="margin:0 0 16px;">Dear Brother ${firstName},</p>
            ${bodyContent}
            <p style="margin:24px 0 0;">In Brotherhood,<br><strong style="color:#C9A84C;">Xi Tau Lambda Chapter</strong></p>
          </td>
        </tr>
        <!-- CTA Button -->
        <tr>
          <td style="padding:0 32px 32px;text-align:center;">
            <a href="${PORTAL_URL}" style="display:inline-block;background:#C9A84C;color:#000;font-weight:bold;font-size:15px;padding:14px 32px;border-radius:6px;text-decoration:none;letter-spacing:1px;">Access Member Portal</a>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#000;border-top:1px solid #333;padding:20px 32px;text-align:center;">
            <div style="font-size:11px;color:#666;letter-spacing:1px;">XI TAU LAMBDA CHAPTER — ALPHA PHI ALPHA FRATERNITY, INC.</div>
            <div style="font-size:11px;color:#555;margin-top:4px;">North Dallas, Texas</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject, html };
}

serve(async (req: Request) => {
  try {
    const RESEND_API_KEY        = Deno.env.get('RESEND_API_KEY') || '';
    const RESEND_FROM_EMAIL     = Deno.env.get('RESEND_FROM_EMAIL') || '';
    const RESEND_FROM_NAME      = Deno.env.get('RESEND_FROM_NAME') || 'Xi Tau Lambda Chapter';
    const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') || '';
    const SERVICE_ROLE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const DUES_NOTIFY_SECRET    = Deno.env.get('DUES_NOTIFY_SECRET') || '';

    // Auth: Bearer token (service role) or x-dues-notify-secret header
    const authHeader   = req.headers.get('Authorization') || '';
    const secretHeader = req.headers.get('x-dues-notify-secret') || '';
    const bearerToken  = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    const authed =
      (SERVICE_ROLE_KEY && safeEquals(bearerToken, SERVICE_ROLE_KEY)) ||
      (DUES_NOTIFY_SECRET && safeEquals(secretHeader, DUES_NOTIFY_SECRET));

    if (!authed) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Load payments config
    const { data: configRows } = await supabase
      .from('site_content')
      .select('content_json')
      .eq('content_key', 'payments')
      .limit(1);

    const cfg = (configRows && configRows[0] && configRows[0].content_json) || {};

    // Get today in Central Time (respects CST/CDT automatically)
    const todayCST = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
    const year     = todayCST.slice(0, 4);

    const unlockDate = (cfg.unlock_date as string) || null;
    const lateDate   = (cfg.late_date as string)   || `${year}-11-15`;

    // Determine which notifications fire today
    type NotifType = 'PRE_UNLOCK' | 'UNLOCK_OPEN' | 'NOV_WARNING' | 'LATE_FEE' | 'DEC_WARNING';
    const firedTypes: NotifType[] = [];

    if (unlockDate) {
      if (todayCST === addDays(unlockDate, -3)) firedTypes.push('PRE_UNLOCK');
      if (todayCST === unlockDate)              firedTypes.push('UNLOCK_OPEN');
    }
    const novDates = [`${year}-11-01`, `${year}-11-07`, `${year}-11-14`];
    if (novDates.includes(todayCST)) firedTypes.push('NOV_WARNING');
    if (todayCST === lateDate)       firedTypes.push('LATE_FEE');
    const decDates = [`${year}-12-01`, `${year}-12-15`, `${year}-12-31`];
    if (decDates.includes(todayCST)) firedTypes.push('DEC_WARNING');

    if (!firedTypes.length) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no notifications scheduled for today' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch member lists
    const { data: allActive } = await supabase
      .from('members')
      .select('email,first_name,last_name')
      .eq('status', 'active')
      .not('email', 'is', null);

    const { data: unpaidActive } = await supabase
      .from('members')
      .select('email,first_name,last_name')
      .eq('status', 'active')
      .not('email', 'is', null)
      .or(`dues_paid_year.is.null,dues_paid_year.neq.${year}`)
      .not('life_member', 'in', '(yes,y,true,1)');

    type Member = { email: string; first_name: string; last_name: string };
    const allActiveList: Member[]  = (allActive  || []) as Member[];
    const unpaidList: Member[]     = (unpaidActive || []) as Member[];

    let totalSent = 0;

    const fromField = `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`;

    async function sendEmail(to: string, subject: string, html: string) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify({ from: fromField, to, subject, html })
      });
    }

    for (const type of firedTypes) {
      let recipients: Member[];
      let getEmail: (m: Member) => { subject: string; html: string };

      if (type === 'PRE_UNLOCK') {
        recipients = allActiveList;
        getEmail = (m) => {
          const { subject, html } = emailTemplate(
            m.first_name,
            'Xi Tau Lambda — Chapter Dues Window Opens in 3 Days',
            `<p style="margin:0 0 16px;">This is a friendly reminder that the chapter dues payment window opens in <strong style="color:#C9A84C;">3 days</strong> on <strong style="color:#C9A84C;">${formatDate(unlockDate!)}</strong>.</p>
             <p style="margin:0 0 16px;">Please have your payment information ready. You will be able to pay your dues securely through the Member Portal starting on that date.</p>`
          );
          return { subject, html };
        };
      } else if (type === 'UNLOCK_OPEN') {
        recipients = allActiveList;
        getEmail = (m) => {
          const { subject, html } = emailTemplate(
            m.first_name,
            'Xi Tau Lambda — Chapter Dues Are Now Open',
            `<p style="margin:0 0 16px;">The chapter dues payment window is <strong style="color:#C9A84C;">now open</strong>!</p>
             <p style="margin:0 0 16px;">Please pay your annual chapter dues by <strong>November 14</strong> to avoid a late fee. You can pay securely through the Member Portal using the button below.</p>`
          );
          return { subject, html };
        };
      } else if (type === 'NOV_WARNING') {
        recipients = unpaidList;
        getEmail = (m) => {
          const { subject, html } = emailTemplate(
            m.first_name,
            'Xi Tau Lambda — Chapter Dues Reminder: Deadline Approaching',
            `<p style="margin:0 0 16px;">This is a friendly reminder that chapter dues are still <strong style="color:#f59e0b;">outstanding</strong> for your account.</p>
             <p style="margin:0 0 16px;">The late fee of <strong style="color:#f59e0b;">$${cfg.late_fee_cents ? (cfg.late_fee_cents / 100).toFixed(2) : '10.00'}</strong> kicks in on <strong>November 15</strong>. Please pay before that date to avoid the additional charge.</p>`
          );
          return { subject, html };
        };
      } else if (type === 'LATE_FEE') {
        recipients = unpaidList;
        getEmail = (m) => {
          const { subject, html } = emailTemplate(
            m.first_name,
            'Xi Tau Lambda — Chapter Dues Past Due',
            `<p style="margin:0 0 16px;">Your chapter dues are <strong style="color:#ef4444;">past due</strong> as of today, ${formatDate(todayCST)}.</p>
             <p style="margin:0 0 16px;">A late fee now applies when paying. Please log in to the Member Portal and settle your dues as soon as possible to remain in good standing.</p>`
          );
          return { subject, html };
        };
      } else { // DEC_WARNING
        recipients = unpaidList;
        getEmail = (m) => {
          const { subject, html } = emailTemplate(
            m.first_name,
            'Xi Tau Lambda — Chapter Dues: Delinquent Status Warning',
            `<p style="margin:0 0 16px;"><strong style="color:#ef4444;">Urgent:</strong> Your chapter dues remain unpaid and the end of the year is approaching.</p>
             <p style="margin:0 0 16px;">Members who have not paid their dues by December 31 may be placed in <strong style="color:#ef4444;">delinquent status</strong>, which affects your standing and chapter privileges. Please pay immediately through the Member Portal.</p>`
          );
          return { subject, html };
        };
      }

      for (const member of recipients) {
        if (!member.email) continue;
        const { subject, html } = getEmail(member);
        await sendEmail(member.email, subject, html);
        totalSent++;
        await sleep(50);
      }
    }

    return new Response(
      JSON.stringify({ sent: totalSent, notifications: firedTypes, members: totalSent }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
