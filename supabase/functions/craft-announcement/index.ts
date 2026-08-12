import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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

interface Payload {
  description: string;   // what the brother wants to say
  title?: string;        // announcement title (context)
  category?: string;     // General, Event, Scholarship, etc.
  tone?: string;         // Professional, Casual, Formal
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return json({ error: "AI service not configured. Ask your chapter admin to add the ANTHROPIC_API_KEY secret in Supabase." }, 500);
    }

    const { description, title, category, tone } = await req.json() as Payload;

    if (!description || description.trim().length < 5) {
      return json({ error: "Please provide a description of what you want to announce." }, 400);
    }

    const toneGuide = tone === "Formal"
      ? "Use formal, dignified language appropriate for a professional fraternity communication."
      : tone === "Casual"
      ? "Use warm, friendly language that feels personal and approachable among brothers."
      : "Use professional but approachable language — clear, respectful, and Brotherhood-oriented.";

    const categoryContext = category && category !== "General"
      ? `The category is "${category}".`
      : "";

    const titleContext = title ? `The announcement title is: "${title}".` : "";

    const systemPrompt = `You are a communications assistant for the Xi Tau Lambda Chapter of Alpha Phi Alpha Fraternity, Inc. (North Dallas Alphas). You help chapter brothers craft well-written announcements for the brotherhood.

When writing announcements:
- Write in the voice of a chapter brother speaking to fellow brothers
- Be clear, concise, and action-oriented
- Include all relevant information from the description
- Use inclusive, brotherhood-focused language consistent with Alpha Phi Alpha values
- Do NOT include a subject line or title — only the message body
- Do NOT use placeholder text like [Name] or [Date] — if information is missing, write around it naturally
- Keep it to 2-4 short paragraphs unless more detail is clearly needed
- ${toneGuide}`;

    const userPrompt = `Please craft a well-written announcement message for our chapter brotherhood portal.

${titleContext}
${categoryContext}

Here is what the brother wants to communicate:
${description.trim()}

Write only the announcement message body — no title, no greeting like "Dear Brothers", and no sign-off.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic API error:", err);
      return json({ error: "AI service error. Please try again." }, 502);
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text ?? "";

    return json({ announcement: text.trim() });
  } catch (e) {
    console.error("craft-announcement error:", e);
    return json({ error: "Unexpected error. Please try again." }, 500);
  }
});
