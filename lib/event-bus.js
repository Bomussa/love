class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    const eventListeners = this.listeners.get(event);
    eventListeners.add(callback);
    return () => {
      eventListeners.delete(callback);
      if (eventListeners.size === 0) this.listeners.delete(event);
    };
  }

  emit(event, payload) {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return;
    for (const listener of eventListeners) {
      try {
        listener(payload);
      } catch {
        // Ignore listener-side errors to keep bus resilient
      }
    }
  }
}

const eventBus = new EventBus();
export default eventBus;
