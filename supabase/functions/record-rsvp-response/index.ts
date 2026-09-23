import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const config = { auth: false };

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://northdallasalphas.com",
  "Access-Control-Allow-Headers": "content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { newsletter_id, rsvp_id, event_name, response, name, email } = body;

  if (!rsvp_id || !response || !name) {
    return new Response(JSON.stringify({ error: "Missing required fields: rsvp_id, response, name" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await supabase
    .from("newsletter_rsvp_responses")
    .upsert(
      {
        newsletter_id: newsletter_id || null,
        rsvp_id,
        event_name: event_name || null,
        response,
        name,
        email: email || null,
        responded_at: new Date().toISOString(),
      },
      { onConflict: "newsletter_id,rsvp_id,name", ignoreDuplicates: false },
    );

  if (error) {
    console.error("rsvp insert error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
