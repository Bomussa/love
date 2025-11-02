import { preflight, ok } from "../_shared/cors.ts";
Deno.serve((req: Request) => {
  const pf = preflight(req); if (pf) return pf;
  return ok({ ok: true, service: "edge-functions", ts: Date.now() }, req);
});
