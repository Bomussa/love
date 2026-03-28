const { getDb } = require('../../_lib/supabase');
const { json, handleOptions } = require('../../_lib/http');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { success: false, error: 'Method Not Allowed' });

  const clinicId = req.query.clinicId || req.query.clinic_id;
  if (!clinicId) return json(res, 400, { success: false, error: 'clinicId required' });

  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await db
      .from('queues')
      .select('patient_id,display_number,status,entered_at')
      .eq('clinic_id', clinicId)
      .gte('entered_at', `${today}T00:00:00.000Z`)
      .order('display_number', { ascending: true });

    if (error) throw error;

    const waiting = (data || []).filter((q) => q.status === 'waiting');
    const serving = (data || []).find((q) => q.status === 'serving');

    return json(res, 200, {
      success: true,
      data: {
        clinicId,
        queueLength: waiting.length,
        currentNumber: serving?.display_number || null,
        patients: waiting.map((q) => ({ patientId: q.patient_id, position: q.display_number })),
      },
    });
  } catch (error) {
    return json(res, 500, { success: false, error: error.message || 'queue_status_failed' });
  }
};
