// Minimal health endpoint expected by smoke-test.
import { handleOptions, corsJsonResponse } from '../_shared/cors.ts';

Deno.serve((req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  return corsJsonResponse({ data: { ok: true, ts: new Date().toISOString() } });
});
