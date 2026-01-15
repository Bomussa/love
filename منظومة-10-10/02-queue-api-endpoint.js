/**
 * API Endpoint جديد لنظام الدور المحسّن
 * يجب إضافته إلى /api/v1.js في مستودع love-api
 * تاريخ: 15 يناير 2026
 */

// ========== إضافة هذا الكود إلى v1.js ==========

// دالة مساعدة لاستدعاء RPC functions في Supabase
async function supabaseRPC(functionName, params = {}) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/${functionName}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(params)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Supabase RPC Error: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

// ========== Endpoints الجديدة ==========

// 1. الحصول على رقم دور للمراجع
if (pathname === '/api/v1/queue/get-number' && method === 'POST') {
  const { patientId, clinicId, examType } = body;
  
  if (!patientId || !clinicId || !examType) {
    return sendError('Patient ID, Clinic ID, and Exam Type are required');
  }

  try {
    const queueNumber = await supabaseRPC('get_next_queue_number', {
      p_patient_id: patientId,
      p_clinic_id: clinicId,
      p_exam_type: examType
    });

    return sendResponse({
      patientId,
      clinicId,
      examType,
      queueNumber: queueNumber || 0,
      date: new Date().toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Error getting queue number:', error);
    return sendError('Failed to get queue number', 500);
  }
}

// 2. الحصول على حالة الدور للمراجع
if (pathname === '/api/v1/queue/status' && method === 'GET') {
  const patientId = parsedUrl.searchParams.get('patientId');
  const clinicId = parsedUrl.searchParams.get('clinicId');
  const examType = parsedUrl.searchParams.get('examType');

  if (!patientId || !clinicId || !examType) {
    return sendError('Patient ID, Clinic ID, and Exam Type are required');
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // الحصول على معلومات الدور
    const queueData = await supabaseRequest(
      `patient_queue_numbers?patient_id=eq.${patientId}&clinic_id=eq.${clinicId}&exam_type=eq.${examType}&date=eq.${today}&select=*`
    );

    if (queueData.length === 0) {
      return sendResponse({
        hasQueue: false,
        message: 'No queue number assigned yet'
      });
    }

    const queue = queueData[0];

    // حساب عدد المنتظرين أمامه
    const waitingCount = await supabaseRequest(
      `patient_queue_numbers?clinic_id=eq.${clinicId}&exam_type=eq.${examType}&date=eq.${today}&queue_number=lt.${queue.queue_number}&status=in.(assigned,active)&select=count`
    );

    return sendResponse({
      hasQueue: true,
      queueNumber: queue.queue_number,
      status: queue.status,
      waitingAhead: waitingCount[0]?.count || 0,
      assignedAt: queue.assigned_at,
      activatedAt: queue.activated_at,
      completedAt: queue.completed_at
    });
  } catch (error) {
    console.error('Error getting queue status:', error);
    return sendError('Failed to get queue status', 500);
  }
}

// 3. تحديث حالة الدور
if (pathname === '/api/v1/queue/update-status' && method === 'POST') {
  const { patientId, clinicId, examType, status } = body;

  if (!patientId || !clinicId || !examType || !status) {
    return sendError('Patient ID, Clinic ID, Exam Type, and Status are required');
  }

  const validStatuses = ['assigned', 'active', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return sendError('Invalid status. Must be one of: ' + validStatuses.join(', '));
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // تحديث الحالة
    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'active') {
      updateData.activated_at = new Date().toISOString();
    } else if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const result = await supabaseRequest(
      `patient_queue_numbers?patient_id=eq.${patientId}&clinic_id=eq.${clinicId}&exam_type=eq.${examType}&date=eq.${today}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      }
    );

    return sendResponse({
      success: true,
      message: 'Queue status updated successfully',
      data: result[0]
    });
  } catch (error) {
    console.error('Error updating queue status:', error);
    return sendError('Failed to update queue status', 500);
  }
}

// 4. الحصول على إحصائيات العيادة
if (pathname === '/api/v1/queue/clinic-stats' && method === 'GET') {
  const clinicId = parsedUrl.searchParams.get('clinicId');
  const examType = parsedUrl.searchParams.get('examType');

  if (!clinicId || !examType) {
    return sendError('Clinic ID and Exam Type are required');
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // الحصول على جميع الأرقام لهذه العيادة اليوم
    const allQueues = await supabaseRequest(
      `patient_queue_numbers?clinic_id=eq.${clinicId}&exam_type=eq.${examType}&date=eq.${today}&select=*`
    );

    const stats = {
      total: allQueues.length,
      assigned: allQueues.filter(q => q.status === 'assigned').length,
      active: allQueues.filter(q => q.status === 'active').length,
      completed: allQueues.filter(q => q.status === 'completed').length,
      cancelled: allQueues.filter(q => q.status === 'cancelled').length,
      currentNumber: allQueues.length > 0 ? Math.max(...allQueues.map(q => q.queue_number)) : 0
    };

    return sendResponse(stats);
  } catch (error) {
    console.error('Error getting clinic stats:', error);
    return sendError('Failed to get clinic statistics', 500);
  }
}

// 5. إعادة تعيين عداد العيادة (للإدارة فقط)
if (pathname === '/api/v1/queue/reset-counter' && method === 'POST') {
  const { clinicId, examType, adminPin } = body;

  if (!clinicId || !examType || !adminPin) {
    return sendError('Clinic ID, Exam Type, and Admin PIN are required');
  }

  // التحقق من صلاحية المدير (يمكن تحسينه لاحقاً)
  if (adminPin !== process.env.ADMIN_PIN) {
    return sendError('Invalid admin PIN', 403);
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // حذف العداد الحالي
    await supabaseRequest(
      `queue_counters?clinic_id=eq.${clinicId}&exam_type=eq.${examType}&date=eq.${today}`,
      {
        method: 'DELETE'
      }
    );

    return sendResponse({
      success: true,
      message: 'Queue counter reset successfully',
      clinicId,
      examType,
      date: today
    });
  } catch (error) {
    console.error('Error resetting queue counter:', error);
    return sendError('Failed to reset queue counter', 500);
  }
}

/**
 * ========== تعليمات التطبيق ==========
 * 
 * 1. افتح ملف /api/v1.js في مستودع love-api
 * 
 * 2. أضف دالة supabaseRPC بعد دالة supabaseRequest (حوالي السطر 23)
 * 
 * 3. أضف جميع الـ endpoints الجديدة قبل السطر الأخير في handler function
 *    (قبل return sendError('Endpoint not found', 404))
 * 
 * 4. احفظ الملف وقم برفعه إلى GitHub
 * 
 * 5. سيتم نشره تلقائياً على Vercel
 * 
 * ========== الاختبار ==========
 * 
 * اختبر الـ endpoints باستخدام:
 * 
 * POST /api/v1/queue/get-number
 * {
 *   "patientId": "123456",
 *   "clinicId": "clinic_radiology",
 *   "examType": "recruitment"
 * }
 * 
 * GET /api/v1/queue/status?patientId=123456&clinicId=clinic_radiology&examType=recruitment
 * 
 * POST /api/v1/queue/update-status
 * {
 *   "patientId": "123456",
 *   "clinicId": "clinic_radiology",
 *   "examType": "recruitment",
 *   "status": "active"
 * }
 */
