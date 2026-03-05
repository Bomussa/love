/**
 * Retry Strategy - استراتيجية إعادة المحاولة الذكية
 * تطبيق exponential backoff مع jitter للطلبات الفاشلة
 */

class RetryStrategy {
  constructor(options = {}) {
    this.maxAttempts = options.maxAttempts || 5;
    this.initialDelay = options.initialDelay || 100; // ملي ثانية
    this.maxDelay = options.maxDelay || 30000; // 30 ثانية
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.jitterFactor = options.jitterFactor || 0.1;
    this.retryableStatusCodes = options.retryableStatusCodes || [408, 429, 500, 502, 503, 504];
  }

  /**
   * تحديد ما إذا كان يجب إعادة المحاولة
   */
  shouldRetry(error, attempt) {
    if (attempt >= this.maxAttempts) {
      return false;
    }

    // إعادة محاولة أخطاء الشبكة
    if (!error.response) {
      return true;
    }

    // إعادة محاولة رموز الحالة المحددة
    return this.retryableStatusCodes.includes(error.response.status);
  }

  /**
   * حساب التأخير قبل إعادة المحاولة
   */
  calculateDelay(attempt) {
    // exponential backoff
    let delay = this.initialDelay * Math.pow(this.backoffMultiplier, attempt);

    // تطبيق الحد الأقصى
    delay = Math.min(delay, this.maxDelay);

    // إضافة jitter لتجنب thundering herd
    const jitter = delay * this.jitterFactor * Math.random();
    return delay + jitter;
  }

  /**
   * تنفيذ دالة مع إعادة محاولة
   */
  async execute(fn, context = {}) {
    let lastError;

    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (!this.shouldRetry(error, attempt)) {
          throw error;
        }

        const delay = this.calculateDelay(attempt);
        console.warn(
          `⚠️ Retry attempt ${attempt + 1}/${this.maxAttempts} after ${delay.toFixed(0)}ms`,
          {
            error: error.message,
            ...context,
          }
        );

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * دالة مساعدة للانتظار
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * تنفيذ طلب HTTP مع إعادة محاولة
   */
  async executeRequest(url, options = {}) {
    return this.execute(async () => {
      const response = await fetch(url, options);
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.response = response;
        throw error;
      }
      return response;
    });
  }
}

// إنشاء مثيلات مختلفة
export const aggressiveRetry = new RetryStrategy({
  maxAttempts: 10,
  initialDelay: 50,
  maxDelay: 10000,
});

export const normalRetry = new RetryStrategy({
  maxAttempts: 5,
  initialDelay: 100,
  maxDelay: 30000,
});

export const conservativeRetry = new RetryStrategy({
  maxAttempts: 3,
  initialDelay: 500,
  maxDelay: 10000,
});

export default RetryStrategy;
