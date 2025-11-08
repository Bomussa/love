// api/cron/daily-pin.js
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
  // حماية بسيطة حتى لا يستطيع أي أحد استدعاء الكرون
  const k = req.headers['x-cron-key'] || req.query.key;
  if (!process.env.CRON_SECRET || k !== process.env.CRON_SECRET) {
    return unauthorized(res);
  }

  try {
    const sb = supabaseAdmin();
    // SQL function generate_daily_pins(_for_date date DEFAULT current_date)
    const { data, error } = await sb.rpc('generate_daily_pins');
    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.status(200).json({ ok: true, ran: 'generate_daily_pins', data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};
