import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const THANK_YOU_URL = "https://northdallasalphas.com/survey-thanks.html";

serve(async (req: Request) => {
  const url = new URL(req.url);
  const newsletterId = url.searchParams.get("newsletter_id") || null;
  const surveyId = url.searchParams.get("survey_id") || null;
  const response = url.searchParams.get("response") || null;
  const question = url.searchParams.get("question") || null;

  if (!surveyId || !response) {
    return new Response("Missing required parameters.", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Record the response (ignore duplicate — unique constraint handles it)
  const { error } = await supabase
    .from("newsletter_survey_responses")
    .upsert(
      {
        newsletter_id: newsletterId,
        survey_id: surveyId,
        response: response,
        question: question,
        ip_hash: await hashIp(req.headers.get("x-forwarded-for") || ""),
        responded_at: new Date().toISOString(),
      },
      { onConflict: "newsletter_id,survey_id,ip_hash", ignoreDuplicates: true },
    );

  if (error) {
    console.error("survey insert error", error);
  }

  return Response.redirect(THANK_YOU_URL, 302);
});

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip.split(",")[0].trim());
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}
