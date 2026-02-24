/**
 * MMC Self-Healing System - Constants
 * Configuration values for all self-healing components
 */

// Health Monitor Configuration
export const HEALTH_MONITOR_CONFIG = {
  // Check intervals (milliseconds)
  CHECK_INTERVALS: {
    FRONTEND: 5000,    // 5 seconds
    API: 10000,        // 10 seconds
    DATABASE: 15000,   // 15 seconds
    REALTIME: 5000,    // 5 seconds
  },
  
  // Timeouts (milliseconds)
  TIMEOUTS: {
    API: 5000,         // 5 seconds
    DATABASE: 5000,    // 5 seconds
    REALTIME: 10000,   // 10 seconds
  },
  
  // Status thresholds
  DEGRADED_THRESHOLD: 2,  // Number of failures before DEGRADED
  FAIL_THRESHOLD: 5,      // Number of failures before FAIL
};

// Request Manager Configuration
export const REQUEST_MANAGER_CONFIG = {
  timeoutMs: 8000,
  maxRetries: 3,
  baseBackoffMs: 400,
  maxBackoffMs: 5000,
  breakerOpenMs: 30000,
  breakerFailThreshold: 5,  // failures per 60 seconds
  breakerWindowMs: 60000,
};

// Realtime Manager Configuration
export const REALTIME_CONFIG = {
  heartbeatTimeoutSec: 25,
  resubscribeMaxAttempts: 6,
  pollingIntervalMs: 3500,
  stabilityThresholdMs: 30000,  // Return to realtime after 30s stable
};

// Recovery Playbook Configuration
export const RECOVERY_CONFIG = {
  // Soft reload
  softReload: {
    maxPerSession: 1,
    tokenPrefix: 'sh_reload_',
  },
  
  // Hard refresh (last resort)
  hardRefresh: {
    maxPerSession: 1,
    tokenKey: 'sh_hard_refresh_done',
  },
  
  // Backoff delays for realtime resubscribe
  resubscribeBackoffMs: [1000, 2000, 4000, 8000, 16000, 32000],
  
  // Read-only mode
  readOnlyMode: {
    activationDelayMs: 30000,  // Enter after 30s API down
    healthCheckIntervalMs: 10000,
  },
  
  // Notification dedup
  notificationDedup: {
    windowMs: 5000,      // 5 second dedup window
    cleanupIntervalMs: 10000,
  },
  
  // Cache clearing
  cacheClear: {
    protectedKeys: [
      'mmc_auth_session',
      'mmc_admin_session',
      'mmc_clinic_session',
      'patientData',
      'selectedTheme',
      'language',
      'mmc_device_id',
      'mmc_activity_log',
    ],
    protectedPrefixes: ['sh_reload_', 'sh_hard_refresh_', 'mmc_safe_mode'],
  },
};

// Safe Mode Configuration
export const SAFE_MODE_CONFIG = {
  settingsKey: 'safe_mode_enabled',
  
  // Features disabled in safe mode
  disabledFeatures: [
    'stats_panels',
    'theme_selector',
    'advanced_reports',
    'content_editing',
    'analytics',
    'export_advanced',
  ],
  
  // Features preserved in safe mode (critical)
  preservedFeatures: [
    'queue_management',
    'patient_flow',
    'notifications',
    'basic_admin',
    'pin_management',
  ],
};

// Repair Log Configuration
export const REPAIR_LOG_CONFIG = {
  activityType: 'SELF_HEALING_ACTION',
  maxLocalLogs: 1000,
  exportBatchSize: 500,
};

// Status Levels
export const STATUS = {
  OK: 'OK',
  DEGRADED: 'DEGRADED',
  FAIL: 'FAIL',
};

// Severity Levels
export const SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
};

// Module Names
export const MODULES = {
  FRONTEND: 'frontend',
  API: 'api',
  DATABASE: 'database',
  REALTIME: 'realtime',
  NOTIFICATIONS: 'notifications',
  I18N: 'i18n',
  CACHE: 'cache',
};

// Playbook Names
export const PLAYBOOKS = {
  SOFT_RELOAD: 'softReloadOnce',
  HARD_REFRESH: 'hardRefresh',
  RESET_REALTIME: 'resetRealtimeSubscribe',
  API_RETRY: 'apiRetryWithBackoff',
  SAFE_CACHE_CLEAR: 'safeCacheClear',
  READ_ONLY_MODE: 'enterReadOnlyMode',
  EXIT_READ_ONLY: 'exitReadOnlyMode',
  I18N_REPAIR: 'i18nCacheRepair',
  NOTIFICATION_DEDUP: 'notificationDedupRepair',
};

// Error Signatures (for pattern matching)
export const ERROR_SIGNATURES = {
  // Frontend
  REACT_ERROR: 'REACT_ERROR',
  MEMORY_EXHAUSTED: 'MEMORY_EXHAUSTED',
  INFINITE_LOOP: 'INFINITE_LOOP',
  
  // API
  API_TIMEOUT: 'API_TIMEOUT',
  API_5XX: 'API_5XX',
  API_NETWORK_ERROR: 'API_NETWORK_ERROR',
  CIRCUIT_OPEN: 'CIRCUIT_OPEN',
  
  // Database
  DB_CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
  DB_QUERY_TIMEOUT: 'DB_QUERY_TIMEOUT',
  
  // Realtime
  WS_DISCONNECT: 'WS_DISCONNECT',
  WS_DISCONNECT_25S: 'WS_DISCONNECT_25S',
  HEARTBEAT_TIMEOUT: 'HEARTBEAT_TIMEOUT',
  
  // Notifications
  NOTIFICATION_DUPLICATE: 'NOTIFICATION_DUPLICATE',
  NOTIFICATION_STORM: 'NOTIFICATION_STORM',
  
  // I18n
  I18N_MISSING_KEY: 'I18N_MISSING_KEY',
  I18N_LOAD_FAILED: 'I18N_LOAD_FAILED',
  
  // Cache
  CACHE_CORRUPTION: 'CACHE_CORRUPTION',
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
};

// i18n Keys for self-healing UI
export const I18N_KEYS = {
  SELF_HEALING_CENTER: 'selfHealing.center',
  HEALTH_STATUS: 'selfHealing.healthStatus',
  AUTO_REPAIR: 'selfHealing.autoRepair',
  SAFE_MODE: 'selfHealing.safeMode',
  READ_ONLY_BANNER: 'selfHealing.readOnlyBanner',
  SAFE_MODE_BANNER: 'selfHealing.safeModeBanner',
  RECOVERY_IN_PROGRESS: 'selfHealing.recoveryInProgress',
  RECOVERY_SUCCESS: 'selfHealing.recoverySuccess',
  RECOVERY_FAILED: 'selfHealing.recoveryFailed',
  CONTACT_ADMIN: 'selfHealing.contactAdmin',
  
  // Status
  STATUS_OK: 'selfHealing.status.ok',
  STATUS_DEGRADED: 'selfHealing.status.degraded',
  STATUS_FAIL: 'selfHealing.status.fail',
  
  // Playbooks
  PLAYBOOK_SOFT_RELOAD: 'selfHealing.playbook.softReload',
  PLAYBOOK_RESET_REALTIME: 'selfHealing.playbook.resetRealtime',
  PLAYBOOK_CLEAR_CACHE: 'selfHealing.playbook.clearCache',
  PLAYBOOK_FIX_NOTIFICATIONS: 'selfHealing.playbook.fixNotifications',
};

// Default translations (Arabic)
export const DEFAULT_TRANSLATIONS = {
  ar: {
    [I18N_KEYS.SELF_HEALING_CENTER]: 'مركز الإصلاح الذاتي',
    [I18N_KEYS.HEALTH_STATUS]: 'حالة النظام',
    [I18N_KEYS.AUTO_REPAIR]: 'الإصلاح التلقائي',
    [I18N_KEYS.SAFE_MODE]: 'وضع الأمان',
    [I18N_KEYS.READ_ONLY_BANNER]: 'وضع القراءة فقط - Limited Mode',
    [I18N_KEYS.SAFE_MODE_BANNER]: 'وضع الأمان مفعل - Safe Mode Active',
    [I18N_KEYS.RECOVERY_IN_PROGRESS]: 'جاري الإصلاح...',
    [I18N_KEYS.RECOVERY_SUCCESS]: 'تم الإصلاح بنجاح',
    [I18N_KEYS.RECOVERY_FAILED]: 'فشل الإصلاح',
    [I18N_KEYS.CONTACT_ADMIN]: 'يرجى التواصل مع الإدارة',
    [I18N_KEYS.STATUS_OK]: 'يعمل',
    [I18N_KEYS.STATUS_DEGRADED]: 'محدود',
    [I18N_KEYS.STATUS_FAIL]: 'متوقف',
    [I18N_KEYS.PLAYBOOK_SOFT_RELOAD]: 'إعادة تحميل الواجهة',
    [I18N_KEYS.PLAYBOOK_RESET_REALTIME]: 'إعادة الاتصال بالخادم',
    [I18N_KEYS.PLAYBOOK_CLEAR_CACHE]: 'مسح الذاكرة المؤقتة',
    [I18N_KEYS.PLAYBOOK_FIX_NOTIFICATIONS]: 'إصلاح الإشعارات',
  },
  en: {
    [I18N_KEYS.SELF_HEALING_CENTER]: 'Self-Healing Center',
    [I18N_KEYS.HEALTH_STATUS]: 'System Health',
    [I18N_KEYS.AUTO_REPAIR]: 'Auto-Repair',
    [I18N_KEYS.SAFE_MODE]: 'Safe Mode',
    [I18N_KEYS.READ_ONLY_BANNER]: 'Read-Only Mode - Limited Mode',
    [I18N_KEYS.SAFE_MODE_BANNER]: 'Safe Mode Active',
    [I18N_KEYS.RECOVERY_IN_PROGRESS]: 'Recovery in progress...',
    [I18N_KEYS.RECOVERY_SUCCESS]: 'Recovery successful',
    [I18N_KEYS.RECOVERY_FAILED]: 'Recovery failed',
    [I18N_KEYS.CONTACT_ADMIN]: 'Please contact administrator',
    [I18N_KEYS.STATUS_OK]: 'Operational',
    [I18N_KEYS.STATUS_DEGRADED]: 'Degraded',
    [I18N_KEYS.STATUS_FAIL]: 'Down',
    [I18N_KEYS.PLAYBOOK_SOFT_RELOAD]: 'Reload Interface',
    [I18N_KEYS.PLAYBOOK_RESET_REALTIME]: 'Reconnect to Server',
    [I18N_KEYS.PLAYBOOK_CLEAR_CACHE]: 'Clear Cache',
    [I18N_KEYS.PLAYBOOK_FIX_NOTIFICATIONS]: 'Fix Notifications',
  },
};

export default {
  HEALTH_MONITOR_CONFIG,
  REQUEST_MANAGER_CONFIG,
  REALTIME_CONFIG,
  RECOVERY_CONFIG,
  SAFE_MODE_CONFIG,
  REPAIR_LOG_CONFIG,
  STATUS,
  SEVERITY,
  MODULES,
  PLAYBOOKS,
  ERROR_SIGNATURES,
  I18N_KEYS,
  DEFAULT_TRANSLATIONS,
};
