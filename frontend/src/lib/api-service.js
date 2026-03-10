/**
 * API Service - استدعاء الـ API الصحيح بدلاً من Supabase المباشر
 * هذا الملف يحتوي على جميع الدوال المطلوبة للتواصل مع الـ Backend
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';

// دالة عامة للتعامل مع الأخطاء
const handleApiError = (error) => {
  console.error('API Error:', error);
  throw new Error(error.message || 'خطأ في الاتصال بالخادم');
};

// ==================== Admin Management ====================

/**
 * إضافة مستخدم جديد
 */
export const addAdmin = async (adminData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/admins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      },
      body: JSON.stringify(adminData)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'فشل إضافة المستخدم');
    return data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * الحصول على قائمة المستخدمين
 */
export const getAdmins = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/admins`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'فشل في جلب المستخدمين');
    return data.data || [];
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * تحديث بيانات المستخدم
 */
export const updateAdmin = async (adminId, updateData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/admins/${adminId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      },
      body: JSON.stringify(updateData)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'فشل تحديث المستخدم');
    return data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * حذف مستخدم
 */
export const deleteAdmin = async (adminId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/admins/${adminId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'فشل حذف المستخدم');
    return data;
  } catch (error) {
    handleApiError(error);
  }
};

// ==================== PIN Management ====================

/**
 * إضافة رقم سري جديد
 */
export const addPin = async (pinData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/pins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      },
      body: JSON.stringify(pinData)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'فشل إضافة الرقم السري');
    return data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * حذف رقم سري
 */
export const deletePin = async (pinId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/pins/${pinId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'فشل حذف الرقم السري');
    return data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * تحديث رقم سري
 */
export const updatePin = async (pinId, pinData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/pins/${pinId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      },
      body: JSON.stringify(pinData)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'فشل تحديث الرقم السري');
    return data;
  } catch (error) {
    handleApiError(error);
  }
};

// ==================== Clinic Management ====================

/**
 * الحصول على قائمة العيادات
 */
export const getClinics = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/clinics`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'فشل في جلب العيادات');
    return data.data || [];
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * إضافة عيادة جديدة
 */
export const addClinic = async (clinicData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clinics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      },
      body: JSON.stringify(clinicData)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'فشل إضافة العيادة');
    return data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * تحديث عيادة
 */
export const updateClinic = async (clinicId, clinicData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clinics/${clinicId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      },
      body: JSON.stringify(clinicData)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'فشل تحديث العيادة');
    return data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * حذف عيادة
 */
export const deleteClinic = async (clinicId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clinics/${clinicId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'فشل حذف العيادة');
    return data;
  } catch (error) {
    handleApiError(error);
  }
};

// ==================== Queue Management ====================

/**
 * الحصول على قائمة الطوابير
 */
export const getQueues = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/queues`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'فشل في جلب الطوابير');
    return data.data || [];
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * تحديث أولوية المريض
 */
export const updatePatientPriority = async (patientId, priority) => {
  try {
    const response = await fetch(`${API_BASE_URL}/patients/${patientId}/priority`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      },
      body: JSON.stringify({ priority })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'فشل تحديث الأولوية');
    return data;
  } catch (error) {
    handleApiError(error);
  }
};

// ==================== Activity Logging ====================

/**
 * تسجيل النشاط
 */
export const logActivity = async (actionType, description, metadata = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}/activity-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      },
      body: JSON.stringify({
        action_type: actionType,
        description,
        metadata,
        user_agent: navigator.userAgent
      })
    });

    const data = await response.json();
    if (!response.ok) console.warn('Failed to log activity:', data.error);
    return data;
  } catch (error) {
    console.error('Activity logging error:', error);
  }
};

// ==================== System Health ====================

/**
 * فحص صحة النظام
 */
export const getSystemHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET'
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Health check error:', error);
    return { status: 'error', ok: false };
  }
};

/**
 * تشغيل فحص QA العميق
 */
export const runDeepQA = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/qa/deep_run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'فشل فحص QA');
    return data;
  } catch (error) {
    handleApiError(error);
  }
};

export default {
  addAdmin,
  getAdmins,
  updateAdmin,
  deleteAdmin,
  addPin,
  deletePin,
  updatePin,
  getClinics,
  addClinic,
  updateClinic,
  deleteClinic,
  getQueues,
  updatePatientPriority,
  logActivity,
  getSystemHealth,
  runDeepQA
};
