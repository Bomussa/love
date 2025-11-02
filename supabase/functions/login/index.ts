import { preflight, ok, err } from "../_shared/cors.ts";
import { validateId, normalizeGender } from "../_shared/validate.ts";
Deno.serve(async (req: Request) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== "POST") return err("method_not_allowed", req, 405);
  let body: { id?: unknown; gender?: unknown } = {};
  try { body = await req.json(); } catch { return err("invalid_json", req, 400); }
  const idv = validateId(body.id);
  if (!idv.ok) return err(`bad_id:${idv.reason}`, req, 400, "bad_id");
  const g = normalizeGender(String(body.gender || ""));
  if (!g) return err("bad_gender", req, 400, "bad_gender");
  const ticket = crypto.randomUUID();
  return ok({ ok: true, ticket, id: idv.value, gender: g, next: { step: "assign_path", nextClinic: "reception" } }, req);
});
