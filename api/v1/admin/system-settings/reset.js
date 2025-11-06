/**
 * Admin System Settings Reset Endpoint
 * POST /api/v1/admin/system-settings/reset
 */

import SupabaseClient, { getSupabaseClient } from '../../../api/lib/supabase.js';
import { jsonResponse, corsResponse } from '../../../../_shared/utils.js';
import { logActivity } from '../../../../_shared/activity-logger.js';

// القيم الافتراضية (يجب أن تكون متطابقة مع system-settings.js)
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { updateSettings } = SupabaseClient;
    const supabase = getSupabaseClient(process.env); // Use process.env for Vercel environment
    const SETTINGS_KEY = 'system:settings';

    // 1. إعادة تعيين الإعدادات للقيم الافتراضية باستخدام updateSettings
    await updateSettings(supabase, SETTINGS_KEY, DEFAULT_SETTINGS, 'admin_reset');
    
    // 2. تسجيل النشاط
    // await logActivity(supabase, 'ADMIN', 'SETTINGS_RESET', 'System settings reset to defaults');
    
    return res.status(200).json({
      success: true,
      message: 'System settings reset to defaults successfully'
    });
    
  } catch (error) {
    console.error('Error in api/v1/admin/system-settings/reset.js:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
}
