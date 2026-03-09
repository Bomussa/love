// Event Bus - ناقل الأحداث المركزي (Enhanced with SSE)
class EventBus {
  constructor() {
    this.listeners = new Map();
    this.history = [];
    this.maxHistory = 100;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    const payload = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };

    // حفظ في التاريخ
    this.history.push(payload);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // إرسال للمستمعين
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        try {
          callback(data, payload);
        } catch (error) {
          // console.error(`[EventBus] Error in listener for ${event}:`, error)
        }
      }
    }

    // إرسال للمستمعين العامين (*)
    if (this.listeners.has('*')) {
      for (const callback of this.listeners.get('*')) {
        try {
          callback(data, payload);
        } catch (error) {
          // console.error(`[EventBus] Error in wildcard listener:`, error)
        }
      }
    }

    // تسجيل في console للتطوير
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
      //
    }
  }

  getHistory(event = null) {
    if (event) {
      return this.history.filter((h) => h.event === event);
    }
    return [...this.history];
  }

  clear() {
    this.listeners.clear();
    this.history = [];
  }
}

// Singleton instance
const eventBus = new EventBus();

export default eventBus;
export { EventBus };

// === اتصال SSE المركزي (من 2027) ===
// يتم إنشاء اتصال واحد فقط بـ Backend ويغذي eventBus

let sseConnection = null;
let reconnectTimer = null;
const RECONNECT_DELAY = 5000;

function connectToSSE() {
  // تم عزل مسار SSE القديم حتى يتم نشر endpoint رسمي في API_CONTRACT.
  if (sseConnection) return;
  eventBus.emit('sse:unsupported', { reason: 'No contracted SSE endpoint in API_CONTRACT' });
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
  // تعطيل SSE مؤقتاً - الاعتماد على polling فقط
  // setTimeout(() => {
  //   connectToSSE();
  // }, 1000);

  // // إعادة الاتصال عند عودة الصفحة من hidden
  // document.addEventListener('visibilitychange', () => {
  //   if (!document.hidden && !sseConnection) {
  //     ;
  //     connectToSSE();
  //   }
  // });

  // تصدير للاستخدام اليدوي
  window.eventBusSSE = {
    connect: connectToSSE,
    disconnect: disconnectSSE,
    isConnected: () => false, // Always return false when SSE disabled
  };
}

export { connectToSSE, disconnectSSE };
