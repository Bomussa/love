// نظام التخزين الموحد - يعمل Offline و Online
import pinEngine from '../core/pin-engine.js'
import queueEngine from '../core/queue-engine.js'
import pathEngine from '../core/path-engine.js'
import notificationEngine from '../core/notification-engine.js'

class UnifiedStorage {
  constructor() {
    this.isOnline = false
    this.init()
  }

  init() {
    // فحص الاتصال
    this.checkConnection()
    window.addEventListener('online', () => this.handleOnline())
    window.addEventListener('offline', () => this.handleOffline())
  }

  checkConnection() {
    this.isOnline = navigator.onLine
  }

  handleOnline() {
    this.isOnline = true

    // مزامنة البيانات المحلية مع الخادم
    this.syncWithServer()
  }

  handleOffline() {
    this.isOnline = false

  }

  async syncWithServer() {
    // TODO: مزامنة البيانات المحلية مع الخادم

  }

  // ========== إدارة المرضى ==========
  
  addPatient(data) {
    const patients = this.getPatients()
    const patient = {
      id: data.id || `patient_${Date.now()}`,
      personalId: data.personalId,
      gender: data.gender,
      queueType: data.queueType || null,
      createdAt: new Date().toISOString(),
      status: 'active'
    }
    
    patients.push(patient)
    localStorage.setItem('mms_patients', JSON.stringify(patients))
    
    // إشعار البداية
    notificationEngine.subscribe(patient.id, (notification) => {

      // يمكن إضافة toast notification هنا
    })
    
    return patient
  }

  getPatients() {
    return JSON.parse(localStorage.getItem('mms_patients') || '[]')
  }

  getPatient(id) {
    const patients = this.getPatients()
    return patients.find(p => p.id === id)
  }

  updatePatient(id, updates) {
    const patients = this.getPatients()
    const index = patients.findIndex(p => p.id === id)
    
    if (index !== -1) {
      patients[index] = { ...patients[index], ...updates }
      localStorage.setItem('mms_patients', JSON.stringify(patients))
      return patients[index]
    }
    
    return null
  }

  // ========== نظام الطوابير (Queue) ==========
  
  async addToQueue(clinicId, patientId) {
    try {
      const entry = await queueEngine.addToQueue(clinicId, patientId)
      
      // حفظ في localStorage أيضاً
      const queues = JSON.parse(localStorage.getItem('mms_queues') || '[]')
      queues.push(entry)
      localStorage.setItem('mms_queues', JSON.stringify(queues))
      
      return entry
    } catch (error) {
      // // // // console.error('[Queue] Error:', error)
      throw error
    }
  }

  async callNext(clinicId) {
    try {
      const next = await queueEngine.callNext(clinicId)
      
      if (next) {
        // إشعار المراجع
        await notificationEngine.sendYourTurn(
          next.patientId,
          this.getClinicName(clinicId),
          next.number
        )
      }
      
      return next
    } catch (error) {
      // // // // console.error('[Queue] Error:', error)
      throw error
    }
  }

  getQueueStatus(clinicId) {
    return queueEngine.getQueueStatus(clinicId)
  }

  getAllQueues() {
    return queueEngine.getAllQueues()
  }

  async pauseQueue(clinicId) {
    return await queueEngine.pauseQueue(clinicId)
  }

  async resumeQueue(clinicId) {
    return await queueEngine.resumeQueue(clinicId)
  }

  // ========== نظام البنكود (PIN) ==========
  
  async generatePin(clinicId) {
    try {
      const pinData = await pinEngine.assignNextPin(clinicId)
      
      // حفظ في localStorage
      const pins = JSON.parse(localStorage.getItem('mms_pins') || '[]')
      pins.push(pinData)
      localStorage.setItem('mms_pins', JSON.stringify(pins))
      
      return pinData
    } catch (error) {
      // // // // console.error('[PIN] Error:', error)
      throw error
    }
  }

  async verifyPin(clinicId, pin) {
    return await pinEngine.verifyPin(clinicId, pin)
  }

  getActivePins() {
    return pinEngine.getActivePins()
  }

  async deactivatePin(clinicId) {
    const result = pinEngine.deactivatePin(clinicId)
    
    // تحديث localStorage
    const pins = JSON.parse(localStorage.getItem('mms_pins') || '[]')
    const updated = pins.filter(p => p.clinicId !== clinicId || !p.active)
    localStorage.setItem('mms_pins', JSON.stringify(updated))
    
    return result
  }

  // ========== المسارات الديناميكية (Path) ==========
  
  async initPatientPath(patientId, examType) {
    const path = await pathEngine.initializePatientPath(patientId, examType)
    
    // إضافة للعيادة الأولى تلقائياً
    const firstClinic = path.path[0]
    await this.addToQueue(firstClinic, patientId)
    
    return path
  }

  async advanceToNext(patientId, currentClinicId, status = 'completed') {
    const nextClinic = await pathEngine.advanceToNextClinic(patientId, currentClinicId, status)
    
    if (nextClinic) {
      // إضافة للعيادة التالية
      await this.addToQueue(nextClinic.clinicId, patientId)
      
      // إشعار المراجع
      await notificationEngine.sendStepDone(
        patientId,
        this.getClinicName(currentClinicId),
        nextClinic.name
      )
    }
    
    return nextClinic
  }

  getCurrentClinic(patientId) {
    return pathEngine.getCurrentClinic(patientId)
  }

  getFullPath(patientId) {
    return pathEngine.getFullPath(patientId)
  }

  // ========== العيادات ==========
  
  getClinics() {
    const defaultClinics = [
      { id: 'lab', name: 'المختبر والأشعة', floor: 'الميزانين', status: 'open' },
      { id: 'vitals', name: 'القياسات الحيوية', floor: 'الطابق الثاني', status: 'locked' },
      { id: 'dental', name: 'الأسنان', floor: 'الطابق الثاني', status: 'locked' },
      { id: 'eye', name: 'العيون', floor: 'الطابق الثاني', status: 'locked' },
      { id: 'ent', name: 'الأنف والأذن والحنجرة', floor: 'الطابق الثاني', status: 'locked' },
      { id: 'surgery', name: 'الجراحة', floor: 'الطابق الثالث', status: 'locked' },
      { id: 'internal', name: 'الباطنية', floor: 'الطابق الثالث', status: 'locked' },
      { id: 'final', name: 'اللجنة النهائية', floor: 'الطابق الرابع', status: 'locked' }
    ]

    const stored = localStorage.getItem('mms_clinics')
    return stored ? JSON.parse(stored) : defaultClinics
  }

  getClinicName(clinicId) {
    const clinics = this.getClinics()
    const clinic = clinics.find(c => c.id === clinicId)
    return clinic ? clinic.name : clinicId
  }

  updateClinicStatus(clinicId, status) {
    const clinics = this.getClinics()
    const clinic = clinics.find(c => c.id === clinicId)
    
    if (clinic) {
      clinic.status = status
      localStorage.setItem('mms_clinics', JSON.stringify(clinics))
      
      // إشعار الإدارة
      if (status === 'open') {
        notificationEngine.sendClinicOpened(clinic.name)
      } else if (status === 'closed') {
        notificationEngine.sendClinicClosed(clinic.name)
      }
    }
    
    return clinic
  }

  // ========== التقارير ==========
  
  async generateReport(type, date) {
    const report = {
      id: `report_${Date.now()}`,
      type,
      date: date || new Date().toISOString().split('T')[0],
      generatedAt: new Date().toISOString(),
      data: {
        patients: this.getPatients().length,
        queues: this.getAllQueues(),
        pins: this.getActivePins().length
      }
    }

    const reports = JSON.parse(localStorage.getItem('mms_reports') || '[]')
    reports.push(report)
    localStorage.setItem('mms_reports', JSON.stringify(reports))

    return report
  }

  getReports() {
    return JSON.parse(localStorage.getItem('mms_reports') || '[]')
  }

  // ========== الإحصائيات ==========
  
  getStats() {
    const patients = this.getPatients()
    const queues = this.getAllQueues()
    
    const totalWaiting = queues.reduce((sum, q) => sum + q.waiting, 0)
    const avgWaitTime = queues.length > 0
      ? Math.round(queues.reduce((sum, q) => sum + q.avgWaitTime, 0) / queues.length)
      : 0

    return {
      totalPatients: patients.length,
      activeQueues: queues.filter(q => !q.paused).length,
      totalWaiting,
      avgWaitTime,
      activePins: this.getActivePins().length
    }
  }

  // ========== إعادة التعيين ==========
  
  async resetAll() {
    // إعادة تعيين المحركات
    pinEngine.resetAll()
    queueEngine.resetAll()
    
    // مسح localStorage
    localStorage.removeItem('mms_patients')
    localStorage.removeItem('mms_queues')
    localStorage.removeItem('mms_pins')
    
    // إشعار الإدارة
    await notificationEngine.sendResetDone()
    
    return { success: true, message: 'تم إعادة تعيين النظام بنجاح' }
  }
}

// Singleton instance
const unifiedStorage = new UnifiedStorage()

export default unifiedStorage

