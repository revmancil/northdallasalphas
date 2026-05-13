/**
 * CORS headers for browser calls to Edge Functions (GitHub Pages → Supabase).
 * Keep in sync with https://supabase.com/docs/guides/functions/cors
 */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, accept-profile, content-profile, prefer, x-upsert, traceparent, baggage",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};
