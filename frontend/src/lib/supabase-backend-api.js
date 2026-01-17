/**
 * Supabase Backend API - REAL IMPLEMENTATION
 * تكامل حقيقي 100% مع Supabase بدون بيانات وهمية
 * Updated: Jan 6, 2026
 */

import { supabase } from './supabase-client';

// ==========================================
// HELPER FUNCTIONS
// ==========================================

async function invokeFunction(functionName, body) {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`[invokeFunction] ${functionName} error:`, error);
    throw error;
  }
}

// الحصول على تاريخ اليوم بتوقيت قطر
function getTodayDateKey() {
  const now = new Date();
  const qatarTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Qatar' }));
  return qatarTime.toISOString().split('T')[0];
}

// ==========================================
// PATIENT MANAGEMENT - حقيقي
// ==========================================

export async function patientLogin(patientId, gender) {
  try {
    // جلب إعدادات منع التكرار من Supabase
    const { data: settingsData } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['prevent_duplicate_patient_daily']);
    
    const settings = {};
    if (settingsData) {
      settingsData.forEach(s => { settings[s.key] = s.value; });
    }
    
    // التحقق من عدم تكرار الرقم العسكري/الشخصي في نفس اليوم (إذا كان مفعلاً)
    if (settings.prevent_duplicate_patient_daily !== false) {
      const todayStart = getTodayDateKey() + 'T00:00:00';
      const todayEnd = getTodayDateKey() + 'T23:59:59';
      
      const { data: existingEntry, error: checkError } = await supabase
        .from('queues')
        .select('id, patient_id, entered_at')
        .eq('patient_id', patientId)
        .gte('entered_at', todayStart)
        .lte('entered_at', todayEnd)
        .limit(1);
      
      if (checkError) {
        console.error('[patientLogin] Check error:', checkError);
      }
      
      if (existingEntry && existingEntry.length > 0) {
        return {
          success: false,
          error: 'ALREADY_REGISTERED_TODAY',
          message: 'هذا الرقم مسجل بالفعل اليوم. يمكنك الدخول لفحص جديد غداً.'
        };
      }
    }
    
    // استخدام API Router مباشرة
    const response = await fetch('https://rujwuruuosffcxazymit.supabase.co/functions/v1/api-router/patient/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ patientId, gender })
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Login failed');
    }

    return {
      success: true,
      data: {
        id: result.data.id,
        patientId: result.data.patientId,
        gender: result.data.gender,
        sessionId: result.data.sessionId,
        loginTime: result.data.loginTime,
        patient: result.data.patient
      }
    };
  } catch (error) {
    console.error('[patientLogin] Error:', error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// CLINICS MANAGEMENT - حقيقي
// ==========================================

export async function getClinics() {
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .eq('is_active', true)
      .order('name_ar', { ascending: true });

    if (error) throw error;
    return { success: true, clinics: data || [] };
  } catch (error) {
    console.error('[getClinics] Error:', error);
    return { success: false, error: error.message, clinics: [] };
   }
}

export async function getQueuePosition(clinicId, patientId) {
  try {
    // جلب موقع المريض في الطابور
    const { data: queueEntry, error } = await supabase
      .from('queues')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      .single();

    if (error) throw error;

    if (!queueEntry) {
      return {
        success: false,
        error: 'Not in queue'
      };
    }

    // حساب عدد المنتظرين قبله
    const { count, error: countError } = await supabase
      .from('queues')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('status', 'waiting')
      .lt('position', queueEntry.position);

    if (countError) throw countError;

    return {
      success: true,
      position: queueEntry.position,
      ahead: count || 0,
      status: queueEntry.status,
      display_number: queueEntry.display_number
    };
  } catch (error) {
    console.error('[getQueuePosition] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ==========================================
// QUEUE DONE - حقيقيحقيقي بالكامل
// ==========================================

export async function enterQueue(clinicId, patientId, patientName = 'مراجع') {
  try {
    // التحقق من عدم وجود المريض في الطابور بالفعل
    const { data: existing } = await supabase
      .from('queues')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      .in('status', ['waiting', 'called', 'in_service'])
      .maybeSingle();

    if (existing) {
      return {
        success: true,
        message: 'Already in queue',
        data: existing
      };
    }

    // الحصول على آخر موقع في الطابور
    const { data: lastInQueue } = await supabase
      .from('queues')
      .select('position')
      .eq('clinic_id', clinicId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const newPosition = (lastInQueue?.position || 0) + 1;

    // استخدام clinic_counters للحصول على رقم تسلسلي ثابت لا يتكرر
    const { data: counter, error: counterError } = await supabase
      .from('clinic_counters')
      .select('*')
      .eq('clinic_id', clinicId)
      .maybeSingle();

    let newDisplayNumber;
    
    if (!counter) {
      // إنشاء عداد جديد للعيادة
      const { data: newCounter } = await supabase
        .from('clinic_counters')
        .insert([{ clinic_id: clinicId, counter: 1 }])
        .select()
        .single();
      newDisplayNumber = 1;
    } else {
      // زيادة العداد
      const { data: updatedCounter } = await supabase
        .from('clinic_counters')
        .update({ counter: counter.counter + 1 })
        .eq('clinic_id', clinicId)
        .select()
        .single();
      newDisplayNumber = updatedCounter.counter;
    }

    // إضافة للطابور
    const { data: queueEntry, error } = await supabase
      .from('queues')
      .insert([{
        patient_id: patientId,
        patient_name: patientName,
        clinic_id: clinicId,
        position: newPosition,
        display_number: newDisplayNumber, // رقم تسلسلي ثابت خاص بكل عيادة
        status: 'waiting',
        entered_at: new Date().toISOString(),
        exam_type: 'general'
      }])
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: queueEntry,
      position: newPosition
    };
  } catch (error) {
    console.error('[enterQueue] Error:', error);
    return { success: false, error: error.message };
  }
}

// دالة حساب عدد المنتظرين في العيادة
export async function getQueueCount(clinicId) {
  try {
    const { count, error } = await supabase
      .from('queues')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('status', 'waiting');
    
    if (error) {
      console.error('[getQueueCount] Error:', error);
      return 0;
    }
    return count || 0;
  } catch (error) {
    console.error('[getQueueCount] Error:', error);
    return 0;
  }
}

export async function getQueueStatus(clinicId) {
  try {
    const today = getTodayDateKey();
    
    // جلب جميع عناصر الطابور للعيادة
    const { data: allQueue, error } = await supabase
      .from('queues')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('position', { ascending: true });

    if (error) throw error;

    const queue = allQueue || [];
    
    // تصنيف حسب الحالة
    const waiting = queue.filter(q => q.status === 'waiting');
    const inService = queue.filter(q => q.status === 'called' || q.status === 'in_service');
    const completed = queue.filter(q => q.status === 'completed');

    // تحويل البيانات للتنسيق المطلوب
    const formatEntry = (entry) => ({
      id: entry.id,
      ticket: entry.position,
      visitId: entry.patient_id,
      patientName: entry.patient_name,
      issuedAt: entry.entered_at,
      calledAt: entry.called_at,
      doneAt: entry.completed_at,
      status: entry.status
    });

    return {
      success: true,
      clinicId,
      dateKey: today,
      waiting: waiting.map(formatEntry),
      in: inService.map(formatEntry),
      done: completed.map(formatEntry),
      queue: queue,
      stats: {
        totalWaiting: waiting.length,
        totalIn: inService.length,
        totalDone: completed.length,
        totalToday: queue.length
      }
    };
  } catch (error) {
    console.error('[getQueueStatus] Error:', error);
    return { 
      success: false, 
      error: error.message,
      waiting: [],
      in: [],
      done: [],
      stats: { totalWaiting: 0, totalIn: 0, totalDone: 0, totalToday: 0 }
    };
  }
}

export async function callNextPatient(clinicId, pin) {
  try {
    // التحقق من PIN
    const pinValid = await verifyPin(clinicId, pin);
    if (!pinValid.success) {
      return { success: false, error: 'رمز PIN غير صحيح' };
    }

    // إنهاء أي مريض قيد الخدمة حالياً
    await supabase
      .from('queues')
      .update({ 
        status: 'completed', 
        completed_at: new Date().toISOString() 
      })
      .eq('clinic_id', clinicId)
      .in('status', ['called', 'in_service']);

    // جلب التالي في الانتظار
    const { data: nextPatient, error: fetchError } = await supabase
      .from('queues')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('status', 'waiting')
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!nextPatient) {
      return { success: true, message: 'لا يوجد مرضى في الانتظار', data: null };
    }

    // تحديث حالة المريض التالي
    const { data: calledPatient, error: updateError } = await supabase
      .from('queues')
      .update({ 
        status: 'called', 
        called_at: new Date().toISOString() 
      })
      .eq('id', nextPatient.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return {
      success: true,
      data: calledPatient,
      message: `تم استدعاء المريض رقم ${calledPatient.position}`
    };
  } catch (error) {
    console.error('[callNextPatient] Error:', error);
    return { success: false, error: error.message };
  }
}

export async function queueDone(clinicId, patientId, pin) {
  try {
    // التحقق من PIN
    const pinValid = await verifyPin(clinicId, pin);
    if (!pinValid.success) {
      return { success: false, error: 'رمز PIN غير صحيح' };
    }

    const { data, error } = await supabase
      .from('queues')
      .update({ 
        status: 'completed', 
        completed_at: new Date().toISOString() 
      })
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      .in('status', ['waiting', 'called', 'in_service'])
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('[queueDone] Error:', error);
    return { success: false, error: error.message };
  }
}

export async function getPatientPosition(clinicId, patientId) {
  try {
    const { data: queue } = await supabase
      .from('queues')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('status', 'waiting')
      .order('position', { ascending: true });

    const position = queue?.findIndex(q => q.patient_id === patientId);
    
    if (position === -1 || position === undefined) {
      return { success: true, position: 0, ahead: 0, displayNumber: 0 };
    }

    return {
      success: true,
      position: position + 1,
      ahead: position,
      displayNumber: queue[position]?.position || 0
    };
  } catch (error) {
    console.error('[getPatientPosition] Error:', error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// PIN MANAGEMENT - حقيقي بالكامل
// ==========================================

// دالة الحصول على PIN الحالي لعيادة معينة
export async function getCurrentPin(clinicId) {
  try {
    const { data: clinic, error } = await supabase
      .from('clinics')
      .select('id, name_ar, name_en, pin_code, pin_expires_at')
      .eq('id', clinicId)
      .maybeSingle();

    if (error) throw error;

    if (!clinic) {
      return {
        success: true,
        currentPin: null,
        totalIssued: 0,
        dateKey: getTodayDateKey(),
        allPins: []
      };
    }

    const expires = clinic.pin_expires_at ? new Date(clinic.pin_expires_at) : null;
    const isActive = clinic.pin_code && expires && expires > new Date();

    return {
      success: true,
      currentPin: isActive ? clinic.pin_code : null,
      totalIssued: clinic.pin_code ? 1 : 0,
      dateKey: getTodayDateKey(),
      allPins: clinic.pin_code ? [clinic.pin_code] : [],
      expiresAt: clinic.pin_expires_at,
      isActive: isActive
    };
  } catch (error) {
    console.error('[getCurrentPin] Error:', error);
    throw error;
  }
}

// دالة الحصول على جميع أكواد PIN النشطة
export async function getAllPins() {
  try {
    const { data: clinics, error } = await supabase
      .from('clinics')
      .select('id, name_ar, name_en, pin_code, pin_expires_at, is_active')
      .eq('is_active', true);

    if (error) throw error;

    const now = new Date();
    const pins = (clinics || []).map(clinic => {
      const expires = clinic.pin_expires_at ? new Date(clinic.pin_expires_at) : null;
      const isActive = clinic.pin_code && expires && expires > now;

      return {
        pinId: clinic.id,
        currentPin: isActive ? clinic.pin_code : null,
        clinic_id: clinic.id,
        clinicName: clinic.name_ar || clinic.name_en,
        status: isActive ? 'active' : 'expired',
        expiresAt: clinic.pin_expires_at
      };
    }).filter(p => p.currentPin);

    return { success: true, pins };
  } catch (error) {
    console.error('[getAllPins] Error:', error);
    return { success: false, error: error.message, pins: [] };
  }
}

export async function getPinStatus() {
  try {
    const { data: clinics, error } = await supabase
      .from('clinics')
      .select('id, name_ar, name_en, pin_code, pin_expires_at, is_active')
      .eq('is_active', true);

    if (error) throw error;

    const pinStatus = {};
    const now = new Date();

    (clinics || []).forEach(clinic => {
      const expires = clinic.pin_expires_at ? new Date(clinic.pin_expires_at) : null;
      const isActive = clinic.pin_code && expires && expires > now;

      pinStatus[clinic.id] = {
        clinicId: clinic.id,
        clinicName: clinic.name_ar || clinic.name_en,
        pin: clinic.pin_code || null,
        expiresAt: clinic.pin_expires_at,
        isActive: isActive,
        isExpired: expires ? expires <= now : true
      };
    });

    return { success: true, pins: pinStatus };
  } catch (error) {
    console.error('[getPinStatus] Error:', error);
    return { success: false, error: error.message, pins: {} };
  }
}

export async function issuePin(clinicId) {
  try {
    // توليد PIN عشوائي من 2 رقم
    const newPin = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
    
    // تحديد وقت الانتهاء (نهاية اليوم)
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('clinics')
      .update({
        pin_code: newPin,
        pin_expires_at: expiresAt.toISOString()
      })
      .eq('id', clinicId)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      pin: newPin,
      expiresAt: expiresAt.toISOString(),
      clinicId: clinicId
    };
  } catch (error) {
    console.error('[issuePin] Error:', error);
    return { success: false, error: error.message };
  }
}

export async function verifyPin(clinicId, pin) {
  try {
    const { data: clinic, error } = await supabase
      .from('clinics')
      .select('pin_code, pin_expires_at')
      .eq('id', clinicId)
      .single();

    if (error || !clinic) {
      return { success: false, error: 'العيادة غير موجودة' };
    }

    // التحقق من تطابق PIN
    if (clinic.pin_code !== pin) {
      return { success: false, error: 'رمز PIN غير صحيح' };
    }

    // التحقق من صلاحية PIN
    if (clinic.pin_expires_at && new Date(clinic.pin_expires_at) < new Date()) {
      return { success: false, error: 'انتهت صلاحية رمز PIN' };
    }

    return { success: true, data: true };
  } catch (error) {
    console.error('[verifyPin] Error:', error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// NOTIFICATIONS - حقيقي بالكامل
// ==========================================

export async function addNotification(patientId, message, type = 'info', title = '') {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert([{
        patient_id: patientId,
        message: message,
        title: title,
        type: type,
        is_read: false,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('[addNotification] Error:', error);
    return { success: false, error: error.message };
  }
}

export async function getNotifications(patientId, unreadOnly = false) {
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, notifications: data || [] };
  } catch (error) {
    console.error('[getNotifications] Error:', error);
    return { success: false, error: error.message, notifications: [] };
  }
}

export async function markNotificationRead(notificationId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('[markNotificationRead] Error:', error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// PATHWAYS / ROUTES - حقيقي بالكامل
// ==========================================

export async function createPathway(patientId, gender, examType = 'general') {
  try {
    // تحديد المسار حسب نوع الفحص والجنس
    const pathways = {
      'recruitment': ['lab', 'vitals', 'dental', 'eye', 'ent', 'surgery', 'internal', 'final'],
      'promotion': ['lab', 'vitals', 'internal', 'final'],
      'general': ['lab', 'vitals', 'internal', 'final'],
      'transfer': ['lab', 'vitals', 'surgery', 'final']
    };

    const steps = pathways[examType] || pathways['general'];

    const { data: route, error } = await supabase
      .from('routes')
      .insert([{
        patient_id: patientId,
        gender: gender,
        exam_type: examType,
        status: 'active',
        current_step: 0,
        total_steps: steps.length,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // المسار موجود بالفعل
        return getPathway(patientId);
      }
      throw error;
    }

    // إنشاء خطوات المسار
    const routeSteps = steps.map((clinicId, index) => ({
      route_id: route.id,
      clinic_id: clinicId,
      step_order: index + 1,
      status: index === 0 ? 'current' : 'pending'
    }));

    await supabase.from('route_steps').insert(routeSteps);

    return { success: true, pathway: route, steps: routeSteps };
  } catch (error) {
    console.error('[createPathway] Error:', error);
    return { success: false, error: error.message };
  }
}

export async function getPathway(patientId) {
  try {
    // Get patient's exam type first
    const { data: queueEntry, error: queueError } = await supabase
      .from('queues')
      .select('exam_type')
      .eq('patient_id', patientId)
      .order('entered_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (queueError) throw queueError;
    
    if (!queueEntry || !queueEntry.exam_type) {
      return { success: false, error: 'لا يوجد نوع فحص للمريض' };
    }

    // Get route for this exam type
    const { data: route, error } = await supabase
      .from('routes')
      .select('*')
      .eq('exam_type', queueEntry.exam_type)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;

    if (!route) {
      return { success: false, error: 'لا يوجد مسار نشط' };
    }

    return { success: true, pathway: route, route: route };
  } catch (error) {
    console.error('[getPathway] Error:', error);
    return { success: false, error: error.message };
  }
}

// Alias for getPathway - used by PatientPage.jsx
export async function getRoute(patientId) {
  return getPathway(patientId);
}

export async function updatePathwayStep(patientId, stepId, status = 'completed') {
  try {
    // تحديث الخطوة الحالية
    const { error: stepError } = await supabase
      .from('route_steps')
      .update({ status: status, completed_at: new Date().toISOString() })
      .eq('id', stepId);

    if (stepError) throw stepError;

    // تحديث المسار
    const { data: route } = await supabase
      .from('routes')
      .select('*, route_steps(*)')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .single();

    if (route) {
      const completedSteps = route.route_steps.filter(s => s.status === 'completed').length;
      await supabase
        .from('routes')
        .update({ current_step: completedSteps })
        .eq('id', route.id);
    }

    return { success: true };
  } catch (error) {
    console.error('[updatePathwayStep] Error:', error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// REPORTS & STATISTICS - حقيقي بالكامل
// ==========================================

export async function getAdminStatus() {
  try {
    const today = getTodayDateKey();
    
    // إحصائيات الطوابير
    const { data: queueStats } = await supabase
      .from('queues')
      .select('status')
      .gte('entered_at', `${today}T00:00:00`);

    const stats = {
      totalToday: queueStats?.length || 0,
      waiting: queueStats?.filter(q => q.status === 'waiting').length || 0,
      inService: queueStats?.filter(q => ['called', 'in_service'].includes(q.status)).length || 0,
      completed: queueStats?.filter(q => q.status === 'completed').length || 0
    };

    // عدد العيادات النشطة
    const { data: clinics } = await supabase
      .from('clinics')
      .select('id')
      .eq('is_active', true);

    stats.activeClinics = clinics?.length || 0;

    // عدد PINs النشطة
    const { data: activePins } = await supabase
      .from('clinics')
      .select('id')
      .eq('is_active', true)
      .not('pin_code', 'is', null)
      .gt('pin_expires_at', new Date().toISOString());

    stats.activePins = activePins?.length || 0;

    return {
      success: true,
      ...stats,
      totalPatients: stats.totalToday,
      waitingPatients: stats.waiting,
      completedToday: stats.completed,
      activeQueues: stats.inService
    };
  } catch (error) {
    console.error('[getAdminStatus] Error:', error);
    return {
      success: false,
      error: error.message,
      totalToday: 0,
      waiting: 0,
      completed: 0,
      activeClinics: 0,
      activePins: 0
    };
  }
}

export async function getDailyReport(date = null) {
  try {
    const targetDate = date || getTodayDateKey();
    
    // جلب بيانات الطوابير لليوم المحدد
    const { data: queueData, error } = await supabase
      .from('queues')
      .select('*, clinics(name_ar, name_en)')
      .gte('entered_at', `${targetDate}T00:00:00`)
      .lte('entered_at', `${targetDate}T23:59:59`)
      .order('entered_at', { ascending: true });

    if (error) throw error;

    // تجميع الإحصائيات حسب العيادة
    const clinicStats = {};
    (queueData || []).forEach(entry => {
      const clinicId = entry.clinic_id;
      if (!clinicStats[clinicId]) {
        clinicStats[clinicId] = {
          clinicId,
          clinicName: entry.clinics?.name_ar || clinicId,
          total: 0,
          waiting: 0,
          completed: 0,
          avgWaitTime: 0,
          waitTimes: []
        };
      }
      
      clinicStats[clinicId].total++;
      
      if (entry.status === 'waiting') {
        clinicStats[clinicId].waiting++;
      } else if (entry.status === 'completed') {
        clinicStats[clinicId].completed++;
        
        // حساب وقت الانتظار
        if (entry.entered_at && entry.completed_at) {
          const waitTime = (new Date(entry.completed_at) - new Date(entry.entered_at)) / 1000 / 60;
          clinicStats[clinicId].waitTimes.push(waitTime);
        }
      }
    });

    // حساب متوسط وقت الانتظار
    Object.values(clinicStats).forEach(stat => {
      if (stat.waitTimes.length > 0) {
        stat.avgWaitTime = Math.round(
          stat.waitTimes.reduce((a, b) => a + b, 0) / stat.waitTimes.length
        );
      }
      delete stat.waitTimes;
    });

    return {
      success: true,
      date: targetDate,
      total: queueData?.length || 0,
      clinics: Object.values(clinicStats),
      rawData: queueData
    };
  } catch (error) {
    console.error('[getDailyReport] Error:', error);
    return { success: false, error: error.message, total: 0, clinics: [] };
  }
}

export async function getWeeklyReport() {
  try {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('queues')
      .select('entered_at, status, clinic_id')
      .gte('entered_at', weekAgo.toISOString())
      .order('entered_at', { ascending: true });

    if (error) throw error;

    // تجميع حسب اليوم
    const dailyStats = {};
    (data || []).forEach(entry => {
      const day = entry.entered_at.split('T')[0];
      if (!dailyStats[day]) {
        dailyStats[day] = { date: day, total: 0, completed: 0 };
      }
      dailyStats[day].total++;
      if (entry.status === 'completed') {
        dailyStats[day].completed++;
      }
    });

    return {
      success: true,
      days: Object.values(dailyStats),
      totalWeek: data?.length || 0
    };
  } catch (error) {
    console.error('[getWeeklyReport] Error:', error);
    return { success: false, error: error.message };
  }
}

export async function getMonthlyReport() {
  try {
    const today = new Date();
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const { data, error } = await supabase
      .from('queues')
      .select('entered_at, status, clinic_id')
      .gte('entered_at', monthAgo.toISOString())
      .order('entered_at', { ascending: true });

    if (error) throw error;

    return {
      success: true,
      totalMonth: data?.length || 0,
      completed: data?.filter(d => d.status === 'completed').length || 0
    };
  } catch (error) {
    console.error('[getMonthlyReport] Error:', error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// ADMIN LOGIN
// ==========================================

export async function adminLogin(username, password) {
  // تسجيل دخول الإدارة - السوبر أدمن: Bomussa / 14490
  // اسم المستخدم غير حساس لحالة الأحرف
  if (username.toLowerCase() === 'bomussa' && password === '14490') {
    return { success: true, token: 'admin-token-' + Date.now(), role: 'SUPER_ADMIN' };
  }
  
  // التحقق من المستخدمين الآخرين من قاعدة البيانات
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .ilike('username', username)
      .eq('is_active', true)
      .single();
    
    if (data && data.password === password) {
      return { success: true, token: 'admin-token-' + Date.now(), role: data.role || 'ADMIN' };
    }
  } catch (e) {
    console.log('[AdminLogin] DB check failed, using fallback');
  }
  
  return { success: false, error: 'بيانات الدخول غير صحيحة' };
}

// ==========================================
// REALTIME SUBSCRIPTIONS
// ==========================================

export function subscribeToQueue(clinicId, callback) {
  const channel = supabase
    .channel(`queue-${clinicId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'queue',
        filter: `clinic_id=eq.${clinicId}`
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToNotifications(patientId, callback) {
  const channel = supabase
    .channel(`notifications-${patientId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `patient_id=eq.${patientId}`
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ==========================================
// EXPORTS
// ==========================================

export default {
  // Patient
  patientLogin,
  
  // Clinics
  getClinics,
  
  // Queue
  enterQueue,
  getQueueStatus,
  getQueuePosition,
  callNextPatient,
  queueDone,
  getPatientPosition,
  subscribeToQueue,
  
  // PIN
  getCurrentPin,
  getAllPins,
  getPinStatus,
  issuePin,
  verifyPin,
  
  // Notifications
  addNotification,
  getNotifications,
  markNotificationRead,
  subscribeToNotifications,
  
  // Pathways
  createPathway,
  getPathway,
  getRoute,
  updatePathwayStep,
  
  // Reports
  getAdminStatus,
  getDailyReport,
  getWeeklyReport,
  getMonthlyReport,
  
  // Admin
  adminLogin,
  
  // Queue Count
  getQueueCount
};
