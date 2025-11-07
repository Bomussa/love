// supabase/functions/functions-proxy/index.ts
// Router بسيط لمسارات queue/clinics/notifications
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""; // اختياري للتسجيل فقط

type Json = Record<string, unknown>;

function ok(data: Json | unknown[], init: number = 200) {
  return new Response(JSON.stringify({ ok: true, data }, null, 2), {
    status: init, headers: { "content-type": "application/json; charset=utf-8" }
  });
}
function err(message: string, init = 400, extra: Json = {}) {
  return new Response(JSON.stringify({ ok: false, error: message, ...extra }, null, 2), {
    status: init, headers: { "content-type": "application/json; charset=utf-8" }
  });
}

serve(async (req) => {
  try {
    const u = new URL(req.url);
    const path = (u.searchParams.get("path") || "").replace(/^\/|\/$/g, "");

    // auth client: يمرر Authorization الوارد لتفعيل RLS
    const incomingAuth = req.headers.get("authorization") ?? `Bearer ${ANON}`;
    const supa = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: incomingAuth } }
    });

    // (A) clinics/list
    if (path === "clinics/list") {
      const { data, error } = await supa.rpc("clinics_list");
      if (error) return err("clinics_list_failed", 500, { detail: error.message });
      return ok(data);
    }

    // (B) queue/create?clinic_id=...
    if (path === "queue/create") {
      const clinic_id = u.searchParams.get("clinic_id");
      if (!clinic_id) return err("clinic_id_required");
      const { data, error } = await supa.rpc("queue_create", { p_clinic_id: clinic_id });
      if (error) return err("queue_create_failed", 409, { detail: error.message });
      return ok(data);
    }

    // (C) queue/status?clinic_id=...
    if (path === "queue/status") {
      const clinic_id = u.searchParams.get("clinic_id");
      if (!clinic_id) return err("clinic_id_required");
      // حالة العيادة + ترتيب المستخدم إن كان لديه دور
      const [{ data: clinics, error: e1 }, { data: myq, error: e2 }] = await Promise.all([
        supa.rpc("clinics_list"),
        supa.from("queues").select("id, clinic_id, number, status, created_at, entered_at, left_at")
            .eq("clinic_id", clinic_id).eq("user_id", (await supa.auth.getUser()).data.user?.id || "")
            .order("created_at", { ascending: false }).limit(1)
      ]);
      if (e1) return err("clinics_list_failed", 500, { detail: e1.message });
      if (e2) return err("queue_fetch_failed", 500, { detail: e2.message });
      const clinic = clinics?.find((c: any) => c.id === clinic_id);
      return ok({ clinic, my: myq?.[0] || null });
    }

    // (D) clinics/:id/enter  &  clinics/:id/leave
    if (path.startsWith("clinics/") && (path.endsWith("/enter") || path.endsWith("/leave"))) {
      const parts = path.split("/");
      const clinicId = parts[1];
      const action = parts[2]; // enter | leave
      const { id: userId } = (await supa.auth.getUser()).data.user ?? { id: null };
      if (!userId) return err("unauthenticated", 401);

      // احضر آخر سجل waiting/in_service لنفس المستخدم في هذه العيادة
      const { data: q, error } = await supa
        .from("queues")
        .select("id, status")
        .eq("clinic_id", clinicId)
        .eq("user_id", userId)
        .in("status", ["waiting","in_service"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (error || !q?.length) return err("queue_not_found", 404);

      if (action === "enter") {
        const { data, error: e } = await supa.rpc("queue_enter", { p_queue_id: q[0].id });
        if (e) return err("queue_enter_failed", 409, { detail: e.message });
        return ok(data);
      } else {
        const { data, error: e } = await supa.rpc("queue_leave", { p_queue_id: q[0].id, p_status: "done" });
        if (e) return err("queue_leave_failed", 409, { detail: e.message });
        return ok(data);
      }
    }

    // (E) notifications/poll
    if (path === "notifications/poll") {
      const { data: user } = await supa.auth.getUser();
      if (!user?.user) return err("unauthenticated", 401);
      const { data, error } = await supa.from("notifications")
        .select("*").eq("user_id", user.user.id).is("read_at", null)
        .order("sent_at", { ascending: false }).limit(50);
      if (error) return err("notifications_failed", 500, { detail: error.message });
      return ok(data);
    }

    return err("unknown_path", 404, { path });
  } catch (e) {
    return err("internal_error", 500, { detail: String(e) });
  }
});
