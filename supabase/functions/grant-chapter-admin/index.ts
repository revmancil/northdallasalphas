/**
 * Grant chapter admin: creates Auth user (or links existing) + chapter_admins row.
 * Keep this file self-contained (no ../ imports) so Supabase deploy bundles reliably.
 * CORS: https://supabase.com/docs/guides/functions/cors
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, accept-profile, content-profile, prefer, x-upsert, traceparent, baggage, x-supabase-api-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function trimLowerEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json({ error: "Server is not configured (missing Supabase secrets)." }, 503);
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing Authorization header." }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user?.email) {
      return json({ error: "Invalid or expired session." }, 401);
    }
    const requesterEmail = trimLowerEmail(userData.user.email);

    let body: { email?: string; password?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }

    const email = trimLowerEmail(body.email);
    const password = String(body.password ?? "");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "A valid email address is required." }, 400);
    }
    if (password.length < 8) {
      return json({ error: "Password must be at least 8 characters." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { count, error: countErr } = await admin
      .from("chapter_admins")
      .select("*", { count: "exact", head: true });
    if (countErr) {
      return json({ error: "Could not verify admin roster: " + countErr.message }, 500);
    }
    const adminCount = count ?? 0;

    if (adminCount === 0) {
      return json(
        {
          error:
            "No chapter administrators are defined yet. In Supabase SQL Editor, run: insert into public.chapter_admins (email, granted_by) values ('your-admin@email.com','bootstrap'); — use the same email as an existing Supabase Auth user who signs in at admin.html.",
        },
        403,
      );
    }

    const { data: row, error: gateErr } = await admin
      .from("chapter_admins")
      .select("email")
      .eq("email", requesterEmail)
      .maybeSingle();
    if (gateErr || !row) {
      return json({ error: "Only chapter administrators can grant access." }, 403);
    }

    const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
      }),
    });

    let createdNewAuthUser = false;
    if (authRes.ok) {
      createdNewAuthUser = true;
    } else {
      let errMsg = "";
      try {
        const errJson = await authRes.json();
        errMsg = String(errJson.message || errJson.msg || errJson.error_description || "");
      } catch {
        errMsg = await authRes.text();
      }
      const lower = errMsg.toLowerCase();
      const duplicate =
        lower.includes("already") ||
        lower.includes("registered") ||
        lower.includes("exists") ||
        authRes.status === 422;
      if (!duplicate) {
        return json({ error: errMsg || "Could not create auth user." }, 400);
      }
    }

    const now = new Date().toISOString();
    const { error: insErr } = await admin.from("chapter_admins").upsert(
      {
        email,
        granted_by: requesterEmail,
        granted_at: now,
      },
      { onConflict: "email" },
    );
    if (insErr) {
      return json({ error: "User step ok but could not update admin roster: " + insErr.message }, 500);
    }

    return json({
      ok: true,
      createdNewAuthUser,
      message: createdNewAuthUser
        ? "Supabase login created and chapter admin access granted. Share the password securely."
        : "That email already had an account; chapter admin access was granted. They can use Forgot Password if needed.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: "Unexpected error: " + msg }, 500);
  }
});
