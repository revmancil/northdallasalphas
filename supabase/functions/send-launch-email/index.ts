import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function safeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const LOGO_URL = 'https://northdallasalphas.com/images/xtl-logo.png';
const PORTAL_URL = 'https://northdallasalphas.com/member-portal.html';

function buildEmail(firstName: string): { subject: string; html: string } {
  const subject = 'Xi Tau Lambda Member Portal — Now Live';
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
            <img src="${LOGO_URL}" alt="Xi Tau Lambda Chapter" width="90" height="90" style="border-radius:50%;border:2px solid #C9A84C;object-fit:cover;display:block;margin:0 auto 14px;">
            <div style="font-size:11px;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;margin-bottom:6px;">Alpha Phi Alpha Fraternity, Inc.</div>
            <div style="font-size:22px;font-weight:bold;color:#C9A84C;font-family:Georgia,serif;">Xi Tau Lambda Chapter</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px;color:#e5e5e5;font-size:15px;line-height:1.75;">
            <p style="margin:0 0 18px;">Dear Brother ${firstName},</p>

            <p style="margin:0 0 18px;">We are pleased to announce that the <strong style="color:#C9A84C;">Xi Tau Lambda Member Portal</strong> is now live. The portal is your central hub for chapter business — pay dues, register for events, access meeting records, order chapter apparel, and stay connected with the brotherhood.</p>

            <p style="margin:0 0 18px;">We ask that every active brother <strong style="color:#C9A84C;">log in and complete your profile before the next chapter meeting</strong> so your account is active and your information is current in our system.</p>

            <!-- URL callout -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
              <tr>
                <td style="background:rgba(201,168,76,0.12);border:1px solid rgba(201,168,76,0.3);border-radius:6px;padding:14px 20px;text-align:center;font-size:14px;color:#aaa;">
                  Member Portal &nbsp;→&nbsp;
                  <a href="${PORTAL_URL}" style="color:#C9A84C;font-weight:bold;font-size:15px;text-decoration:none;">${PORTAL_URL.replace('https://', '')}</a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 14px;"><strong style="color:#e5e5e5;">First time logging in? Here's how to get started:</strong></p>

            <table cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
              <tr>
                <td style="vertical-align:top;padding:4px 12px 4px 0;">
                  <div style="width:22px;height:22px;border-radius:50%;background:rgba(201,168,76,0.15);color:#C9A84C;font-size:11px;font-weight:bold;text-align:center;line-height:22px;">1</div>
                </td>
                <td style="color:#aaa;font-size:14px;line-height:1.65;padding:4px 0;">Visit the portal at the link above and click <strong style="color:#e5e5e5;">Sign In</strong>.</td>
              </tr>
              <tr>
                <td style="vertical-align:top;padding:4px 12px 4px 0;">
                  <div style="width:22px;height:22px;border-radius:50%;background:rgba(201,168,76,0.15);color:#C9A84C;font-size:11px;font-weight:bold;text-align:center;line-height:22px;">2</div>
                </td>
                <td style="color:#aaa;font-size:14px;line-height:1.65;padding:4px 0;">Click <strong style="color:#e5e5e5;">Forgot Password</strong> and enter the email address on file with the chapter. You will receive a link to set your password.</td>
              </tr>
              <tr>
                <td style="vertical-align:top;padding:4px 12px 4px 0;">
                  <div style="width:22px;height:22px;border-radius:50%;background:rgba(201,168,76,0.15);color:#C9A84C;font-size:11px;font-weight:bold;text-align:center;line-height:22px;">3</div>
                </td>
                <td style="color:#aaa;font-size:14px;line-height:1.65;padding:4px 0;">Once signed in, navigate to <strong style="color:#e5e5e5;">My Profile</strong> and confirm your contact information, upload a photo, and complete any missing fields.</td>
              </tr>
              <tr>
                <td style="vertical-align:top;padding:4px 12px 4px 0;">
                  <div style="width:22px;height:22px;border-radius:50%;background:rgba(201,168,76,0.15);color:#C9A84C;font-size:11px;font-weight:bold;text-align:center;line-height:22px;">4</div>
                </td>
                <td style="color:#aaa;font-size:14px;line-height:1.65;padding:4px 0;">Explore the portal — events, the brother directory, chapter news, and more are all available from the sidebar.</td>
              </tr>
            </table>

            <p style="margin:0 0 18px;color:#aaa;">If you do not receive the password reset email or do not have an account, contact the Financial Secretary to get your account set up.</p>

            <p style="margin:0 0 18px;color:#aaa;"><strong style="color:#e5e5e5;">Note:</strong> The current chapter website at <strong style="color:#C9A84C;">northdallasalphas.org</strong> will be redirected to the new site on <strong style="color:#C9A84C;">September 17</strong>. After that date, visiting .org will take you directly to northdallasalphas.com.</p>

            <p style="margin:24px 0 0;">In Brotherhood,<br><strong style="color:#C9A84C;">Xi Tau Lambda Chapter</strong><br><span style="color:#aaa;font-size:13px;">Alpha Phi Alpha Fraternity, Inc.</span></p>
          </td>
        </tr>

        <!-- CTA Button -->
        <tr>
          <td style="padding:0 32px 32px;text-align:center;">
            <a href="${PORTAL_URL}" style="display:inline-block;background:#C9A84C;color:#000;font-weight:bold;font-size:15px;padding:14px 32px;border-radius:6px;text-decoration:none;letter-spacing:1px;">Access the Member Portal</a>
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
    const RESEND_API_KEY     = Deno.env.get('RESEND_API_KEY') || '';
    const RESEND_FROM_EMAIL  = Deno.env.get('RESEND_FROM_EMAIL') || '';
    const RESEND_FROM_NAME   = Deno.env.get('RESEND_FROM_NAME') || 'Xi Tau Lambda Chapter';
    const SUPABASE_URL       = Deno.env.get('SUPABASE_URL') || '';
    const SERVICE_ROLE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const DUES_NOTIFY_SECRET = Deno.env.get('DUES_NOTIFY_SECRET') || '';

    // Auth: Bearer service role key or x-dues-notify-secret header
    const authHeader   = req.headers.get('Authorization') || '';
    const secretHeader = req.headers.get('x-dues-notify-secret') || '';
    const bearerToken  = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    const authed =
      (SERVICE_ROLE_KEY && safeEquals(bearerToken, SERVICE_ROLE_KEY)) ||
      (DUES_NOTIFY_SECRET && safeEquals(secretHeader, DUES_NOTIFY_SECRET));

    if (!authed) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Optional: dry_run=true to preview recipient list without sending
    const url    = new URL(req.url);
    const dryRun = url.searchParams.get('dry_run') === 'true';

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: members, error } = await supabase
      .from('members')
      .select('email, first_name, last_name')
      .eq('status', 'active')
      .not('email', 'is', null);

    if (error) throw new Error(error.message);

    type Member = { email: string; first_name: string; last_name: string };
    const list: Member[] = (members || []) as Member[];

    if (dryRun) {
      return new Response(
        JSON.stringify({ dry_run: true, recipients: list.length, members: list.map(m => ({ email: m.email, name: m.first_name + ' ' + m.last_name })) }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const fromField = `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`;
    let sent = 0;
    const failed: string[] = [];

    for (const member of list) {
      if (!member.email) continue;
      const { subject, html } = buildEmail(member.first_name || 'Brother');
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify({ from: fromField, to: member.email, subject, html })
      });
      if (res.ok) {
        sent++;
      } else {
        failed.push(member.email);
      }
      await sleep(100); // stay well within Resend rate limits
    }

    return new Response(
      JSON.stringify({ sent, failed: failed.length, failed_emails: failed }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
});
