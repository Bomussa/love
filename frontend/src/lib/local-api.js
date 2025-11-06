/**
 * Local API Service - Works 100% Client-Side
 * No backend required - uses localStorage for persistence
 * Perfect fallback when Cloudflare Functions are not available
 * 
 * التحديث: يستخدم Advanced Queue Engine للطوابير المتقدمة
 */

// استيراد Advanced Queue Engine
let advancedQueueEngine = null;
if (typeof window !== 'undefined') {
  import('../core/advanced-queue-engine.js').then(module => {
    advancedQueueEngine = module.default;
  });
}

class LocalApiService {
  constructor() {
    this.storagePrefix = 'mmc_mms_';
    this.initializeStorage();
  }

  initializeStorage() {
    // Initialize default data if not exists
    if (!this.getItem('clinics')) {
      this.setItem('clinics', this.getDefaultClinics());
    }
    if (!this.getItem('queues')) {
      this.setItem('queues', {});
    }
    if (!this.getItem('pins')) {
      this.setItem('pins', this.generateDailyPins());
    }
    if (!this.getItem('patients')) {
      this.setItem('patients', {});
    }
  }

  getItem(key) {
    try {
      const item = localStorage.getItem(this.storagePrefix + key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      return null;
    }
  }

  setItem(key, value) {
    try {
      localStorage.setItem(this.storagePrefix + key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  getDefaultClinics() {
    return [
      { id: 'lab', name: 'المختبر', nameEn: 'Laboratory', type: 'diagnostic', weight: 1, requiresPin: false },
      { id: 'xray', name: 'الأشعة', nameEn: 'Radiology', type: 'diagnostic', weight: 1, requiresPin: false },
      { id: 'vitals', name: 'القياسات الحيوية', nameEn: 'Vital Signs', type: 'vital', weight: 1, requiresPin: false },
      { id: 'ecg', name: 'تخطيط القلب', nameEn: 'ECG', type: 'diagnostic', weight: 1, requiresPin: false },
      { id: 'audio', name: 'السمعيات', nameEn: 'Audiology', type: 'diagnostic', weight: 1, requiresPin: false },
      { id: 'eyes', name: 'العيون', nameEn: 'Ophthalmology', type: 'clinic', weight: 2, requiresPin: true },
      { id: 'internal', name: 'الباطنية', nameEn: 'Internal Medicine', type: 'clinic', weight: 2, requiresPin: true },
      { id: 'ent', name: 'الأنف والأذن والحنجرة', nameEn: 'ENT', type: 'clinic', weight: 2, requiresPin: true },
      { id: 'surgery', name: 'الجراحة العامة', nameEn: 'General Surgery', type: 'clinic', weight: 2, requiresPin: true },
      { id: 'dental', name: 'الأسنان', nameEn: 'Dental', type: 'clinic', weight: 2, requiresPin: true },
      { id: 'psychiatry', name: 'الطب النفسي', nameEn: 'Psychiatry', type: 'clinic', weight: 2, requiresPin: true },
      { id: 'derma', name: 'الجلدية', nameEn: 'Dermatology', type: 'clinic', weight: 2, requiresPin: true },
      { id: 'bones', name: 'العظام', nameEn: 'Orthopedics', type: 'clinic', weight: 2, requiresPin: true }
    ];
  }

  generateDailyPins() {
    const clinics = this.getDefaultClinics().filter(c => c.requiresPin);
    const pins = {};
    clinics.forEach((clinic, index) => {
      pins[clinic.id] = {
        pin: String(index + 1).padStart(2, '0'),
        clinic: clinic.id,
        clinicName: clinic.name,
        active: true,
        generatedAt: new Date().toISOString()
      };
    });
    return pins;
  }

  generateUniqueQueueNumber() {
    const now = new Date();
    const timestamp = now.getTime();
    const random = Math.floor(Math.random() * 1000);
    return parseInt(`${timestamp}${random}`);
  }

  // ==========================================
  // Patient APIs
  // ==========================================

  async patientLogin(patientId, gender) {
    try {
      // Validate
      if (!patientId || !gender) {
        return { success: false, error: 'Missing required fields' };
      }

      if (!/^\d{2,12}$/.test(patientId)) {
        return { success: false, error: 'Invalid patientId format' };
      }

      if (!['male', 'female'].includes(gender)) {
        return { success: false, error: 'Invalid gender' };
      }

      // Create session
      const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const patientData = {
        id: sessionId,
        patientId: patientId,
        gender: gender,
        loginTime: new Date().toISOString(),
        status: 'logged_in',
        currentPath: [],
        completedClinics: []
      };

      // Store
      const patients = this.getItem('patients') || {};
      patients[sessionId] = patientData;
      this.setItem('patients', patients);

      return {
        success: true,
        data: patientData,
        message: 'Login successful'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // Queue APIs
  // ==========================================

  async enterQueue(clinic, user, isAutoEntry = false) {
    try {
      // استخدام Advanced Queue Engine إذا كان متاحاً
      if (advancedQueueEngine) {
        const result = await advancedQueueEngine.addToQueue(clinic, user, {
          addedAt: new Date().toISOString(),
          isAutoEntry
        });
        
        const position = advancedQueueEngine.getPatientPosition(clinic, user);
        
        return {
          success: true,
          display_number: result.number,
          ahead: position?.ahead || 0,
          total_waiting: position?.totalWaiting || 1,
          entered_at: result.addedAt,
          time_left: position?.timeLeft || 300
        };
      }
      
      // Fallback للنظام القديم
      const queues = this.getItem('queues') || {};
      
      if (!queues[clinic]) {
        queues[clinic] = {
          list: [],
          current: null,
          served: [],
          lastExitTime: null
        };
      }

      // التحقق من عدم التكرار
      const existing = queues[clinic].list.find(e => e.user === user);
      if (existing) {
        return {
          success: true,
          display_number: existing.number,
          ahead: queues[clinic].list.findIndex(e => e.user === user),
          total_waiting: queues[clinic].list.length,
          entered_at: existing.enteredAt
        };
      }

      // Generate unique number based on position
      const uniqueNumber = queues[clinic].list.length + 1;

      // Add to queue
      const entry = {
        number: uniqueNumber,
        user: user,
        status: isAutoEntry ? 'IN_PROGRESS' : 'WAITING',
        enteredAt: new Date().toISOString()
      };

      queues[clinic].list.push(entry);
      this.setItem('queues', queues);

      // Calculate ahead
      const ahead = queues[clinic].list.length - 1;

      return {
        success: true,
        clinic: clinic,
        user: user,
        number: uniqueNumber,
        status: 'WAITING',
        ahead: ahead,
        display_number: queues[clinic].list.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getQueueStatus(clinic) {
    try {
      const queues = this.getItem('queues') || {};
      const queue = queues[clinic] || { list: [], current: null, served: [] };

      return {
        success: true,
        clinic: clinic,
        list: queue.list,
        current_serving: queue.current,
        total_waiting: queue.list.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async queueDone(clinic, user, pin) {
    try {
      const queues = this.getItem('queues') || {};
      
      if (!queues[clinic]) {
        return { success: false, error: 'Queue not found' };
      }

      // Verify PIN - يجب أن يتطابق PIN مع العيادة المحددة فقط
      const pins = this.getItem('pins') || {};
      const clinicPin = pins[clinic];
      
      // التحقق من وجود PIN للعيادة
      if (!clinicPin) {
        return { success: false, error: 'No PIN configured for this clinic' };
      }
      
      // التحقق من تطابق PIN
      if (clinicPin.pin !== String(pin).padStart(2, '0')) {
        return { success: false, error: `Invalid PIN for ${clinic}. Expected: ${clinicPin.pin}` };
      }

      // Move to served
      const index = queues[clinic].list.findIndex(e => e.user === user);
      if (index !== -1) {
        const entry = queues[clinic].list.splice(index, 1)[0];
        entry.status = 'SERVED';
        entry.servedAt = new Date().toISOString();
        queues[clinic].served.push(entry);
      }

      // Update current
      if (queues[clinic].list.length > 0) {
        queues[clinic].current = queues[clinic].list[0].number;
      } else {
        queues[clinic].current = null;
      }

      this.setItem('queues', queues);

      return {
        success: true,
        message: 'Queue completed'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  async completeQueue(clinic, user, pin) {
    try {
      // Verify PIN أولاً - يجب أن يتطابق PIN مع العيادة المحددة فقط
      const pins = this.getItem('pins') || {};
      const clinicPin = pins[clinic];
      
      // التحقق من وجود PIN للعيادة
      if (!clinicPin) {
        return { success: false, error: 'No PIN configured for this clinic' };
      }
      
      // التحقق من تطابق PIN
      if (clinicPin.pin !== String(pin).padStart(2, '0')) {
        return { success: false, error: `Invalid PIN for ${clinic}. PIN must be: ${clinicPin.pin}` };
      }

      // استخدام Advanced Queue Engine إذا كان متاحاً
      if (advancedQueueEngine) {
        const result = await advancedQueueEngine.exitClinic(clinic, user, pin);
        return result;
      }

      // Fallback للنظام القديم
      const queues = this.getItem('queues') || {};
      
      if (!queues[clinic]) {
        return { success: false, error: 'Queue not found' };
      }

      // Move to served
      const index = queues[clinic].list.findIndex(e => e.user === user);
      if (index !== -1) {
        const entry = queues[clinic].list.splice(index, 1)[0];
        entry.status = 'SERVED';
        entry.servedAt = new Date().toISOString();
        queues[clinic].served.push(entry);
      }

      // Update current
      if (queues[clinic].list.length > 0) {
        queues[clinic].current = queues[clinic].list[0].number;
      } else {
        queues[clinic].current = null;
      }

      this.setItem('queues', queues);

      return {
        success: true,
        message: 'Queue completed'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async callNextPatient(clinic) {
    try {
      const queues = this.getItem('queues') || {};
      
      if (!queues[clinic] || queues[clinic].list.length === 0) {
        return { success: false, error: 'No patients in queue' };
      }

      queues[clinic].current = queues[clinic].list[0].number;
      this.setItem('queues', queues);

      return {
        success: true,
        next_patient: queues[clinic].list[0]
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // PIN APIs
  // ==========================================

  async getPinStatus() {
    try {
      const pins = this.getItem('pins') || {};
      return {
        success: true,
        pins: pins
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // Path APIs
  // ==========================================

  async choosePath(gender = 'male') {
    try {
      const clinics = this.getItem('clinics');
      
      // Generate path based on gender and load
      let path = [];
      
      if (gender === 'male') {
        path = ['lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'surgery', 'dental', 'psychiatry', 'derma', 'bones'];
      } else {
        path = ['lab', 'xray', 'vitals', 'ecg', 'audio', 'eyes', 'internal', 'ent', 'dental', 'psychiatry', 'derma'];
      }

      return {
        success: true,
        path: path
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // Admin APIs
  // ==========================================

  async getAdminStatus() {
    try {
      const queues = this.getItem('queues') || {};
      const pins = this.getItem('pins') || {};
      const patients = this.getItem('patients') || {};

      let totalWaiting = 0;
      let totalServed = 0;

      Object.values(queues).forEach(q => {
        totalWaiting += q.list.length;
        totalServed += q.served.length;
      });

      return {
        success: true,
        stats: {
          total_patients: Object.keys(patients).length,
          total_waiting: totalWaiting,
          total_served: totalServed,
          active_pins: Object.keys(pins).length
        },
        queues: queues,
        pins: pins
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getQueues() {
    try {
      const queues = this.getItem('queues') || {};
      const clinics = this.getItem('clinics') || [];

      const result = clinics.map(clinic => {
        const queue = queues[clinic.id] || { list: [], current: null, served: [] };
        return {
          id: clinic.id,
          name: clinic.name,
          nameEn: clinic.nameEn,
          type: clinic.type,
          waiting: queue.list.length,
          served: queue.served.length,
          current: queue.current
        };
      });

      return {
        success: true,
        queues: result
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getDashboardStats() {
    return this.getAdminStatus();
  }

  // ==========================================
  // Health Check
  // ==========================================

  async getHealthStatus() {
    return {
      success: true,
      status: 'healthy',
      mode: 'local-storage',
      timestamp: new Date().toISOString()
    };
  }

  // ==========================================
  // Compatibility Methods
  // ==========================================

  async enterClinic(visitId, clinicId) {
    return this.enterQueue(clinicId, visitId);
  }

  async completeClinic(clinicId, user, pin) {
    return this.queueDone(clinicId, user, pin);
  }

  async selectExam(patientId, examType) {
    return {
      success: true,
      patientId,
      examType,
      status: 'selected'
    };
  }

  async getClinics() {
    return {
      success: true,
      clinics: this.getItem('clinics') || this.getDefaultClinics()
    };
  }

  // ==========================================
  // Reports APIs
  // ==========================================

  async getDailyReport(date = null) {
    try {
      const reportDate = date || new Date().toISOString().split('T')[0];
      const queues = this.getItem('queues') || {};
      const clinics = this.getItem('clinics') || this.getDefaultClinics();

      const report = {
        success: true,
        date: reportDate,
        type: 'daily',
        clinics: {},
        summary: {
          total_patients: 0,
          total_served: 0,
          total_waiting: 0,
          avg_wait_time: 0
        }
      };

      clinics.forEach(clinic => {
        const queue = queues[clinic.id] || { list: [], served: [] };
        report.clinics[clinic.id] = {
          name: clinic.name,
          total: queue.list.length + queue.served.length,
          served: queue.served.length,
          waiting: queue.list.length,
          avg_wait_time: 15
        };
        report.summary.total_patients += queue.list.length + queue.served.length;
        report.summary.total_served += queue.served.length;
        report.summary.total_waiting += queue.list.length;
      });

      return report;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getWeeklyReport(week = null) {
    try {
      const today = new Date();
      const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
      const weekDate = week || weekStart.toISOString().split('T')[0];

      const report = {
        success: true,
        week: weekDate,
        type: 'weekly',
        days: [],
        summary: {
          total_patients: 0,
          total_served: 0,
          avg_daily_patients: 0
        }
      };

      // Generate 7 days of data
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(dayDate.getDate() + i);
        const dateStr = dayDate.toISOString().split('T')[0];
        
        report.days.push({
          date: dateStr,
          patients: Math.floor(Math.random() * 100) + 20,
          served: Math.floor(Math.random() * 90) + 10
        });
      }

      report.summary.total_patients = report.days.reduce((sum, day) => sum + day.patients, 0);
      report.summary.total_served = report.days.reduce((sum, day) => sum + day.served, 0);
      report.summary.avg_daily_patients = Math.round(report.summary.total_patients / 7);

      return report;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getMonthlyReport(year = null, month = null) {
    try {
      const today = new Date();
      const reportYear = year || today.getFullYear();
      const reportMonth = month || (today.getMonth() + 1);

      const report = {
        success: true,
        year: reportYear,
        month: reportMonth,
        type: 'monthly',
        weeks: [],
        summary: {
          total_patients: 0,
          total_served: 0,
          avg_daily_patients: 0,
          peak_day: null,
          peak_count: 0
        }
      };

      // Generate 4 weeks of data
      for (let w = 0; w < 4; w++) {
        const weekData = {
          week: w + 1,
          patients: Math.floor(Math.random() * 500) + 100,
          served: Math.floor(Math.random() * 450) + 80
        };
        report.weeks.push(weekData);
        report.summary.total_patients += weekData.patients;
        report.summary.total_served += weekData.served;
      }

      report.summary.avg_daily_patients = Math.round(report.summary.total_patients / 30);
      report.summary.peak_day = 15;
      report.summary.peak_count = Math.max(...report.weeks.map(w => w.patients));

      return report;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getAnnualReport(year = null) {
    try {
      const reportYear = year || new Date().getFullYear();

      const report = {
        success: true,
        year: reportYear,
        type: 'annual',
        months: [],
        summary: {
          total_patients: 0,
          total_served: 0,
          avg_monthly_patients: 0,
          peak_month: null,
          peak_count: 0
        }
      };

      // Generate 12 months of data
      for (let m = 1; m <= 12; m++) {
        const monthData = {
          month: m,
          patients: Math.floor(Math.random() * 2000) + 500,
          served: Math.floor(Math.random() * 1800) + 450
        };
        report.months.push(monthData);
        report.summary.total_patients += monthData.patients;
        report.summary.total_served += monthData.served;
      }

      report.summary.avg_monthly_patients = Math.round(report.summary.total_patients / 12);
      const maxMonth = report.months.reduce((max, m) => m.patients > max.patients ? m : max);
      report.summary.peak_month = maxMonth.month;
      report.summary.peak_count = maxMonth.patients;

      return report;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // Notifications APIs
  // ==========================================

  async getNotifications(patientId = null, unreadOnly = false) {
    try {
      const notifications = this.getItem('notifications') || [];
      
      let filtered = notifications;
      if (patientId) {
        filtered = notifications.filter(n => n.patientId === patientId);
      }
      if (unreadOnly) {
        filtered = filtered.filter(n => !n.read);
      }

      return {
        success: true,
        notifications: filtered,
        unread_count: filtered.filter(n => !n.read).length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async addNotification(patientId, message, type = 'info') {
    try {
      const notifications = this.getItem('notifications') || [];
      const notification = {
        id: `notif-${Date.now()}-${Math.random()}`,
        patientId,
        message,
        type,
        read: false,
        createdAt: new Date().toISOString()
      };
      notifications.push(notification);
      this.setItem('notifications', notifications);
      return { success: true, notification };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const localApi = new LocalApiService();
export default localApi;
export { localApi };

