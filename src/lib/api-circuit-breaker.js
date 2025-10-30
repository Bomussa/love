// Circuit Breaker Pattern Implementation
// يحمي النظام من الفشل المتكرر للـ APIs الخارجية

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5 // عدد الفشل المسموح
    this.successThreshold = options.successThreshold || 2 // عدد النجاح للإغلاق
    this.timeout = options.timeout || 60000 // وقت الانتظار قبل Half-Open (60 ثانية)
    this.state = 'CLOSED' // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0
    this.successCount = 0
    this.nextAttempt = Date.now()
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0
    }
  }

  async execute(fn) {
    this.stats.totalRequests++

    // إذا كانت الدائرة مفتوحة (OPEN)
    if (this.state === 'OPEN') {
      // التحقق من وقت إعادة المحاولة
      if (Date.now() < this.nextAttempt) {
        this.stats.rejectedRequests++
        throw new Error('Circuit breaker is OPEN - request rejected')
      }
      // الانتقال إلى Half-Open للتجربة
      this.state = 'HALF_OPEN'
      console.log('🟡 Circuit breaker: OPEN → HALF_OPEN')
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  onSuccess() {
    this.stats.successfulRequests++
    this.failureCount = 0

    if (this.state === 'HALF_OPEN') {
      this.successCount++
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED'
        this.successCount = 0
        console.log('🟢 Circuit breaker: HALF_OPEN → CLOSED')
      }
    }
  }

  onFailure() {
    this.stats.failedRequests++
    this.failureCount++
    this.successCount = 0

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN'
      this.nextAttempt = Date.now() + this.timeout
      console.error(`🔴 Circuit breaker: ${this.state === 'HALF_OPEN' ? 'HALF_OPEN' : 'CLOSED'} → OPEN (failures: ${this.failureCount})`)
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt,
      stats: this.stats,
      reliability: this.stats.totalRequests > 0 
        ? (this.stats.successfulRequests / this.stats.totalRequests).toFixed(4)
        : 1.0
    }
  }

  reset() {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.successCount = 0
    this.nextAttempt = Date.now()
    console.log('🔄 Circuit breaker reset')
  }
}

export default CircuitBreaker
