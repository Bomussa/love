// lib/settings.js - خدمة إدارة إعدادات النظام (Supabase-first)
import { supabase } from './supabase-client';

const DEFAULT_SETTINGS = {
  grace_minutes: '5',
  admission_cadence_minutes: '1',
  max_capacity_per_clinic: '6',
  enable_auto_routing: 'true',
  enable_notifications: 'true',
  working_hours_start: '07:00',
  working_hours_end: '15:00',
  emergency_pin: '999',
  current_theme: 'medical-professional',
  enable_theme_selector: 'true',
  show_theme_preview: 'true',
};

function normalizeError(error, context = 'settings') {
  if (!error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: `Unknown ${context} error`,
      context,
      originalError: null,
    };
  }

  return {
    code: error.code || error.status || 'SETTINGS_ERROR',
    message: error.message || `Failed ${context} operation`,
    details: error.details,
    hint: error.hint,
    context,
    originalError: error,
  };
}

function toNumber(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
}

function toStringValue(value, fallback) {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

async function upsertSetting(key, value) {
  const payload = {
    key,
    value: String(value),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('system_settings')
    .upsert(payload, { onConflict: 'key' });

  if (error) throw normalizeError(error, `upsert:${key}`);
}

export async function getSetting(key, fallback = '') {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) throw normalizeError(error, `get:${key}`);
    return toStringValue(data?.value, fallback);
  } catch {
    return toStringValue(fallback, '');
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

    if (error) throw normalizeError(error, 'list:all');

    const settings = {};
    (data || []).forEach((row) => {
      settings[row.key] = {
        value: toStringValue(row.value, ''),
        description: row.description || '',
      };
    });

    return settings;
  } catch {
    return {};
  }
}

export async function getSystemConfig() {
  const graceMinutes = await getSetting('grace_minutes', DEFAULT_SETTINGS.grace_minutes);
  const cadenceMinutes = await getSetting('admission_cadence_minutes', DEFAULT_SETTINGS.admission_cadence_minutes);
  const maxCapacity = await getSetting('max_capacity_per_clinic', DEFAULT_SETTINGS.max_capacity_per_clinic);
  const autoRouting = await getSetting('enable_auto_routing', DEFAULT_SETTINGS.enable_auto_routing);
  const notifications = await getSetting('enable_notifications', DEFAULT_SETTINGS.enable_notifications);
  const workingHoursStart = await getSetting('working_hours_start', DEFAULT_SETTINGS.working_hours_start);
  const workingHoursEnd = await getSetting('working_hours_end', DEFAULT_SETTINGS.working_hours_end);
  const emergencyPin = await getSetting('emergency_pin', DEFAULT_SETTINGS.emergency_pin);

  return {
    graceMinutes: toNumber(graceMinutes, 5),
    cadenceMinutes: toNumber(cadenceMinutes, 1),
    maxCapacity: toNumber(maxCapacity, 6),
    autoRouting: toBoolean(autoRouting, true),
    notifications: toBoolean(notifications, true),
    workingHours: {
      start: toStringValue(workingHoursStart, DEFAULT_SETTINGS.working_hours_start),
      end: toStringValue(workingHoursEnd, DEFAULT_SETTINGS.working_hours_end),
    },
    emergencyPin: toStringValue(emergencyPin, DEFAULT_SETTINGS.emergency_pin),
  };
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
  const currentTheme = await getSetting('current_theme', DEFAULT_SETTINGS.current_theme);
  const enableThemeSelector = await getSetting('enable_theme_selector', DEFAULT_SETTINGS.enable_theme_selector);
  const showThemePreview = await getSetting('show_theme_preview', DEFAULT_SETTINGS.show_theme_preview);

  return {
    currentTheme: toStringValue(currentTheme, DEFAULT_SETTINGS.current_theme),
    enableThemeSelector: toBoolean(enableThemeSelector, true),
    showThemePreview: toBoolean(showThemePreview, true),
  };
}

export async function updateThemeSettings(themeSettings = {}) {
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
