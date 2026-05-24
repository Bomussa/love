/**
 * Auth Service - Authentication System
 * Updated with canonical API-based authentication and robust error handling
 */

import api from './api-unified';
import { supabase } from './supabase-client';

function normalizeId(value) {
  return String(value || '').trim();
}

function makeLocalPatientLogin(patientId, gender) {
  const sessionId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return {
    success: true,
    data: {
      success: true,
      sessionId,
      session_id: sessionId,
      personalId: patientId,
      personal_id: patientId,
      patient_id: patientId,
      gender: gender || 'male',
      localFallback: true,
    },
    sessionId,
    session_id: sessionId,
    personalId: patientId,
    personal_id: patientId,
    patient_id: patientId,
    gender: gender || 'male',
  };
}

function buildQueuePosition(row, currentNumber = 0, ahead = 0, totalWaiting = 0) {
  if (!row) return null;
  return {
    success: true,
    id: row.id,
    display_number: row.display_number ?? row.queue_number_int ?? null,
    current_number: currentNumber,
    ahead,
    total_waiting: totalWaiting,
    entered_at: row.entered_at || row.created_at || null,
    status: row.status || 'waiting',
    data: row,
  };
}

const originalPatientLogin = api.patientLogin?.bind(api);
const originalEnterQueue = api.enterQueue?.bind(api);
const originalGetQueuePosition = api.getQueuePosition?.bind(api);
const originalCreateRoute = api.createRoute?.bind(api);
const originalGetRoute = api.getRoute?.bind(api);

api.patientLogin = async (patientId, gender) => {
  try {
    const response = await originalPatientLogin?.(patientId, gender);
    if (response?.success) return response;
  } catch (error) {
    console.warn('[auth-service] patientLogin failed, using local fallback:', error?.message || error);
  }
  return makeLocalPatientLogin(normalizeId(patientId), gender);
};

api.getQueuePosition = async (clinicId, patientId) => {
  try {
    const response = await originalGetQueuePosition?.(clinicId, patientId);
    if (response?.success) return response;
  } catch (error) {
    console.warn('[auth-service] getQueuePosition failed, using direct Supabase fallback:', error?.message || error);
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: row, error } = await supabase
    .from('unified_queue')
    .select('id, display_number, status, entered_at, created_at')
    .eq('clinic_id', normalizeId(clinicId))
    .eq('patient_id', normalizeId(patientId))
    .eq('queue_date', today)
    .not('status', 'eq', 'cancelled')
    .order('entered_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !row) {
    return { success: false, error: error?.message || 'Queue entry not found' };
  }

  const { data: serving } = await supabase
    .from('unified_queue')
    .select('display_number')
    .eq('clinic_id', normalizeId(clinicId))
    .eq('queue_date', today)
    .in('status', ['called', 'serving', 'in_progress'])
    .order('display_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: ahead } = await supabase
    .from('unified_queue')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', normalizeId(clinicId))
    .eq('queue_date', today)
    .in('status', ['waiting', 'called', 'serving', 'in_progress'])
    .lt('display_number', row.display_number);

  const { count: totalWaiting } = await supabase
    .from('unified_queue')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', normalizeId(clinicId))
    .eq('queue_date', today)
    .in('status', ['waiting', 'called', 'serving', 'in_progress']);

  return buildQueuePosition(row, serving?.display_number ?? 0, ahead ?? 0, totalWaiting ?? 0);
};

api.enterQueue = async (clinicId, patientId, isAutoEnter = true, patientName = null, examType = null, gender = null, militaryId = null, personalId = null) => {
  try {
    const response = await originalEnterQueue?.(clinicId, patientId, isAutoEnter, patientName, examType, gender, militaryId, personalId);
    if (response?.success) return response;
  } catch (error) {
    console.warn('[auth-service] enterQueue failed, using direct Supabase fallback:', error?.message || error);
  }

  const { data, error } = await supabase.rpc('enter_unified_queue_safe', {
    p_clinic_id: normalizeId(clinicId),
    p_patient_id: normalizeId(patientId, personalId),
    p_patient_name: patientName || normalizeId(patientId, personalId),
    p_exam_type: examType || 'GENERAL',
    p_gender: gender || 'male',
    p_military_id: normalizeId(militaryId, patientId),
    p_personal_id: normalizeId(personalId, patientId),
    p_force: false,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: data || {}, ...(data || {}) };
};

api.createRoute = async (patientId, examType, gender, stations) => {
  try {
    const response = await originalCreateRoute?.(patientId, examType, gender, stations);
    if (response?.success) return response;
  } catch (error) {
    console.warn('[auth-service] createRoute failed, using direct Supabase fallback:', error?.message || error);
  }

  if (!Array.isArray(stations) || stations.length === 0) {
    return { success: false, error: 'invalid route payload' };
  }

  const { data, error } = await supabase
    .from('patient_routes')
    .insert({
      patient_id: normalizeId(patientId),
      exam_type: examType || null,
      gender: gender || null,
      stations,
      current_station_index: 0,
      status: 'active',
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, route: data, data };
};

api.getRoute = async (patientId, routeId = null) => {
  try {
    const response = await originalGetRoute?.(patientId, routeId);
    if (response?.success) return response;
  } catch (error) {
    console.warn('[auth-service] getRoute failed, using direct Supabase fallback:', error?.message || error);
  }

  let query = supabase.from('patient_routes').select('*');
  if (routeId) {
    const { data, error } = await query.eq('id', routeId).maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: 'route not found' };
    return { success: true, route: data, data };
  }

  const { data, error } = await query
    .eq('patient_id', normalizeId(patientId))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'route not found' };
  return { success: true, route: data, data };
};

export const USER_ROLES = {
  SUPER_ADMIN: {
    id: 'SUPER_ADMIN',
    name: 'مدير النظام',
    nameEn: 'System Administrator',
    permissions: ['*']
  },
  ADMIN: {
    id: 'ADMIN',
    name: 'مدير',
    nameEn: 'Administrator',
    permissions: [
      'dashboard',
      'queue_management',
      'pin_management',
      'reports',
      'clinic_configuration',
      'settings',
      'user_management',
      'activity_logs'
    ]
  },
  DOCTOR: {
    id: 'DOCTOR',
    name: 'طبيب',
    nameEn: 'Doctor',
    permissions: [
      'dashboard',
      'queue_management',
      'clinic_only',
      'patient_view'
    ]
  },
  RECEPTIONIST: {
    id: 'RECEPTIONIST',
    name: 'موظف استقبال',
    nameEn: 'Receptionist',
    permissions: [
      'dashboard',
      'patient_registration',
      'queue_view',
      'reports_view'
    ]
  },
  VIEWER: {
    id: 'VIEWER',
    name: 'مشاهد',
    nameEn: 'Viewer',
    permissions: [
      'dashboard_view',
      'queue_view',
      'reports_view'
    ]
  }
};

class AuthService {
  constructor() {
    this.storageKey = 'mmc_admin_session';
    this.maxAttempts = 5;
    this.lockoutDuration = 5 * 60 * 1000;
    this.sessionTimeout = 60 * 60 * 1000;
    this.failedAttempts = new Map();
  }

  async login(username, password) {
    try {
      const response = await api.adminLogin(username, password);
      if (!response?.success || !response?.data) {
        throw new Error(response?.error || 'اسم المستخدم أو كلمة المرور غير صحيحة');
      }

      const session = this.createSession(
        response.data.username || response.data.name || username,
        response.data.role || 'ADMIN'
      );

      return { success: true, session };
    } catch (error) {
      console.error('[AuthService] Login error:', error);
      throw new Error(error.message || 'اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  }

  async doctorLogin(username, password) {
    try {
      const response = await api.doctorLogin(username, password);
      if (!response?.success || !response?.data) {
        throw new Error(response?.error || 'اسم المستخدم أو كلمة المرور غير صحيحة');
      }

      const session = this.createSession(
        response.data.username || response.data.name || username,
        'DOCTOR'
      );

      return { success: true, session };
    } catch (error) {
      console.error('[AuthService] Doctor login error:', error);
      throw new Error(error.message || 'اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  }

  createSession(username, role) {
    const session = {
      id: `sess_${Date.now()}`,
      username,
      role,
      name: username.toUpperCase(),
      loginTime: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.sessionTimeout).toISOString(),
    };
    this.saveSession(session);
    return session;
  }

  logout() {
    localStorage.removeItem(this.storageKey);
  }

  getSession() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return null;
      const session = JSON.parse(data);
      if (new Date(session.expiresAt) < new Date()) {
        this.logout();
        return null;
      }
      return session;
    } catch (e) { return null; }
  }

  saveSession(session) {
    localStorage.setItem(this.storageKey, JSON.stringify(session));
  }

  hasPermission(permission) {
    const session = this.getSession();
    if (!session) return false;

    const role = USER_ROLES[session.role];
    if (!role) return false;
    if (role.permissions.includes('*')) return true;

    return role.permissions.includes(permission);
  }

  hasAnyPermission(permissions) {
    return permissions.some(p => this.hasPermission(p));
  }

  hasAllPermissions(permissions) {
    return permissions.every(p => this.hasPermission(p));
  }

  getCurrentPermissions() {
    const session = this.getSession();
    if (!session) return [];

    const role = USER_ROLES[session.role];
    return role ? role.permissions : [];
  }

  isDoctor() {
    const session = this.getSession();
    return session && session.role === 'DOCTOR';
  }

  canAccessClinicOnly() {
    return this.hasPermission('clinic_only');
  }
}

const authService = new AuthService();
export default authService;
