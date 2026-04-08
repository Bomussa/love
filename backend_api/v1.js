import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const url = req.url;
  const method = req.method;

  try {
    // HEALTH
    if (url.includes('/health')) {
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: 'v1-final-lock'
      });
    }

    // STATUS
    if (url.includes('/status')) {
      return res.status(200).json({
        service: 'love-api',
        version: 'v1-final-lock',
        uptime: process.uptime(),
      });
    }

    // ADMINS
    if (url.includes('/admins')) {
      let { data, error } = await supabase.from('admins').select('*');

      if (error && error.message.includes('clinic_id')) {
        const fallback = await supabase
          .from('admins')
          .select('id, name, role, created_at');

        if (fallback.error) {
          return res.status(500).json({ error: fallback.error.message });
        }
        return res.status(200).json(fallback.data);
      }

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json(data);
    }

    return res.status(404).json({
      error: 'Endpoint not found',
      path: url
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
