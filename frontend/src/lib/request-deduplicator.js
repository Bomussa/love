/**
 * Request Deduplicator - إزالة الطلبات المكررة
 * منع الطلبات المتطابقة من التنفيذ عدة مرات في نفس الوقت
 */

class RequestDeduplicator {
  constructor() {
    this.pendingRequests = new Map();
  }

  /**
   * تنفيذ طلب مع إزالة التكرار
   */
  async deduplicate(key, fn) {
    // إذا كان هناك طلب معلق بنفس المفتاح، انتظر نتيجته
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }

    // إنشاء promise جديد للطلب
    const promise = fn()
      .then(result => {
        this.pendingRequests.delete(key);
        return result;
      })
      .catch(error => {
        this.pendingRequests.delete(key);
        throw error;
      });

    // حفظ الـ promise
    this.pendingRequests.set(key, promise);

    return promise;
  }

  /**
   * الحصول على عدد الطلبات المعلقة
   */
  getPendingCount() {
    return this.pendingRequests.size;
  }

  /**
   * مسح جميع الطلبات المعلقة
   */
  clear() {
    this.pendingRequests.clear();
  }

  /**
   * الحصول على قائمة الطلبات المعلقة
   */
  getPendingKeys() {
    return Array.from(this.pendingRequests.keys());
  }
}

// إنشاء مثيل عام
export const requestDeduplicator = new RequestDeduplicator();

export default RequestDeduplicator;
