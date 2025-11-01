export const config = { runtime: "edge" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info,prefer",
  "Access-Control-Max-Age": "86400"
};

function withCors(init = {}) {
  const headers = new Headers(init.headers || {});
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return { ...init, headers };
}

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, withCors({ status: 204 }));
  }

  const url = new URL(req.url);
  let subpath = url.pathname.replace(/^\/?api\/v1\//, "");
  if (!subpath || subpath === "" || subpath === url.pathname) {
    return new Response(JSON.stringify({ error: "Missing path" }), withCors({
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" }
    }));
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" }), withCors({
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" }
    }));
  }

  const target = new URL(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${subpath}`);
  for (const [k, v] of url.searchParams.entries()) target.searchParams.append(k, v);

  const incomingHeaders = new Headers(req.headers);
  const outgoing = new Headers();
  const ct = incomingHeaders.get("content-type");
  if (ct) outgoing.set("content-type", ct);
  const incomingAuth = incomingHeaders.get("authorization");
  if (incomingAuth) { outgoing.set("authorization", incomingAuth); }
  else { outgoing.set("authorization", `Bearer ${SUPABASE_ANON_KEY}`); }
  outgoing.set("apikey", SUPABASE_ANON_KEY);
  outgoing.set("x-client-info", "mmc-mms/edge-proxy");

  let body = undefined;
  if (!["GET", "HEAD"].includes(req.method)) { body = req.body; }

  let resp;
  try {
    resp = await fetch(target.toString(), { method: req.method, headers: outgoing, body, redirect: "follow" });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Upstream fetch failed", details: String(e) }), withCors({
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8" }
    }));
  }

  const resHeaders = new Headers(resp.headers);
  for (const [k, v] of Object.entries(corsHeaders)) resHeaders.set(k, v);
  return new Response(resp.body, { status: resp.status, headers: resHeaders });
}
