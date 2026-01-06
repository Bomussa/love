// Simple CORS helper for Supabase Edge Functions (Deno)
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "Content-Type": "application/json; charset=utf-8",
};

export function isOptions(req: Request) {
  return req.method === "OPTIONS";
}

export function ok(body: unknown, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: { ...corsHeaders, ...extraHeaders },
  });
}

export function badRequest(message: string, details?: unknown) {
  return new Response(JSON.stringify({ success: false, error: message, details }, null, 2), {
    status: 400,
    headers: corsHeaders,
  });
}