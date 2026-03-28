const { getDb } = require('../../_lib/supabase');
const { json, handleOptions } = require('../../_lib/http');

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { success: false, error: 'Method Not Allowed' });

  try {
    const db = getDb();
    const { data, error } = await db.from('system_settings').select('key,value');
    if (error) throw error;

    const settings = {};
    for (const row of data || []) {
      settings[row.key] = row.value;
    }

    return json(res, 200, { success: true, data: settings });
  } catch (error) {
    return json(res, 500, { success: false, error: error.message || 'settings_failed' });
  }
};
