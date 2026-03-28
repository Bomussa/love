const { getDb } = require('../../_lib/supabase');
const { json, handleOptions } = require('../../_lib/http');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { success: false, error: 'Method Not Allowed' });

  const clinicId = req.query.clinicId || req.query.clinic_id;
  if (!clinicId) return json(res, 400, { success: false, error: 'clinicId required' });

  try {
    const db = getDb();
    const nowIso = new Date().toISOString();
    const { data, error } = await db
      .from('pins')
      .select('id,pin,valid_until,used_at,created_at')
      .eq('clinic_id', clinicId)
      .gt('valid_until', nowIso)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return json(res, 200, {
      success: true,
      data: {
        clinic_id: clinicId,
        has_active_pin: Boolean(data),
        pin: data?.pin || null,
        pin_id: data?.id || null,
        valid_until: data?.valid_until || null,
        checked_at: nowIso,
      },
    });
  } catch (error) {
    return json(res, 500, { success: false, error: error.message || 'pin_status_failed' });
  }
};
