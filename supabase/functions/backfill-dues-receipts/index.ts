import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceKey) {
    return new Response("Server misconfiguration", { status: 500, headers: CORS });
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

  // Only Zelle payers — Stripe receipts were already sent at checkout
  const { data: zellePayments, error: zpErr } = await admin
    .from("dues_payments")
    .select("id, full_name, email, amount_cents, payment_method, payment_status, created_at, member_id")
    .eq("payment_method", "zelle")
    .eq("payment_status", "paid")
    .order("created_at", { ascending: true });

  if (zpErr) {
    console.warn("dues_payments fetch failed:", zpErr.message);
  }

  type PaymentRow = { id: string; member_name: string; email: string; fiscal_year: string; amount_cents: number; method: string; stripe_session_id: string; created_at: string; };

  const payments: PaymentRow[] = (zellePayments ?? []).map((p) => ({
    id:               String(p.id),
    member_name:      p.full_name ?? "",
    email:            p.email ?? "",
    fiscal_year:      "",
    amount_cents:     p.amount_cents ?? 0,
    method:           "zelle",
    stripe_session_id: "",
    created_at:       p.created_at ?? "",
  }));

  if (payments.length === 0) {
    return json({ sent: 0, skipped: 0, errors: 0, message: "No dues payments found." });
  }

  const results: { id: string; name: string; email: string; status: string; error?: string }[] = [];

  for (const payment of payments) {
    const email: string = payment.email ?? "";

    if (!email) {
      results.push({ id: payment.id, name: payment.member_name, email: "", status: "skipped_no_email", error: `member_id=${payment.member_id}` });
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
          paymentMethod:   payment.method ?? "stripe",
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

  return json({ sent, skipped, errors, dryRun, results });
});
