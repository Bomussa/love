// Minimal health endpoint expected by smoke-test: returns { ok: true }
import { corsHeaders, isOptions, ok } from "../_shared/cors.ts";

Deno.serve((req) => {
  if (isOptions(req)) return new Response(null, { status: 204, headers: corsHeaders });
  return ok({ ok: true, ts: new Date().toISOString() });
});