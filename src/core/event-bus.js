// Event Bus - ناقل الأحداث المركزي (Browser Version)
class EventBus {
  constructor() {
    this.listeners = new Map()
    this.history = []
    this.maxHistory = 100
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event).add(callback)
    
    return () => this.off(event, callback)
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback)
    }
  }

  emit(event, data) {
    const payload = {
      event,
      data,
      timestamp: new Date().toISOString()
    }

    // حفظ في التاريخ
    this.history.push(payload)
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }

    // إرسال للمستمعين
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        try {
          callback(data, payload)
        } catch (error) {
          console.error(`[EventBus] Error in listener for ${event}:`, error)
        }
      }
    }

    // إرسال للمستمعين العامين (*)
    if (this.listeners.has('*')) {
      for (const callback of this.listeners.get('*')) {
        try {
          callback(data, payload)
        } catch (error) {
          console.error(`[EventBus] Error in wildcard listener:`, error)
        }
      }
    }

    // تسجيل في console للتطوير
    if (import.meta.env.DEV) {
      console.log(`[EventBus] ${event}:`, data)
    }
  }

  getHistory(event = null) {
    if (event) {
      return this.history.filter(h => h.event === event)
    }
    return [...this.history]
  }

  clear() {
    this.listeners.clear()
    this.history = []
  }
}

// Singleton instance
const eventBus = new EventBus()

export default eventBus
export { EventBus }

