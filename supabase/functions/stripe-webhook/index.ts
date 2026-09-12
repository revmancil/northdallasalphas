import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "npm:stripe@17.4.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

async function fireNotification(supabaseUrl: string, serviceKey: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-admin-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("send-admin-notification fire failed:", e);
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const whSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!stripeKey || !whSecret || !supabaseUrl || !serviceKey) {
    return new Response("Server misconfiguration", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-11-20.acacia" });
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch (e) {
    console.error("Webhook signature error:", e);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.mode !== "payment" || session.payment_status !== "paid") {
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const meta = session.metadata ?? {};
  const kind = String(meta.kind ?? "");
  const sessionId = session.id;
  const amountTotal = session.amount_total ?? 0;

  const admin = createClient(supabaseUrl, serviceKey);

  if (kind === "event") {
    const eventId = parseInt(String(meta.event_id ?? ""), 10);
    const full_name = String(meta.full_name ?? "").slice(0, 200);
    const phone = String(meta.phone ?? "").slice(0, 40);
    const email = String(meta.email ?? "").slice(0, 320);
    if (!Number.isFinite(eventId) || eventId <= 0 || !full_name || !email) {
      console.error("Invalid event checkout metadata", meta);
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { error } = await admin.from("event_registrations").insert({
      event_id: eventId,
      full_name,
      phone,
      email,
      payment_status: "paid",
      amount_cents: amountTotal,
      stripe_checkout_session_id: sessionId,
    });

    const ignorable =
      error?.code === "23505" ||
      /duplicate key/i.test(String(error?.message ?? ""));
    if (error && !ignorable) {
      console.error("event_registrations insert:", error);
      return new Response(error.message, { status: 500 });
    }
  } else if (kind === "dues") {
    const memberId          = String(meta.member_id ?? "").trim();
    const full_name         = String(meta.full_name ?? "").slice(0, 200);
    const phone             = String(meta.phone ?? "").slice(0, 40);
    const email             = String(meta.email ?? "").slice(0, 320);
    const duesCategory      = String(meta.dues_category      ?? "renewing");
    const duesCategoryLabel = String(meta.dues_category_label ?? "Chapter Dues");
    const fiscalYear        = String(meta.fiscal_year ?? String(new Date().getFullYear()));
    const lateFee           = meta.late_fee === "true";
    const buildingFund      = meta.building_fund === "true";
    const amountCents       = parseInt(String(meta.amount_cents ?? amountTotal), 10) || amountTotal;

    if (!full_name || !email) {
      console.error("Invalid dues checkout metadata", meta);
      return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
    }

    // Write to finance_payments (primary dues record)
    const { error: fpErr } = await admin.from("finance_payments").insert({
      member_id:                 memberId || null,
      member_name:               full_name,
      category:                  duesCategory,
      category_label:            duesCategoryLabel,
      fiscal_year:               fiscalYear,
      amount_cents:              amountCents,
      method:                    "stripe",
      status:                    "paid",
      late_fee:                  lateFee,
      building_fund:             buildingFund,
      stripe_session_id:         sessionId,
      xero_sync_status:          "pending",
      created_at:                new Date().toISOString(),
    });

    const ignorableFP = fpErr?.code === "23505" || /duplicate key/i.test(String(fpErr?.message ?? ""));
    if (fpErr && !ignorableFP) console.error("finance_payments insert:", fpErr);

    // Update member dues_paid_year if member_id is a UUID
    if (memberId && /^[0-9a-f-]{36}$/i.test(memberId)) {
      const { error: memErr } = await admin
        .from("members")
        .update({ dues_paid_year: fiscalYear, dues_current: true })
        .eq("id", memberId);
      if (memErr) console.warn("members dues_paid_year update:", memErr);
    }

    // Notify finance admins
    await fireNotification(supabaseUrl, serviceKey, {
      type:        "dues_payment",
      memberName:  full_name,
      email,
      amount:      amountCents / 100,
      category:    duesCategoryLabel,
      fiscalYear,
      lateFee,
    });

  } else if (kind === "store") {
    const orderId    = String(meta.order_id    ?? "").trim();
    const memberName = String(meta.member_name ?? meta.full_name ?? "").trim();
    const email      = String(meta.email       ?? "").trim();
    if (orderId && orderId !== "pending") {
      const { error } = await admin
        .from("finance_merch_orders")
        .update({
          status:            "paid",
          stripe_session_id: sessionId,
        })
        .eq("id", orderId);
      if (error) console.warn("finance_merch_orders update:", error);
    }

    // Notify finance admins
    await fireNotification(supabaseUrl, serviceKey, {
      type:       "store_purchase",
      memberName,
      email,
      amount:     amountTotal / 100,
      orderId:    orderId || "—",
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
