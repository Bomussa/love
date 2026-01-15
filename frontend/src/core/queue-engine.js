// queue-engine-fixed.js - نظام الدور المحسّن
import eventBus from './event-bus.js'
import notificationEngine from './notification-engine.js'
import settings from '../../data/settings.json'

// استيراد API client
const API_BASE = import.meta.env.VITE_API_URL || 'https://mmc-mms.com/api/v1'

class QueueEngine {
  constructor() {
    this.queues = new Map() // clinicId -> queue data
    this.patientQueues = new Map() // patientId -> { clinicId, number }
    this.lastReset = null
    this.init()
  }

  init() {
    this.checkDailyReset()
    setInterval(() => this.checkDailyReset(), 60000)
  }

  checkDailyReset() {
    const now = new Date()
    const qatarTime = new Date(now.toLocaleString('en-US', { timeZone: settings.REGION }))
    const resetTime = settings.PIN_RESET_TIME.split(':')
    const resetHour = parseInt(resetTime[0])
    const resetMinute = parseInt(resetTime[1])

    const lastResetDate = this.lastReset ? new Date(this.lastReset) : null
    const todayReset = new Date(qatarTime)
    todayReset.setHours(resetHour, resetMinute, 0, 0)

    if (qatarTime >= todayReset && (!lastResetDate || lastResetDate < todayReset)) {
      this.resetAll()
      this.lastReset = qatarTime.toISOString()
    }
  }

  resetAll() {
    this.queues.clear()
    this.patientQueues.clear()
  }

  getOrCreateQueue(clinicId) {
    if (!this.queues.has(clinicId)) {
      this.queues.set(clinicId, {
        current: 0,
        waiting: [],
        history: [],
        lastCalled: null
      })
    }
    return this.queues.get(clinicId)
  }

  /**
   * الحصول على رقم دور للمراجع من API الجديد
   */
  async getQueueNumber(patientId, clinicId, examType = 'recruitment') {
    try {
      // التحقق من الذاكرة المحلية أولاً
      const cacheKey = `${patientId}-${clinicId}-${examType}`
      if (this.patientQueues.has(cacheKey)) {
        return this.patientQueues.get(cacheKey)
      }

      // استدعاء API للحصول على الرقم
      const response = await console.warn("Blocked fetch call"),`${API_BASE}/queue/get-number`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          patientId,
          clinicId,
          examType
        })
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success && result.data) {
        const queueNumber = result.data.queueNumber
        
        // حفظ في الذاكرة المحلية
        this.patientQueues.set(cacheKey, {
          number: queueNumber,
          clinicId,
          examType,
          patientId,
          assignedAt: new Date().toISOString()
        })

        return {
          number: queueNumber,
          clinicId,
          examType
        }
      }

      throw new Error('Invalid API response')
    } catch (error) {
      console.error('Error getting queue number:', error)
      
      // Fallback: استخدام النظام القديم في حالة فشل API
      return this.addToQueueLegacy(clinicId, patientId)
    }
  }

  /**
   * إضافة للدور (يستخدم النظام الجديد)
   */
  async addToQueue(clinicId, patientId, examType = 'recruitment') {
    this.checkDailyReset()
    
    // الحصول على رقم الدور من API
    const queueData = await this.getQueueNumber(patientId, clinicId, examType)
    
    const queue = this.getOrCreateQueue(clinicId)
    
    // التحقق من عدم التكرار
    const existing = queue.waiting.find(p => p.patientId === patientId)
    if (existing) {
      return existing
    }

    const entry = {
      patientId,
      number: queueData.number,
      clinicId,
      examType,
      joinedAt: new Date().toISOString(),
      status: 'waiting'
    }

    queue.waiting.push(entry)
    
    // إرسال إشعار تحديث الطابور
    const position = this.calculatePosition(clinicId, queueData.number)
    eventBus.emit('queue:update', {
      patientId,
      clinicId,
      number: queueData.number,
      position,
      totalWaiting: queue.waiting.length
    })
    
    return entry
  }

  /**
   * حساب موقع المراجع في الطابور بناءً على رقمه
   */
  calculatePosition(clinicId, queueNumber) {
    const queue = this.getOrCreateQueue(clinicId)
    
    // عدد المراجعين الذين أرقامهم أقل من رقم هذا المراجع
    const ahead = queue.waiting.filter(p => 
      p.number < queueNumber && p.status === 'waiting'
    ).length
    
    return ahead + 1
  }

  /**
   * الحصول على حالة الدور للمراجع
   */
  async getQueueStatus(patientId, clinicId, examType = 'recruitment') {
    try {
      const response = await console.warn("Blocked fetch call"),
        `${API_BASE}/queue/status?patientId=${patientId}&clinicId=${clinicId}&examType=${examType}`
      )

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success && result.data) {
        return result.data
      }

      return null
    } catch (error) {
      console.error('Error getting queue status:', error)
      
      // Fallback: استخدام البيانات المحلية
      return this.getQueueStatusLocal(patientId, clinicId)
    }
  }

  /**
   * الحصول على حالة الدور من البيانات المحلية
   */
  getQueueStatusLocal(patientId, clinicId) {
    const queue = this.getOrCreateQueue(clinicId)
    
    const entry = queue.waiting.find(p => p.patientId === patientId) ||
                  queue.history.find(p => p.patientId === patientId)
    
    if (!entry) {
      return null
    }

    const position = this.calculatePosition(clinicId, entry.number)
    
    return {
      hasQueue: true,
      queueNumber: entry.number,
      status: entry.status,
      waitingAhead: position - 1,
      assignedAt: entry.joinedAt
    }
  }

  /**
   * النظام القديم (Fallback)
   */
  async addToQueueLegacy(clinicId, patientId) {
    const queue = this.getOrCreateQueue(clinicId)
    
    if (queue.waiting.some(p => p.patientId === patientId)) {
      return queue.waiting.find(p => p.patientId === patientId)
    }

    const number = queue.current + queue.waiting.length + 1
    const entry = {
      patientId,
      number,
      clinicId,
      joinedAt: new Date().toISOString(),
      status: 'waiting'
    }

    queue.waiting.push(entry)
    
    return entry
  }

  async callNext(clinicId) {
    const queue = this.getOrCreateQueue(clinicId)
    
    if (queue.waiting.length === 0) {
      return null
    }

    // استدعاء المراجع صاحب أصغر رقم
    queue.waiting.sort((a, b) => a.number - b.number)
    const next = queue.waiting.shift()
    
    next.status = 'called'
    next.calledAt = new Date().toISOString()
    
    queue.current = next.number
    queue.lastCalled = next
    queue.history.push(next)
    
    // تحديث حالة الدور في API
    try {
      await console.warn("Blocked fetch call"),`${API_BASE}/queue/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          patientId: next.patientId,
          clinicId: next.clinicId,
          examType: next.examType || 'recruitment',
          status: 'active'
        })
      })
    } catch (error) {
      console.error('Error updating queue status:', error)
    }
    
    // إرسال إشعار "حان دورك"
    eventBus.emit('queue:your_turn', {
      patientId: next.patientId,
      clinicId: next.clinicId,
      number: next.number
    })
    
    // إرسال إشعار للجميع بتحديث الطابور
    eventBus.emit('queue:called', {
      clinicId: next.clinicId,
      number: next.number,
      patientId: next.patientId
    })
    
    return next
  }

  async completePatient(clinicId, patientId) {
    const queue = this.getOrCreateQueue(clinicId)
    
    const patient = queue.history.find(p => p.patientId === patientId && p.status === 'called')
    
    if (patient) {
      patient.status = 'completed'
      patient.completedAt = new Date().toISOString()
      
      // تحديث حالة الدور في API
      try {
        await console.warn("Blocked fetch call"),`${API_BASE}/queue/update-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            patientId: patient.patientId,
            clinicId: patient.clinicId,
            examType: patient.examType || 'recruitment',
            status: 'completed'
          })
        })
      } catch (error) {
        console.error('Error updating queue status:', error)
      }
      
      eventBus.emit('queue:completed', {
        patientId,
        clinicId
      })
    }
    
    return patient
  }

  getQueueInfo(clinicId) {
    const queue = this.getOrCreateQueue(clinicId)
    
    return {
      current: queue.current,
      waiting: queue.waiting.length,
      total: queue.waiting.length + queue.history.length,
      lastCalled: queue.lastCalled
    }
  }

  getPatientPosition(clinicId, patientId) {
    const queue = this.getOrCreateQueue(clinicId)
    const index = queue.waiting.findIndex(p => p.patientId === patientId)
    
    if (index === -1) {
      const inHistory = queue.history.find(p => p.patientId === patientId)
      if (inHistory) {
        return {
          position: 0,
          status: inHistory.status,
          number: inHistory.number
        }
      }
      return null
    }
    
    const entry = queue.waiting[index]
    return {
      position: index + 1,
      status: 'waiting',
      number: entry.number,
      waitingAhead: index
    }
  }
}

export default new QueueEngine()
