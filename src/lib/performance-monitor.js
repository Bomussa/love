/**
 * Performance Monitor - مراقب الأداء المتقدم
 * يراقب أداء التطبيق ويسجل المقاييس المهمة
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.thresholds = {
      apiCall: 3000, // 3 ثوانٍ
      rendering: 1000, // 1 ثانية
      dataFetch: 5000, // 5 ثوانٍ
    };
  }

  /**
   * قياس وقت تنفيذ دالة
   */
  async measureAsync(name, fn, category = 'general') {
    const startTime = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, category);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, category, true);
      throw error;
    }
  }

  /**
   * قياس وقت تنفيذ دالة متزامنة
   */
  measureSync(name, fn, category = 'general') {
    const startTime = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, category);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, category, true);
      throw error;
    }
  }

  /**
   * تسجيل مقياس الأداء
   */
  recordMetric(name, duration, category = 'general', isError = false) {
    const key = `${category}:${name}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        name,
        category,
        measurements: [],
        errors: 0,
        warnings: 0,
      });
    }

    const metric = this.metrics.get(key);
    metric.measurements.push(duration);

    if (isError) {
      metric.errors++;
    }

    // تحذير إذا تجاوز الحد الأقصى
    const threshold = this.thresholds[category] || 5000;
    if (duration > threshold) {
      metric.warnings++;
      console.warn(`⚠️ Performance Warning: ${name} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`);
    }

    // الاحتفاظ بآخر 100 قياس فقط
    if (metric.measurements.length > 100) {
      metric.measurements.shift();
    }
  }

  /**
   * الحصول على إحصائيات المقياس
   */
  getMetricStats(name, category = 'general') {
    const key = `${category}:${name}`;
    const metric = this.metrics.get(key);

    if (!metric || metric.measurements.length === 0) {
      return null;
    }

    const measurements = metric.measurements;
    const sum = measurements.reduce((a, b) => a + b, 0);
    const avg = sum / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);

    return {
      name,
      category,
      count: measurements.length,
      avg: avg.toFixed(2),
      min: min.toFixed(2),
      max: max.toFixed(2),
      errors: metric.errors,
      warnings: metric.warnings,
    };
  }

  /**
   * الحصول على جميع الإحصائيات
   */
  getAllStats() {
    const stats = [];
    for (const [key, metric] of this.metrics.entries()) {
      if (metric.measurements.length > 0) {
        stats.push(this.getMetricStats(metric.name, metric.category));
      }
    }
    return stats;
  }

  /**
   * طباعة تقرير الأداء
   */
  printReport() {
    console.group('📊 Performance Report');
    const stats = this.getAllStats();
    
    if (stats.length === 0) {
      console.log('No metrics recorded yet');
      console.groupEnd();
      return;
    }

    // تجميع حسب الفئة
    const byCategory = {};
    stats.forEach(stat => {
      if (!byCategory[stat.category]) {
        byCategory[stat.category] = [];
      }
      byCategory[stat.category].push(stat);
    });

    // طباعة كل فئة
    for (const [category, categoryStats] of Object.entries(byCategory)) {
      console.group(`📈 ${category}`);
      console.table(categoryStats);
      console.groupEnd();
    }

    console.groupEnd();
  }

  /**
   * إعادة تعيين جميع المقاييس
   */
  reset() {
    this.metrics.clear();
  }

  /**
   * تصدير البيانات كـ JSON
   */
  export() {
    return JSON.stringify(Array.from(this.metrics.entries()), null, 2);
  }
}

// إنشاء مثيل عام من المراقب
export const performanceMonitor = new PerformanceMonitor();

// تصدير الفئة للاستخدام المتقدم
export default PerformanceMonitor;
