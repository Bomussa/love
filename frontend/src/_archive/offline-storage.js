// نظام تخزين محلي متقدم لدعم وضع Offline الكامل
class OfflineStorage {
  constructor() {
    this.prefix = 'mms_'
    this.init()
  }

  init() {
    // تهيئة البيانات الأساسية إذا لم تكن موجودة
    if (!this.get('initialized')) {
      this.set('patients', [])
      this.set('queues', [])
      this.set('pins', [])
      this.set('stats', {
        totalPatients: 0,
        totalWaiting: 0,
        totalCompleted: 0,
        avgWaitTime: 0
      })
      this.set('clinics', this.getDefaultClinics())
      this.set('reports', [])
      this.set('notifications', [])
      this.set('initialized', true)
    }
  }

  getDefaultClinics() {
    return [
      { id: 'lab', name: 'المختبر والأشعة', floor: 'الميزانين', status: 'open', currentNumber: 0, waiting: 0, paused: false },
      { id: 'vitals', name: 'القياسات الحيوية', floor: 'الطابق الثاني', status: 'closed', currentNumber: 0, waiting: 0, paused: false },
      { id: 'eye', name: 'عيادة العيون', floor: 'الطابق الثاني', status: 'closed', currentNumber: 0, waiting: 0, paused: false },
      { id: 'internal', name: 'عيادة الباطنية', floor: 'الطابق الثاني', status: 'closed', currentNumber: 0, waiting: 0, paused: false },
      { id: 'surgery', name: 'عيادة الجراحة العامة', floor: 'الطابق الثاني', status: 'closed', currentNumber: 0, waiting: 0, paused: false },
      { id: 'ortho', name: 'عيادة العظام والمفاصل', floor: 'الطابق الثاني', status: 'closed', currentNumber: 0, waiting: 0, paused: false },
      { id: 'ent', name: 'عيادة أنف وأذن وحنجرة', floor: 'الطابق الثاني', status: 'closed', currentNumber: 0, waiting: 0, paused: false },
      { id: 'psych', name: 'عيادة النفسية', floor: 'الطابق الثاني', status: 'closed', currentNumber: 0, waiting: 0, paused: false },
      { id: 'dental', name: 'عيادة الأسنان', floor: 'الطابق الثاني', status: 'closed', currentNumber: 0, waiting: 0, paused: false }
    ]
  }

  get(key) {
    try {
      const data = localStorage.getItem(this.prefix + key)
      return data ? JSON.parse(data) : null
    } catch {
      return null
    }
  }

  set(key, value) {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  }

  // إدارة المرضى
  addPatient(patientData) {
    const patients = this.get('patients') || []
    const patient = {
      id: Date.now().toString(36),
      ...patientData,
      createdAt: new Date().toISOString(),
      status: 'waiting',
      currentClinic: null,
      completedClinics: []
    }
    patients.push(patient)
    this.set('patients', patients)
    this.updateStats()
    return patient
  }

  getPatient(id) {
    const patients = this.get('patients') || []
    return patients.find(p => p.id === id || p.patientId === id)
  }

  updatePatient(id, updates) {
    const patients = this.get('patients') || []
    const index = patients.findIndex(p => p.id === id || p.patientId === id)
    if (index !== -1) {
      patients[index] = { ...patients[index], ...updates }
      this.set('patients', patients)
      this.updateStats()
      return patients[index]
    }
    return null
  }

  // إدارة الطوابير
  addToQueue(clinicId, patientId) {
    const queues = this.get('queues') || []
    const clinics = this.get('clinics') || []
    const clinic = clinics.find(c => c.id === clinicId)
    
    if (clinic) {
      const queueNumber = clinic.currentNumber + clinic.waiting + 1
      const queueItem = {
        id: Date.now().toString(36),
        clinicId,
        patientId,
        queueNumber,
        status: 'waiting',
        enteredAt: new Date().toISOString(),
        calledAt: null,
        completedAt: null
      }
      
      queues.push(queueItem)
      clinic.waiting += 1
      
      this.set('queues', queues)
      this.set('clinics', clinics)
      this.updateStats()
      
      return queueItem
    }
    return null
  }

  getClinicQueues(clinicId) {
    const queues = this.get('queues') || []
    return queues.filter(q => q.clinicId === clinicId && q.status === 'waiting')
  }

  // استدعاء المراجع التالي
  callNextPatient(clinicId) {
    const queues = this.get('queues') || []
    const clinics = this.get('clinics') || []
    const clinic = clinics.find(c => c.id === clinicId)
    
    if (!clinic || clinic.paused) {
      return { success: false, error: 'Clinic not available' }
    }

    const waitingQueue = queues.filter(q => q.clinicId === clinicId && q.status === 'waiting')
      .sort((a, b) => new Date(a.enteredAt) - new Date(b.enteredAt))
    
    if (waitingQueue.length === 0) {
      return { success: false, error: 'No patients waiting' }
    }

    const nextPatient = waitingQueue[0]
    nextPatient.status = 'called'
    nextPatient.calledAt = new Date().toISOString()
    
    clinic.currentNumber = nextPatient.queueNumber
    clinic.waiting -= 1
    
    this.set('queues', queues)
    this.set('clinics', clinics)
    this.updateStats()
    
    // إضافة إشعار
    this.addNotification({
      type: 'YOUR_TURN',
      patientId: nextPatient.patientId,
      clinicId: clinicId,
      message: `دورك الآن في ${clinic.name}`,
      queueNumber: nextPatient.queueNumber
    })
    
    return { success: true, patient: nextPatient, clinic }
  }

  // إكمال خدمة المراجع
  completePatient(clinicId, patientId) {
    const queues = this.get('queues') || []
    const patients = this.get('patients') || []
    
    const queueItem = queues.find(q => 
      q.clinicId === clinicId && 
      q.patientId === patientId && 
      q.status === 'called'
    )
    
    if (queueItem) {
      queueItem.status = 'completed'
      queueItem.completedAt = new Date().toISOString()
      
      const patient = patients.find(p => p.id === patientId || p.patientId === patientId)
      if (patient) {
        patient.completedClinics = patient.completedClinics || []
        patient.completedClinics.push(clinicId)
        patient.currentClinic = null
      }
      
      this.set('queues', queues)
      this.set('patients', patients)
      this.updateStats()
      
      return { success: true }
    }
    
    return { success: false, error: 'Patient not found or not called' }
  }

  // إيقاف/تشغيل الطابور
  pauseQueue(clinicId) {
    const clinics = this.get('clinics') || []
    const clinic = clinics.find(c => c.id === clinicId)
    
    if (clinic) {
      clinic.paused = !clinic.paused
      this.set('clinics', clinics)
      return { success: true, paused: clinic.paused }
    }
    
    return { success: false, error: 'Clinic not found' }
  }

  // إدارة البنكود (PINs)
  generatePIN(clinicId) {
    const pins = this.get('pins') || []
    const pin = {
      id: Date.now().toString(36),
      clinicId,
      pin: Math.floor(1000 + Math.random() * 9000).toString(),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      active: true
    }
    pins.push(pin)
    this.set('pins', pins)
    return pin
  }

  validatePIN(clinicId, pin) {
    const pins = this.get('pins') || []
    const validPin = pins.find(p => 
      p.clinicId === clinicId && 
      p.pin === pin && 
      p.active && 
      new Date(p.expiresAt) > new Date()
    )
    return !!validPin
  }

  getActivePINs() {
    const pins = this.get('pins') || []
    return pins.filter(p => p.active && new Date(p.expiresAt) > new Date())
  }

  deactivatePIN(pinId) {
    const pins = this.get('pins') || []
    const pin = pins.find(p => p.id === pinId)
    if (pin) {
      pin.active = false
      this.set('pins', pins)
      return true
    }
    return false
  }

  // فتح/إغلاق العيادات
  openClinic(clinicId, pin) {
    if (!this.validatePIN(clinicId, pin)) {
      return { success: false, error: 'Invalid PIN' }
    }
    
    const clinics = this.get('clinics') || []
    const clinic = clinics.find(c => c.id === clinicId)
    if (clinic) {
      clinic.status = 'open'
      this.set('clinics', clinics)
      return { success: true, clinic }
    }
    return { success: false, error: 'Clinic not found' }
  }

  closeClinic(clinicId) {
    const clinics = this.get('clinics') || []
    const clinic = clinics.find(c => c.id === clinicId)
    if (clinic) {
      clinic.status = 'closed'
      this.set('clinics', clinics)
      return { success: true, clinic }
    }
    return { success: false, error: 'Clinic not found' }
  }

  // نظام الإشعارات
  addNotification(notification) {
    const notifications = this.get('notifications') || []
    const newNotification = {
      id: Date.now().toString(36),
      ...notification,
      createdAt: new Date().toISOString(),
      read: false
    }
    notifications.unshift(newNotification)
    
    // الاحتفاظ بآخر 50 إشعار فقط
    if (notifications.length > 50) {
      notifications.splice(50)
    }
    
    this.set('notifications', notifications)
    return newNotification
  }

  getNotifications(patientId = null) {
    const notifications = this.get('notifications') || []
    if (patientId) {
      return notifications.filter(n => n.patientId === patientId)
    }
    return notifications
  }

  markNotificationRead(notificationId) {
    const notifications = this.get('notifications') || []
    const notification = notifications.find(n => n.id === notificationId)
    if (notification) {
      notification.read = true
      this.set('notifications', notifications)
      return true
    }
    return false
  }

  // التقارير
  generateReport(type, format = 'json') {
    const stats = this.getStats()
    const patients = this.get('patients') || []
    const queues = this.get('queues') || []
    const clinics = this.get('clinics') || []
    
    const report = {
      id: Date.now().toString(36),
      type,
      format,
      generatedAt: new Date().toISOString(),
      data: {
        stats,
        totalPatients: patients.length,
        totalQueues: queues.length,
        clinicsStatus: clinics.map(c => ({
          id: c.id,
          name: c.name,
          status: c.status,
          currentNumber: c.currentNumber,
          waiting: c.waiting
        }))
      }
    }
    
    const reports = this.get('reports') || []
    reports.unshift(report)
    
    // الاحتفاظ بآخر 20 تقرير
    if (reports.length > 20) {
      reports.splice(20)
    }
    
    this.set('reports', reports)
    return report
  }

  getReports() {
    return this.get('reports') || []
  }

  // تحديث الإحصائيات
  updateStats() {
    const patients = this.get('patients') || []
    const queues = this.get('queues') || []
    
    const waitingQueues = queues.filter(q => q.status === 'waiting')
    const completedQueues = queues.filter(q => q.status === 'completed')
    
    // حساب متوسط وقت الانتظار
    let totalWaitTime = 0
    completedQueues.forEach(q => {
      if (q.calledAt && q.enteredAt) {
        const waitTime = new Date(q.calledAt) - new Date(q.enteredAt)
        totalWaitTime += waitTime
      }
    })
    
    const avgWaitTime = completedQueues.length > 0 
      ? Math.round(totalWaitTime / completedQueues.length / 1000 / 60) // بالدقائق
      : 0
    
    const stats = {
      totalPatients: patients.length,
      totalWaiting: waitingQueues.length,
      totalCompleted: completedQueues.length,
      avgWaitTime
    }
    
    this.set('stats', stats)
    return stats
  }

  getStats() {
    return this.get('stats') || {
      totalPatients: 0,
      totalWaiting: 0,
      totalCompleted: 0,
      avgWaitTime: 0
    }
  }

  getClinics() {
    return this.get('clinics') || this.getDefaultClinics()
  }

  // إعادة تعيين النظام
  resetSystem() {
    const clinics = this.getDefaultClinics()
    this.set('patients', [])
    this.set('queues', [])
    this.set('clinics', clinics)
    this.set('notifications', [])
    this.updateStats()
    return { success: true, message: 'System reset successfully' }
  }

  // مسح البيانات (للاختبار فقط)
  clearAll() {
    const keys = ['patients', 'queues', 'pins', 'stats', 'clinics', 'reports', 'notifications', 'initialized']
    keys.forEach(key => localStorage.removeItem(this.prefix + key))
    this.init()
  }
}

const offlineStorage = new OfflineStorage()
export default offlineStorage

