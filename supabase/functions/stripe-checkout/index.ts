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
    const eventId = Number(payload.eventId);
    if (!Number.isFinite(eventId) || eventId <= 0) {
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

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [
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
      ],
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

  return json({ error: "Unknown mode." }, 400);
});
