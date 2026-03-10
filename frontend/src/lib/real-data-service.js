/**
 * Real Data Service - خدمة جلب البيانات الحقيقية من Supabase
 * تستبدل جميع البيانات الوهمية (Mock Data) بالبيانات الحقيقية
 */

import { supabase } from './supabase-client';

class RealDataService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 دقائق
  }

  /**
   * جلب جميع العيادات
   */
  async getClinics() {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .order('name_ar', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ خطأ في جلب العيادات:', error);
      return [];
    }
  }

  /**
   * جلب عيادة محددة
   */
  async getClinic(clinicId) {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', clinicId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`❌ خطأ في جلب العيادة ${clinicId}:`, error);
      return null;
    }
  }

  /**
   * جلب الطوابير الحالية
   */
  async getCurrentQueues(clinicId = null) {
    try {
      const today = new Date().toISOString().split('T')[0];
      let query = supabase
        .from('unified_queue')
        .select('*')
        .eq('queue_date', today);

      if (clinicId) {
        query = query.eq('clinic_id', clinicId);
      }

      const { data, error } = await query.order('display_number', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ خطأ في جلب الطوابير:', error);
      return [];
    }
  }

  /**
   * جلب الأرقام السرية (PINs)
   */
  async getPins(clinicId = null) {
    try {
      let query = supabase.from('pins').select('*');

      if (clinicId) {
        query = query.eq('clinic_code', clinicId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ خطأ في جلب الأرقام السرية:', error);
      return [];
    }
  }

  /**
   * جلب المستخدمين (الإداريين)
   */
  async getAdmins() {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ خطأ في جلب المستخدمين:', error);
      return [];
    }
  }

  /**
   * جلب الإشعارات
   */
  async getNotifications(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ خطأ في جلب الإشعارات:', error);
      return [];
    }
  }

  /**
   * جلب التقارير اليومية
   */
  async getDailyReports(clinicId = null, date = null) {
    try {
      const reportDate = date || new Date().toISOString().split('T')[0];
      let query = supabase
        .from('daily_reports')
        .select('*')
        .eq('report_date', reportDate);

      if (clinicId) {
        query = query.eq('clinic_id', clinicId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ خطأ في جلب التقارير:', error);
      return [];
    }
  }

  /**
   * جلب سجلات النشاط
   */
  async getActivityLogs(limit = 100) {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ خطأ في جلب سجلات النشاط:', error);
      return [];
    }
  }

  /**
   * جلب إحصائيات النظام
   */
  async getSystemStatistics() {
    try {
      const today = new Date().toISOString().split('T')[0];

      // جلب عدد العيادات
      const { count: clinicsCount } = await supabase
        .from('clinics')
        .select('*', { count: 'exact', head: true });

      // جلب عدد المرضى اليوم
      const { count: patientsCount } = await supabase
        .from('unified_queue')
        .select('*', { count: 'exact', head: true })
        .eq('queue_date', today);

      // جلب عدد الزيارات المكتملة
      const { data: completedVisits } = await supabase
        .from('unified_queue')
        .select('*')
        .eq('queue_date', today)
        .eq('status', 'completed');

      // جلب عدد الإشعارات
      const { count: notificationsCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('created_at', `gte.${today}T00:00:00`);

      return {
        totalClinics: clinicsCount || 0,
        totalPatientsToday: patientsCount || 0,
        completedVisitsToday: completedVisits?.length || 0,
        totalNotifications: notificationsCount || 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ خطأ في جلب إحصائيات النظام:', error);
      return {
        totalClinics: 0,
        totalPatientsToday: 0,
        completedVisitsToday: 0,
        totalNotifications: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * جلب حالة النظام
   */
  async getSystemStatus() {
    try {
      const { data: config, error } = await supabase
        .from('system_config')
        .select('*');

      if (error) throw error;

      const status = {
        isOnline: true,
        lastCheck: new Date().toISOString(),
        config: config || [],
      };

      return status;
    } catch (error) {
      console.error('❌ خطأ في جلب حالة النظام:', error);
      return {
        isOnline: false,
        lastCheck: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  /**
   * جلب أنواع الفحوصات
   */
  async getExamTypes() {
    try {
      const { data, error } = await supabase
        .from('exam_types')
        .select('*')
        .order('name_ar', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ خطأ في جلب أنواع الفحوصات:', error);
      return [];
    }
  }

  /**
   * جلب المسارات (Routes)
   */
  async getRoutes() {
    try {
      const { data, error } = await supabase
        .from('routes')
        .select('*')
        .order('name_ar', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ خطأ في جلب المسارات:', error);
      return [];
    }
  }

  /**
   * جلب سجلات الأخطاء الذكية
   */
  async getSmartErrors(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('smart_errors_log')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ خطأ في جلب سجلات الأخطاء:', error);
      return [];
    }
  }

  /**
   * جلب سجلات الإصلاحات الذكية
   */
  async getSmartFixes(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('smart_fixes_log')
        .select('*')
        .order('applied_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ خطأ في جلب سجلات الإصلاحات:', error);
      return [];
    }
  }

  /**
   * جلب الملفات
   */
  async getFiles(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ خطأ في جلب الملفات:', error);
      return [];
    }
  }

  /**
   * مسح الذاكرة المؤقتة
   */
  clearCache() {
    this.cache.clear();
  }
}

export const realDataService = new RealDataService();

export default realDataService;
