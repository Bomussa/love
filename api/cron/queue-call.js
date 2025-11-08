// api/cron/queue-call.js
const { createClient } = require('@supabase/supabase-js');

function unauthorized(res) {
  return res.status(401).json({ ok: false, error: 'unauthorized' });
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase configuration');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

module.exports = async function handler(req, res) {
  const k = req.headers['x-cron-key'] || req.query.key;
  if (!process.env.CRON_SECRET || k !== process.env.CRON_SECRET) {
    return unauthorized(res);
  }

  try {
    // SQL function queue_call_engine_tick() تُنفّذ من داخل القاعدة
    const sb = supabaseAdmin();
    const { data, error } = await sb.rpc('queue_call_engine_tick');
    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.status(200).json({ ok: true, ran: 'queue_call_engine_tick', data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};
