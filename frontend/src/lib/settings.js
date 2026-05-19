// lib/settings.js - خدمة إدارة إعدادات النظام (Supabase-first)
import { supabase } from './supabase-client';

async function upsertSetting(key, value) {
  const payload = {
    key,
    value: String(value),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('system_settings')
    .upsert(payload, { onConflict: 'key' });

  if (error) throw error;
}

export async function getSetting(key, fallback = '') {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) throw error;
    return data?.value ?? fallback;
  } catch {
    return fallback;
  }
}

export async function setSetting(key, value) {
  try {
    await upsertSetting(key, value);
    return true;
  } catch {
    return false;
  }
}

export async function getAllSettings() {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('key, value, description')
      .order('key', { ascending: true });

    if (error) throw error;

    const settings = {};
    (data || []).forEach((row) => {
      settings[row.key] = {
        value: row.value,
        description: row.description,
      };
    });

    return settings;
  } catch {
    return {};
  }
}

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
      graceMinutes: parseInt(graceMinutes, 10),
      cadenceMinutes: parseInt(cadenceMinutes, 10),
      maxCapacity: parseInt(maxCapacity, 10),
      autoRouting: autoRouting === 'true',
      notifications: notifications === 'true',
      workingHours: {
        start: workingHoursStart,
        end: workingHoursEnd,
      },
      emergencyPin,
    };
  } catch {
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

export async function updateSettings(settings) {
  try {
    const entries = Object.entries(settings || {});
    for (const [key, value] of entries) {
      await upsertSetting(key, value);
    }
    return true;
  } catch {
    return false;
  }
}

export async function isWorkingHours() {
  try {
    const config = await getSystemConfig();
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    return currentTime >= config.workingHours.start
           && currentTime <= config.workingHours.end;
  } catch {
    return true;
  }
}

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
  } catch {
    return {
      currentTheme: 'medical-professional',
      enableThemeSelector: true,
      showThemePreview: true,
    };
  }
}

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
  } catch {
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
