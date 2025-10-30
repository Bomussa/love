// Data Consistency Module
// يضمن تناسق البيانات بين Frontend و Backend

class DataConsistency {
  constructor() {
    this.cache = new Map()
    this.cacheTimeout = 30000 // 30 ثانية
    this.pendingUpdates = new Map()
  }

  /**
   * الحصول على بيانات مع cache
   */
  async get(key, fetchFn) {
    const cached = this.cache.get(key)
    
    // التحقق من صلاحية Cache
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log(`📦 Cache HIT: ${key}`)
      return cached.data
    }

    // Fetch من Backend
    console.log(`🌐 Cache MISS: ${key} - fetching from backend`)
    try {
      const data = await fetchFn()
      this.set(key, data)
      return data
    } catch (error) {
      // إذا فشل Fetch، استخدم Cache القديم إن وجد
      if (cached) {
        console.warn(`⚠️ Using stale cache for ${key}`)
        return cached.data
      }
      throw error
    }
  }

  /**
   * حفظ بيانات في Cache
   */
  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  /**
   * حذف بيانات من Cache (Invalidation)
   */
  invalidate(key) {
    if (key) {
      console.log(`🗑️ Cache invalidated: ${key}`)
      this.cache.delete(key)
    } else {
      console.log(`🗑️ All cache invalidated`)
      this.cache.clear()
    }
  }

  /**
   * Optimistic Update مع Rollback
   */
  async optimisticUpdate(key, updateFn, rollbackData) {
    // حفظ البيانات الحالية للـ Rollback
    const currentData = this.cache.get(key)?.data || rollbackData
    
    // تطبيق التحديث فوراً في UI
    this.set(key, rollbackData)
    this.pendingUpdates.set(key, true)

    try {
      // إرسال التحديث للـ Backend
      const newData = await updateFn()
      
      // تحديث Cache بالبيانات الجديدة
      this.set(key, newData)
      this.pendingUpdates.delete(key)
      
      console.log(`✅ Optimistic update succeeded: ${key}`)
      return newData
    } catch (error) {
      // Rollback في حالة الفشل
      console.error(`❌ Optimistic update failed: ${key} - rolling back`)
      this.set(key, currentData)
      this.pendingUpdates.delete(key)
      throw error
    }
  }

  /**
   * التحقق من وجود تحديثات معلقة
   */
  hasPendingUpdates(key) {
    return this.pendingUpdates.has(key)
  }

  /**
   * مزامنة البيانات مع Backend
   */
  async sync(keys, fetchFns) {
    console.log(`🔄 Syncing ${keys.length} keys...`)
    
    const results = await Promise.allSettled(
      keys.map(async (key, index) => {
        try {
          const data = await fetchFns[index]()
          this.set(key, data)
          return { key, success: true }
        } catch (error) {
          console.error(`Failed to sync ${key}:`, error)
          return { key, success: false, error }
        }
      })
    )

    const succeeded = results.filter(r => r.value?.success).length
    const failed = results.length - succeeded
    
    console.log(`✅ Sync complete: ${succeeded} succeeded, ${failed} failed`)
    return results
  }

  /**
   * حذف Cache القديم
   */
  cleanup() {
    const now = Date.now()
    let cleaned = 0
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key)
        cleaned++
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} stale cache entries`)
    }
  }

  /**
   * الحصول على إحصائيات Cache
   */
  getStats() {
    return {
      size: this.cache.size,
      pendingUpdates: this.pendingUpdates.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

// Singleton instance
const dataConsistency = new DataConsistency()

// Cleanup كل 5 دقائق
if (typeof window !== 'undefined') {
  setInterval(() => dataConsistency.cleanup(), 5 * 60 * 1000)
}

export default dataConsistency
