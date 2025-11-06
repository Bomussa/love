/**
 * Admin System Settings Endpoint
 * GET/POST /api/v1/admin/system-settings
 * Manage all system timings, toggles, and display settings
 */

import SupabaseClient, { getSupabaseClient } from '../../../api/lib/supabase.js';
import { jsonResponse, corsResponse, validateRequiredFields } from '../../../_shared/utils.js';
import { logActivity } from '../../../_shared/activity-logger.js';

// القيم الافتراضية
const DEFAULT_SETTINGS = {
  // توقيتات النظام (بالثواني)
  queueIntervalSeconds: 120,        // 2 دقيقة للنداء التلقائي
  patientMaxWaitSeconds: 240,       // 4 دقائق للمراجع
  refreshIntervalSeconds: 30,       // تحديث البيانات
  nearTurnRefreshSeconds: 7,        // تحديث عند قرب الدور
  
  // تفعيل/تعطيل الأنظمة
  autoCallEnabled: true,            // النداء التلقائي
  timeoutHandlerEnabled: true,      // نقل المراجع بعد 4 دقائق
  notificationsEnabled: true,       // الإشعارات
  
  // إظهار/إخفاء للمراجعين
  showCountdownTimer: true,         // عرض العد التنازلي
  showQueuePosition: true,          // عرض الموقع في الدور
  showEstimatedWait: true,          // عرض الوقت المتوقع
  showAheadCount: true,             // عرض عدد المنتظرين قبله
  
  // إعدادات إضافية
  notifyNearAhead: 3,               // إشعار للـ3 التاليين
  pinLateMinutes: 5,                // مهلة تأخير PIN
  noticeTtlSeconds: 30              // مدة عرض الإشعار
};

export default async function handler(req, res) {
  try {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { getSettings, updateSettings } = SupabaseClient;
  const supabase = getSupabaseClient(process.env); // Use process.env for Vercel environment
  const SETTINGS_KEY = 'system:settings';

  if (req.method === 'GET') {
    try {
      // 1. جلب الإعدادات من Supabase
      const settingsEntry = await getSettings(supabase, SETTINGS_KEY);
      
      // 2. إذا لم توجد، استخدم القيم الافتراضية
      let settings = settingsEntry ? settingsEntry.value : DEFAULT_SETTINGS;
      
      return res.status(200).json({
        success: true,
        settings: settings
      });
      
    } catch (error) {
      console.error('Supabase GET Error:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message
      });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body;
      
      // 1. جلب الإعدادات الحالية (للتحديث الجزئي)
      const currentSettingsEntry = await getSettings(supabase, SETTINGS_KEY);
      const currentSettings = currentSettingsEntry ? currentSettingsEntry.value : DEFAULT_SETTINGS;

      // 2. دمج الإعدادات الجديدة مع الحالية
      const newSettings = { ...currentSettings, ...body };
      
      // 3. حفظ الإعدادات المحدثة في Supabase
      await updateSettings(supabase, SETTINGS_KEY, newSettings, 'admin');
      
      // 4. تسجيل النشاط
      // await logActivity(supabase, 'ADMIN', 'UPDATE_SETTINGS', `Updated system settings: ${JSON.stringify(body)}`);

      return res.status(200).json({
        success: true,
        message: 'System settings updated successfully',
        settings: newSettings
      });
      
    } catch (error) {
      console.error('Supabase POST Error:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message
      });
    }
  }

  return res.status(405).json({
    success: false,
    error: 'Method not allowed'
  });
}
