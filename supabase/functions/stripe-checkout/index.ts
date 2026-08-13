import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "npm:stripe@17.4.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function trimStr(v: unknown, max: number): string {
  const s = String(v ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return json({ error: "Stripe is not configured on the server." }, 503);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: "Supabase is not configured on the server." }, 503);
  }

  const siteBase = (
    Deno.env.get("PUBLIC_SITE_URL") ?? "https://northdallasalphas.org"
  ).replace(/\/$/, "");

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const mode = trimStr(payload.mode, 32);
  const fullName = trimStr(payload.fullName, 200);
  const phone = trimStr(payload.phone, 40);
  const email = trimStr(payload.email, 320).toLowerCase();

  if (fullName.length < 2) return json({ error: "Please enter your full name." }, 400);
  if (!isEmail(email)) return json({ error: "Please enter a valid email address." }, 400);
  if (phone.length < 7) return json({ error: "Please enter a valid phone number." }, 400);

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-11-20.acacia" });
  const admin = createClient(supabaseUrl, serviceKey);

  if (mode === "event") {
    const eventId = trimStr(payload.eventId, 64);
    if (!eventId) {
      return json({ error: "Invalid event." }, 400);
    }

    const { data: ev, error: evErr } = await admin
      .from("events")
      .select("id,name,chapter_registration_enabled,registration_fee_cents,reg_url")
      .eq("id", eventId)
      .maybeSingle();

    if (evErr || !ev) {
      return json({ error: "Event not found." }, 404);
    }

    const regUrl = String(ev.reg_url ?? "").trim();
    if (regUrl) {
      return json(
        { error: "This event uses an external registration link." },
        400,
      );
    }

    if (!ev.chapter_registration_enabled) {
      return json({ error: "Registration is not open for this event." }, 400);
    }

    const fee = Math.max(0, parseInt(String(ev.registration_fee_cents), 10) || 0);
    if (fee <= 0) {
      return json(
        { error: "This event is free — use the form on the website instead." },
        400,
      );
    }

    const eventName = trimStr(ev.name, 120) || "Event registration";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: fee,
            product_data: {
              name: eventName,
              description: "Event registration — Xi Tau Lambda",
            },
          },
        },
      ],
      success_url: `${siteBase}/events.html?reg=success`,
      cancel_url: `${siteBase}/events.html?reg=cancel`,
      metadata: {
        kind: "event",
        event_id: String(eventId),
        full_name: fullName,
        phone,
        email,
      },
    });

    return json({ url: session.url });
  }

  if (mode === "dues") {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Sign in to the member portal to pay dues." }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user?.email) {
      return json({ error: "Invalid or expired session. Please sign in again." }, 401);
    }

    const userEmail = String(userData.user.email).toLowerCase();
    if (userEmail !== email) {
      return json({ error: "Email must match your signed-in account." }, 400);
    }

    const { data: member, error: memErr } = await admin
      .from("members")
      .select("id,first_name,last_name")
      .eq("email", userEmail)
      .maybeSingle();

    if (memErr || !member?.id) {
      return json({ error: "Member profile not found for this account." }, 403);
    }

    let duesCents = parseInt(Deno.env.get("DUES_AMOUNT_CENTS") ?? "", 10);
    if (!Number.isFinite(duesCents) || duesCents <= 0) {
      const { data: payRow } = await admin
        .from("site_content")
        .select("content_json")
        .eq("content_key", "payments")
        .maybeSingle();
      const j = payRow?.content_json as { dues_amount_cents?: number } | null;
      duesCents = Math.max(0, parseInt(String(j?.dues_amount_cents ?? 15000), 10) || 15000);
    }

    if (duesCents <= 0) {
      return json({ error: "Dues amount is not configured." }, 503);
    }

    const applyLateFee = payload.lateFee === true;
    const lateFeeCents = parseInt(Deno.env.get("LATE_FEE_CENTS") ?? "1000", 10) || 1000;

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: duesCents,
          product_data: {
            name: "Xi Tau Lambda — Chapter dues",
            description: "Chapter dues payment",
          },
        },
      },
    ];

    if (applyLateFee) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: lateFeeCents,
          product_data: {
            name: "Late fee",
            description: "Dues received after December 31 deadline",
          },
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: lineItems,
      success_url: `${siteBase}/member-portal.html?dues=success`,
      cancel_url: `${siteBase}/member-portal.html?dues=cancel`,
      metadata: {
        kind: "dues",
        member_id: String(member.id),
        full_name: fullName,
        phone,
        email,
      },
    });

    return json({ url: session.url });
  }

  if (mode === "store") {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Sign in to the member portal to checkout." }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user?.email) {
      return json({ error: "Invalid or expired session. Please sign in again." }, 401);
    }

    const userEmail = String(userData.user.email).toLowerCase();

    const { data: member } = await admin
      .from("members")
      .select("id,first_name,last_name")
      .eq("email", userEmail)
      .maybeSingle();

    if (!member?.id) {
      return json({ error: "Member profile not found." }, 403);
    }

    const items = Array.isArray(payload.items) ? payload.items as Record<string, unknown>[] : [];
    if (!items.length) return json({ error: "Cart is empty." }, 400);

    const notes = trimStr(payload.notes, 500);
    const totalCents = items.reduce((s: number, i: Record<string, unknown>) =>
      s + Math.round(Number(i.price ?? 0) * 100) * Math.max(1, parseInt(String(i.quantity ?? 1), 10)), 0);

    if (totalCents <= 0) return json({ error: "Order total must be greater than zero for Stripe checkout." }, 400);

    const memberName = [member.first_name, member.last_name].filter(Boolean).join(" ");

    // Save order first so webhook can reference it by ID
    const { data: order, error: orderErr } = await admin
      .from("store_orders")
      .insert({
        member_id: member.id,
        member_name: memberName,
        member_email: userEmail,
        items: JSON.stringify(items.map((i) => ({
          item_id: i.item_id,
          name: trimStr(i.name, 200),
          price: Number(i.price ?? 0),
          quantity: Math.max(1, parseInt(String(i.quantity ?? 1), 10)),
          selections: i.selections ?? {},
        }))),
        total: totalCents / 100,
        status: "awaiting_payment",
        notes: notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (orderErr || !order?.id) {
      console.error("store_orders insert:", orderErr);
      return json({ error: "Could not create order record." }, 500);
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((i) => ({
      quantity: Math.max(1, parseInt(String(i.quantity ?? 1), 10)),
      price_data: {
        currency: "usd",
        unit_amount: Math.round(Number(i.price ?? 0) * 100),
        product_data: {
          name: trimStr(i.name, 120) || "Store item",
          description: "Xi Tau Lambda Chapter Store",
        },
      },
    }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: lineItems,
      success_url: `${siteBase}/member-portal.html?store=success`,
      cancel_url: `${siteBase}/member-portal.html?store=cancel&order=${order.id}`,
      metadata: {
        kind: "store",
        order_id: String(order.id),
        member_id: String(member.id),
        full_name: fullName,
        email,
      },
    });

    return json({ url: session.url });
  }

  return json({ error: "Unknown mode." }, 400);
});
