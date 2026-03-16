/**
 * Network Status Monitor - مراقب حالة الشبكة
 * مراقبة الاتصال بالإنترنت والتعامل مع حالات الانقطاع
 */

class NetworkStatusMonitor {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = new Set();
    this.lastCheckTime = Date.now();
    this.connectionQuality = 'good'; // good, fair, poor
    this.latency = 0;

    this.setupListeners();
  }

  /**
   * إعداد مستمعي الأحداث
   */
  setupListeners() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // فحص دوري لجودة الاتصال
    this.startPeriodicCheck();
  }

  /**
   * معالج الاتصال بالإنترنت
   */
  handleOnline() {
    this.isOnline = true;
    this.notifyListeners('online');
    console.log('✅ Online');
  }

  /**
   * معالج قطع الاتصال
   */
  handleOffline() {
    this.isOnline = false;
    this.notifyListeners('offline');
    console.log('❌ Offline');
  }

  /**
   * فحص دوري لجودة الاتصال
   */
  startPeriodicCheck() {
    this.checkInterval = setInterval(async () => {
      if (this.isOnline) {
        await this.checkConnectionQuality();
      }
    }, 30000); // كل 30 ثانية
  }

  /**
   * فحص جودة الاتصال
   */
  async checkConnectionQuality() {
    try {
      const startTime = performance.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch('/functions/v1/healthz', {
        method: 'GET',
        cache: 'no-cache',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      this.latency = performance.now() - startTime;

      if (response.ok) {
        if (this.latency < 500) {
          this.connectionQuality = 'good';
        } else if (this.latency < 2000) {
          this.connectionQuality = 'fair';
        } else {
          this.connectionQuality = 'poor';
        }
      }

      this.lastCheckTime = Date.now();
      this.notifyListeners('quality-changed', {
        quality: this.connectionQuality,
        latency: this.latency,
      });
    } catch (error) {
      this.lastCheckTime = Date.now();
      this.connectionQuality = 'poor';
      this.notifyListeners('quality-changed', {
        quality: 'poor',
        error: error.message,
      });
    }
  }


  cleanup() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * إضافة مستمع لتغييرات الحالة
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * إخطار جميع المستمعين
   */
  notifyListeners(event, data = {}) {
    for (const listener of this.listeners) {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error in network status listener:', error);
      }
    }
  }

  /**
   * الحصول على حالة الاتصال
   */
  getStatus() {
    return {
      isOnline: this.isOnline,
      quality: this.connectionQuality,
      latency: this.latency,
      lastCheck: new Date(this.lastCheckTime).toISOString(),
    };
  }

  /**
   * الحصول على وصف حالة الاتصال
   */
  getStatusDescription() {
    if (!this.isOnline) {
      return 'بدون اتصال بالإنترنت';
    }
    switch (this.connectionQuality) {
      case 'good':
        return 'اتصال جيد';
      case 'fair':
        return 'اتصال متوسط';
      case 'poor':
        return 'اتصال ضعيف';
      default:
        return 'حالة غير معروفة';
    }
  }
}

// إنشاء مثيل عام
export const networkStatusMonitor = new NetworkStatusMonitor();

export default NetworkStatusMonitor;
