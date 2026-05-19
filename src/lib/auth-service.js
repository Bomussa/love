/**
 * @file auth-service.js
 * @description طبقة مصادقة موحّدة — تُغلّف منطق تسجيل الدخول لكل الأدوار.
 */

import { supabase } from './supabase-client';

/**
 * خدمة المصادقة الموحّدة
 * @namespace authService
 */
const authService = {
  /**
   * تسجيل دخول الطبيب.
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{success:boolean, data?:object, error?:string}>}
   */
  async doctorLogin(username, password) {
    const { data, error } = await supabase.rpc('doctor_login', {
      p_username: username,
      p_password: password
    });
    if (error) return { success: false, data: null, role: null, error: { code: 'AUTH_RPC_ERROR', message: error.message } };
    if (!data?.success || !data?.data) return { success: false, data: null, role: null, error: { code: 'INVALID_CREDENTIALS', message: data?.message || data?.error || 'invalid_credentials' } };
    return { success: true, data: data.data, role: data.data.role || 'DOCTOR', error: null };
  },

  /**
   * تسجيل دخول المشرف من جدول admins.
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{success:boolean, data?:object, error?:string}>}
   */
  async adminLogin(username, password) {
    const { data, error } = await supabase.rpc('admin_login', {
      p_username: String(username || '').trim().toLowerCase(),
      p_password: String(password || '').trim()
    });

    if (error) return { success: false, data: null, role: null, error: { code: 'AUTH_RPC_ERROR', message: error.message } };
    if (!data?.success || !data?.data) {
      return { success: false, data: null, role: null, error: { code: 'INVALID_CREDENTIALS', message: data?.message || data?.error || 'invalid_credentials' } };
    }

    return { success: true, data: data.data, role: data.data.role || 'ADMIN', error: null };
  },

  /** تسجيل خروج — تنظيف localStorage. */
  logout() {
    ['mmc_admin_session', 'mmc_doctor_session', 'mmc_clinic_session', 'patientData']
      .forEach(k => localStorage.removeItem(k));
    return { success: true, data: { loggedOut: true }, error: null };
  }
};

export default authService;
