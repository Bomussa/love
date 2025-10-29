/**
 * Core Layer (الطبقة الوسطية) — بنية وخدمات مشتركة
 * - توزيع المسارات
 * - الكاش (in-memory + optional Redis)
 * - Circuit Breaker
 * - مراقبة مبسطة
 */

export class CircuitBreaker {
  constructor({ failureThreshold = 5, successThreshold = 2, timeout = 10000 } = {}) {
    this.failureThreshold = failureThreshold;
    this.successThreshold = successThreshold;
    this.timeout = timeout;
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextTry = 0;
  }

  async exec(fn) {
    const now = Date.now();
    if (this.state === 'OPEN') {
      if (now > this.nextTry) {
        this.state = 'HALF';
      } else {
        throw new Error('Circuit open');
      }
    }
    try {
      const res = await fn();
      if (this.state === 'HALF') {
        this.successCount++;
        if (this.successCount >= this.successThreshold) {
          this.state = 'CLOSED';
          this.failureCount = 0;
          this.successCount = 0;
        }
      }
      return res;
    } catch (e) {
      this.failureCount++;
      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
        this.nextTry = Date.now() + this.timeout;
      }
      throw e;
    }
  }
}

export const MemoryCache = (() => {
  const store = new Map();
  return {
    get: (k) => store.get(k),
    set: (k, v, ttlMs = 0) => {
      store.set(k, v);
      if (ttlMs > 0) setTimeout(() => store.delete(k), ttlMs).unref?.();
    },
    del: (k) => store.delete(k),
  };
})();

export function writeThrough(setDbFn, invalidateCacheFn) {
  return async (key, value) => {
    await setDbFn(key, value);
    await invalidateCacheFn(key); // Redis-like: DEL key
    return true;
  };
}
