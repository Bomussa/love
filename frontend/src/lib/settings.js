// lib/settings.js - خدمة إدارة إعدادات النظام
import { apiClient } from "@/lib/api/client";

// Local cache for settings
let _settingsCache = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Normalize settings data structure
 */
function normalizeSettings(data) {
  if (!data) return {};
  
  // If data has a settings property, unwrap it
  if (data.settings && typeof data.settings === 'object') {
    return data.settings;
  }
  
  return data;
}

/**
 * جلب قيمة إعداد من قاعدة البيانات
 * @param {string} key - مفتاح الإعداد
 * @param {string} fallback - القيمة الافتراضية
 * @returns {Promise<string>} قيمة الإعداد
 */
export async function getSetting(key, fallback = '') {
  try {
    // Try to get from cache first
    const allSettings = await getAllSettings();
    
    if (allSettings[key]) {
      const value = allSettings[key].value || allSettings[key];
      return String(value);
    }
    
    return fallback;
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
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
    // Update via API if available
    const result = await apiClient.post('updateSetting', {
      key,
      value: String(value)
    });
    
    // Clear cache
    _settingsCache = null;
    _cacheTime = 0;
    
    return result && result.success !== false;
  } catch (error) {
    console.error(`Error setting ${key}:`, error);
    return false;
  }
}

/**
 * جلب جميع الإعدادات
 * @returns {Promise<Object>} كائن يحتوي على جميع الإعدادات
 */
export async function getAllSettings() {
  try {
    const now = Date.now();
    
    // Return cached settings if still valid
    if (_settingsCache && (now - _cacheTime) < CACHE_TTL) {
      return _settingsCache;
    }

    // Try to fetch from API
    try {
      const data = await apiClient.get('settings');
      const normalized = normalizeSettings(data);
      
      const settings = {};
      if (Array.isArray(normalized)) {
        normalized.forEach((item) => {
          if (item.key) {
            settings[item.key] = {
              value: item.value,
              description: item.description,
            };
          }
        });
      } else if (typeof normalized === 'object') {
        Object.keys(normalized).forEach((key) => {
          settings[key] = {
            value: normalized[key],
            description: '',
          };
        });
      }
      
      _settingsCache = settings;
      _cacheTime = now;
      
      return settings;
    } catch (apiError) {
      console.warn('Failed to fetch settings from API, using defaults:', apiError);
      // Return default settings
      return getDefaultSettings();
    }
  } catch (error) {
    console.error('Error getting all settings:', error);
    return getDefaultSettings();
  }
}

/**
 * Get default settings
 */
function getDefaultSettings() {
  return {
    grace_minutes: { value: '5', description: 'Grace period in minutes' },
    admission_cadence_minutes: { value: '1', description: 'Admission cadence in minutes' },
    max_capacity_per_clinic: { value: '6', description: 'Max capacity per clinic' },
    enable_auto_routing: { value: 'true', description: 'Enable auto routing' },
    enable_notifications: { value: 'true', description: 'Enable notifications' },
    working_hours_start: { value: '07:00', description: 'Working hours start' },
    working_hours_end: { value: '15:00', description: 'Working hours end' },
    emergency_pin: { value: '999', description: 'Emergency PIN' },
    current_theme: { value: 'medical-professional', description: 'Current theme' },
    enable_theme_selector: { value: 'true', description: 'Enable theme selector' },
    show_theme_preview: { value: 'true', description: 'Show theme preview' },
  };
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
    const emergencyPin = await getSetting('emergency_pin', '999');

    return {
      graceMinutes: parseInt(graceMinutes, 10) || 5,
      cadenceMinutes: parseInt(cadenceMinutes, 10) || 1,
      maxCapacity: parseInt(maxCapacity, 10) || 6,
      autoRouting: autoRouting === 'true',
      notifications: notifications === 'true',
      workingHours: {
        start: workingHoursStart,
        end: workingHoursEnd,
      },
      emergencyPin,
    };
  } catch (error) {
    console.error('Error getting system config:', error);
    return {
      graceMinutes: 5,
      cadenceMinutes: 1,
      maxCapacity: 6,
      autoRouting: true,
      notifications: true,
      workingHours: {
        start: '07:00',
        end: '15:00',
      },
      emergencyPin: '999',
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
    // Update via API if available
    const result = await apiClient.post('updateSettings', settings);
    
    // Clear cache
    _settingsCache = null;
    _cacheTime = 0;
    
    return result && result.success !== false;
  } catch (error) {
    console.error('Error updating settings:', error);
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
    console.error('Error checking working hours:', error);
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
    console.error('Error getting theme settings:', error);
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
    console.error('Error updating theme settings:', error);
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
