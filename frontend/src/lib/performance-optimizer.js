/**
 * Performance Optimizer
 * 
 * تحسين الأداء من خلال:
 * - التخزين المؤقت الذكي
 * - إزالة الطلبات المكررة
 * - تقليل استهلاك الموارد
 * - تحسين سرعة التنقل
 */

class PerformanceOptimizer {
  constructor() {
    this.cache = new Map()
    this.pendingRequests = new Map()
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      deduplicatedRequests: 0,
      totalRequests: 0,
    }
  }

  /**
   * تخزين مؤقت ذكي مع TTL
   */
  async getCachedOrFetch(key, fetchFn, ttl = 30000) {
    this.metrics.totalRequests++

    // التحقق من الـ cache
    if (this.cache.has(key)) {
      const { data, expiresAt } = this.cache.get(key)
      
      if (Date.now() < expiresAt) {
        this.metrics.cacheHits++
        console.log(`✅ Cache hit for ${key}`)
        return data
      }

      // انتهت صلاحية الـ cache
      this.cache.delete(key)
    }

    this.metrics.cacheMisses++

    // إذا كان هناك طلب قيد الانتظار، انتظر النتيجة
    if (this.pendingRequests.has(key)) {
      console.log(`⏳ Waiting for pending request: ${key}`)
      return this.pendingRequests.get(key)
    }

    // تنفيذ الطلب
    const promise = fetchFn()
      .then((data) => {
        // حفظ في الـ cache
        this.cache.set(key, {
          data,
          expiresAt: Date.now() + ttl,
        })

        this.pendingRequests.delete(key)
        return data
      })
      .catch((error) => {
        this.pendingRequests.delete(key)
        throw error
      })

    this.pendingRequests.set(key, promise)
    return promise
  }

  /**
   * إزالة الطلبات المكررة
   */
  async deduplicateRequest(key, requestFn) {
    this.metrics.totalRequests++

    if (this.pendingRequests.has(key)) {
      this.metrics.deduplicatedRequests++
      console.log(`🔄 Deduplicated request: ${key}`)
      return this.pendingRequests.get(key)
    }

    const promise = requestFn()
      .finally(() => {
        this.pendingRequests.delete(key)
      })

    this.pendingRequests.set(key, promise)
    return promise
  }

  /**
   * مسح الـ cache
   */
  clearCache(pattern = null) {
    if (!pattern) {
      this.cache.clear()
      console.log('✅ Cache cleared')
      return
    }

    // مسح الـ cache بناءً على النمط
    for (const [key] of this.cache) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }

    console.log(`✅ Cache cleared for pattern: ${pattern}`)
  }

  /**
   * الحصول على إحصائيات الأداء
   */
  getMetrics() {
    const hitRate = this.metrics.totalRequests > 0
      ? ((this.metrics.cacheHits / this.metrics.totalRequests) * 100).toFixed(2)
      : 0

    return {
      ...this.metrics,
      hitRate: `${hitRate}%`,
      pendingRequests: this.pendingRequests.size,
      cachedItems: this.cache.size,
    }
  }

  /**
   * طباعة تقرير الأداء
   */
  printMetrics() {
    const metrics = this.getMetrics()
    console.table(metrics)
  }

  /**
   * تنظيف الموارد
   */
  cleanup() {
    this.cache.clear()
    this.pendingRequests.clear()
    console.log('✅ Performance optimizer cleaned up')
  }
}

// إنشاء instance واحد
export const performanceOptimizer = new PerformanceOptimizer()

export default performanceOptimizer
