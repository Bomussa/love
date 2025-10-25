/**
 * MIGRATED TO SUPABASE
 * Health Status Endpoint
 * GET /api/v1/health/status
 */

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    // Check KV bindings
    const kvBound = [];
    if (env.KV_ADMIN) kvBound.push('KV_ADMIN');
    if (env.KV_PINS) kvBound.push('KV_PINS');
    if (env.KV_QUEUES) kvBound.push('KV_QUEUES');
    if (env.KV_EVENTS) kvBound.push('KV_EVENTS');
    if (env.KV_LOCKS) kvBound.push('KV_LOCKS');
    if (env.KV_CACHE) kvBound.push('KV_CACHE');

    // Check R2 bindings
    const r2Bound = [];
    if (env.R2_BUCKET_REPORTS) r2Bound.push('R2_BUCKET_REPORTS');

    // Check DO bindings
    const doBound = [];
    if (env.DO_ROUTER) doBound.push('DO_ROUTER');

    // Check environment variables
    const envOk = {
      PIN_SECRET: !!env.PIN_SECRET,
      NOTIFY_KEY: !!env.NOTIFY_KEY,
      JWT_SECRET: !!env.JWT_SECRET,
      TIMEZONE: env.TIMEZONE === 'Asia/Qatar',
      DB_URL: !!env.DB_URL
    };

    // Check WWW redirect
    const url = new URL(request.url);
    const wwwRedirect = url.hostname.startsWith('www.');

    const healthStatus = {
      pages_fullstack: true,
      functions_enabled: true,
      kv_bound: kvBound,
      r2_bound: r2Bound,
      do_bound: doBound,
      env_ok: envOk,
      www_redirect: wwwRedirect,
      rate_limit: {
        enabled: false,
        rpm: 60
      },
      edge_headers: {
        server: 'cloudflare',
        'cf-worker': true
      },
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(healthStatus, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

