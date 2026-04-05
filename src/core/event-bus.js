class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const bucket = this.listeners.get(event);
    if (!bucket) return;
    bucket.delete(callback);
    if (bucket.size === 0) this.listeners.delete(event);
  }

  emit(event, payload) {
    const bucket = this.listeners.get(event);
    if (!bucket) return;
    bucket.forEach((cb) => {
      try {
        cb(payload);
      } catch (error) {
        console.error('[event-bus] listener failed', error);
      }
    });
  }

  clear() {
    this.listeners.clear();
  }
}

const eventBus = new EventBus();
if (typeof window !== 'undefined') {
  window.eventBus = eventBus;
}

export default eventBus;
