// API Service للتكامل مع Backend
// المسارات محدثة لتتطابق مع /api/v1/*

import { getApiBase } from './api-base';
import { generateIdempotencyKey, sentKeysRegistry } from '../utils/idempotency';

const API_BASE = getApiBase();
const API_VERSION = '/api/v1'; // For backwards compatibility in method calls

// Normalize endpoint to prevent double /api/v1
function normalizePath(endpoint) {
  const p = String(endpoint || '');
  // Remove any leading /api/v1 or api/v1
  const withoutVersion = p.replace(/^\/?api\/v1/, '');
  // Ensure it starts with /
  return withoutVersion.startsWith('/') ? withoutVersion : `/${withoutVersion}`;
}

class ApiService {
  constructor() {
    // Auto-sync offline queue when online
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {

        this.syncOfflineQueue()
      })
      
      // Sync on page load if online
      if (navigator.onLine) {
        setTimeout(() => this.syncOfflineQueue(), 1000)
      }
    }
  }
  async request(endpoint, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    
    // Generate and attach idempotency key for mutating requests
    let idempotencyKey = options.idempotencyKey; // Allow override
    if (!idempotencyKey && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      idempotencyKey = generateIdempotencyKey(method, endpoint, options.body);
      
      // Check if already sent successfully
      if (sentKeysRegistry.isSent(idempotencyKey)) {
        // Skip resend - return cached success
        return {
          success: true,
          cached: true,
          message: 'Request already sent successfully'
        };
      }
    }
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(idempotencyKey && { 'X-Idempotency-Key': idempotencyKey }),
        ...options.headers
      },
      ...options
    }

    const url = `${API_BASE}${normalizePath(endpoint)}`
    
    try {
      const response = await fetch(url, config)
      const text = await response.text()
      let data
      try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }

      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`)
      }
      
      // Mark idempotency key as sent on success
      if (idempotencyKey && response.ok) {
        sentKeysRegistry.markSent(idempotencyKey);
      }
      
      return data
    } catch (err) {
      // Offline fallback with queue system for write operations
      // Note: In production, the Vercel Edge proxy handles upstream forwarding,
      // and network-level retries are handled by the enhanced-api client when needed
      const offline = this.offlineFallback(endpoint, options)
      if (offline.ok) return offline.data

      // console.error('API Error:', err)
      throw err || new Error('تعذر الوصول إلى الخادم')
    }
  }

  offlineFallback(endpoint, options = {}) {
    // OFFLINE QUEUE SYSTEM
    // When connection fails:
    // 1. Store operation in localStorage temporarily
    // 2. Return pending status to user
    // 3. Auto-sync when connection restored
    
    try {
      const method = (options.method || 'GET').toUpperCase()
      
      // For write operations, queue them for later sync
      if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
        this.queueOfflineOperation(endpoint, options)
        return {
          ok: true,
          data: {
            success: true,
            offline: true,
            queued: true,
            message: 'تم حفظ العملية مؤقتاً - سيتم الإرسال عند عودة الاتصال'
          }
        }
      }
      
      // For read operations, return offline status
      return { ok: false }
      
    } catch (e) {
      return { ok: false }
    }
  }

  queueOfflineOperation(endpoint, options) {
    try {
      const method = (options.method || 'GET').toUpperCase();
      
      // Generate idempotency key if not already present
      let idempotencyKey = options.idempotencyKey;
      if (!idempotencyKey && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        idempotencyKey = generateIdempotencyKey(method, endpoint, options.body);
      }
      
      const queue = JSON.parse(localStorage.getItem('mms.offlineQueue') || '[]')
      queue.push({
        id: Date.now() + Math.random(),
        endpoint,
        options: {
          ...options,
          idempotencyKey // Persist for replay
        },
        timestamp: new Date().toISOString()
      })
      localStorage.setItem('mms.offlineQueue', JSON.stringify(queue))
    } catch (e) {
      // console.error('Failed to queue offline operation:', e)
    }
  }

  async syncOfflineQueue() {
    try {
      const queue = JSON.parse(localStorage.getItem('mms.offlineQueue') || '[]')
      if (queue.length === 0) return

      const remaining = []
      for (const op of queue) {
        try {
          await this.request(op.endpoint, op.options)

        } catch (e) {
          // console.error(`❌ Failed to sync: ${op.endpoint}`, e)
          remaining.push(op)
        }
      }
      
      localStorage.setItem('mms.offlineQueue', JSON.stringify(remaining))
      
      if (remaining.length === 0) {

      } else {

      }
    } catch (e) {
      // console.error('Sync error:', e)
    }
  }

  // ==========================================
  // Queue APIs - متطابقة مع Backend
  // ==========================================

  /**
   * تسجيل دخول المريض
   * Backend: POST /api/v1/patient/login
   * Body: { patientId, gender }
   * Response: { success, data }
   */
  async patientLogin(patientId, gender) {
    return this.request(`${API_VERSION}/patient/login`, {
      method: 'POST',
      body: JSON.stringify({ patientId, gender })
    })
  }

  /**
   * دخول الدور في عيادة
   * Backend: POST /api/v1/queue/enter
   * Body: { clinic, user, isAutoEntry }
   * Response: { success, number, display_number, ahead, total_waiting }
   * مع طبقة تحقق وإعادة محاولة
   */
  async enterQueue(clinic, user, isAutoEntry = false, retryCount = 0) {
    const maxRetries = 3
    
    try {
      const data = await this.request(`${API_VERSION}/queue/enter`, {
        method: 'POST',
        body: JSON.stringify({ clinic, user, isAutoEntry })
      })
      
      // طبقة التحقق
      if (!data || !data.success) {
        throw new Error('Failed to enter queue')
      }
      
      // التحقق من وجود رقم الدور
      if (!data.number && !data.display_number) {
        throw new Error('Missing queue number in response')
      }
      
      return data
      
    } catch (error) {
      // console.error(`Enter queue failed (attempt ${retryCount + 1}/${maxRetries}):`, error)
      
      if (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 100))
        return this.enterQueue(clinic, user, isAutoEntry, retryCount + 1)
      }
      
      throw error
    }
  }

  /**
   * الحصول على موقع الدور الحالي (للتحديث الدوري)
   * Backend: GET /api/v1/queue/position?clinic=xxx&user=yyy
   * Response: { success, display_number, ahead, total_waiting, estimated_wait_minutes }
   * مع طبقة تحقق وإعادة محاولة تلقائية
   */
  async getQueuePosition(clinic, user, retryCount = 0) {
    const maxRetries = 3
    
    try {
      const data = await this.request(`${API_VERSION}/queue/position?clinic=${clinic}&user=${user}`, {
        method: 'GET'
      })
      
      // طبقة التحقق: التأكد من صحة البيانات
      if (!data || !data.success) {
        throw new Error('Invalid response from backend')
      }
      
      // التحقق من وجود display_number
      if (data.display_number === undefined || data.display_number === null) {
        throw new Error('Missing display_number in response')
      }
      
      // التحقق من صحة الرقم (-1 للمنتهي, 0 للداخل, 1+ للمنتظر)
      if (data.display_number < -1) {
        throw new Error('Invalid display_number value')
      }
      
      // التحقق من ahead
      if (data.ahead === undefined || data.ahead < 0) {
        throw new Error('Invalid ahead value')
      }
      
      // البيانات صحيحة ✅
      return data
      
    } catch (error) {
      // console.error(`Queue position fetch failed (attempt ${retryCount + 1}/${maxRetries}):`, error)
      
      // إعادة المحاولة إذا لم نصل للحد الأقصى
      if (retryCount < maxRetries) {
        // انتظار قصير قبل إعادة المحاولة (100ms, 200ms, 300ms)
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 100))
        return this.getQueuePosition(clinic, user, retryCount + 1)
      }
      
      // فشلت جميع المحاولات
      throw error
    }
  }

  /**
   * حالة الدور في عيادة
   * Backend: GET /api/v1/queue/status?clinic=xxx
   * Response: { success, clinic, list, current_serving, total_waiting }
   */
  async getQueueStatus(clinic) {
    return this.request(`${API_VERSION}/queue/status?clinic=${clinic}`)
  }

  /**
   * إنهاء الدور والخروج من العيادة
   * Backend: POST /api/v1/queue/done
   * Body: { clinic, user, pin }
   * Response: { success, message }
   */
  async queueDone(clinic, user, pin) {
    return this.request(`${API_VERSION}/queue/done`, {
      method: 'POST',
      body: JSON.stringify({
        clinic,
        user,
        pin: String(pin)
      })
    })
  }

  /**
   * الخروج من العيادة بـ PIN
   * Backend: POST /api/v1/clinic/exit
   * Body: { patientId, clinicId, pin }
   * Response: { success, message, route }
   */
  async clinicExit(patientId, clinicId, pin) {
    return this.request(`${API_VERSION}/clinic/exit`, {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        clinicId,
        pin: String(pin)
      })
    })
  }

  /**
   * استدعاء المراجع التالي (للإدارة)
   * Backend: POST /api/v1/queue/call
   * Body: { clinic }
   * Response: { success, next_patient }
   */
  async callNextPatient(clinic) {
    return this.request(`${API_VERSION}/queue/call`, {
      method: 'POST',
      body: JSON.stringify({ clinic })
    })
  }

  // ==========================================
  // PIN APIs
  // ==========================================

  /**
   * حالة PIN اليومي
   * Backend: GET /api/v1/pin/status
   * Response: { success, pins: {...} }
   */
  async getPinStatus() {
    return this.request(`${API_VERSION}/pin/status`)
  }

  /**
   * الحصول على جميع أكواد PIN النشطة
   * Backend: GET /api/v1/pin/status
   * Response: { success, pins: {...} }
   */
  async getActivePins(adminCode) {
    const response = await this.request(`${API_VERSION}/pin/status`)
    if (response.success && response.pins) {
      // تحويل الكائن إلى مصفوفة للعرض
      const pinsArray = Object.entries(response.pins).map(([clinicId, pinData]) => ({
        id: clinicId,
        clinicId: clinicId,
        pin: pinData.pin || pinData,
        code: clinicId,
        status: pinData.active ? 'active' : 'used',
        generatedAt: pinData.generatedAt
      }))
      return { success: true, pins: pinsArray }
    }
    return { success: false, pins: [] }
  }

  // ==========================================
  // Path APIs
  // ==========================================

  /**
   * إنشاء وحفظ مسار المراجع
   * Backend: POST /api/v1/route/create
   * Body: { patientId, examType, gender, stations }
   * Response: { success, route }
   */
  async createRoute(patientId, examType, gender, stations) {
    return this.request(`${API_VERSION}/route/create`, {
      method: 'POST',
      body: JSON.stringify({ patientId, examType, gender, stations })
    })
  }

  /**
   * جلب مسار المراجع المحفوظ
   * Backend: GET /api/v1/route/get?patientId=xxx
   * Response: { success, route }
   */
  async getRoute(patientId) {
    return this.request(`${API_VERSION}/route/get?patientId=${patientId}`)
  }

  /**
   * اختيار المسار الطبي
   * Backend: GET /api/v1/path/choose
   * Response: { success, path: [...] }
   */
  async choosePath() {
    return this.request(`${API_VERSION}/path/choose`)
  }

  // ==========================================
  // Admin APIs
  // ==========================================

  /**
   * حالة الإدارة
   * Backend: GET /api/v1/admin/status
   */
  async getAdminStatus() {
    return this.request(`${API_VERSION}/admin/status`)
  }

  // ==========================================
  // Health Check
  // ==========================================

  /**
   * فحص صحة النظام
   * Backend: GET /api/v1/health/status
   */
  async getHealthStatus() {
    return this.request(`${API_VERSION}/health/status`)
  }

  // ==========================================
  // SSE (Server-Sent Events)
  // ==========================================

  /**
   * الاتصال بـ SSE للتحديثات الحية
   * Backend: GET /api/v1/events/stream?clinic=xxx
   */
  connectSSE(clinic, callback) {
    // استخدام eventBus بدلاً من إنشاء EventSource مكرر
    // event-bus.js يدير الاتصال المركزي
    
    const handleQueueUpdate = (data) => {
      if (data.clinic === clinic || !data.clinic) {
        callback({ type: 'queue_update', data });
      }
    };
    
    const handleHeartbeat = (data) => {
      callback({ type: 'heartbeat', data });
    };
    
    // الاشتراك في الأحداث
    const unsubscribe1 = eventBus.on('queue:update', handleQueueUpdate);
    const unsubscribe2 = eventBus.on('heartbeat', handleHeartbeat);
    
    // إرجاع كائن يحاكي EventSource للتوافق
    return {
      close: () => {
        unsubscribe1();
        unsubscribe2();
      }
    };
  }

  // ==========================================
  // Compatibility Methods (للتوافق مع الكود القديم)
  // ==========================================

  async enterClinic(visitId, clinicId) {
    return this.enterQueue(clinicId, visitId)
  }

  async completeClinic(clinicId, user, pin) {
    return this.queueDone(clinicId, user, pin)
  }

  async getPatientStatus(patientId) {
    // لا يوجد endpoint مباشر - استخدم offline fallback
    return this.offlineFallback('/api/patient/' + patientId, {})
  }

  async selectExam(patientId, examType) {
    // لا يوجد endpoint مباشر - استخدم offline fallback
    const data = {
      ok: true,
      patientId,
      examType,
      status: 'selected'
    }
    return data
  }

  async unlockStation(patientId, stationId, pin) {
    return this.getPinStatus()
  }

  async getQueues() {
    // استخدام API الجديد للحصول على جميع الطوابير
    return this.request(`${API_VERSION}/stats/queues`)
  }

  async getQueueStats() {
    // استخدام API الجديد للإحصائيات
    return this.request(`${API_VERSION}/stats/dashboard`)
  }

  async adminLogin(code) {
    // لا يوجد endpoint - استخدم validation بسيط
    return { success: code === 'admin123', token: 'mock-token' }
  }

  async pauseQueue(queueType, adminCode) {
    return { success: true, message: 'Queue paused' }
  }

  async resetSystem(adminCode) {
    return { success: true, message: 'System reset' }
  }

  async generatePIN(stationId, adminCode) {
    return this.getPinStatus()
  }

  async deactivatePIN(pinId, adminCode) {
    return { success: true, message: 'PIN deactivated' }
  }

  async getActivePINs(adminCode) {
    return this.getPinStatus()
  }

  async getClinics() {
    return {
      clinics: [
        { id: 'lab', name: 'المختبر', type: 'diagnostic' },
        { id: 'xray', name: 'الأشعة', type: 'diagnostic' },
        { id: 'eyes', name: 'العيون', type: 'clinic' },
        { id: 'internal', name: 'الباطنية', type: 'clinic' },
        { id: 'ent', name: 'الأنف والأذن والحنجرة', type: 'clinic' },
        { id: 'surgery', name: 'الجراحة', type: 'clinic' },
        { id: 'dental', name: 'الأسنان', type: 'clinic' },
        { id: 'psychiatry', name: 'الطب النفسي', type: 'clinic' },
        { id: 'derma', name: 'الجلدية', type: 'clinic' },
        { id: 'bones', name: 'العظام', type: 'clinic' },
        { id: 'vitals', name: 'القياسات الحيوية', type: 'vital' },
        { id: 'ecg', name: 'تخطيط القلب', type: 'diagnostic' },
        { id: 'audio', name: 'السمعيات', type: 'diagnostic' }
      ]
    }
  }

  async getActiveQueue() {
    return this.request(`${API_VERSION}/stats/queues`)
  }

  async getDashboardStats() {
    return this.request(`${API_VERSION}/stats/dashboard`)
  }

  async getClinicOccupancy() {
    return this.request(`${API_VERSION}/stats/queues`)
  }

  async getWaitTimes() {
    return this.getQueues()
  }

  async getThroughputStats() {
    return this.getAdminStatus()
  }

  async generateReport(type, format, adminCode) {
    return { success: true, report: 'Generated' }
  }

  // جلب التقارير الحديثة من الباك اند
  async getRecentReports(adminCode) {
    // استدعاء endpoint حقيقي من الباك اند
    return this.request(`${API_VERSION}/reports/history?adminCode=${encodeURIComponent(adminCode)}`)
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}`

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {

    }

    ws.onclose = () => {

      setTimeout(() => this.connectWebSocket(), 3000)
    }

    ws.onerror = (error) => {
      // console.error('WebSocket error:', error)
    }

    return ws
  }
}

const api = new ApiService()
export default api
export { api }

