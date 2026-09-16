import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "npm:stripe@17.4.0";
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

function trimStr(v: unknown, max: number): string {
  const s = String(v ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// Processing fee line item so buyer pays and chapter nets 100%
// fee = (subtotal × 0.029 + 0.30) / 0.971  → rounds up to nearest cent
function calcFeeCents(subtotalCents: number): number {
  return Math.ceil((subtotalCents * 0.029 + 30) / 0.971);
}

function processingFeeLine(subtotalCents: number): Stripe.Checkout.SessionCreateParams.LineItem {
  return {
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: calcFeeCents(subtotalCents),
      product_data: { name: "Processing Fee (2.9% + $0.30)" },
    },
  };
}

// ── Chapter Store — Stripe Price IDs ────────────────────────────────────────
const STORE_PRICE_IDS: Record<string, string> = {
  "blazer-standard": "price_1UEDL2CKVGcSdbnRniuhXuDC",   // sizes 34–60, $150
  "blazer-extended": "price_1UEDObCKVGcSdbnR0hGOLO5L",   // sizes 62+,  $200
  "polo-sxl":        "price_1UEDTYCKVGcSdbnRERKpWPQa",   // S–XL,       $32
  "polo-2x3x":       "price_1UEDUSCKVGcSdbnR7z0igLM9",   // 2X–3X,      $36
  "polo-4x6x":       "price_1UEDUSCKVGcSdbnRdKadb6wb",   // 4X–6X,      $40
  "sweatshirt":      "price_1UEDamCKVGcSdbnRi8vJtosI",   // S–2X,       $65
  "necktie":         "price_1UEDikCKVGcSdbnRX1Ku1GiK",   // one-size,   $27
  "bowtie":          "price_1UEDiwCKVGcSdbnRppzZ8A2E",   // one-size,   $27
};

const BLAZER_EXTENDED = ["62","64","66","68","70","72"];
const POLO_4X         = ["4X","5X","6X"];
const POLO_2X         = ["2X","3X"];

function resolveStorePriceId(productKey: string, size: string): string | null {
  switch (productKey) {
    case "chapter-blazer":
      return BLAZER_EXTENDED.includes(size) ? STORE_PRICE_IDS["blazer-extended"] : STORE_PRICE_IDS["blazer-standard"];
    case "chapter-polo":
      if (POLO_4X.includes(size)) return STORE_PRICE_IDS["polo-4x6x"];
      if (POLO_2X.includes(size)) return STORE_PRICE_IDS["polo-2x3x"];
      return STORE_PRICE_IDS["polo-sxl"];
    case "chenille-sweatshirt": return STORE_PRICE_IDS["sweatshirt"];
    case "chapter-necktie":     return STORE_PRICE_IDS["necktie"];
    case "chapter-bowtie":      return STORE_PRICE_IDS["bowtie"];
    default: return null;
  }
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
    Deno.env.get("PUBLIC_SITE_URL") ?? "https://northdallasalphas.com"
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
        processingFeeLine(fee),
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

    const applyLateFee   = payload.lateFee === true;
    const applyBldFund   = payload.buildingFund === true;
    const lateFeeCents   = parseInt(Deno.env.get("LATE_FEE_CENTS") ?? "1000", 10) || 1000;
    const bldFundCents   = parseInt(String(payload.buildingFundCents ?? "5000"), 10) || 5000;

    const duesCategory      = trimStr(payload.duesCategory, 40)      || "renewing";
    const duesCategoryLabel = trimStr(payload.duesCategoryLabel, 120) || "Chapter Dues";
    const fiscalYear        = trimStr(payload.fiscalYear, 10)         || String(new Date().getFullYear());
    const amountCents       = parseInt(String(payload.amountCents ?? duesCents), 10) || duesCents;
    const baseCents         = amountCents - (applyLateFee ? lateFeeCents : 0) - (applyBldFund ? bldFundCents : 0);

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: baseCents,
          product_data: {
            name: `${duesCategoryLabel} — FY ${fiscalYear}`,
            description: "Xi Tau Lambda Chapter dues",
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
            name: "Late Fee",
            description: "Dues received after January 1 deadline",
          },
        },
      });
    }

    if (applyBldFund) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: bldFundCents,
          product_data: { name: "Building Fund Contribution" },
        },
      });
    }

    // Processing fee — buyer pays so chapter nets the full dues amount
    lineItems.push(processingFeeLine(amountCents));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: lineItems,
      success_url: `${siteBase}/finance/pay-dues.html?payment=success`,
      cancel_url:  `${siteBase}/finance/pay-dues.html?payment=cancelled`,
      metadata: {
        kind:                "dues",
        member_id:           String(member.id),
        full_name:           fullName,
        phone,
        email,
        dues_category:       duesCategory,
        dues_category_label: duesCategoryLabel,
        fiscal_year:         fiscalYear,
        late_fee:            applyLateFee ? "true" : "false",
        building_fund:       applyBldFund ? "true" : "false",
        amount_cents:        String(amountCents),
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

    const notes      = trimStr(payload.notes, 500);
    const memberName = [member.first_name, member.last_name].filter(Boolean).join(" ");

    // Build line items — chapter store items use Stripe Price IDs when available
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    let totalCents = 0;

    for (const i of items) {
      const qty      = Math.max(1, parseInt(String(i.quantity ?? 1), 10));
      const prodKey  = String(i.product_key ?? "").trim();
      const size     = String(i.size ?? "N/A").trim();
      const resolvedPriceId = prodKey ? resolveStorePriceId(prodKey, size) : null;

      if (resolvedPriceId) {
        // Use Stripe Price ID (exact price pulled from Stripe)
        const priceObj = await stripe.prices.retrieve(resolvedPriceId);
        const unitAmt  = priceObj.unit_amount ?? 0;
        totalCents    += unitAmt * qty;
        lineItems.push({ price: resolvedPriceId, quantity: qty });
      } else {
        // Fallback: dynamic price from frontend
        const unitAmt = Math.round(Number(i.price ?? 0) * 100);
        totalCents   += unitAmt * qty;
        lineItems.push({
          quantity: qty,
          price_data: {
            currency: "usd",
            unit_amount: unitAmt,
            product_data: {
              name: trimStr(i.name, 120) || "Store item",
              description: size !== "N/A" ? `Size: ${size}` : "Xi Tau Lambda Chapter Store",
            },
          },
        });
      }
    }

    if (totalCents <= 0) return json({ error: "Order total must be greater than zero." }, 400);

    // Processing fee — buyer pays so chapter nets full product price
    lineItems.push(processingFeeLine(totalCents));

    // Save order record so webhook can reference it
    const { data: order, error: orderErr } = await admin
      .from("finance_merch_orders")
      .insert({
        member_id:   member.id,
        member_name: memberName,
        email:       userEmail,
        items:       JSON.stringify(items.map((i) => ({
          product_key: String(i.product_key ?? ""),
          name:        trimStr(i.name, 200),
          size:        String(i.size ?? "N/A"),
          quantity:    Math.max(1, parseInt(String(i.quantity ?? 1), 10)),
        }))),
        total_cents:  totalCents,
        status:       "awaiting_payment",
        notes:        notes || null,
        created_at:   new Date().toISOString(),
      })
      .select("id")
      .single();

    const orderId = order?.id ? String(order.id) : "pending";
    if (orderErr) console.warn("finance_merch_orders insert:", orderErr);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: lineItems,
      success_url: `${siteBase}/member-portal.html?store=success`,
      cancel_url:  `${siteBase}/member-portal.html?store=cancel`,
      metadata: {
        kind:        "store",
        order_id:    orderId,
        member_id:   String(member.id),
        member_name: memberName,
        full_name:   fullName,
        email,
        amount_cents: String(totalCents),
      },
    });

    return json({ url: session.url });
  }

  return json({ error: "Unknown mode." }, 400);
});
