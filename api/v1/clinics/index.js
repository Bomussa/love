const { getDb } = require('../../_lib/supabase');
const { json, handleOptions } = require('../../_lib/http');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { success: false, error: 'Method Not Allowed' });

  try {
    const db = getDb();
    const { data, error } = await db
      .from('clinics')
      .select('id,name_ar,name_en,is_active,display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    const clinics = (data || []).map((c) => ({
      id: c.id,
      name: c.name_en || c.name_ar || c.id,
      name_ar: c.name_ar,
      name_en: c.name_en,
      status: c.is_active ? 'open' : 'closed',
    }));

    return json(res, 200, { success: true, data: clinics });
  } catch (error) {
    return json(res, 500, { success: false, error: error.message || 'clinics_failed' });
  }
};
