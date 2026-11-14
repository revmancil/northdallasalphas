import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceKey) {
    return new Response("Server misconfiguration", { status: 500 });
  }

  // Optional dry_run param — POST body { "dry_run": true } skips sends
  let dryRun = false;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      dryRun = body.dry_run === true;
    }
  } catch { /* ignore */ }

  const admin = createClient(supabaseUrl, serviceKey);

  // Fetch all Stripe dues payments
  const { data: payments, error: fetchErr } = await admin
    .from("finance_payments")
    .select("id, member_id, member_name, category_label, fiscal_year, amount_cents, stripe_session_id, created_at")
    .eq("method", "stripe")
    .eq("status", "paid")
    .order("created_at", { ascending: true });

  if (fetchErr) {
    return new Response("Failed to fetch payments: " + fetchErr.message, { status: 500 });
  }

  if (!payments || payments.length === 0) {
    return new Response(JSON.stringify({ sent: 0, skipped: 0, errors: 0, message: "No Stripe dues payments found." }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const results: { id: string; name: string; email: string; status: string; error?: string }[] = [];

  for (const payment of payments) {
    // Look up member email
    let email = "";
    if (payment.member_id) {
      const { data: member } = await admin
        .from("members")
        .select("email, first_name, last_name")
        .eq("id", payment.member_id)
        .maybeSingle();
      if (member?.email) email = member.email;
    }

    if (!email) {
      results.push({ id: payment.id, name: payment.member_name, email: "", status: "skipped_no_email" });
      continue;
    }

    if (dryRun) {
      results.push({ id: payment.id, name: payment.member_name, email, status: "dry_run" });
      continue;
    }

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/send-dues-receipt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "apikey": serviceKey,
        },
        body: JSON.stringify({
          email,
          fullName:        payment.member_name,
          fiscalYear:      payment.fiscal_year,
          amountCents:     payment.amount_cents,
          paidAt:          payment.created_at,
          categoryLabel:   payment.category_label ?? "Chapter Dues",
          lateFee:         false,
          buildingFund:    false,
          stripeSessionId: payment.stripe_session_id ?? "",
        }),
      });

      if (res.ok) {
        results.push({ id: payment.id, name: payment.member_name, email, status: "sent" });
      } else {
        const errText = await res.text();
        results.push({ id: payment.id, name: payment.member_name, email, status: "error", error: errText });
      }
    } catch (e) {
      results.push({ id: payment.id, name: payment.member_name, email, status: "error", error: String(e) });
    }

    // Throttle: 2 emails/sec to stay inside Resend free-tier rate limits
    await new Promise((r) => setTimeout(r, 500));
  }

  const sent    = results.filter((r) => r.status === "sent").length;
  const skipped = results.filter((r) => r.status.startsWith("skipped") || r.status === "dry_run").length;
  const errors  = results.filter((r) => r.status === "error").length;

  return new Response(
    JSON.stringify({ sent, skipped, errors, dryRun, results }),
    { headers: { "Content-Type": "application/json" } },
  );
});
