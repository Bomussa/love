// محرك الطوابير (Queue Engine) - النظام الرسمي
import eventBus from './event-bus.js'
import notificationEngine from './notification-engine.js'
import settings from '../../data/settings.json'

class QueueEngine {
  constructor() {
    this.queues = new Map() // clinicId -> { current, waiting: [], history: [] }
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
    console.log(`[Queue Engine] Reset completed at ${new Date().toISOString()}`)
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

  async addToQueue(clinicId, patientId) {
    this.checkDailyReset()
    const queue = this.getOrCreateQueue(clinicId)
    
    // التحقق من عدم التكرار
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
    
    // إرسال إشعار تحديث الطابور
    const position = queue.waiting.length
    eventBus.emit('queue:update', {
      patientId,
      clinicId,
      position,
      totalWaiting: queue.waiting.length
    })
    
    return entry
  }

  async callNext(clinicId) {
    const queue = this.getOrCreateQueue(clinicId)
    
    if (queue.waiting.length === 0) {
      return null
    }

    const next = queue.waiting.shift()
    next.status = 'called'
    next.calledAt = new Date().toISOString()
    
    queue.current = next.number
    queue.lastCalled = next
    queue.history.push(next)
    
    // إرسال إشعار "حان دورك"
    eventBus.emit('queue:your_turn', {
      patientId: next.patientId,
      clinicId,
      clinicName: clinicId, // سيتم تحسينه لاحقاً
      number: next.number
    })
    
    // تحديث موقع باقي المنتظرين
    queue.waiting.forEach((entry, index) => {
      const position = index + 1
      eventBus.emit('queue:update', {
        patientId: entry.patientId,
        clinicId,
        position,
        totalWaiting: queue.waiting.length
      })
      
      // إشعار "اقترب دورك" للمراكز 1-3
      if (position <= 3) {
        eventBus.emit('queue:near_turn', {
          patientId: entry.patientId,
          clinicId,
          clinicName: clinicId,
          position
        })
      }
    })

    return next
  }

  async pauseQueue(clinicId) {
    const queue = this.getOrCreateQueue(clinicId)
    queue.paused = true
    queue.pausedAt = new Date().toISOString()
    return queue
  }

  async resumeQueue(clinicId) {
    const queue = this.getOrCreateQueue(clinicId)
    queue.paused = false
    queue.resumedAt = new Date().toISOString()
    return queue
  }

  getQueueStatus(clinicId) {
    const queue = this.getOrCreateQueue(clinicId)
    return {
      clinicId,
      current: queue.current,
      waiting: queue.waiting.length,
      paused: queue.paused || false,
      lastCalled: queue.lastCalled,
      avgWaitTime: this.calculateAvgWaitTime(queue)
    }
  }

  calculateAvgWaitTime(queue) {
    if (queue.history.length === 0) return 0

    const times = queue.history
      .filter(h => h.calledAt && h.joinedAt)
      .map(h => {
        const joined = new Date(h.joinedAt)
        const called = new Date(h.calledAt)
        return (called - joined) / 1000 / 60 // minutes
      })

    if (times.length === 0) return 0
    return Math.round(times.reduce((a, b) => a + b, 0) / times.length)
  }

  getPatientPosition(clinicId, patientId) {
    const queue = this.getOrCreateQueue(clinicId)
    const index = queue.waiting.findIndex(p => p.patientId === patientId)
    
    if (index === -1) return null

    return {
      position: index + 1,
      current: queue.current,
      ahead: index,
      estimatedWait: index * settings.QUEUE_INTERVAL_SECONDS / 60
    }
  }

  getAllQueues() {
    const result = []
    for (const [clinicId, queue] of this.queues.entries()) {
      result.push(this.getQueueStatus(clinicId))
    }
    return result
  }
}

// Singleton instance
const queueEngine = new QueueEngine()

export default queueEngine
export { QueueEngine }

