import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import mjml2html from "npm:mjml@4.15.3";

type NewsletterBlock =
  | { type: "text"; heading?: string; body?: string }
  | { type: "image"; imageUrl?: string; alt?: string; caption?: string }
  | { type: "cta"; text?: string; url?: string }
  | { type: "social"; heading?: string; links?: Array<{ network?: string; url?: string }> };

type RenderRequest = {
  campaignName?: string;
  subject?: string;
  preheader?: string;
  blocks?: NewsletterBlock[];
  brand?: {
    chapterName?: string;
    primaryColor?: string;
    darkColor?: string;
    textColor?: string;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function esc(input: unknown): string {
  return String(input || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cleanBodyHtml(html: string): string {
  return String(html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(String(url || "").trim());
}

function buildMjml(payload: RenderRequest): string {
  const brand = payload.brand || {};
  const primary = brand.primaryColor || "#C9A84C";
  const dark = brand.darkColor || "#0f0f0f";
  const text = brand.textColor || "#2a2a2a";
  const chapter = brand.chapterName || "North Dallas Alphas";
  const preheader = esc(payload.preheader || "");
  const subject = esc(payload.subject || payload.campaignName || "North Dallas Alphas Newsletter");
  const blocks = Array.isArray(payload.blocks) ? payload.blocks : [];

  const bodyParts: string[] = [];

  bodyParts.push(`
    <mj-section background-color="${dark}" padding="24px 24px 16px">
      <mj-column>
        <mj-text color="#ffffff" font-size="22px" font-family="Georgia, serif" font-weight="700" padding="0">
          ${esc(payload.campaignName || chapter)}
        </mj-text>
        <mj-text color="#d8d8d8" font-size="13px" padding="8px 0 0">
          ${subject}
        </mj-text>
      </mj-column>
    </mj-section>
  `);

  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    if (block.type === "text") {
      const heading = esc(block.heading || "");
      const body = cleanBodyHtml(block.body || "");
      bodyParts.push(`
        <mj-section background-color="#ffffff" padding="16px 24px 8px">
          <mj-column>
            ${heading ? `<mj-text font-size="20px" color="${text}" font-family="Georgia, serif" font-weight="700" padding="0 0 8px">${heading}</mj-text>` : ""}
            <mj-text font-size="15px" color="${text}" line-height="1.7" padding="0">${body}</mj-text>
          </mj-column>
        </mj-section>
      `);
    } else if (block.type === "image") {
      const src = String(block.imageUrl || "").trim();
      if (!isHttpUrl(src)) continue;
      bodyParts.push(`
        <mj-section background-color="#ffffff" padding="12px 24px 6px">
          <mj-column>
            <mj-image src="${esc(src)}" alt="${esc(block.alt || "Newsletter image")}" padding="0" border-radius="8px" />
            ${block.caption ? `<mj-text font-size="12px" color="#666666" padding="8px 0 0">${esc(block.caption)}</mj-text>` : ""}
          </mj-column>
        </mj-section>
      `);
    } else if (block.type === "cta") {
      const href = String(block.url || "").trim();
      const textLabel = String(block.text || "").trim();
      if (!isHttpUrl(href) || !textLabel) continue;
      bodyParts.push(`
        <mj-section background-color="#ffffff" padding="12px 24px 12px">
          <mj-column>
            <mj-button href="${esc(href)}" background-color="${primary}" color="#111111" font-size="13px" font-weight="700" border-radius="4px" inner-padding="12px 20px">
              ${esc(textLabel)}
            </mj-button>
          </mj-column>
        </mj-section>
      `);
    } else if (block.type === "social") {
      const heading = esc(block.heading || "Connect With Us");
      const links = Array.isArray(block.links) ? block.links : [];
      const validLinks = links.filter((l) => l && isHttpUrl(String(l.url || "").trim()));
      if (!validLinks.length) continue;
      bodyParts.push(`
        <mj-section background-color="#ffffff" padding="8px 24px 20px">
          <mj-column>
            <mj-text font-size="16px" color="${text}" font-family="Georgia, serif" font-weight="700" padding="0 0 8px">
              ${heading}
            </mj-text>
            <mj-social mode="horizontal" icon-size="28px" padding="0">
              ${validLinks
                .map((link) => {
                  const name = String(link.network || "Website").trim();
                  return `<mj-social-element name="${esc(name.toLowerCase())}" href="${esc(String(link.url || "").trim())}">${esc(name)}</mj-social-element>`;
                })
                .join("\n")}
            </mj-social>
          </mj-column>
        </mj-section>
      `);
    }
  }

  bodyParts.push(`
    <mj-section background-color="#f8f8f8" padding="16px 24px">
      <mj-column>
        <mj-text font-size="12px" color="#777777" line-height="1.6" padding="0">
          You are receiving this email because you are connected to Xi Tau Lambda Chapter of Alpha Phi Alpha Fraternity, Inc.
        </mj-text>
      </mj-column>
    </mj-section>
  `);

  return `
    <mjml>
      <mj-head>
        <mj-title>${subject}</mj-title>
        <mj-preview>${preheader}</mj-preview>
        <mj-attributes>
          <mj-all font-family="Arial, Helvetica, sans-serif" />
        </mj-attributes>
      </mj-head>
      <mj-body background-color="#f4f4f4" width="640px">
        ${bodyParts.join("\n")}
      </mj-body>
    </mjml>
  `;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as RenderRequest;
    const mjml = buildMjml(payload);
    const out = mjml2html(mjml, { validationLevel: "soft" });
    if (out.errors && out.errors.length) {
      return new Response(
        JSON.stringify({
          html: out.html || "",
          warnings: out.errors.map((e: { message?: string }) => e.message || "Unknown MJML warning"),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ html: out.html || "", warnings: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to render newsletter" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
