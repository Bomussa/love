// Supabase Edge Function: api-v1-status
// Health check with strict CORS for mmc-mms.com
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const ORIGIN = "https://mmc-mms.com";

function corsHeaders(origin: string | null) {
  // Allow only the production origin; relax to * if public
  const allowOrigin = origin && origin.startsWith(ORIGIN) ? ORIGIN : ORIGIN;
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "cache-control": "no-store",
  } as Record<string, string>;
}

serve((req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  const body = {
    ok: true,
    service: "love-api (supabase)",
    time: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
      ...corsHeaders(origin),
    },
  });
});
