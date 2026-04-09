// lib/settings.js - خدمة إدارة إعدادات النظام
import db from './supabase-client.js';

/**
 * جلب قيمة إعداد من قاعدة البيانات
 * @param {string} key - مفتاح الإعداد
 * @param {string} fallback - القيمة الافتراضية
 * @returns {Promise<string>} قيمة الإعداد
 */
export async function getSetting(key, fallback = '') {
  try {
    const { data, error } = await db
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    
    if (error) throw error;
    return data?.value ?? fallback;
  } catch (error) {
    return fallback;
  }
}

/**
 * تحديث قيمة إعداد في قاعدة البيانات
 * @param {string} key - مفتاح الإعداد
 * @param {string} value - القيمة الجديدة
 * @returns {Promise<boolean>} نجح التحديث أم لا
 */
export async function setSetting(key, value) {
  try {
    const { error } = await db
      .from('system_settings')
      .upsert({ 
        key, 
        value, 
        updated_at: new Date().toISOString() 
      }, { onConflict: 'key' });
    
    return !error;
  } catch (error) {
    return false;
  }
}

/**
 * جلب جميع الإعدادات
 * @returns {Promise<Object>} كائن يحتوي على جميع الإعدادات
 */
export async function getAllSettings() {
  try {
    const { data, error } = await db
      .from('system_settings')
      .select('key, value, description')
      .order('key');

    if (error) throw error;

    const settings = {};
    data.forEach((row) => {
      settings[row.key] = {
        value: row.value,
        description: row.description,
      };
    });

    return settings;
  } catch (error) {
    return {};
  }
}

/**
 * جلب الإعدادات الأساسية للنظام
 * @returns {Promise<Object>} الإعدادات الأساسية
 */
export async function getSystemConfig() {
  try {
    const graceMinutes = await getSetting('grace_minutes', '5');
    const cadenceMinutes = await getSetting('admission_cadence_minutes', '1');
    const maxCapacity = await getSetting('max_capacity_per_clinic', '6');
    const autoRouting = await getSetting('enable_auto_routing', 'true');
    const notifications = await getSetting('enable_notifications', 'true');
    const workingHoursStart = await getSetting('working_hours_start', '07:00');
    const workingHoursEnd = await getSetting('working_hours_end', '15:00');

    return {
      graceMinutes: parseInt(graceMinutes, 10),
      cadenceMinutes: parseInt(cadenceMinutes, 10),
      maxCapacity: parseInt(maxCapacity, 10),
      autoRouting: autoRouting === 'true',
      notifications: notifications === 'true',
      workingHours: {
        start: workingHoursStart,
        end: workingHoursEnd,
      }
    };
  } catch (error) {
    return {
      graceMinutes: 5,
      cadenceMinutes: 1,
      maxCapacity: 6,
      autoRouting: true,
      notifications: true,
      workingHours: {
        start: '07:00',
        end: '15:00',
      }
    };
  }
}

/**
 * تحديث إعدادات متعددة دفعة واحدة
 * @param {Object} settings - كائن يحتوي على الإعدادات المراد تحديثها
 * @returns {Promise<boolean>} نجح التحديث أم لا
 */
export async function updateSettings(settings) {
  try {
    const updates = Object.entries(settings).map(([key, value]) => ({
      key,
      value: String(value),
      updated_at: new Date().toISOString()
    }));

    const { error } = await db
      .from('system_settings')
      .upsert(updates, { onConflict: 'key' });

    return !error;
  } catch (error) {
    return false;
  }
}

/**
 * التحقق من أن النظام يعمل في ساعات العمل
 * @returns {Promise<boolean>} هل النظام يعمل الآن
 */
export async function isWorkingHours() {
  try {
    const config = await getSystemConfig();
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM

    return currentTime >= config.workingHours.start
           && currentTime <= config.workingHours.end;
  } catch (error) {
    return true; // افتراضياً نعتبر أنه وقت عمل
  }
}

/**
 * جلب إعدادات الثيمات
 * @returns {Promise<Object>} إعدادات الثيمات
 */
export async function getThemeSettings() {
  try {
    const currentTheme = await getSetting('current_theme', 'medical-professional');
    const enableThemeSelector = await getSetting('enable_theme_selector', 'true');
    const showThemePreview = await getSetting('show_theme_preview', 'true');

    return {
      currentTheme,
      enableThemeSelector: enableThemeSelector === 'true',
      showThemePreview: showThemePreview === 'true',
    };
  } catch (error) {
    return {
      currentTheme: 'medical-professional',
      enableThemeSelector: true,
      showThemePreview: true,
    };
  }
}

/**
 * تحديث إعدادات الثيمات
 * @param {Object} themeSettings - إعدادات الثيمات الجديدة
 * @returns {Promise<boolean>} نجح التحديث أم لا
 */
export async function updateThemeSettings(themeSettings) {
  try {
    const updates = {};

    if (themeSettings.currentTheme) {
      updates.current_theme = themeSettings.currentTheme;
    }

    if (typeof themeSettings.enableThemeSelector === 'boolean') {
      updates.enable_theme_selector = themeSettings.enableThemeSelector.toString();
    }

    if (typeof themeSettings.showThemePreview === 'boolean') {
      updates.show_theme_preview = themeSettings.showThemePreview.toString();
    }

    return await updateSettings(updates);
  } catch (error) {
    return false;
  }
}

export default {
  getSetting,
  setSetting,
  getAllSettings,
  getSystemConfig,
  updateSettings,
  isWorkingHours,
  getThemeSettings,
  updateThemeSettings,
};
