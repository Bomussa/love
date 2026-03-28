const { getDb } = require('../../_lib/supabase');
const { json, handleOptions } = require('../../_lib/http');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Method Not Allowed' });

  const body = req.body || {};
  const clinicId = body.clinicId || body.clinic_id;
  const patientId = body.patientId || body.patient_id;
  const patientName = body.patientName || body.patient_name || patientId;
  const examType = body.examType || body.exam_type || 'general';
  const gender = body.gender === 'female' ? 'female' : 'male';

  if (!clinicId || !patientId) return json(res, 400, { success: false, error: 'clinicId and patientId required' });

  try {
    const db = getDb();

    // Ensure patient exists for FK integrity
    await db.from('patients').upsert({ id: patientId, gender }, { onConflict: 'id' });

    const { data: last, error: lastError } = await db
      .from('queues')
      .select('display_number')
      .eq('clinic_id', clinicId)
      .order('display_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastError) throw lastError;
    const nextNumber = (last?.display_number || 0) + 1;

    const { data, error } = await db.from('queues').insert({
      clinic_id: clinicId,
      patient_id: patientId,
      display_number: nextNumber,
      status: 'waiting',
    }).select('clinic_id,patient_id,display_number,status').single();

    if (error) throw error;

    return json(res, 200, {
      success: true,
      data: {
        clinicId: data.clinic_id,
        patientId: data.patient_id,
        patientName,
        examType,
        position: data.display_number,
        status: data.status,
      },
    });
  } catch (error) {
    return json(res, 500, { success: false, error: error.message || 'queue_enter_failed' });
  }
};
