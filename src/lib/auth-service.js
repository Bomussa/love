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
    if (error) return { success: false, error: error.message };
    return data;
  },

  /**
   * تسجيل دخول المشرف من جدول admins.
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{success:boolean, data?:object, error?:string}>}
   */
  async adminLogin(username, password) {
    const { data, error } = await supabase
      .from('admins')
      .select('id, username, role, full_name, is_active')
      .eq('username', username)
      .eq('is_active', true)
      .single();

    if (error || !data) return { success: false, error: 'invalid_credentials' };

    // مقارنة plain-text (مؤقت — يجب الانتقال لـ bcrypt)
    const { data: passRow } = await supabase
      .from('admins')
      .select('password_hash')
      .eq('id', data.id)
      .single();

    if (passRow?.password_hash !== password) return { success: false, error: 'invalid_credentials' };

    await supabase.from('admins').update({ last_login: new Date().toISOString() }).eq('id', data.id);
    return { success: true, data };
  },

  /** تسجيل خروج — تنظيف localStorage. */
  logout() {
    ['mmc_admin_session', 'mmc_doctor_session', 'mmc_clinic_session', 'patientData']
      .forEach(k => localStorage.removeItem(k));
  }
};

export default authService;
