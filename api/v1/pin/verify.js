const { getDb } = require('../../_lib/supabase');
const { json, handleOptions } = require('../../_lib/http');

async function verify(db, clinicId, pin) {
  const nowIso = new Date().toISOString();
  const { data, error } = await db
    .from('pins')
    .select('id,valid_until')
    .eq('clinic_id', clinicId)
    .eq('pin', pin)
    .gt('valid_until', nowIso)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Method Not Allowed' });

  const body = req.body || {};
  const clinicId = body.clinicId || body.clinic_id;
  const pin = String(body.pin || '').trim();
  if (!clinicId || !pin) return json(res, 400, { success: false, error: 'clinicId and pin required' });

  try {
    const db = getDb();
    const match = await verify(db, clinicId, pin);

    if (match) {
      await db.from('pins').update({ used_at: new Date().toISOString() }).eq('id', match.id);
    }

    const valid = Boolean(match);
    return json(res, 200, {
      success: true,
      data: { valid, verified: valid, isValid: valid },
    });
  } catch (error) {
    return json(res, 500, { success: false, error: error.message || 'pin_verify_failed' });
  }
};
