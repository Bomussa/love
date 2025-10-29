/**
 * services/config.ts
 * تحميل الإعدادات من متغيرات البيئة.
 */
export function getConfig() {
  return {
    MW_PORT: process.env.MW_PORT || '8080',
    MW_BASE_URL: process.env.MW_BASE_URL || 'http://localhost:8080',
    BE_BASE_URL: process.env.BE_BASE_URL || 'http://localhost:8787/api/v1',
    SSE_CHANNEL: process.env.SSE_CHANNEL || '/mw/admin/live'
  };
}
