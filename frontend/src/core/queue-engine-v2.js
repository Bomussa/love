// محرك الطوابير (Queue Engine) - النسخة المحدثة مع Supabase
import eventBus from './event-bus.js'
import notificationEngine from './notification-engine.js'
import settings from '../../data/settings.json'
import supabaseApi from '../lib/supabase-api.js'

class QueueEngineV2 {
  constructor() {
    this.cache = new Map() // Local cache for performance
    this.lastReset = null
    this.init()
  }

  init() {
    this.checkDailyReset()
    setInterval(() => this.checkDailyReset(), 60000)
    console.log('[QueueEngineV2] Initialized with Supabase integration')
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
    this.cache.clear()
    console.log('[QueueEngineV2] Daily reset completed')
  }

  /**
   * Add patient to queue (or get existing entry)
   * @param {string} clinicId - Clinic ID
   * @param {string} patientId - Patient ID (military or personal number)
   * @param {string} patientName - Patient name
   * @param {string} examType - Exam type
   * @returns {Promise<Object>} Queue entry with position
   */
  async addToQueue(clinicId, patientId, patientName = '', examType = 'general') {
    try {
      this.checkDailyReset()

      // Get or create queue entry from Supabase
      const result = await supabaseApi.getOrCreateQueueEntry(
        patientId,
        clinicId,
        patientName,
        examType
      )

      if (!result.success) {
        throw new Error('Failed to create queue entry')
      }

      const entry = result.queueEntry
      const isNew = result.isNew

      // Update local cache
      const cacheKey = `${patientId}-${clinicId}`
      this.cache.set(cacheKey, entry)

      // Emit events
      if (isNew) {
        eventBus.emit('queue:joined', {
          patientId,
          clinicId,
          position: entry.position,
          number: entry.position
        })
      }

      eventBus.emit('queue:update', {
        patientId,
        clinicId,
        position: entry.position,
        status: entry.status
      })

      console.log(`[QueueEngineV2] Patient ${patientId} ${isNew ? 'added to' : 'found in'} queue at position ${entry.position}`)

      return {
        patientId: entry.patient_id,
        number: entry.position,
        position: entry.position,
        clinicId: entry.clinic_id,
        status: entry.status,
        joinedAt: entry.entered_at,
        isNew
      }
    } catch (error) {
      console.error('[QueueEngineV2] addToQueue error:', error)
      throw error
    }
  }

  /**
   * Call next patient in queue
   * @param {string} clinicId - Clinic ID
   * @returns {Promise<Object|null>} Called patient or null
   */
  async callNext(clinicId) {
    try {
      // This would be implemented with Supabase function
      // For now, keeping the basic structure
      console.log(`[QueueEngineV2] callNext for clinic ${clinicId}`)
      
      // TODO: Implement with Supabase
      // - Update status from 'waiting' to 'called'
      // - Set called_at timestamp
      // - Emit events
      
      return null
    } catch (error) {
      console.error('[QueueEngineV2] callNext error:', error)
      throw error
    }
  }

  /**
   * Get queue status for a clinic
   * @param {string} clinicId - Clinic ID
   * @returns {Promise<Object>} Queue status
   */
  async getQueueStatus(clinicId) {
    try {
      const status = await supabaseApi.getQueueStatus(clinicId)
      
      if (!status.success) {
        throw new Error('Failed to get queue status')
      }

      return {
        clinicId: status.clinicId,
        current: status.current,
        waiting: status.waiting,
        paused: false, // TODO: Implement pause functionality
        lastCalled: status.currentPatient,
        avgWaitTime: 0 // TODO: Calculate from history
      }
    } catch (error) {
      console.error('[QueueEngineV2] getQueueStatus error:', error)
      return {
        clinicId,
        current: 0,
        waiting: 0,
        paused: false,
        lastCalled: null,
        avgWaitTime: 0
      }
    }
  }

  /**
   * Get patient position in queue
   * @param {string} clinicId - Clinic ID
   * @param {string} patientId - Patient ID
   * @returns {Promise<Object|null>} Position info or null
   */
  async getPatientPosition(clinicId, patientId) {
    try {
      // Check cache first
      const cacheKey = `${patientId}-${clinicId}`
      const cached = this.cache.get(cacheKey)
      
      if (cached && (Date.now() - new Date(cached.entered_at).getTime()) < 60000) {
        // Cache valid for 1 minute
        return {
          position: cached.position,
          number: cached.position,
          current: 0, // TODO: Get from queue status
          ahead: cached.position - 1,
          estimatedWait: (cached.position - 1) * settings.QUEUE_INTERVAL_SECONDS / 60
        }
      }

      // Get from Supabase
      const result = await supabaseApi.getPatientPosition(patientId, clinicId)
      
      if (!result.success || !result.found) {
        return null
      }

      // Update cache
      this.cache.set(cacheKey, {
        position: result.position,
        entered_at: result.enteredAt
      })

      return {
        position: result.position,
        number: result.position,
        current: 0, // TODO: Get from queue status
        ahead: result.ahead,
        estimatedWait: result.ahead * settings.QUEUE_INTERVAL_SECONDS / 60
      }
    } catch (error) {
      console.error('[QueueEngineV2] getPatientPosition error:', error)
      return null
    }
  }

  /**
   * Get all queues status
   * @returns {Promise<Array>} Array of queue statuses
   */
  async getAllQueues() {
    try {
      // TODO: Implement with Supabase to get all clinics
      const clinicIds = ['lab', 'vitals', 'dental', 'eye', 'ent', 'surgery', 'internal', 'final']
      const statuses = []

      for (const clinicId of clinicIds) {
        const status = await this.getQueueStatus(clinicId)
        statuses.push(status)
      }

      return statuses
    } catch (error) {
      console.error('[QueueEngineV2] getAllQueues error:', error)
      return []
    }
  }

  /**
   * Pause queue for a clinic
   * @param {string} clinicId - Clinic ID
   * @returns {Promise<Object>} Updated queue status
   */
  async pauseQueue(clinicId) {
    try {
      // TODO: Implement with Supabase
      console.log(`[QueueEngineV2] pauseQueue for clinic ${clinicId}`)
      return { success: true, clinicId, paused: true }
    } catch (error) {
      console.error('[QueueEngineV2] pauseQueue error:', error)
      throw error
    }
  }

  /**
   * Resume queue for a clinic
   * @param {string} clinicId - Clinic ID
   * @returns {Promise<Object>} Updated queue status
   */
  async resumeQueue(clinicId) {
    try {
      // TODO: Implement with Supabase
      console.log(`[QueueEngineV2] resumeQueue for clinic ${clinicId}`)
      return { success: true, clinicId, paused: false }
    } catch (error) {
      console.error('[QueueEngineV2] resumeQueue error:', error)
      throw error
    }
  }

  /**
   * Calculate average wait time
   * @param {Object} queue - Queue object
   * @returns {number} Average wait time in minutes
   */
  calculateAvgWaitTime(queue) {
    // TODO: Implement with historical data from Supabase
    return 0
  }
}

// Singleton instance
const queueEngineV2 = new QueueEngineV2()

export default queueEngineV2
export { QueueEngineV2 }
