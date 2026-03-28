const { getDb } = require('../../_lib/supabase');
const { json, handleOptions } = require('../../_lib/http');

function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Method Not Allowed' });

  const body = req.body || {};
  const clinicId = body.clinic_id || body.clinicId;
  if (!clinicId) return json(res, 400, { success: false, error: 'clinicId required' });

  try {
    const db = getDb();
    const pin = generatePin();
    const validUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { data, error } = await db.from('pins').insert({
      clinic_id: clinicId,
      pin,
      valid_until: validUntil,
    }).select('id,pin,valid_until').single();

    if (error) throw error;

    return json(res, 200, { success: true, data });
  } catch (error) {
    return json(res, 500, { success: false, error: error.message || 'pin_generate_failed' });
  }
};
