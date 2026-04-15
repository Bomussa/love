// pages/api/admin/settings.js - واجهة API لإدارة إعدادات النظام
import { 
  getAllSettings, 
  getSystemConfig, 
  updateSettings, 
  getThemeSettings, 
  updateThemeSettings 
} from '../../../lib/settings.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { type = 'all' } = req.query;

      if (type === 'system') {
        // جلب الإعدادات الأساسية للنظام
        const config = await getSystemConfig();
        return res.json({
          success: true,
          type: 'system',
          data: config,
          timestamp: new Date().toISOString()
        });

      } else if (type === 'theme') {
        // جلب إعدادات الثيمات
        const themeSettings = await getThemeSettings();
        return res.json({
          success: true,
          type: 'theme',
          data: themeSettings,
          timestamp: new Date().toISOString()
        });

      } else {
        // جلب جميع الإعدادات
        const allSettings = await getAllSettings();
        return res.json({
          success: true,
          type: 'all',
          data: allSettings,
          timestamp: new Date().toISOString()
        });
      }

    } else if (req.method === 'POST') {
      const { type = 'system', settings } = req.body;

      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Settings object is required'
        });
      }

      let updateResult;

      if (type === 'theme') {
        // تحديث إعدادات الثيمات
        updateResult = await updateThemeSettings(settings);
      } else {
        // تحديث الإعدادات العامة
        updateResult = await updateSettings(settings);
      }

      if (updateResult) {
        return res.json({
          success: true,
          type,
          message: 'تم تحديث الإعدادات بنجاح',
          updatedSettings: Object.keys(settings),
          timestamp: new Date().toISOString()
        });
      } else {
        return res.status(500).json({
          success: false,
          error: 'Failed to update settings'
        });
      }

    } else if (req.method === 'PUT') {
      // تحديث إعداد واحد
      const { key, value } = req.body;

      if (!key || value === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Key and value are required'
        });
      }

      const { setSetting } = await import('../../../lib/settings.js');
      const updateResult = await setSetting(key, String(value));

      if (updateResult) {
        return res.json({
          success: true,
          key,
          value,
          message: `تم تحديث ${key} بنجاح`,
          timestamp: new Date().toISOString()
        });
      } else {
        return res.status(500).json({
          success: false,
          error: 'Failed to update setting'
        });
      }

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    // console.error('Error in admin settings API:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}
