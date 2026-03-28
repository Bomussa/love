/**
 * Cache Manager - مدير التخزين المؤقت
 * إدارة ذكية للتخزين المؤقت مع الفترات الزمنية والتحقق من الصحة
 */

class CacheManager {
  constructor(options = {}) {
    this.cache = new Map();
    this.timers = new Map();
    this.ttl = options.ttl || 300000; // 5 دقائق افتراضياً
    this.maxSize = options.maxSize || 100; // الحد الأقصى للعناصر
    this.strategy = options.strategy || 'LRU'; // Least Recently Used
  }

  /**
   * حفظ قيمة في الذاكرة المؤقتة
   */
  set(key, value, ttl = this.ttl) {
    // التحقق من حد الحجم الأقصى
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evict();
    }

    // حذف المؤقت السابق إن وجد
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // حفظ القيمة
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0,
    });

    // تعيين مؤقت للحذف التلقائي
    if (ttl > 0) {
      const timer = setTimeout(() => {
        this.delete(key);
      }, ttl);
      this.timers.set(key, timer);
    }
  }

  /**
   * استرجاع قيمة من الذاكرة المؤقتة
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }

    // تحديث إحصائيات الاستخدام
    item.hits++;
    item.timestamp = Date.now();

    return item.value;
  }

  /**
   * التحقق من وجود مفتاح
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * حذف مفتاح من الذاكرة المؤقتة
   */
  delete(key) {
    this.cache.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  /**
   * حذف عنصر عند امتلاء الذاكرة المؤقتة
   */
  evict() {
    if (this.strategy === 'LRU') {
      // حذف الأقل استخداماً مؤخراً
      let lruKey = null;
      let lruTime = Infinity;

      for (const [key, item] of this.cache.entries()) {
        if (item.timestamp < lruTime) {
          lruTime = item.timestamp;
          lruKey = key;
        }
      }

      if (lruKey) {
        this.delete(lruKey);
      }
    } else if (this.strategy === 'FIFO') {
      // حذف الأقدم
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.delete(firstKey);
      }
    }
  }

  /**
   * مسح جميع البيانات المخزنة مؤقتاً
   */
  clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.cache.clear();
    this.timers.clear();
  }

  /**
   * الحصول على إحصائيات الذاكرة المؤقتة
   */
  getStats() {
    let totalHits = 0;
    let totalSize = 0;
    let totalMisses = 0;

    for (const item of this.cache.values()) {
      totalHits += item.hits;
      totalSize += JSON.stringify(item.value).length;
      totalMisses += item.hits === 0 ? 1 : 0;
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalHits,
      totalMisses,
      totalSize: `${(totalSize / 1024).toFixed(2)} KB`,
      hitRate: this.cache.size > 0 ? ((totalHits / (totalHits + totalMisses)) * 100).toFixed(2) + '%' : '0%',
    };
  }

  /**
   * طباعة إحصائيات الذاكرة المؤقتة
   */
  printStats() {
    console.table(this.getStats());
  }
}

// إنشاء مثيلات للذاكرة المؤقتة المختلفة
export const apiCache = new CacheManager({
  ttl: 300000, // 5 دقائق
  maxSize: 50,
});

export const dataCache = new CacheManager({
  ttl: 600000, // 10 دقائق
  maxSize: 100,
});

export const userCache = new CacheManager({
  ttl: 1800000, // 30 دقيقة
  maxSize: 20,
});

export default CacheManager;
