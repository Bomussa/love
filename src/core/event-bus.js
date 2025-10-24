// Event Bus - ناقل الأحداث المركزي (Enhanced with SSE)
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
          // // // // console.error(`[EventBus] Error in listener for ${event}:`, error)
        }
      }
    }

    // إرسال للمستمعين العامين (*)
    if (this.listeners.has('*')) {
      for (const callback of this.listeners.get('*')) {
        try {
          callback(data, payload)
        } catch (error) {
          // // // // console.error(`[EventBus] Error in wildcard listener:`, error)
        }
      }
    }

    // تسجيل في console للتطوير
    if (import.meta.env.DEV) {

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

// === اتصال SSE المركزي (من 2027) ===
// يتم إنشاء اتصال واحد فقط بـ Backend ويغذي eventBus

let sseConnection = null;
let reconnectTimer = null;
const RECONNECT_DELAY = 5000;

function connectToSSE() {
  // تجنب اتصالات متعددة
  if (sseConnection) {

    return;
  }

  try {
    const url = `${window.location.origin}/api/v1/events/stream`;

    sseConnection = new EventSource(url);

    sseConnection.onopen = () => {

      eventBus.emit('sse:connected', { timestamp: new Date().toISOString() });
    };

    // الأحداث المختلفة من Backend
    sseConnection.addEventListener('queue_update', (e) => {
      try {
        const data = JSON.parse(e.data);
        eventBus.emit('queue:update', data);
      } catch (err) {
        // // // // console.error('[EventBus] Error parsing queue_update:', err);
      }
    });

    sseConnection.addEventListener('queue_call', (e) => {
      try {
        const data = JSON.parse(e.data);
        eventBus.emit('queue:call', data);
      } catch (err) {
        // // // // console.error('[EventBus] Error parsing queue_call:', err);
      }
    });

    sseConnection.addEventListener('heartbeat', (e) => {
      eventBus.emit('heartbeat', { timestamp: e.data });
    });

    sseConnection.addEventListener('notice', (e) => {
      try {
        const data = JSON.parse(e.data);
        eventBus.emit('notice', data);
      } catch (err) {
        // // // // console.error('[EventBus] Error parsing notice:', err);
      }
    });

    sseConnection.addEventListener('stats_update', (e) => {
      try {
        const data = JSON.parse(e.data);
        eventBus.emit('stats:update', data);
      } catch (err) {
        // // // // console.error('[EventBus] Error parsing stats_update:', err);
      }
    });

    sseConnection.onerror = (err) => {
      // // // // console.error('[EventBus] ❌ SSE Error:', err);
      eventBus.emit('sse:error', { error: err });
      
      // إغلاق الاتصال الحالي
      if (sseConnection) {
        sseConnection.close();
        sseConnection = null;
      }

      // إعادة الاتصال بعد تأخير
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {

          reconnectTimer = null;
          connectToSSE();
        }, RECONNECT_DELAY);
      }
    };

  } catch (err) {
    // // // // console.error('[EventBus] Failed to create SSE connection:', err);
  }
}

function disconnectSSE() {
  if (sseConnection) {
    sseConnection.close();
    sseConnection = null;

  }
  
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

// الاتصال التلقائي عند تحميل الصفحة
if (typeof window !== 'undefined') {
  // الانتظار قليلاً للسماح بتحميل التطبيق
  setTimeout(() => {
    connectToSSE();
  }, 1000);

  // إعادة الاتصال عند عودة الصفحة من hidden
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !sseConnection) {

      connectToSSE();
    }
  });

  // تصدير للاستخدام اليدوي
  window.eventBusSSE = {
    connect: connectToSSE,
    disconnect: disconnectSSE,
    isConnected: () => sseConnection !== null
  };
}

export { connectToSSE, disconnectSSE };

