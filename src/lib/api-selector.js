/**
 * src/lib/api-selector.js
 * نقطة التبديل الذكية بين API القديم والطبقة الوسطية
 * 
 * يستخدم Feature Flag للتحكم في المسار المستخدم
 * مما يسمح بالتبديل السلس بدون تعديل الكود
 */

import ApiService from './api.js';
import ApiMiddlewareAdapter from './api-middleware.js';

/**
 * التحقق من تفعيل الطبقة الوسطية
 */
function isMiddlewareEnabled() {
  // التحقق من متغير البيئة
  const envFlag = import.meta.env.VITE_FEATURE_MW_ENABLED;
  
  if (envFlag === 'true' || envFlag === true) {
    console.log('✅ Middleware V2 is ENABLED');
    return true;
  }
  
  console.log('ℹ️ Using legacy API (Middleware disabled)');
  return false;
}

/**
 * اختيار الـ API المناسب
 */
function selectApi() {
  if (isMiddlewareEnabled()) {
    return new ApiMiddlewareAdapter();
  } else {
    return new ApiService();
  }
}

// تصدير instance واحد
const api = selectApi();

export default api;
export { api };

