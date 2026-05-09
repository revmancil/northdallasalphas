import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "npm:stripe@17.4.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const memberId = parseInt(String(meta.member_id ?? ""), 10);
    const full_name = String(meta.full_name ?? "").slice(0, 200);
    const phone = String(meta.phone ?? "").slice(0, 40);
    const email = String(meta.email ?? "").slice(0, 320);
    if (!full_name || !email) {
      console.error("Invalid dues checkout metadata", meta);
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { error } = await admin.from("dues_payments").insert({
      member_id: Number.isFinite(memberId) && memberId > 0 ? memberId : null,
      full_name,
      phone,
      email,
      amount_cents: amountTotal,
      payment_status: "paid",
      stripe_checkout_session_id: sessionId,
    });

    const ignorableDues =
      error?.code === "23505" ||
      /duplicate key/i.test(String(error?.message ?? ""));
    if (error && !ignorableDues) {
      console.error("dues_payments insert:", error);
      return new Response(error.message, { status: 500 });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
